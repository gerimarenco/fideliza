// Límites del mes calendario en hora de Argentina (UTC-3, sin horario de
// verano), expresados como instantes UTC para filtrar en la base. Sin
// esto, "este mes" arrancaba a las 21:00 del último día del mes anterior.
const DESFASE_ARGENTINA_MS = 3 * 60 * 60 * 1000

export function mesArgentina(ahora = new Date()) {
  const local = new Date(ahora.getTime() - DESFASE_ARGENTINA_MS)
  const anio = local.getUTCFullYear()
  const mes = local.getUTCMonth()
  return {
    inicio: new Date(Date.UTC(anio, mes, 1) + DESFASE_ARGENTINA_MS),
    fin: new Date(Date.UTC(anio, mes + 1, 1) + DESFASE_ARGENTINA_MS),
  }
}
