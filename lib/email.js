import { Resend } from 'resend'
import { nombreClub } from './nombreClub.js'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Mientras no haya un dominio propio verificado en Resend, el remitente de
// prueba (onboarding@resend.dev) solo puede mandar mails a la casilla con la
// que se creó la cuenta de Resend, no a clientes reales — ver README.
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Retornar <onboarding@resend.dev>'

// negocioNombre lo carga el admin (ver app/api/negocios) y email lo carga el
// propio cliente al registrarse — ninguno de los dos está pensado para
// llevar markup, pero nada los valida contra eso tampoco. Escaparlos acá
// evita que terminen interpretados como HTML dentro del mail (ej. un link
// de phishing armado como "nombre").
const ESCAPES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (c) => ESCAPES_HTML[c])
}


// Mail de aviso después de cada compra que suma puntos (manual, Mercado
// Pago, Tiendanube o Dragon Fish) para un cliente que ya tenía cuenta.
export async function enviarEmailPuntosAcreditados({ email, puntosAcreditados, puntosTotales, negocioNombre }) {
  if (!resend) {
    console.warn('RESEND_API_KEY no configurada: no se envió el email de puntos acreditados a', email)
    return
  }

  const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : '/login'

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `+${puntosAcreditados} puntos en ${nombreClub(negocioNombre)}`,
      html: `
        <p>¡Gracias por tu compra en <strong>${escaparHtml(nombreClub(negocioNombre))}</strong>!</p>
        <p>Sumaste <strong>${puntosAcreditados} puntos</strong>. Ahora tenés <strong>${puntosTotales} puntos</strong> en total.</p>
        <p><a href="${loginUrl}">Entrá a tu cuenta</a> para ver qué premios ya podés canjear.</p>
      `,
    })
  } catch (error) {
    console.error('Error al enviar el email de puntos acreditados a', email, error)
  }
}

// Mail de aviso después de canjear un premio (POST /api/canjes) — antes de
// esto no había ningún aviso por mail de un canje, a diferencia de las
// compras. Si el premio tenía un cupón de Tiendanube asociado (ver
// app/api/canjes), se incluye el código para que la clienta sepa cómo
// usarlo sin tener que volver a entrar a la app.
export async function enviarEmailCanje({ email, premioNombre, puntosUsados, puntosRestantes, negocioNombre, cuponCodigo, tiendanubeProductoUrl }) {
  if (!resend) {
    console.warn('RESEND_API_KEY no configurada: no se envió el email de canje a', email)
    return
  }

  const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : '/login'
  const premioSeguro = escaparHtml(premioNombre)

  let cuponHtml = ''
  if (cuponCodigo) {
    cuponHtml = tiendanubeProductoUrl
      ? `<p>Usá el código <strong>${escaparHtml(cuponCodigo)}</strong> en <a href="${escaparHtml(tiendanubeProductoUrl)}">este producto</a> de la tienda online al pagar.</p>`
      : `<p>Usá el código <strong>${escaparHtml(cuponCodigo)}</strong> en la tienda online al pagar.</p>`
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Canjeaste ${premioSeguro} en ${nombreClub(negocioNombre)}`,
      html: `
        <p>¡Listo! Canjeaste <strong>${premioSeguro}</strong> por <strong>${puntosUsados} puntos</strong> en <strong>${escaparHtml(nombreClub(negocioNombre))}</strong>.</p>
        ${cuponHtml}
        <p>Te quedan <strong>${puntosRestantes} puntos</strong> disponibles.</p>
        <p><a href="${loginUrl}">Entrá a tu cuenta</a> para ver el detalle.</p>
      `,
    })
  } catch (error) {
    console.error('Error al enviar el email de canje a', email, error)
  }
}

// Mail de aviso cuando netlify/functions/vencimiento-puntos.mjs le vence
// puntos a un cliente por no haberlos usado dentro de Negocio.vencimientoPuntosMeses
// (configurable por negocio, no siempre el mismo número) desde que los ganó —
// sin este aviso, el cliente vería bajar su saldo sin ninguna explicación.
export async function enviarEmailPuntosVencidos({ email, puntosVencidos, puntosTotales, negocioNombre, meses }) {
  if (!resend) {
    console.warn('RESEND_API_KEY no configurada: no se envió el email de puntos vencidos a', email)
    return
  }

  const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : '/login'

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Vencieron ${puntosVencidos} puntos en ${nombreClub(negocioNombre)}`,
      html: `
        <p>Te avisamos que vencieron <strong>${puntosVencidos} puntos</strong> en <strong>${escaparHtml(nombreClub(negocioNombre))}</strong> por no haberlos usado dentro de los ${meses} meses de haberlos sumado.</p>
        <p>Todavía te quedan <strong>${puntosTotales} puntos</strong> disponibles.</p>
        <p><a href="${loginUrl}">Entrá a tu cuenta</a> para ver qué premios podés canjear antes de que venzan.</p>
      `,
    })
  } catch (error) {
    console.error('Error al enviar el email de puntos vencidos a', email, error)
  }
}
