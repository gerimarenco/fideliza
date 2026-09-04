import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { enviarEmailPuntosAcreditados } from '@/lib/email'

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

    // Misma protección de idempotencia que Mercado Pago: si Tiendanube
    // reenvía el mismo webhook, la restricción única de WebhookEvento hace
    // fallar la transacción entera (P2002) y no se suman los puntos de nuevo.
    // referenciaExterna incluye el storeId porque el orderId de Tiendanube
    // solo es único dentro de una tienda, no entre negocios distintos.
    let clienteActualizado
    try {
      [, clienteActualizado] = await prisma.$transaction([
        prisma.webhookEvento.create({
          data: { proveedor: 'tiendanube', referenciaExterna: `${storeId}:${orderId}` },
        }),
        prisma.cliente.update({
          where: { id: cliente.id },
          data: { puntos: { increment: puntos } },
        }),
        prisma.movimientoPuntos.create({
          data: { clienteId: cliente.id, negocioId: negocio.id, puntos, origen: 'tiendanube' },
        }),
      ])
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('Webhook Tiendanube: orden ya procesada, se ignora el reenvío', orderId)
        return NextResponse.json({ success: true, duplicado: true })
      }
      throw error
    }

    await enviarEmailPuntosAcreditados({
      email: clienteActualizado.email,
      puntosAcreditados: puntos,
      puntosTotales: clienteActualizado.puntos,
      negocioNombre: negocio.nombre,
    })

    return NextResponse.json({ success: true, puntosAcreditados: puntos })
  } catch (error) {
    console.error('Webhook Tiendanube error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}