// Cara pública del programa de fidelización de cada negocio: "Club Peperina"
// en vez del nombre pelado del negocio ("Peperina"), en todo lo que ve el
// cliente (mails, pantalla de registro, widget, panel). El nombre del
// negocio en sí (sin el prefijo) sigue siendo el que ven admin/negocio en
// su propio panel. Vive en su propio módulo, sin dependencias, para poder
// importarse tanto desde código de servidor (lib/email.js, rutas de API)
// como desde app/page.js — que es un client component y no puede importar
// lib/email.js sin arrastrar el paquete `resend` (server-only) al bundle
// del navegador.
export function nombreClub(negocioNombre) {
  return `Club ${negocioNombre}`
}

// Nombre visible del remitente de los mails de un negocio a sus clientas:
// el que cargó en Ajustes ("Emails a tus clientas") o, si no cargó ninguno,
// el nombre de su club ("Club Peperina"), el mismo que ven en el asunto y en
// el mail. Así cada negocio sale con su nombre sin tener que configurarlo.
// Un nombre de negocio que ya empieza con "Club" no se duplica.
export function nombreRemitente(negocio) {
  const propio = String(negocio?.emailRemitenteNombre ?? '').trim()
  if (propio) return propio
  const nombre = String(negocio?.nombre ?? '').replace(/\s+/g, ' ').trim()
  if (!nombre) return null
  return /^club\b/i.test(nombre) ? nombre : `Club ${nombre}`
}
