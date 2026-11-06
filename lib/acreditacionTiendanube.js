// Acreditación de puntos por compras de Tiendanube: una sola lógica para las
// tres puertas por las que llega una orden (el webhook "order/paid", la
// conciliación programada y el script de recuperación), así se comportan
// igual y ninguna compra queda sin rastro.
//
// 1. clasificarOrden: ¿la orden se puede acreditar? (pagada, no cancelada ni
//    reembolsada, con total). Las pendientes de pago se vuelven a revisar.
// 2. buscarClientaDeOrden: la cuenta del negocio por el email de contacto o el
//    de la cuenta de la tienda (sin distinguir mayúsculas ni espacios) y, si
//    no aparece, por celular (solo si una única cuenta lo tiene).
// 3. procesarOrden: acredita una sola vez (WebhookEvento "<storeId>:<orderId>",
//    la misma clave de siempre) y deja el resultado en OrdenTiendanube.
//
// Reglas que no cambian: los puntos salen de Negocio.puntosXPeso; no se crean
// cuentas solas; una compra pagada antes de que exista la cuenta no suma
// (igual que Dragon Fish: "sus próximas compras sí").
import { calcularPuntosPorCompra } from './puntos.js'
import { acreditarSiEsPrimeraCompraReferida } from './referidos.js'
import { normalizarEmail, ocultarEmail } from './identidad.js'
import { mismoCelular } from './bienvenida.js'

export const ESTADOS_FINALES = ['acreditada', 'cuenta_posterior', 'cancelada', 'reembolsada', 'sin_puntos', 'incompleta']
// Se vuelven a revisar (conciliación): puede pagarse, corregirse el email de
// la cuenta o pasar el error temporal.
export const ESTADOS_A_REVISAR = ['pendiente_pago', 'sin_cliente', 'error']

const PENDIENTES = new Set(['pending', 'authorized', 'in_process', 'partially_paid'])
const ANULADOS = new Set(['refunded', 'voided', 'abandoned', 'partially_refunded', 'rejected'])

function fecha(valor) {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

// Qué se puede hacer con la orden, mirando la orden real pedida a la API.
export function clasificarOrden(orden) {
  const pago = String(orden?.payment_status || '').toLowerCase()
  if (orden?.status === 'cancelled') return { estado: 'cancelada' }
  if (ANULADOS.has(pago)) return { estado: 'reembolsada', motivo: pago }
  if (pago !== 'paid') return { estado: 'pendiente_pago', motivo: pago || 'sin_estado' }
  const total = parseFloat(orden.total)
  if (!Number.isFinite(total) || total < 0) return { estado: 'incompleta', motivo: 'total' }
  return { estado: 'pagada', total, pagadaEn: fecha(orden.paid_at) || fecha(orden.created_at) }
}

// Emails de la orden, normalizados y sin repetir: el de contacto (el que se
// escribe en el checkout) y el de la cuenta de la tienda, que pueden diferir.
export function emailsDeOrden(orden) {
  const lista = [orden?.contact_email, orden?.customer?.email, orden?.billing_email].map(normalizarEmail).filter((e) => e.includes('@'))
  return [...new Set(lista)]
}

export function celularesDeOrden(orden) {
  const lista = [orden?.contact_phone, orden?.customer?.phone, orden?.billing_phone, orden?.shipping_address?.phone, orden?.customer?.billing_phone]
    .map((t) => (t == null ? '' : String(t).trim()))
    .filter((t) => t.replace(/\D/g, '').length >= 8)
  return [...new Set(lista)]
}

// La cuenta de la clienta en ESTE negocio. Email primero (comparando sin
// mayúsculas ni espacios alrededor, también para cuentas viejas guardadas
// "tal cual se tipearon"); si no, celular, solo si una única cuenta coincide
// (dos cuentas con el mismo celular → no se adivina).
export async function buscarClientaDeOrden(db, negocioId, orden) {
  const emails = emailsDeOrden(orden)
  if (emails.length) {
    const filas = await db.$queryRaw`
      SELECT id FROM "Cliente"
      WHERE "negocioId" = ${negocioId} AND lower(btrim(email)) = ANY(${emails})
      ORDER BY "createdAt" ASC, id ASC`
    if (filas.length) {
      const porEmail = new Map()
      for (const f of filas) {
        const c = await db.cliente.findUnique({ where: { id: f.id } })
        if (c) porEmail.set(normalizarEmail(c.email), c)
      }
      // Preferencia: el email de contacto de la orden, después el de la cuenta de la tienda.
      for (const e of emails) if (porEmail.has(e)) return { cliente: porEmail.get(e), por: 'email' }
    }
  }
  for (const celular of celularesDeOrden(orden)) {
    const cola = celular.replace(/\D/g, '').slice(-6)
    const candidatas = await db.$queryRaw`
      SELECT id, telefono FROM "Cliente"
      WHERE "negocioId" = ${negocioId}
        AND right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 6) = ${cola}`
    const coinciden = candidatas.filter((c) => mismoCelular(c.telefono, celular))
    if (coinciden.length === 1) return { cliente: await db.cliente.findUnique({ where: { id: coinciden[0].id } }), por: 'celular' }
    if (coinciden.length > 1) return { cliente: null, motivo: 'celular_en_varias_cuentas' }
  }
  return { cliente: null, motivo: emails.length ? 'email_sin_cuenta' : 'sin_email' }
}

export const claveIdempotencia = (storeId, orderId) => `${storeId}:${orderId}`

async function yaAcreditada(db, storeId, orderId) {
  return !!(await db.webhookEvento.findUnique({
    where: { proveedor_referenciaExterna: { proveedor: 'tiendanube', referenciaExterna: claveIdempotencia(storeId, orderId) } },
  }))
}

// Decide qué corresponde con una orden, sin escribir nada (lo usa la
// simulación del script de recuperación y procesarOrden antes de acreditar).
export async function evaluarOrden(db, negocio, orden) {
  const orderId = String(orden?.id ?? '')
  const base = { orderId, numero: orden?.number != null ? String(orden.number) : null, emailOculto: ocultarEmail(emailsDeOrden(orden)[0] || '') || null }
  if (await yaAcreditada(db, negocio.tiendanubeStoreId, orderId)) return { ...base, estado: 'acreditada', motivo: 'ya_acreditada', yaAcreditada: true }
  const c = clasificarOrden(orden)
  if (c.estado !== 'pagada') return { ...base, ...c }
  const r = { ...base, total: c.total, pagadaEn: c.pagadaEn }
  const { cliente, por, motivo } = await buscarClientaDeOrden(db, negocio.id, orden)
  if (!cliente) return { ...r, estado: 'sin_cliente', motivo }
  // Cuenta creada después de pagar: no suma (regla de siempre, ver arriba).
  if (c.pagadaEn && cliente.createdAt > c.pagadaEn) return { ...r, estado: 'cuenta_posterior', clienteId: cliente.id, motivo: por }
  const puntos = calcularPuntosPorCompra(c.total, negocio.puntosXPeso)
  if (puntos <= 0) return { ...r, estado: 'sin_puntos', clienteId: cliente.id, puntos: 0 }
  return { ...r, estado: 'acreditar', cliente, clienteId: cliente.id, puntos, motivo: por }
}

async function registrar(db, negocioId, datos, via, { error } = {}) {
  const valores = {
    estado: datos.estado,
    motivo: datos.motivo ?? null,
    numero: datos.numero ?? null,
    emailOculto: datos.emailOculto ?? null,
    total: datos.total ?? null,
    pagadaEn: datos.pagadaEn ?? null,
    clienteId: datos.clienteId ?? null,
    puntos: datos.puntos ?? null,
    ultimoError: error ?? null,
    via,
    procesadaEn: new Date(),
  }
  return db.ordenTiendanube.upsert({
    where: { negocioId_orderId: { negocioId, orderId: datos.orderId } },
    create: { negocioId, orderId: datos.orderId, ...valores, intentos: 1 },
    update: { ...valores, intentos: { increment: 1 } },
  })
}

// Un error temporal (Tiendanube caído, la base, un timeout): queda anotado
// para el diagnóstico y para que la conciliación lo reintente.
export async function registrarError(db, negocioId, orderId, via, error) {
  const texto = String(error?.message || error).replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 500)
  const previa = await db.ordenTiendanube.findUnique({ where: { negocioId_orderId: { negocioId, orderId: String(orderId) } } })
  // Nunca se pisa un estado final (por ejemplo, ya acreditada) con un error de un reintento.
  if (previa && ESTADOS_FINALES.includes(previa.estado)) return previa
  return db.ordenTiendanube.upsert({
    where: { negocioId_orderId: { negocioId, orderId: String(orderId) } },
    create: { negocioId, orderId: String(orderId), estado: 'error', ultimoError: texto, via, intentos: 1, procesadaEn: new Date() },
    update: { estado: 'error', ultimoError: texto, via, intentos: { increment: 1 }, procesadaEn: new Date() },
  })
}

