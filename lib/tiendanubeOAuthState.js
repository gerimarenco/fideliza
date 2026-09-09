import crypto from 'crypto'

// El flujo de OAuth2 de Tiendanube redirige siempre a una URL de callback
// fija, registrada de antemano en su Partner Portal — no admite mandar un
// `state` propio en la URL de autorización (ver app/api/tiendanube/conectar).
// Para saber a qué Negocio corresponde cada código que vuelve en el
// callback, se guarda el negocioId en una cookie firmada (HMAC con
// NEXTAUTH_SECRET, que ya existe para NextAuth) de corta duración, en vez
// de depender de que Tiendanube haga eco de un parámetro que no documenta.
const DURACION_MS = 10 * 60 * 1000

function firmar(payload) {
  return crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET).update(payload).digest('hex')
}

export function crearCookieEstado(negocioId) {
  const payload = `${negocioId}.${Date.now() + DURACION_MS}`
  return `${payload}.${firmar(payload)}`
}

export function leerCookieEstado(cookie) {
  if (!cookie) return null
  const partes = cookie.split('.')
  if (partes.length !== 3) return null
  const [negocioId, expiraStr, firma] = partes
  const payload = `${negocioId}.${expiraStr}`
  const firmaEsperada = firmar(payload)

  const firmaBuffer = Buffer.from(firma, 'hex')
  const esperadaBuffer = Buffer.from(firmaEsperada, 'hex')
  if (firmaBuffer.length !== esperadaBuffer.length || !crypto.timingSafeEqual(firmaBuffer, esperadaBuffer)) {
    return null
  }

  const expira = Number(expiraStr)
  if (!Number.isFinite(expira) || Date.now() > expira) return null

  return negocioId
}
