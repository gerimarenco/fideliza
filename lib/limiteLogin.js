import { createHmac } from 'crypto'
import { normalizarEmail } from './identidad.js'

// Límite de intentos de login fallidos (ver authorize en lib/auth.js). Con
// contraseñas de 6 caracteres como mínimo, sin esto alguien podía probar
// contraseñas sin parar contra el email de una clienta o del negocio.
//
// Se cuenta por cuenta + conexión (IP), no por cuenta sola: si fuera solo por
// cuenta, cualquiera que conociera el email de una clienta podría dejarla sin
// poder entrar mandando 10 contraseñas falsas cada 15 minutos. Así, quien
// prueba contraseñas solo se bloquea a sí mismo, y la dueña de la cuenta
// entra normalmente desde su celular. Aparte, un tope por conexión frena a
// quien prueba la misma contraseña contra muchas cuentas.
export const MAXIMO_POR_CUENTA = 10
export const MAXIMO_POR_CONEXION = 30
export const VENTANA_MS = 15 * 60 * 1000

// HMAC con NEXTAUTH_SECRET en vez de un hash pelado: ni el email ni la IP
// (datos personales) quedan guardados, y tampoco se pueden recuperar
// probando emails o IPs conocidos sin la clave del servidor.
function hmac(valor) {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET || 'retornar').update(valor).digest('hex')
}

export function hashEmailLogin(email) {
  return hmac(`email:${normalizarEmail(email)}`)
}

export function hashIpLogin(ip) {
  return hmac(`ip:${ip || 'desconocida'}`)
}

// IP real de quien intenta entrar. En Netlify, x-nf-client-connection-ip la
// pone la plataforma (no se puede falsificar desde el navegador); si no
// está (entorno local), el primer valor de x-forwarded-for.
export function ipDeEncabezados(headers = {}) {
  const nf = headers['x-nf-client-connection-ip']
  if (nf) return String(nf).trim()
  const xff = headers['x-forwarded-for']
  if (xff) return String(xff).split(',')[0].trim()
  return ''
}

// Las cantidades incluyen el intento actual (se registra antes de contar,
// para que muchos intentos simultáneos no pasen todos el chequeo a la vez).
export function loginBloqueado(intentosCuenta, intentosConexion) {
  return intentosCuenta > MAXIMO_POR_CUENTA || intentosConexion > MAXIMO_POR_CONEXION
}

export function inicioVentana(ahora = new Date()) {
  return new Date(ahora.getTime() - VENTANA_MS)
}
