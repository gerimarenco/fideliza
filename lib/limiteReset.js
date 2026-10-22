// Límite de mails de "Olvidé mi contraseña" por cuenta. Sin esto, cualquiera
// podía apretar el botón cientos de veces con el email de una clienta: le
// llenaba la casilla y, peor, agotaba el cupo diario del plan de Resend (100
// mails por día) y dejaban de salir los mails de puntos de todas las demás.
export const ESPERA_MINIMA_MS = 2 * 60 * 1000
export const MAXIMO_POR_HORA = 5

// fechasRecientes: createdAt de los pedidos de la última hora de esa cuenta.
export function puedeEnviarReset(fechasRecientes, ahora = new Date()) {
  const unaHoraAtras = ahora.getTime() - 60 * 60 * 1000
  const enLaUltimaHora = fechasRecientes.filter((f) => new Date(f).getTime() > unaHoraAtras)
  if (enLaUltimaHora.length >= MAXIMO_POR_HORA) return false
  const masReciente = Math.max(0, ...enLaUltimaHora.map((f) => new Date(f).getTime()))
  return ahora.getTime() - masReciente >= ESPERA_MINIMA_MS
}
