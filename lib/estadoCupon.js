// Estado de los cupones de canje (Canje.cuponEstado). Retornar no ve el
// checkout de Tiendanube: lo único confiable es lo que informa Tiendanube.
// - Una orden pagada que trae el código (webhook order/paid): utilizado.
// - El cupón en la API (GET /coupons): `used` llegó a `max_uses` →
//   utilizado; `valid: false` o `deleted_at` (borrado, la API puede
//   seguir listándolo) → anulado; `end_date` pasada → vencido; si no,
//   disponible. Un cupón que ya no aparece en el listado completo de
//   Tiendanube (lo borraron) → anulado.
// Sin esa información el estado queda null y se muestra "Pendiente de
// verificación": nunca se da por usado por el paso del tiempo ni por un clic.

export const ESTADOS_CUPON = ['disponible', 'utilizado', 'vencido', 'anulado']

const DIA_MS = 24 * 60 * 60 * 1000

// Número de la API: null si no vino o no es un número (nunca 0 por defecto).
function numero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

// Cupón tal como lo devuelve la API de Tiendanube → estado. null si falta el
// contador de usos (`used`) o el máximo (`max_uses`): sin eso no se puede
// saber si se usó, y no se supone cero usos (queda "Pendiente de verificación").
export function estadoDesdeTiendanube(cupon, ahora = new Date()) {
  const usos = numero(cupon?.used)
  const maximo = numero(cupon?.max_uses)
  if (usos === null || maximo === null) return null
  if (maximo > 0 && usos >= maximo) return 'utilizado'
  if (cupon?.valid === false || cupon?.deleted_at) return 'anulado'
  if (cupon?.end_date) {
    // end_date viene como fecha (aaaa-mm-dd): vale hasta el final de ese día
    // en Argentina (00:00 del día siguiente = 03:00 UTC).
    const fin = /^\d{4}-\d{2}-\d{2}$/.test(cupon.end_date)
      ? new Date(new Date(`${cupon.end_date}T03:00:00Z`).getTime() + DIA_MS)
      : new Date(cupon.end_date)
    if (!Number.isNaN(fin.getTime()) && ahora >= fin) return 'vencido'
  }
  return 'disponible'
}

// Códigos de cupón de una orden de Tiendanube (`coupon` es una lista de
// códigos o de objetos con `code`, según la versión de la API).
export function codigosDeOrden(orden) {
  const lista = Array.isArray(orden?.coupon) ? orden.coupon : []
  return lista
    .map((c) => (typeof c === 'string' ? c : c?.code))
    .filter((c) => typeof c === 'string' && c.trim())
    .map((c) => c.trim().toUpperCase())
}

// Cómo se muestra el cupón de un canje a la clienta o al negocio.
export function estadoVisible(canje) {
  if (!canje.tiendanubeCuponCodigo) {
    return canje.tiendanubeCuponError
      ? { clave: 'en_preparacion', etiqueta: 'En preparación', detalle: 'El código todavía no se pudo generar; el negocio lo está resolviendo.' }
      : null
  }
  switch (canje.cuponEstado) {
    case 'disponible': return { clave: 'disponible', etiqueta: 'Disponible', detalle: 'Todavía no se usó.' }
    case 'utilizado': return { clave: 'utilizado', etiqueta: 'Utilizado', detalle: canje.cuponUsadoEn ? 'Se usó en una compra.' : 'Tiendanube indica que ya se usó.' }
    case 'vencido': return { clave: 'vencido', etiqueta: 'Vencido', detalle: 'Pasó su fecha de vencimiento.' }
    case 'anulado': return { clave: 'anulado', etiqueta: 'Anulado', detalle: 'El negocio lo dio de baja en la tienda.' }
    default: return { clave: 'sin_verificar', etiqueta: 'Pendiente de verificación', detalle: 'Todavía no pudimos confirmar con la tienda si se usó.' }
  }
}
