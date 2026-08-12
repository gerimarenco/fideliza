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

    // Evitar sumar puntos dos veces si MP reenvía la misma notificación
    const negocio = await prisma.negocio.findUnique({
      where: { id: negocio_id },
    });

    const puntosXPeso = negocio?.puntosXPeso || 1000;
    const puntosASumar = Math.floor(Number(monto) / puntosXPeso);

    await prisma.cliente.update({
      where: { id: cliente_id },
      data: {
        puntos: { increment: puntosASumar },
      },
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error en webhook de Mercado Pago:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}