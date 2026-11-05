import { Resend } from 'resend'
import { prisma } from './db.js'
import { nombreClub } from './nombreClub.js'
import { urlBase } from './urlBase.js'
import { ocultarEmail } from './identidad.js'
import { resolverTema } from './tema.js'
import { fechaCorta } from './csv.js'
import { formatearMiles } from './clienteStats.js'
import { escaparHtml, remitente, htmlATexto, armarEmailHtml, parrafo, destacado, seccionPremiosHtml } from './plantillaEmail.js'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Remitente configurado (RESEND_FROM_EMAIL): en producción
// "Retornar <club@retornar.com.ar>", un dominio verificado en Resend.
// Mientras no haya un dominio verificado, el remitente de prueba
// (onboarding@resend.dev) solo puede mandar a la casilla de la cuenta de
// Resend — ver README. Cada negocio puede cambiar el NOMBRE visible
// (Negocio.emailRemitenteNombre, ej. "Club Peperina"); la dirección es
// siempre esta (usar otra, como club@peperina.com.ar, requiere verificar ese
// dominio en Resend: ver docs/lanzamiento/emails.md).
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'Retornar <onboarding@resend.dev>'

// El logo solo se usa si es una imagen https que los clientes de correo
// muestran: Gmail y Outlook no muestran SVG, y una URL http suele quedar
// bloqueada. Si no sirve, el mail sale con el nombre del club.
export function logoParaEmail(url) {
  if (typeof url !== 'string' || !url.trim()) return null
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:' || /\.svg$/i.test(u.pathname)) return null
    return u.toString()
  } catch {
    return null
  }
}

// Todo lo del negocio que necesita un mail: colores (los de su panel), logo,
// remitente visible, a dónde llegan las respuestas (su email de soporte) y
// la equivalencia de puntos. Siempre del negocio del mail (por negocioId).
async function datosDelNegocio(negocioId) {
  const negocio = negocioId
    ? await prisma.negocio.findUnique({
        where: { id: negocioId },
        select: { tema: true, emailRemitenteNombre: true, soporteEmail: true, puntosXPeso: true },
      })
    : null
  const t = resolverTema(negocio?.tema)
  return {
    t,
    logo: logoParaEmail(t.logo),
    from: remitente(negocio?.emailRemitenteNombre, EMAIL_FROM),
    replyTo: negocio?.soporteEmail || undefined,
    puntosXPeso: negocio?.puntosXPeso ?? null,
  }
}

async function premiosActivos(negocioId) {
  if (!negocioId) return []
  return prisma.premio.findMany({ where: { negocioId, activo: true }, orderBy: { puntos: 'asc' }, select: { nombre: true, puntos: true } })
}

// Resend no tira excepción cuando su API rechaza un envío (dominio sin
// verificar, límite de envíos por segundo): devuelve `{ error }`. Sin
// revisarlo, el mail se perdía sin dejar rastro en los logs. Devuelve si se
// envió. Todos los mails van con su versión de texto y, si el negocio cargó
// un email de soporte, con "responder a" ese email.
async function enviarConResend({ negocio, to, subject, html }, descripcion) {
  try {
    const { error } = (await resend.emails.send({
      from: negocio.from,
      to,
      subject,
      html,
      text: htmlATexto(html),
      ...(negocio.replyTo ? { replyTo: negocio.replyTo } : {}),
    })) || {}
    if (error) {
      console.error(`Error al enviar el email de ${descripcion} a`, ocultarEmail(to), error.message || error)
      return false
    }
    return true
  } catch (error) {
    console.error(`Error al enviar el email de ${descripcion} a`, ocultarEmail(to), error)
    return false
  }
}

const sinResend = (descripcion, email) => {
  console.warn(`RESEND_API_KEY no configurada: no se envió el email de ${descripcion} a`, ocultarEmail(email))
}

