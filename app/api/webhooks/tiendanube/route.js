import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { enviarEmailPuntosAcreditados } from '@/lib/email'
import { verificarFirmaTiendanube } from '@/lib/webhookSignature'
import { obtenerOrden } from '@/lib/tiendanube'
import { marcarCuponesDeOrden } from '@/lib/sincronizarCupones'
import { procesarOrden, registrarError } from '@/lib/acreditacionTiendanube'

// Aviso "order/paid" de Tiendanube. Trae solo { store_id, event, id }: la
// orden se pide a la API y se procesa con lib/acreditacionTiendanube.js (la
// misma lógica que la conciliación programada y el script de recuperación).
// Cada orden queda registrada en OrdenTiendanube con su resultado; los
// errores temporales responden 500 para que Tiendanube reintente (hasta 18
// veces en 48 horas) y además los retoma la conciliación. Los reenvíos no
// duplican puntos (WebhookEvento).

export async function POST(request) {
  // La firma se calcula sobre los bytes tal cual llegaron (ver lib/webhookSignature.js).
  const rawBodyBuffer = Buffer.from(await request.arrayBuffer())
  const { verificable, valido } = verificarFirmaTiendanube(
    rawBodyBuffer,
    request.headers.get('x-linkedstore-hmac-sha256'),
    process.env.TIENDANUBE_CLIENT_SECRET
  )
  let body
  try {
    body = JSON.parse(rawBodyBuffer.toString('utf8'))
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  if (verificable && !valido) {
    // Si esto aparece con compras reales, la clave de la app no coincide con
    // la que firma los avisos (ver docs/lanzamiento/acreditacion-tiendanube.md).
    console.error('Webhook Tiendanube: firma HMAC inválida, se rechaza', { storeId: body?.store_id, evento: body?.event, orden: body?.id })
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  if (body?.event !== 'order/paid') return NextResponse.json({ message: 'Evento ignorado' })
  const storeId = body.store_id
  const orderId = body.id
  if (!storeId || !orderId) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

  let negocio
  try {
    negocio = await prisma.negocio.findUnique({ where: { tiendanubeStoreId: String(storeId) } })
  } catch (error) {
    console.error('Webhook Tiendanube: error de base al buscar el negocio', storeId, error.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
  if (!negocio || !negocio.tiendanubeAccessToken) {
    console.error('Webhook Tiendanube: no hay negocio configurado para store_id', storeId)
    return NextResponse.json({ message: 'Negocio no configurado' })
  }
  // Un negocio desactivado no acredita por esta vía.
  if (!negocio.activo) return NextResponse.json({ message: 'Negocio desactivado' })

  let orden
  try {
    orden = await obtenerOrden(negocio, orderId)
  } catch (error) {
    console.error('Webhook Tiendanube: no se pudo leer la orden', { negocioId: negocio.id, orderId, error: error.message })
    await registrarError(prisma, negocio.id, orderId, 'webhook', error).catch(() => {})
    return NextResponse.json({ error: 'No se pudo leer la orden' }, { status: 500 })
  }

  // Cupones de canje de Retornar usados en la orden: quedan "utilizados".
  // Nunca frena la acreditación.
  if (orden?.payment_status === 'paid' && orden?.status !== 'cancelled') {
    try {
      await marcarCuponesDeOrden(negocio, orden)
    } catch (error) {
      console.error('Webhook Tiendanube: no se pudo registrar el uso de cupones de la orden', orderId, error.message)
    }
  }

  let r
  try {
    r = await procesarOrden(prisma, negocio, { ...orden, id: orden?.id ?? orderId }, { via: 'webhook' })
  } catch (error) {
    console.error('Webhook Tiendanube: error al acreditar', { negocioId: negocio.id, orderId, error: error.message })
    await registrarError(prisma, negocio.id, orderId, 'webhook', error).catch(() => {})
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
  console.log('Webhook Tiendanube: orden procesada', { negocioId: negocio.id, orderId, estado: r.estado, motivo: r.motivo, puntos: r.puntos })

  // Todavía no figura pagada en la API (puede tardar unos segundos): error
  // para que Tiendanube la reenvíe; la conciliación también la retoma.
  if (r.estado === 'pendiente_pago') return NextResponse.json({ message: 'La orden todavía no figura como pagada' }, { status: 409 })
  if (r.estado !== 'acreditada' || r.duplicada) return NextResponse.json({ success: true, estado: r.estado, duplicado: r.duplicada || undefined })

  await avisarPorMail(negocio, r)
  return NextResponse.json({ success: true, puntosAcreditados: r.puntos })
}

// Los mails nunca deshacen ni repiten una acreditación.
async function avisarPorMail(negocio, r) {
  try {
    await enviarEmailPuntosAcreditados({ email: r.cliente.email, puntosAcreditados: r.puntos, puntosTotales: r.puntosTotales, negocioNombre: negocio.nombre, negocioId: negocio.id })
    if (r.referido) {
      await enviarEmailPuntosAcreditados({ email: r.referido.invitadorEmail, motivo: 'referido', puntosAcreditados: r.referido.puntos, puntosTotales: r.referido.invitadorPuntosTotales, negocioNombre: negocio.nombre, negocioId: negocio.id })
    }
  } catch (error) {
    console.error('Webhook Tiendanube: puntos acreditados, pero no se pudo mandar el mail', { negocioId: negocio.id, error: error.message })
  }
}
