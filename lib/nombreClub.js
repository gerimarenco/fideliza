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
