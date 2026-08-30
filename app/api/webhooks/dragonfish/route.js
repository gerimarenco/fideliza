import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Entidades de Dragon Fish que representan un comprobante de venta. Zoo
// Logic confirmó que /facturagrupada/{Codigo} en su API REST local devuelve
// los datos de cualquiera de las tres (no hace falta pedir a cada endpoint
// específico por separado), pero igual guardamos qué Entidad mandó el
// webhook para poder inspeccionarlo si algo no calza.
const ENTIDADES_FACTURA = ['FACTURA', 'FACTURAELECTRONICA', 'TICKETFACTURA', 'FACTURAAGRUPADA'];

export async function POST(request) {
  try {
    const body = await request.json();

    console.log('Webhook Dragon Fish recibido:', JSON.stringify(body));

    const { Entidad, Codigo, Fecha, Hora, BaseDeDatos } = body;

    if (!Entidad || !ENTIDADES_FACTURA.includes(Entidad.toUpperCase())) {
      // Dragon Fish también manda webhooks de otras entidades (artículos,
      // clientes, etc.) que no nos interesan acá.
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (!Codigo || !BaseDeDatos) {
      console.error('Webhook Dragon Fish: falta Codigo o BaseDeDatos', body);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const negocio = await prisma.negocio.findUnique({
      where: { dragonfishBaseDeDatos: BaseDeDatos },
    });

    if (!negocio) {
      console.error('Webhook Dragon Fish: no hay negocio configurado para BaseDeDatos', BaseDeDatos);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // No resolvemos la factura acá: solo dejamos la fila pendiente para que
    // el agente local (que sí puede llegar a la API REST de Dragon Fish,
    // corriendo en la PC del negocio) la levante por polling, la resuelva
    // contra Dragon Fish, y reporte el resultado a POST /api/dragonfish/resolver.
    try {
      await prisma.facturaPendiente.create({
        data: { negocioId: negocio.id, codigo: Codigo, entidad: Entidad, fecha: Fecha || '', hora: Hora || '' },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('Webhook Dragon Fish: código ya registrado, se ignora el reenvío', Codigo);
        return NextResponse.json({ received: true, duplicado: true }, { status: 200 });
      }
      throw error;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error en webhook de Dragon Fish:', error);
    // Igual que con Mercado Pago y Tiendanube, respondemos 200 para que
    // Dragon Fish no reintente en loop si algo falla de nuestro lado.
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
