import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { prisma } from '@/lib/db';

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

    const puntosXPeso = negocio?.puntosXPeso || 1000;
    const puntosASumar = Math.floor(Number(monto) / puntosXPeso);

    // Marcar el pago como procesado y sumar los puntos en una sola
    // transacción: si MP reenvía la misma notificación, la restricción
    // única de WebhookEvento hace fallar la transacción entera (P2002) y
    // no se suman los puntos una segunda vez.
    try {
      await prisma.$transaction([
        prisma.webhookEvento.create({
          data: { proveedor: 'mercadopago', referenciaExterna: String(paymentId) },
        }),
        prisma.cliente.update({
          where: { id: cliente_id },
          data: { puntos: { increment: puntosASumar } },
        }),
      ]);
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('Webhook MP: pago ya procesado, se ignora el reenvío', paymentId);
        return NextResponse.json({ received: true, duplicado: true }, { status: 200 });
      }
      throw error;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error en webhook de Mercado Pago:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}