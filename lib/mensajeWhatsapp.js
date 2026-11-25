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

// Los datos se marcan con llaves o corchetes, en mayúscula o minúscula:
// {nombre} / [nombre], {puntos} / [puntos], {club} / [club].
const marca = (palabra) => `[{\\[]${palabra}[}\\]]`
const NOMBRE = new RegExp(`([ \\t]*)${marca('nombre')}`, 'gi')
const PUNTOS = new RegExp(marca('puntos'), 'gi')
const CLUB = new RegExp(marca('club'), 'gi')

// El mensaje de una clienta. Sin nombre, "¡Hola {nombre}!" queda "¡Hola!".
// **negrita** (como se escribe en muchos lados) pasa a *negrita*, que es lo
// que WhatsApp muestra en negrita.
export function armarMensaje(plantilla, { nombre, puntos, club }) {
  const n = primerNombre(nombre)
  return String(plantilla ?? '')
    .replace(NOMBRE, (_, espacio) => (n ? espacio + n : ''))
    .replace(PUNTOS, miles(puntos))
    .replace(CLUB, String(club ?? ''))
    .replace(/\*\*([^*\n]+?)\*\*/g, '*$1*')
}

// Link de WhatsApp con el mensaje escrito, o null si el celular no sirve.
export function enlaceWhatsapp(telefono, mensaje) {
  const numero = numeroWhatsapp(telefono)
  if (!numero || numero.length < 10) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}
