import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'cliente') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { negocioSlug, monto } = await request.json();
    // El cliente siempre paga y suma puntos para sí mismo, nunca para otro.
    const clienteId = session.user.id;

    if (!negocioSlug || !monto) {
      return NextResponse.json(
        { error: 'Faltan datos: negocioSlug y monto son obligatorios.' },
        { status: 400 }
      );
    }

    const negocio = await prisma.negocio.findUnique({
      where: { slug: negocioSlug },
    });

    if (!negocio) {
      return NextResponse.json(
        { error: 'Negocio no encontrado.' },
        { status: 404 }
      );
    }

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente || cliente.negocioId !== negocio.id) {
      return NextResponse.json(
        { error: 'El cliente no pertenece a este negocio.' },
        { status: 403 }
      );
    }

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            title: `Compra en ${negocio.nombre}`,
            quantity: 1,
            unit_price: Number(monto),
            currency_id: 'ARS',
          },
        ],
        metadata: {
          negocio_id: negocio.id,
          cliente_id: clienteId,
          monto: Number(monto),
        },
        notification_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_BASE_URL}/pago-exitoso`,
          failure: `${process.env.NEXT_PUBLIC_BASE_URL}/pago-fallido`,
          pending: `${process.env.NEXT_PUBLIC_BASE_URL}/pago-pendiente`,
        },
        auto_return: 'approved',
      },
    });

    return NextResponse.json(
        { init_point: result.sandbox_init_point || result.init_point },
        { status: 200 }
      );
  } catch (error) {
    console.error('Error al crear preferencia de MP:', error);
    return NextResponse.json(
      { error: 'Error al generar el link de pago.' },
      { status: 500 }
    );
  }
}