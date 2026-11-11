// Fecha real de una venta del local (Dragon Fish) y desde cuándo se suman.
//
// La fecha de la venta la manda Dragon Fish en el aviso (webhook) como
// "Fecha": "21/08/2026" y "Hora": "12:53:14", en hora de Argentina (la de la
// PC del local), y se guarda tal cual en FacturaPendiente.fecha / .hora
// (texto). FacturaPendiente.createdAt es otra cosa: cuándo llegó el aviso a
// Retornar (segundos después de facturar, salvo que el aviso se demore); por
// eso nunca es anterior a la venta.
//
// Sin dependencias del servidor: lo usa también el panel.

const DESFASE_ARGENTINA_MS = 3 * 60 * 60 * 1000 // UTC-3, sin horario de verano

// Desde qué día (inclusive, 00:00 de Argentina) se suman las ventas del local
// de cada negocio, por el nombre de su base en Dragon Fish. Las ventas
// anteriores no suman nunca (ni solas, ni al "Volver a revisar", ni a mano).
// Un negocio que no figura acá no tiene límite.
//
// Club Peperina: el agente procesó tarde las ventas acumuladas desde agosto;
// se recuperan solo las del 05/11/2026 en adelante (decisión del negocio,
// 2026-11-11). Las acreditaciones anteriores ya hechas no se tocan.
export const INICIO_VENTAS_LOCAL = {
  PEPERINA: '2026-11-05',
}

function instanteArgentina(anio, mes, dia, h = 0, mi = 0, s = 0) {
  if (h > 23 || mi > 59 || s > 59) return null
  const utc = Date.UTC(anio, mes - 1, dia, h, mi, s)
  const d = new Date(utc)
  // 31/02 o 00/11 no son fechas: Date.UTC las "corre" a otro día.
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  return new Date(utc + DESFASE_ARGENTINA_MS)
}

const DIA_MS = 24 * 60 * 60 * 1000

// La fecha y hora de la venta según Dragon Fish ("DD/MM/AAAA" y "HH:MM:SS";
// también acepta "AAAA-MM-DD"). Sin hora, las 00:00 de ese día. null si no se
// puede verificar: fecha vacía, ilegible, inexistente (31/02) o más de un día
// posterior a la llegada del aviso (una venta no puede avisarse antes de
// hacerse; el día cubre un reloj adelantado en la PC del local).
export function fechaVerificada(factura) {
  const texto = String(factura?.fecha ?? '').trim()
  let m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const partes = m ? [+m[3], +m[2], +m[1]] : (m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)) ? [+m[1], +m[2], +m[3]] : null
  if (!partes) return null
  const textoHora = String(factura?.hora ?? '').trim()
  const h = textoHora.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (textoHora && !h) return null
  const instante = instanteArgentina(...partes, ...(h ? [+h[1], +h[2], +(h[3] ?? 0)] : []))
  if (!instante) return null
  if (factura?.createdAt && instante.getTime() > new Date(factura.createdAt).getTime() + DIA_MS) return null
  return instante
}

// Fecha de la venta para los flujos SIN límite de fecha (la regla de cuenta
// posterior, los 60/90 días de un negocio sin día de inicio): la verificada
// o, si no hay, cuándo llegó el aviso (createdAt). Nunca decide si una venta
// entra en la recuperación de un negocio con día de inicio: eso es
// anteriorAlInicio / fueraDePeriodoAlProcesar, que no usan createdAt así.
export function fechaDeVenta(factura) {
  return fechaVerificada(factura) ?? (factura?.createdAt ? new Date(factura.createdAt) : null)
}

// Desde cuándo suman las ventas del local de este negocio (null: sin límite).
export function inicioDeVentas(negocio) {
  const dia = INICIO_VENTAS_LOCAL[String(negocio?.dragonfishBaseDeDatos ?? '').trim().toUpperCase()]
  if (!dia) return null
  const [anio, mes, d] = dia.split('-').map(Number)
  return instanteArgentina(anio, mes, d)
}

// Recuperación (lista de ventas sin identificar, "Volver a revisar", asignar a
// mano y vincular una ficha): con día de inicio, una venta entra solo si su
// fecha de Dragon Fish se puede verificar y es de ese día o posterior. Sin
// fecha verificable, queda afuera (no se usa cuándo llegó el aviso).
// Un negocio sin día de inicio no tiene límite.
export function anteriorAlInicio(negocio, factura) {
  const inicio = inicioDeVentas(negocio)
  if (!inicio) return false
  const fecha = fechaVerificada(factura)
  return !fecha || fecha < inicio
}

// Cuando el agente reporta una venta (POST /api/dragonfish/resolver): mismo
// criterio, con una sola excepción segura. Una venta sin fecha verificable
// cuyo aviso llegó después del día de inicio y hace menos de un día es una
// compra del momento, no histórica: se toma la llegada del aviso como fecha
// para no dejar de acreditar compras nuevas si algún aviso viniera sin fecha.
// Un aviso más viejo sin fecha (lo que quedó en la fila) no suma.
export function fueraDePeriodoAlProcesar(negocio, factura, ahora = new Date()) {
  const inicio = inicioDeVentas(negocio)
  if (!inicio) return false
  const fecha = fechaVerificada(factura)
  if (fecha) return fecha < inicio
  const llegada = factura?.createdAt ? new Date(factura.createdAt) : null
  return !(llegada && llegada >= inicio && ahora.getTime() - llegada.getTime() <= DIA_MS)
}
