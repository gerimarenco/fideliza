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

// La fecha y hora de la venta según Dragon Fish ("DD/MM/AAAA" y "HH:MM:SS";
// también acepta "AAAA-MM-DD"). Sin hora, las 00:00 de ese día. Si Dragon
// Fish no mandó una fecha legible, cuándo llegó el aviso (createdAt).
export function fechaDeVenta(factura) {
  const texto = String(factura?.fecha ?? '').trim()
  let m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const partes = m ? [+m[3], +m[2], +m[1]] : (m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)) ? [+m[1], +m[2], +m[3]] : null
  if (partes) {
    const h = String(factura?.hora ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    const instante = instanteArgentina(...partes, ...(h ? [+h[1], +h[2], +(h[3] ?? 0)] : []))
    if (instante) return instante
  }
  return factura?.createdAt ? new Date(factura.createdAt) : null
}

// Desde cuándo suman las ventas del local de este negocio (null: sin límite).
export function inicioDeVentas(negocio) {
  const dia = INICIO_VENTAS_LOCAL[String(negocio?.dragonfishBaseDeDatos ?? '').trim().toUpperCase()]
  if (!dia) return null
  const [anio, mes, d] = dia.split('-').map(Number)
  return instanteArgentina(anio, mes, d)
}

// La venta es anterior al día desde el que suman las de este negocio.
export function anteriorAlInicio(negocio, factura) {
  const inicio = inicioDeVentas(negocio)
  if (!inicio) return false
  const fecha = fechaDeVenta(factura)
  return !fecha || fecha < inicio
}
