import { createHash } from 'crypto'
import { normalizarEmail } from './identidad.js'

// Límite de intentos de login fallidos por cuenta. Con contraseñas de 6
// caracteres como mínimo, sin esto alguien podía probar contraseñas sin
// parar contra el email de una clienta (o del negocio). Pasado el límite,
// esa cuenta no puede entrar con contraseña por 15 minutos (Google sigue
// funcionando: no depende de la contraseña).
export const MAXIMO_FALLOS = 10
export const VENTANA_MS = 15 * 60 * 1000

export function hashEmailLogin(email) {
  return createHash('sha256').update(normalizarEmail(email)).digest('hex')
}

export function loginBloqueado(fallosRecientes) {
  return fallosRecientes >= MAXIMO_FALLOS
}

export function inicioVentana(ahora = new Date()) {
  return new Date(ahora.getTime() - VENTANA_MS)
}