// El nombre de pila, para el saludo (si la cuenta tiene un nombre de verdad).
function saludo(nombre) {
  const pila = String(nombre || '').trim().split(/\s+/)[0]
  return pila && !pila.includes('@') ? `Hola, ${escaparHtml(pila)}:` : 'Hola:'
}

// Mail de aviso cada vez que se suman puntos a un cliente que ya tenía
// cuenta. `motivo`: 'compra' (manual, Mercado Pago, Tiendanube o Dragon
// Fish), 'cumpleanos' (netlify/functions/regalo-cumpleanos.mjs) o 'referido'
// (bono a quien invitó, cuando su amiga hace la primera compra).
const TEXTOS_PUNTOS = {
  compra: {
    icono: 'compra',
    titulo: 'Sumaste puntos',
    asunto: (puntos, club) => `+${puntos} puntos en ${club}`,
    texto: (club) => `¡Gracias por tu compra! Cada vez que comprás en <strong>${club}</strong> sumás puntos que después podés canjear por premios.`,
  },
  cumpleanos: {
    icono: 'cumpleanos',
    titulo: '¡Feliz cumpleaños!',
    asunto: (puntos, club) => `¡Feliz cumpleaños! +${puntos} puntos de regalo en ${club}`,
    texto: (club) => `Para festejar tu cumpleaños, <strong>${club}</strong> te regala puntos para que los canjees por premios.`,
  },
  referido: {
    icono: 'premio',
    titulo: 'Sumaste puntos',
    asunto: (puntos, club) => `+${puntos} puntos por invitar a una amiga en ${club}`,
    texto: (club) => `Una amiga que invitaste hizo su primera compra en <strong>${club}</strong>: por eso sumaste estos puntos de regalo.`,
  },
}

export async function enviarEmailPuntosAcreditados({ email, puntosAcreditados, puntosTotales, negocioNombre, negocioId, motivo = 'compra' }) {
  const textos = TEXTOS_PUNTOS[motivo] || TEXTOS_PUNTOS.compra
  if (!resend) return sinResend('puntos acreditados', email)

  const club = nombreClub(negocioNombre)
  const clubSeguro = escaparHtml(club)
  const negocio = await datosDelNegocio(negocioId)
  const { t } = negocio
  const contenidoHtml = `
    ${parrafo(t, textos.texto(clubSeguro))}
    ${destacado(t, `+${formatearMiles(puntosAcreditados)} puntos`, `Ahora tenés <strong>${formatearMiles(puntosTotales)} puntos</strong> en total`)}
    ${seccionPremiosHtml(t, await premiosActivos(negocioId), puntosTotales)}
  `
  await enviarConResend({
    negocio,
    to: email,
    subject: textos.asunto(puntosAcreditados, club),
    html: armarEmailHtml({
      t, clubSeguro, logo: negocio.logo, icono: textos.icono, titulo: textos.titulo,
      preheader: `Ahora tenés ${formatearMiles(puntosTotales)} puntos en ${club}.`,
      contenidoHtml, botonUrl: `${urlBase()}/login`, textoBoton: 'Ver mis premios', contacto: !!negocio.replyTo,
    }),
  }, 'puntos acreditados')
}

