// `state` del OAuth de Google (lib/googleSheets.js): dice a qué negocio
// corresponde la vuelta de Google y que la pidió esta misma sesión. Firmado
// con HMAC (NEXTAUTH_SECRET), con vencimiento y un nonce que además va en
// una cookie del navegador que lo pidió: una vuelta de Google con un state
// ajeno, vencido, alterado o de otro navegador se rechaza.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const VIGENCIA_MS = 10 * 60 * 1000

function firma(datos) {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET || '').update(`oauth-google:${datos}`).digest('base64url')
}

export function nuevoEstado(negocioId, ahora = Date.now()) {
  const nonce = randomBytes(16).toString('base64url')
  const datos = Buffer.from(JSON.stringify({ n: negocioId, x: ahora + VIGENCIA_MS, r: nonce })).toString('base64url')
  return { state: `${datos}.${firma(datos)}`, nonce }
}

// → negocioId si el state es válido para ese nonce, si no null.
export function verificarEstado(state, nonce, ahora = Date.now()) {
  const [datos, sello] = String(state || '').split('.')
  if (!datos || !sello || !nonce) return null
  const esperado = Buffer.from(firma(datos))
  const recibido = Buffer.from(sello)
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null
  let contenido
  try { contenido = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8')) } catch { return null }
  if (!contenido?.n || contenido.r !== nonce || !(contenido.x > ahora)) return null
  return contenido.n
}
