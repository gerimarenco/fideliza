// Mensajes por WhatsApp a las clientas, desde el WhatsApp del negocio: el
// negocio escribe un mensaje una vez, con {nombre}, {puntos} y {club}, y el
// panel arma el de cada clienta y un link de WhatsApp (wa.me) con el texto ya
// escrito. Nada sale solo: la empleada abre cada link y toca "enviar" desde
// el WhatsApp del negocio (así no es un envío masivo y no hay riesgo de
// bloqueo). Sin dependencias: lo usa el panel (client component).
import { numeroWhatsapp } from './telefono.js'

export const PLANTILLA_SUGERIDA = '¡Hola {nombre}! 🖤 Como sos parte de {club}, queremos contarte antes que nadie: la semana que viene llega nuestro Black Friday. Aprovechá para sumar puntos con tus compras (hoy tenés {puntos}). ¡Te esperamos!'

// "MARIA victoria Denapole" → "Maria"; sin nombre, "".
export function primerNombre(nombre) {
  const palabra = String(nombre ?? '').trim().split(/\s+/)[0] || ''
  return palabra ? palabra[0].toLocaleUpperCase('es-AR') + palabra.slice(1).toLocaleLowerCase('es-AR') : ''
}

const miles = (n) => String(Math.max(0, Math.trunc(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// El mensaje de una clienta. Sin nombre, "¡Hola {nombre}!" queda "¡Hola!".
export function armarMensaje(plantilla, { nombre, puntos, club }) {
  const n = primerNombre(nombre)
  return String(plantilla ?? '')
    .replace(/([ \t]*)\{nombre\}/g, (_, espacio) => (n ? espacio + n : ''))
    .replace(/\{puntos\}/g, miles(puntos))
    .replace(/\{club\}/g, String(club ?? ''))
}

// Link de WhatsApp con el mensaje escrito, o null si el celular no sirve.
export function enlaceWhatsapp(telefono, mensaje) {
  const numero = numeroWhatsapp(telefono)
  if (!numero || numero.length < 10) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}