// Mail de bienvenida al registrarse (POST /api/registro/[negocio]), solo si
// el negocio lo activó en Ajustes (Negocio.emailBienvenida). Breve: gracias,
// cómo se suman puntos, el regalo de bienvenida si lo hubo y el primer
// premio al que puede llegar. Devuelve si se envió.
export async function enviarEmailBienvenida({ email, nombre, puntos = 0, puntosBienvenida = 0, negocioNombre, negocioId }) {
  if (!resend) {
    sinResend('bienvenida', email)
    return false
  }
  const club = nombreClub(negocioNombre)
  const clubSeguro = escaparHtml(club)
  const negocio = await datosDelNegocio(negocioId)
  const { t } = negocio
  const premios = await premiosActivos(negocioId)
  const proximo = premios.find((p) => p.puntos > puntos)
  const alcanzable = [...premios].reverse().find((p) => p.puntos <= puntos)
  const equivalencia = negocio.puntosXPeso > 0
    ? ` Sumás 1 punto por cada $${formatearMiles(negocio.puntosXPeso)} de compra, en el local y en la tienda online.`
    : ''
  const contenidoHtml = `
    ${parrafo(t, saludo(nombre))}
    ${parrafo(t, `Gracias por sumarte a <strong>${clubSeguro}</strong>. Desde hoy, cada compra suma puntos que podés canjear por premios.${equivalencia}`)}
    ${puntosBienvenida > 0 ? destacado(t, `${formatearMiles(puntosBienvenida)} puntos`, 'de regalo para empezar') : ''}
    ${alcanzable
      ? parrafo(t, `Ya te alcanza para <strong>${escaparHtml(alcanzable.nombre)}</strong>.`)
      : proximo ? parrafo(t, `Tu primer premio, <strong>${escaparHtml(proximo.nombre)}</strong>, está a ${formatearMiles(proximo.puntos - puntos)} puntos.`) : ''}
    ${parrafo(t, '¡Nos alegra mucho tenerte en el club!')}
  `
  return enviarConResend({
    negocio,
    to: email,
    subject: `Te damos la bienvenida a ${club}`,
    html: armarEmailHtml({
      t, clubSeguro, logo: negocio.logo, icono: 'premio', titulo: 'Te damos la bienvenida',
      preheader: puntosBienvenida > 0 ? `Ya tenés ${formatearMiles(puntosBienvenida)} puntos de regalo para empezar.` : 'Desde hoy, cada compra suma puntos para tus premios.',
      contenidoHtml, botonUrl: `${urlBase()}/login`, textoBoton: 'Ver mi cuenta', contacto: !!negocio.replyTo,
      motivoPie: `Recibís este email porque te sumaste a ${clubSeguro}.`,
    }),
  }, 'bienvenida')
}

// Mail de aviso después de canjear un premio (POST /api/canjes). Si el
// premio tenía un cupón de Tiendanube, se incluye el código para usarlo.
// Pensado como confirmación (no como promoción): asunto neutro, sin montos
// ni porcentajes en el asunto, y el código como dato, no como "cupón de
// descuento" (ver docs/lanzamiento/emails.md, Gmail).
export async function enviarEmailCanje({ email, premioNombre, puntosUsados, puntosRestantes, negocioNombre, negocioId, cuponCodigo, tiendanubeProductoUrl, enlaceProducto }) {
  if (!resend) return sinResend('canje', email)

  const club = nombreClub(negocioNombre)
  const clubSeguro = escaparHtml(club)
  const premioSeguro = escaparHtml(premioNombre)
  const negocio = await datosDelNegocio(negocioId)
  const { t } = negocio
  // Página intermedia del premio en Retornar (ruta propia) o, si no hay, el
  // link del producto en la tienda.
  const linkProducto = typeof enlaceProducto === 'string' && enlaceProducto.startsWith('/club/') ? `${urlBase()}${enlaceProducto}` : tiendanubeProductoUrl
  const cuponHtml = cuponCodigo
    ? `
      ${parrafo(t, 'Para recibirlo en la tienda online, usá este código al pagar:')}
      ${destacado(t, escaparHtml(cuponCodigo), 'Es de un solo uso.', { mono: true })}
      ${linkProducto
        ? parrafo(t, `Vale para <a href="${escaparHtml(linkProducto)}" style="color:${t.texto};">este producto</a>, en cualquier color o variante, sin otros productos en el carrito.`, { chico: true })
        : ''}
    `
    : ''
  const contenidoHtml = `
    ${parrafo(t, `Tu canje en <strong>${clubSeguro}</strong> está confirmado.`)}
    ${destacado(t, premioSeguro, `Usaste ${formatearMiles(puntosUsados)} puntos · te quedan ${formatearMiles(puntosRestantes)}`)}
    ${cuponHtml}
  `
  await enviarConResend({
    negocio,
    to: email,
    subject: `Confirmación de tu canje en ${club}`,
    html: armarEmailHtml({
      t, clubSeguro, logo: negocio.logo, icono: 'premio', titulo: 'Canje confirmado',
      preheader: `Tu premio: ${premioNombre}.`,
      contenidoHtml, botonUrl: `${urlBase()}/login`, textoBoton: 'Ver mi cuenta', contacto: !!negocio.replyTo,
    }),
  }, 'canje')
}

