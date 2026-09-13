import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma } from '@/lib/db';
import { enviarEmailPuntosAcreditados } from '@/lib/email';
import { verificarFirmaMercadoPago } from '@/lib/webhookSignature';
import { calcularPuntosPorCompra } from '@/lib/puntos';
import { acreditarSiEsPrimeraCompraReferida } from '@/lib/referidos';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

export async function POST(request) {
  try {
    const body = await request.json();

    // Mercado Pago manda distintos tipos de notificación, solo nos interesan los pagos
    if (body.type !== 'payment') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentId = body.data.id;

    // El id para la firma sale del query string de la URL del webhook
    // (`data.id`), no del body -- son cosas distintas aunque casi siempre
    // coincidan en valor, y así lo arma Mercado Pago de su lado para
    // calcular la firma. Si no viniera en el query, se saca del manifest
    // en vez de reemplazarlo por el del body (mismo criterio que
    // x-request-id, ver lib/webhookSignature.js).
    const dataIdDeQuery = new URL(request.url).searchParams.get('data.id');
    const { verificable, valido } = verificarFirmaMercadoPago({
      xSignature: request.headers.get('x-signature'),
      xRequestId: request.headers.get('x-request-id'),
      dataId: dataIdDeQuery,
      secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    });
    if (verificable && !valido) {
      console.error('Webhook MP: firma x-signature inválida, se rechaza');
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    const payment = new Payment(client);
    const paymentInfo = await payment.get({ id: paymentId });

    // Solo sumamos puntos si el pago está efectivamente aprobado
    if (paymentInfo.status !== 'approved') {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const { cliente_id, negocio_id, monto } = paymentInfo.metadata || {};

    if (!cliente_id || !negocio_id || !monto) {
      console.error('Webhook MP: faltan metadata en el pago', paymentInfo.metadata);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const negocio = await prisma.negocio.findUnique({
      where: { id: negocio_id },
    });

    // Un negocio desactivado (ver app/api/negocios) no debería seguir
    // acreditando puntos por esta vía, aunque el pago se haya generado con
    // una preferencia creada antes de desactivarlo.
    if (negocio && !negocio.activo) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const puntosXPeso = negocio?.puntosXPeso || 1000;
    const puntosASumar = calcularPuntosPorCompra(Number(monto), puntosXPeso);

    // Se necesita el cliente completo (no solo su id) para saber si fue
    // referido por alguien -- acreditarSiEsPrimeraCompraReferida lo
    // necesita antes de entrar a la transacción.
    const clienteExistente = await prisma.cliente.findUnique({ where: { id: cliente_id } });

    // Marcar el pago como procesado y sumar los puntos en una sola
    // transacción: si MP reenvía la misma notificación, la restricción
    // única de WebhookEvento hace fallar la transacción entera (P2002) y
    // no se suman los puntos una segunda vez.
    let clienteActualizado, referido;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.webhookEvento.create({
          data: { proveedor: 'mercadopago', referenciaExterna: String(paymentId) },
        });
        clienteActualizado = await tx.cliente.update({
          where: { id: cliente_id },
          data: { puntos: { increment: puntosASumar } },
        });
        await tx.movimientoPuntos.create({
          data: { clienteId: cliente_id, negocioId: negocio_id, puntos: puntosASumar, origen: 'mercadopago', saldoRestante: puntosASumar },
        });
        // El programa de referidos vive en Negocio.puntosReferido -- sin
        // negocio real (metadata con un negocio_id que ya no existe) no
        // hay nada que consultar.
        if (negocio && clienteExistente) {
          referido = await acreditarSiEsPrimeraCompraReferida(tx, clienteExistente, negocio);
        }
      });
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('Webhook MP: pago ya procesado, se ignora el reenvío', paymentId);
        return NextResponse.json({ received: true, duplicado: true }, { status: 200 });
      }
      throw error;
    }

    // negocioId no tiene FK a Negocio (es denormalizado, ver schema) — si la
    // metadata trae un negocio_id que ya no existe, los puntos se acreditan
    // igual pero no hay nombre real para el mail: mejor no mandarlo con
    // "undefined" que mandar uno roto.
    if (negocio) {
      // Si esta fue la primera compra de una clienta referida, su saldo
      // final quedó desactualizado -- se le pagó el bono después de
      // leerlo, dentro de la misma transacción.
      const puntosTotalesFinales = referido
        ? (await prisma.cliente.findUnique({ where: { id: cliente_id }, select: { puntos: true } })).puntos
        : clienteActualizado.puntos;

      await enviarEmailPuntosAcreditados({
        email: clienteActualizado.email,
        puntosAcreditados: puntosASumar,
        puntosTotales: puntosTotalesFinales,
        negocioNombre: negocio.nombre,
      });

      if (referido) {
        await enviarEmailPuntosAcreditados({
          email: referido.invitadorEmail,
          puntosAcreditados: referido.puntos,
          puntosTotales: referido.invitadorPuntosTotales,
          negocioNombre: negocio.nombre,
        });
      }
    } else {
      console.error('Webhook MP: negocio_id de la metadata no existe, no se manda el mail de puntos', negocio_id);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error en webhook de Mercado Pago:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}