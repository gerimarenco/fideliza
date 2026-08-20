import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();

    // TEMPORAL: mientras no sabemos el formato exacto que manda Dragon Fish,
    // logueamos todo lo que llega para poder inspeccionarlo en los logs de Netlify.
    console.log('Webhook Dragon Fish recibido:', JSON.stringify(body, null, 2));

    // --- A completar una vez que veamos el formato real ---
    // Idea general: Dragon Fish debería mandar algo como los datos de la
    // factura de venta (cliente, monto, items). Con eso:
    //
    // 1. Identificar al cliente (por DNI, teléfono o email, según lo que mande).
    // 2. Buscarlo en la base de Fideliza:
    //    const cliente = await prisma.cliente.findFirst({ where: { ... } });
    //
    // 3. Si existe, calcular y sumar los puntos:
    //    const negocio = await prisma.negocio.findUnique({ where: { id: cliente.negocioId } });
    //    const puntosASumar = Math.floor(monto / (negocio.puntosXPeso || 1000));
    //    await prisma.cliente.update({
    //      where: { id: cliente.id },
    //      data: { puntos: { increment: puntosASumar } },
    //    });
    //
    // 4. Si no existe el cliente, no hacer nada (o loguear para revisar).

    // Por ahora respondemos OK para confirmar que el webhook llega bien.
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error en webhook de Dragon Fish:', error);
    // Igual que con Mercado Pago, respondemos 200 para que Dragon Fish
    // no reintente en loop si algo falla de nuestro lado.
    return NextResponse.json({ received: true }, { status: 200 });
  }
}