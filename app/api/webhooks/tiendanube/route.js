import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { enviarEmailPuntosAcreditados } from '@/lib/email'
import { verificarFirmaTiendanube } from '@/lib/webhookSignature'
import { calcularPuntosPorCompra } from '@/lib/puntos'
import { acreditarSiEsPrimeraCompraReferida } from '@/lib/referidos'

// Tiendanube manda un payload liviano (store_id, event, id de la orden), no la
// orden completa. Hay que pedirla a la API con el access_token del negocio.
async function obtenerOrden(storeId, orderId, accessToken) {
  const response = await fetch(`https://api.tiendanube.com/2025-03/${storeId}/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Retornar (soporte@retornar.com.ar)',
    },
  })

  if (!response.ok) {
    throw new Error(`Tiendanube API respondió ${response.status} al pedir la orden ${orderId}`)
  }

  return response.json()
}

export async function POST(request) {
  try {
    // Se lee como bytes crudos primero (ni request.json() ni request.text()):
    // la firma de Tiendanube se calcula sobre los bytes tal cual llegaron, y
    // request.text() los decodifica como UTF-8 antes de dárnoslos -- para
    // JSON eso casi siempre da los mismos bytes de vuelta, pero "casi
    // siempre" no alcanza para algo que compara un hash byte a byte: alcanza
    // con una sola entrega real con una codificación distinta para que la
    // firma calculada no coincida nunca más con la que manda Tiendanube, y
    // se empiecen a rechazar pedidos reales sin que nadie se entere hasta
    // que una clienta se queje de que no le sumó los puntos.
    const rawBodyBuffer = Buffer.from(await request.arrayBuffer())
    const { verificable, valido } = verificarFirmaTiendanube(
      rawBodyBuffer,
      request.headers.get('x-linkedstore-hmac-sha256'),
      process.env.TIENDANUBE_CLIENT_SECRET
    )
    if (verificable && !valido) {
      console.error('Webhook Tiendanube: firma HMAC inválida, se rechaza')
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
    }

    const body = JSON.parse(rawBodyBuffer.toString('utf8'))

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

    // Un negocio desactivado (ver app/api/negocios) no debería seguir
    // acreditando puntos por esta vía, aunque Tiendanube siga mandando el
    // webhook de una tienda que ya no está en uso en Retornar.
    if (!negocio.activo) {
      return NextResponse.json({ message: 'Negocio desactivado' }, { status: 200 })
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
      return NextResponse.json({ message: 'Cliente no registrado en Retornar' }, { status: 200 })
    }

    // Calcular y sumar los puntos
    const puntos = calcularPuntosPorCompra(total, negocio.puntosXPeso)

    // Misma protección de idempotencia que Mercado Pago: si Tiendanube
    // reenvía el mismo webhook, la restricción única de WebhookEvento hace
    // fallar la transacción entera (P2002) y no se suman los puntos de nuevo.
    // referenciaExterna incluye el storeId porque el orderId de Tiendanube
    // solo es único dentro de una tienda, no entre negocios distintos.
    let clienteActualizado, referido
    try {
      await prisma.$transaction(async (tx) => {
        await tx.webhookEvento.create({
          data: { proveedor: 'tiendanube', referenciaExterna: `${storeId}:${orderId}` },
        })
        clienteActualizado = await tx.cliente.update({
          where: { id: cliente.id },
          data: { puntos: { increment: puntos } },
        })
        await tx.movimientoPuntos.create({
          data: { clienteId: cliente.id, negocioId: negocio.id, puntos, origen: 'tiendanube', saldoRestante: puntos },
        })
        referido = await acreditarSiEsPrimeraCompraReferida(tx, cliente, negocio)
      })
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('Webhook Tiendanube: orden ya procesada, se ignora el reenvío', orderId)
        return NextResponse.json({ success: true, duplicado: true })
      }
      throw error
    }

    // Si esta fue la primera compra de una clienta referida, su saldo final
    // quedó desactualizado -- se le pagó el bono después de leerlo, dentro
    // de la misma transacción.
    const puntosTotalesFinales = referido
      ? (await prisma.cliente.findUnique({ where: { id: cliente.id }, select: { puntos: true } })).puntos
      : clienteActualizado.puntos

    await enviarEmailPuntosAcreditados({
      email: clienteActualizado.email,
      puntosAcreditados: puntos,
      puntosTotales: puntosTotalesFinales,
      negocioNombre: negocio.nombre,
    })

    if (referido) {
      await enviarEmailPuntosAcreditados({
        email: referido.invitadorEmail,
        puntosAcreditados: referido.puntos,
        puntosTotales: referido.invitadorPuntosTotales,
        negocioNombre: negocio.nombre,
      })
    }

    return NextResponse.json({ success: true, puntosAcreditados: puntos })
  } catch (error) {
    console.error('Webhook Tiendanube error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}