// Mail de aviso cuando netlify/functions/vencimiento-puntos.mjs le vence
// puntos a un cliente por no haberlos usado dentro de
// Negocio.vencimientoPuntosMeses desde que los ganó. Devuelve si se envió: la
// tarea lo reintenta si no.
export async function enviarEmailPuntosVencidos({ email, puntosVencidos, puntosTotales, negocioNombre, negocioId, meses }) {
  if (!resend) {
    sinResend('puntos vencidos', email)
    return false
  }
  const club = nombreClub(negocioNombre)
  const clubSeguro = escaparHtml(club)
  const negocio = await datosDelNegocio(negocioId)
  const { t } = negocio
  const contenidoHtml = `
    ${parrafo(t, `Te avisamos que algunos puntos en <strong>${clubSeguro}</strong> vencieron por no haberlos usado dentro de los ${meses} meses de haberlos sumado. Todavía te queda saldo para seguir canjeando.`)}
    ${destacado(t, `${formatearMiles(puntosVencidos)} puntos`, `vencieron · te quedan <strong>${formatearMiles(puntosTotales)} puntos</strong>`)}
  `
  return enviarConResend({
    negocio,
    to: email,
    subject: `Vencieron ${puntosVencidos} puntos en ${club}`,
    html: armarEmailHtml({
      t, clubSeguro, logo: negocio.logo, icono: 'vencimiento', titulo: 'Vencieron puntos',
      preheader: `Te quedan ${formatearMiles(puntosTotales)} puntos para canjear.`,
      contenidoHtml, botonUrl: `${urlBase()}/login`, textoBoton: 'Ver qué puedo canjear', contacto: !!negocio.replyTo,
    }),
  }, 'puntos vencidos')
}

