import { Resend } from 'resend'
import { prisma } from './db'
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

const PRIMARIO_DEFECTO = '#6366f1'
const PRIMARIO_TEXTO_DEFECTO = '#ffffff'

// Cada negocio puede tener su propio color de marca (ver Negocio.tema, el
// mismo que ya se usa en /club/[negocio] y en el widget de la tienda
// online) — sin esto todos los mails se verían idénticos sin importar de
// qué club vienen.
async function obtenerTema(negocioId) {
  if (!negocioId) return { primario: PRIMARIO_DEFECTO, primarioTexto: PRIMARIO_TEXTO_DEFECTO }
  const negocio = await prisma.negocio.findUnique({ where: { id: negocioId }, select: { tema: true } })
  return {
    primario: negocio?.tema?.primario || PRIMARIO_DEFECTO,
    primarioTexto: negocio?.tema?.primarioTexto || PRIMARIO_TEXTO_DEFECTO,
  }
}

// Envoltorio visual compartido por los tres mails: banda de color con el
// nombre del club arriba, tarjeta blanca con el contenido propio de cada
// uno, y un pie común. Centralizar esto evita tener el mismo bloque de
// estilos pegado tres veces.
function armarEmailHtml({ negocioNombreSeguro, primario, primarioTexto, emojiHeader, tituloHeader, contenidoHtml, loginUrl, textoBoton }) {
  return `
    <div style="background-color:#f3f4f6;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="background:${primario};color:${primarioTexto};padding:28px 24px;text-align:center;">
          <div style="font-size:32px;line-height:1;margin-bottom:8px;">${emojiHeader}</div>
          <div style="font-size:13px;opacity:0.85;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;">${negocioNombreSeguro}</div>
          <div style="font-size:20px;font-weight:700;">${tituloHeader}</div>
        </div>
        <div style="padding:28px 24px;">
          ${contenidoHtml}
          <a href="${loginUrl}" style="display:block;text-align:center;margin-top:24px;padding:14px;border-radius:10px;background:${primario};color:${primarioTexto};font-size:15px;font-weight:600;text-decoration:none;">${textoBoton}</a>
        </div>
        <div style="padding:16px 24px;text-align:center;color:#9ca3af;font-size:12px;background:#fafafa;">
          Este mail te lo mandó ${negocioNombreSeguro} a través de Retornar.
        </div>
      </div>
    </div>
  `
}

