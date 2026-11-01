import { createHmac } from 'crypto'

// Límites del registro público (ver app/api/registro/[negocio]). El registro
// tiene que decir "Este DNI ya está registrado" para que la clienta sepa qué
// hacer; sin límites, ese mensaje serviría para probar documentos en masa y
// averiguar cuáles tienen cuenta. Al mismo tiempo, varias clientas reales
// pueden registrarse desde el mismo Wi-Fi del local (misma IP), y los errores
// de una no pueden dejar sin registro a las demás.
//
// Cada intento se anota ANTES de contar (en la misma consulta que cuenta ve
// su propia fila), así muchos pedidos simultáneos no pueden pasar todos el
// control: el pedido número N ve al menos N intentos. El modo protección se
// evalúa y el "DNI ya registrado" se anota dentro de una misma transacción
// con un lock por IP y por dispositivo: los pedidos simultáneos de una misma
// IP o dispositivo se esperan y cada uno ve los rechazos de los anteriores.
//
// Se cuentan por separado, cada uno con su propio tope:
// - dni: el documento en ese negocio, venga de donde venga. El más estricto:
//   protege a una persona concreta y no afecta a nadie más.
// - dispositivo: el navegador (una cookie anónima al azar). Solo frena a ese
//   celular o computadora.
// - ip: la conexión. Tope alto, para que un Wi-Fi compartido no se bloquee
//   por volumen normal; solo lo alcanza un envío automatizado. Las IPv6 se
//   agrupan por su red /64 (una sola conexión doméstica tiene millones de
//   direcciones; contarlas por separado haría trivial cambiar de IP).
// - protección: si en una hora hay muchos "DNI ya registrado" en el negocio
//   (lo normal son muy pocos), quien ya recibió esa respuesta no puede
//   consultar otro documento hasta que pase la hora. Así cambiar de IP no
//   da consultas ilimitadas: cada IP o dispositivo nuevo obtiene muy pocas.
//
// Todo se evalúa antes de saber si el DNI existe, así la respuesta "demasiados
// intentos" no revela nada sobre el documento. Nada se guarda en claro: ni la
// IP, ni el documento, ni la cookie (HMAC con la clave del servidor), y las
// filas se borran a las 24 horas.
const HORA = 60 * 60 * 1000
const CUARTO_DE_HORA = 15 * 60 * 1000

export const LIMITES = {
  // La dueña de un documento que se olvidó de que tenía cuenta prueba 2 o 3
  // veces; 5 por hora la deja intentar y frena a quien insiste con un DNI ajeno.
  dni: { maximo: 5, ventanaMs: HORA },
  // Los errores de tipeo no cuentan (se rechazan antes, sin anotar): 10 envíos
  // completos en 15 minutos desde un mismo celular ya no es una persona.
  dispositivo: { maximo: 10, ventanaMs: CUARTO_DE_HORA },
  // 60 en 15 minutos (4 por minuto sostenidos) desde un Wi-Fi: más que una
  // fila de clientas registrándose en el local en el peor momento.
  ip: { maximo: 60, ventanaMs: CUARTO_DE_HORA },
  // Modo protección: 20 "DNI ya registrado" por hora en un negocio es un
  // ataque, no clientas que se equivocan. En ese modo, un dispositivo con 1
  // o una IP con 2 respuestas de DNI repetido en la última hora no pueden
  // probar otro documento. Una IP necesita 2 para no frenar a todo un Wi-Fi
  // porque una clienta se equivocó una vez.
  proteccion: { rechazosNegocio: 20, rechazosDispositivo: 1, rechazosIp: 2, ventanaMs: HORA },
}

// Las filas sirven solo para contar: se borran después de un día.
export const RETENCION_MS = 24 * HORA

function hmac(valor) {
  return createHmac('sha256', process.env.NEXTAUTH_SECRET || 'retornar').update(valor).digest('hex')
}

export function claveDni(negocioId, dni) {
  return hmac(`registro-dni:${negocioId}:${dni}`)
}

export function claveDispositivo(id) {
  return hmac(`registro-dispositivo:${id}`)
}

// IP → lo que se cuenta como "una conexión": la IPv4 tal cual (también si
// viene como ::ffff:1.2.3.4) y, para IPv6, los primeros 64 bits.
export function redDeIp(ip) {
  let x = String(ip || '').trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0]
  if (!x) return 'desconocida'
  const v4 = x.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4) return v4[1]
  if (!x.includes(':')) return x
  const [cabeza, cola] = x.split('::')
  const a = cabeza ? cabeza.split(':') : []
  const b = cola ? cola.split(':') : []
  const partes = x.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a
  return `${partes.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '') || '0').join(':')}::/64`
}

export function claveIp(ip) {
  return hmac(`registro-ip:${redDeIp(ip)}`)
}

// cuentas: intentos (incluido el actual) por dni / dispositivo / ip en su
// ventana. Devuelve qué límite se superó, o null.
export function limiteSuperado(cuentas) {
  if (cuentas.dni > LIMITES.dni.maximo) return 'dni'
  if (cuentas.dispositivo != null && cuentas.dispositivo > LIMITES.dispositivo.maximo) return 'dispositivo'
  if (cuentas.ip > LIMITES.ip.maximo) return 'ip'
  return null
}

// rechazos: respuestas "DNI ya registrado" en la última hora del negocio, de
// este dispositivo y de esta IP (contadas con el lock de la IP y del
// dispositivo tomado, ver arriba). true si el modo protección frena este intento.
export function bloqueadoPorProteccion(rechazos) {
  const p = LIMITES.proteccion
  if (rechazos.negocio < p.rechazosNegocio) return false
  return (rechazos.dispositivo ?? 0) >= p.rechazosDispositivo || rechazos.ip >= p.rechazosIp
}

// Ninguno repite el documento ni dice si existe.
export const MENSAJES_LIMITE = {
  dni: 'Hubo varios intentos de registro con este DNI. Si ya tenés cuenta, iniciá sesión o recuperá tu contraseña; si no, probá de nuevo en un rato.',
  dispositivo: 'Hubo demasiados intentos de registro desde este dispositivo. Probá de nuevo en unos minutos.',
  ip: 'Hubo demasiados intentos de registro desde esta conexión. Probá de nuevo en unos minutos.',
  proteccion: 'Por seguridad no podemos procesar más registros desde este dispositivo por un rato. Probá de nuevo más tarde.',
}