// Mail de aviso antes de que venzan puntos (netlify/functions/vencimiento-puntos.mjs,
// ver lib/vencimientoPuntos.js). Los puntos que vencen salen de los lotes
// (cada compra por separado, solo lo que todavía no se usó), no del saldo
// total. `detalle`: [{ fecha, puntos }] si vencen en fechas distintas.
// Muestra qué premios puede canjear y, para los que no alcanza, cuántos
// puntos le faltan y cuánto tendría que comprar según la equivalencia del
// negocio. Devuelve si se envió (la tarea lo reintenta si no).
export async function enviarEmailPuntosPorVencer({ email, nombre, puntosPorVencer, fechaVencimiento, detalle, puntosTotales, negocioNombre, negocioId }) {
  if (!resend) {
    sinResend('puntos por vencer', email)
    return false
  }
  const club = nombreClub(negocioNombre)
  const clubSeguro = escaparHtml(club)
  const negocio = await datosDelNegocio(negocioId)
  const { t } = negocio
  const fecha = fechaCorta(fechaVencimiento)
  const premios = await premiosActivos(negocioId)
  const canjeables = premios.filter((p) => p.puntos <= puntosTotales)
  const proximo = premios.find((p) => p.puntos > puntosTotales)

  const porFecha = Array.isArray(detalle) && detalle.length > 1
    ? detalle.map((d) => `${formatearMiles(d.puntos)} el ${fechaCorta(d.fecha)}`).join(' · ')
    : `vencen el <strong>${fecha}</strong>`
  let invitacion
  if (canjeables.length > 0) {
    invitacion = `Ya te alcanza para ${canjeables.length === 1 ? 'un premio' : `${canjeables.length} premios`}: canjealo antes del <strong>${fecha}</strong> y aprovechá estos puntos.`
  } else if (proximo) {
    const faltan = proximo.puntos - puntosTotales
    const compra = negocio.puntosXPeso > 0 ? ` (unos $${formatearMiles(faltan * negocio.puntosXPeso)} en compras)` : ''
    invitacion = `Te faltan ${formatearMiles(faltan)} puntos${compra} para <strong>${escaparHtml(proximo.nombre)}</strong>. Si llegás antes del <strong>${fecha}</strong>, podés usar estos puntos antes de que venzan.`
  } else {
    invitacion = `Usalos antes del <strong>${fecha}</strong> para no perderlos.`
  }
  const equivalencia = negocio.puntosXPeso > 0 ? `Sumás 1 punto por cada $${formatearMiles(negocio.puntosXPeso)} de compra.` : ''

  const contenidoHtml = `
    ${parrafo(t, saludo(nombre))}
    ${parrafo(t, `Algunos de tus puntos en <strong>${clubSeguro}</strong> están por vencer:`)}
    ${destacado(t, `${formatearMiles(puntosPorVencer)} puntos`, `${porFecha}<br>Hoy tenés ${formatearMiles(puntosTotales)} puntos en total; el resto sigue disponible.`)}
    ${parrafo(t, invitacion)}
    ${seccionPremiosHtml(t, premios, puntosTotales, { titulo: 'Tus premios', puntosXPeso: negocio.puntosXPeso })}
    ${equivalencia ? parrafo(t, equivalencia, { chico: true }) : ''}
  `
  return enviarConResend({
    negocio,
    to: email,
    subject: `Tenés ${puntosPorVencer} puntos que vencen el ${fecha} en ${club}`,
    html: armarEmailHtml({
      t, clubSeguro, logo: negocio.logo, icono: 'vencimiento', titulo: 'Tus puntos vencen pronto',
      preheader: `Usalos antes del ${fecha} para no perderlos.`,
      contenidoHtml, botonUrl: `${urlBase()}/login`, textoBoton: 'Ver qué puedo canjear', contacto: !!negocio.replyTo,
    }),
  }, 'puntos por vencer')
}

// Mail de "Olvidé mi contraseña" (POST /api/password-reset/solicitar).
// Sirve tanto para un cliente como para el propio negocio: a un cliente se le
// muestra "Club X" (y sale con el remitente del club); al negocio, su propio
// nombre y el remitente de Retornar.
export async function enviarEmailRecuperacionPassword({ email, tipo, negocioNombre, negocioId, resetUrl }) {
  if (!resend) return sinResend('recuperación de contraseña', email)

  const nombre = tipo === 'negocio' ? negocioNombre : nombreClub(negocioNombre)
  const nombreSeguro = escaparHtml(nombre)
  const negocio = await datosDelNegocio(negocioId)
  if (tipo === 'negocio') {
    negocio.from = EMAIL_FROM
    negocio.replyTo = undefined
  }
  const { t } = negocio
  const contenidoHtml = `
    ${parrafo(t, `Nos pediste restablecer tu contraseña en <strong>${nombreSeguro}</strong>. Tocá el botón de abajo para elegir una nueva.`)}
    ${parrafo(t, 'Este link vale por 1 hora y solo se puede usar una vez. Si no lo pediste, podés ignorar este email: tu contraseña actual sigue funcionando.', { chico: true })}
  `
  await enviarConResend({
    negocio,
    to: email,
    subject: `Restablecer tu contraseña en ${nombre}`,
    html: armarEmailHtml({
      t, clubSeguro: nombreSeguro, logo: negocio.logo, icono: 'clave', titulo: 'Restablecer contraseña',
      preheader: 'El link vale por 1 hora.',
      contenidoHtml, botonUrl: resetUrl, textoBoton: 'Elegir nueva contraseña', contacto: false,
      motivoPie: 'Recibís este email porque se pidió restablecer la contraseña de tu cuenta.',
    }),
  }, 'recuperación de contraseña')
}
