import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Tiendanube manda un payload liviano (store_id, event, id de la orden), no la
// orden completa. Hay que pedirla a la API con el access_token del negocio.
async function obtenerOrden(storeId, orderId, accessToken) {
  const response = await fetch(`https://api.tiendanube.com/2025-03/${storeId}/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Fideliza (soporte@fideliza.app)',
    },
  })

  if (!response.ok) {
    throw new Error(`Tiendanube API respondió ${response.status} al pedir la orden ${orderId}`)
  }

  return response.json()
}

export async function POST(request) {
  try {
    const body = await request.json()

    if (body.event !== 'order/paid') {
      return NextResponse.json({ message: 'Evento ignorado' })
    }

    const storeId = body.store_id
    const orderId = body.id

    if (!storeId || !orderId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const negocio = await prisma.negocio.findUnique({
      where: { tiendanubeStoreId: String(storeId) },
    })

    if (!negocio || !negocio.tiendanubeAccessToken) {
      console.error('Webhook Tiendanube: no hay negocio configurado para store_id', storeId)
      return NextResponse.json({ message: 'Negocio no configurado' }, { status: 200 })
    }

    const orden = await obtenerOrden(storeId, orderId, negocio.tiendanubeAccessToken)
    const email = orden.contact_email?.trim().toLowerCase()
    const total = parseFloat(orden.total)

    if (!email || !Number.isFinite(total)) {
      console.error('Webhook Tiendanube: la orden no trae email o total válidos', { orderId, email, total: orden.total })
      return NextResponse.json({ message: 'Datos de la orden incompletos' }, { status: 200 })
    }

    // Buscar el cliente por email
    const cliente = await prisma.cliente.findFirst({
      where: { email, negocioId: negocio.id },
    })

    if (!cliente) {
      return NextResponse.json({ message: 'Cliente no registrado en Fideliza' }, { status: 200 })
    }

    // Calcular y sumar los puntos
    const puntos = Math.floor(total / negocio.puntosXPeso)

    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { puntos: { increment: puntos } },
    })

    return NextResponse.json({ success: true, puntosAcreditados: puntos })
  } catch (error) {
    console.error('Webhook Tiendanube error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}