// Procesa una orden ya pedida a la API: acredita si corresponde (una sola vez)
// y registra el resultado. Devuelve { estado, puntos, cliente, referido,
// duplicada }. Los errores de base se propagan (quien llama los registra y
// reintenta).
export async function procesarOrden(db, negocio, orden, { via }) {
  const ev = await evaluarOrden(db, negocio, orden)
  if (ev.estado !== 'acreditar') {
    await registrar(db, negocio.id, ev, via)
    return { estado: ev.estado, motivo: ev.motivo, duplicada: !!ev.yaAcreditada }
  }
  let clienteActualizado = null
  let referido = null
  try {
    await db.$transaction(async (tx) => {
      await tx.webhookEvento.create({ data: { proveedor: 'tiendanube', referenciaExterna: claveIdempotencia(negocio.tiendanubeStoreId, ev.orderId) } })
      clienteActualizado = await tx.cliente.update({ where: { id: ev.cliente.id }, data: { puntos: { increment: ev.puntos } } })
      await tx.movimientoPuntos.create({
        data: { clienteId: ev.cliente.id, negocioId: negocio.id, puntos: ev.puntos, origen: 'tiendanube', saldoRestante: ev.puntos },
      })
      referido = await acreditarSiEsPrimeraCompraReferida(tx, ev.cliente, negocio)
    })
  } catch (error) {
    // Otro proceso (un reenvío simultáneo, la conciliación) la acreditó recién.
    if (error.code === 'P2002') {
      await registrar(db, negocio.id, { ...ev, estado: 'acreditada', motivo: 'ya_acreditada', cliente: undefined }, via)
      return { estado: 'acreditada', motivo: 'ya_acreditada', duplicada: true }
    }
    throw error
  }
  await registrar(db, negocio.id, { ...ev, estado: 'acreditada' }, via)
  const puntosTotales = referido
    ? (await db.cliente.findUnique({ where: { id: ev.cliente.id }, select: { puntos: true } })).puntos
    : clienteActualizado.puntos
  return { estado: 'acreditada', puntos: ev.puntos, cliente: clienteActualizado, puntosTotales, referido, duplicada: false, por: ev.motivo }
}