// Arma la sección "así vas con tus premios": todos los premios activos del
// negocio con una barra de progreso cada uno, mostrando cuántos puntos le
// faltan a la clienta para cada uno (o que ya lo puede canjear).
async function armarSeccionPremios(negocioId, puntosTotales, primario) {
  if (!negocioId) return ''

  const premios = await prisma.premio.findMany({
    where: { negocioId, activo: true },
    orderBy: { puntos: 'asc' },
    select: { nombre: true, puntos: true },
  })
  if (premios.length === 0) return ''

  const filas = premios.map((premio) => {
    const alcanzado = premio.puntos <= puntosTotales
    const porcentaje = Math.min(100, Math.round((puntosTotales / premio.puntos) * 100))
    const etiqueta = alcanzado
      ? '¡Ya lo podés canjear! 🎁'
      : `Te faltan ${premio.puntos - puntosTotales} puntos`
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#374151;margin-bottom:5px;">
          <span style="font-weight:600;">${escaparHtml(premio.nombre)}</span>
          <span style="color:${alcanzado ? '#16a34a' : '#6b7280'};">${etiqueta}</span>
        </div>
        <div style="background:#e5e7eb;border-radius:6px;height:10px;overflow:hidden;">
          <div style="background:${alcanzado ? '#16a34a' : primario};width:${porcentaje}%;height:100%;"></div>
        </div>
      </div>
    `
  }).join('')

  return `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f0f0f0;">
      <p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 14px;">Así vas con tus premios</p>
      ${filas}
    </div>
  `
}

// Mail de aviso después de cada compra que suma puntos (manual, Mercado
// Pago, Tiendanube o Dragon Fish) para un cliente que ya tenía cuenta.
// negocioId es opcional (si no llega, el mail sale sin color de marca ni
// sección de premios) para no romper algún llamador que todavía no lo pase.
export async function enviarEmailPuntosAcreditados({ email, puntosAcreditados, puntosTotales, negocioNombre, negocioId }) {
  if (!resend) {
    console.warn('RESEND_API_KEY no configurada: no se envió el email de puntos acreditados a', email)
    return
  }

  const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : '/login'
  const negocioNombreSeguro = escaparHtml(nombreClub(negocioNombre))

  const { primario, primarioTexto } = await obtenerTema(negocioId)
  const seccionPremios = await armarSeccionPremios(negocioId, puntosTotales, primario)

  const contenidoHtml = `
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
      ¡Gracias por tu compra! Cada vez que comprás en <strong>${negocioNombreSeguro}</strong> sumás puntos
      que después podés canjear por premios — y esta vez sumaste bastantes.
    </p>
    <div style="text-align:center;background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:4px;">
      <div style="font-size:30px;font-weight:800;color:${primario};">+${puntosAcreditados} puntos</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">Ahora tenés <strong>${puntosTotales} puntos</strong> en total</div>
    </div>
    ${seccionPremios}
  `

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `+${puntosAcreditados} puntos en ${nombreClub(negocioNombre)}`,
      html: armarEmailHtml({
        negocioNombreSeguro,
        primario,
        primarioTexto,
        emojiHeader: '🎉',
        tituloHeader: 'Sumaste puntos',
        contenidoHtml,
        loginUrl,
        textoBoton: 'Ver mis premios',
      }),
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
export async function enviarEmailCanje({ email, premioNombre, puntosUsados, puntosRestantes, negocioNombre, negocioId, cuponCodigo, tiendanubeProductoUrl }) {
  if (!resend) {
    console.warn('RESEND_API_KEY no configurada: no se envió el email de canje a', email)
    return
  }

  const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : '/login'
  const negocioNombreSeguro = escaparHtml(nombreClub(negocioNombre))
  const premioSeguro = escaparHtml(premioNombre)
  const { primario, primarioTexto } = await obtenerTema(negocioId)

  let cuponHtml = ''
  if (cuponCodigo) {
    cuponHtml = `
      <div style="text-align:center;margin:16px 0;">
        <div style="display:inline-block;background:#f9fafb;border:1px dashed #d1d5db;border-radius:10px;padding:12px 20px;font-size:18px;font-weight:700;letter-spacing:1px;color:#111827;">${escaparHtml(cuponCodigo)}</div>
      </div>
      <p style="font-size:13px;color:#6b7280;text-align:center;margin:0 0 20px;">
        ${tiendanubeProductoUrl
          ? `Usá este código en <a href="${escaparHtml(tiendanubeProductoUrl)}" style="color:${primario};">este producto</a> de la tienda online al pagar.`
          : 'Usá este código en la tienda online al pagar.'}
      </p>
    `
  }

  const contenidoHtml = `
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
      ¡Listo! Cambiaste tus puntos por un premio en <strong>${negocioNombreSeguro}</strong>. Esperamos que lo disfrutes.
    </p>
    <div style="text-align:center;background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:4px;">
      <div style="font-size:22px;font-weight:800;color:${primario};">${premioSeguro}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">Usaste <strong>${puntosUsados} puntos</strong></div>
    </div>
    ${cuponHtml}
    <p style="font-size:13px;color:#6b7280;text-align:center;margin:20px 0 0;">Te quedan <strong>${puntosRestantes} puntos</strong> disponibles para el próximo premio.</p>
  `

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Canjeaste ${premioSeguro} en ${nombreClub(negocioNombre)}`,
      html: armarEmailHtml({
        negocioNombreSeguro,
        primario,
        primarioTexto,
        emojiHeader: '🎁',
        tituloHeader: 'Canjeaste un premio',
        contenidoHtml,
        loginUrl,
        textoBoton: 'Ver mi cuenta',
      }),
    })
  } catch (error) {
    console.error('Error al enviar el email de canje a', email, error)
  }
}

// Mail de aviso cuando netlify/functions/vencimiento-puntos.mjs le vence
// puntos a un cliente por no haberlos usado dentro de Negocio.vencimientoPuntosMeses
// (configurable por negocio, no siempre el mismo número) desde que los ganó —
// sin este aviso, el cliente vería bajar su saldo sin ninguna explicación.
export async function enviarEmailPuntosVencidos({ email, puntosVencidos, puntosTotales, negocioNombre, negocioId, meses }) {
  if (!resend) {
    console.warn('RESEND_API_KEY no configurada: no se envió el email de puntos vencidos a', email)
    return
  }

  const loginUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` : '/login'
  const negocioNombreSeguro = escaparHtml(nombreClub(negocioNombre))
  const { primario, primarioTexto } = await obtenerTema(negocioId)

  const contenidoHtml = `
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
      Te avisamos que algunos puntos en <strong>${negocioNombreSeguro}</strong> vencieron por no haberlos usado
      dentro de los ${meses} meses de haberlos sumado. Todavía te queda saldo disponible para seguir canjeando.
    </p>
    <div style="text-align:center;background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:4px;">
      <div style="font-size:28px;font-weight:800;color:#dc2626;">-${puntosVencidos} puntos</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">Te quedan <strong>${puntosTotales} puntos</strong> disponibles</div>
    </div>
  `

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Vencieron ${puntosVencidos} puntos en ${nombreClub(negocioNombre)}`,
      html: armarEmailHtml({
        negocioNombreSeguro,
        primario,
        primarioTexto,
        emojiHeader: '⏳',
        tituloHeader: 'Vencieron puntos',
        contenidoHtml,
        loginUrl,
        textoBoton: 'Ver qué puedo canjear',
      }),
    })
  } catch (error) {
    console.error('Error al enviar el email de puntos vencidos a', email, error)
  }
}
