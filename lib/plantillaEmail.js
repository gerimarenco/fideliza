// Plantilla común de los mails a las clientas (lib/email.js) y piezas puras
// que se pueden probar sin base: remitente, versión de texto, bloques.
//
// Diseño: minimalista y con los colores de cada negocio (Negocio.tema, los
// mismos de su panel): fondo del negocio, tarjeta blanca con línea fina,
// logo o nombre del club arriba, título en serif, un número destacado sobre
// el fondo del negocio, botón recto con el color de marca y un pie corto.
// Hecho con tablas y estilos en línea: Outlook de escritorio (motor de
// Word) ignora flex, márgenes de divs y casi todo el CSS externo.
import { contraste } from './colores.js'
import { urlBase } from './urlBase.js'
import { formatearMiles } from './clienteStats.js'

const ESCAPES_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (c) => ESCAPES_HTML[c])
}

export const SERIF = "Georgia,'Times New Roman',serif"
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Remitente visible: "<nombre> <dirección>". La dirección es siempre la del
// remitente configurado (RESEND_FROM_EMAIL, un dominio verificado en
// Resend); solo cambia el nombre que se ve en la bandeja. Sin nombre propio
// del negocio, queda el remitente de siempre. Se limpia el nombre para que
// no pueda romper el encabezado (comillas, <>, saltos de línea).
export function remitente(nombre, base) {
  const limpio = String(nombre ?? '').replace(/["<>\\\r\n\t]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!limpio) return base
  const direccion = (String(base).match(/<([^>]+)>/)?.[1] || String(base)).trim()
  return `${limpio} <${direccion}>`
}

// Versión de solo texto del mail (los clientes de correo y los filtros de
// spam la esperan junto al HTML). Se arma del mismo HTML: los links quedan
// como "texto (url)".
const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
export function htmlATexto(html) {
  return String(html)
    .replace(/<div[^>]*data-preheader[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<(style|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, texto) => {
      const t = texto.replace(/<[^>]+>/g, '').trim()
      return t && t !== url ? `${t} (${url})` : url
    })
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTIDADES[e])
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Íconos lineales de la app publicados como PNG en /public/email (Gmail y
// Outlook no muestran SVG): compra, premio, cumpleanos, vencimiento, clave.
// Sobre fondo blanco va la versión oscura.
export function iconoUrl(nombre, colorTexto = '#17191b') {
  const tono = contraste(colorTexto, '#ffffff') <= contraste(colorTexto, '#17191b') ? 'claro' : 'oscuro'
  return `${urlBase()}/email/icono-${nombre}-${tono}.png`
}

// Párrafo del cuerpo.
export function parrafo(t, html, { chico = false, centrado = false } = {}) {
  return `<p style="margin:0 0 16px;font-size:${chico ? 13 : 15}px;line-height:1.6;color:${chico ? t.textoSecundario : t.texto};${centrado ? 'text-align:center;' : ''}">${html}</p>`
}

// Número o dato destacado (puntos, premio, código), sobre el fondo del negocio.
export function destacado(t, valorHtml, detalleHtml, { mono = false } = {}) {
  const valor = mono
    ? `<div style="font-family:'Courier New',Courier,monospace;font-size:20px;letter-spacing:2px;color:${t.texto};">${valorHtml}</div>`
    : `<div style="font-family:${SERIF};font-size:34px;line-height:1.15;color:${t.primarioLegible};">${valorHtml}</div>`
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:4px 0 20px;">
      <tr><td align="center" style="background:${t.fondo};padding:22px 16px;text-align:center;">
        ${valor}
        ${detalleHtml ? `<div style="font-size:13px;line-height:1.5;color:${t.textoSecundario};margin-top:6px;">${detalleHtml}</div>` : ''}
      </td></tr>
    </table>`
}

// Lista de premios con cuánto le falta para cada uno. Con `puntosXPeso`
// (pesos por punto del negocio) agrega cuánto tendría que comprar para
// llegar. `premios`: [{ nombre, puntos }] activos, de menor a mayor.
export function seccionPremiosHtml(t, premios, puntosTotales, { titulo = 'Así vas con tus premios', puntosXPeso = null } = {}) {
  if (!premios?.length) return ''
  const filas = premios.map((premio) => {
    const alcanzado = premio.puntos <= puntosTotales
    const faltan = premio.puntos - puntosTotales
    const porcentaje = Math.max(0, Math.min(100, Math.round((puntosTotales / premio.puntos) * 100)))
    const compra = !alcanzado && puntosXPeso > 0 ? ` · comprando $${formatearMiles(faltan * puntosXPeso)}` : ''
    const estado = alcanzado
      ? `<span style="color:#15803d;">Ya lo podés canjear</span>`
      : `Te faltan ${formatearMiles(faltan)} puntos${compra}`
    const celdaRelleno = porcentaje > 0 ? `<td width="${porcentaje}%" style="width:${porcentaje}%;height:4px;line-height:4px;font-size:0;background:${alcanzado ? '#15803d' : t.primarioLegible};">&nbsp;</td>` : ''
    const celdaResto = porcentaje < 100 ? `<td style="height:4px;line-height:4px;font-size:0;">&nbsp;</td>` : ''
    return `
      <tr><td style="padding:12px 0 0;">
        <div style="font-family:${SERIF};font-size:17px;color:${t.texto};">${escaparHtml(premio.nombre)} <span style="font-family:${SANS};font-size:13px;color:${t.textoSecundario};">· ${formatearMiles(premio.puntos)} puntos</span></div>
        <div style="font-size:13px;color:${t.textoSecundario};margin:2px 0 6px;">${estado}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${t.borde};"><tr>${celdaRelleno}${celdaResto}</tr></table>
      </td></tr>`
  }).join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 4px;border-top:1px solid ${t.borde};">
      <tr><td style="padding:16px 0 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${t.textoSecundario};">${titulo}</td></tr>
      ${filas}
    </table>`
}

// La página completa. `t`: tema resuelto del negocio (resolverTema).
// `preheader`: la línea que muestra la bandeja junto al asunto.
// `contacto`: si hay un email de respuesta, el pie invita a responder.
export function armarEmailHtml({ t, clubSeguro, logo, icono, titulo, preheader, contenidoHtml, botonUrl, textoBoton, contacto = false, motivoPie }) {
  const encabezado = logo
    ? `<img src="${escaparHtml(logo)}" height="44" alt="${clubSeguro}" style="display:block;margin:0 auto;height:44px;width:auto;max-width:200px;border:0;outline:none;text-decoration:none;" />`
    : `<div style="font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:${t.textoSecundario};">${clubSeguro}</div>`
  const boton = botonUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px;">
        <tr><td align="center" style="background:${t.primario};">
          <a href="${escaparHtml(botonUrl)}" style="display:block;padding:15px 18px;color:${t.primarioTexto};font-size:15px;letter-spacing:0.3px;text-decoration:none;text-align:center;">${textoBoton}</a>
        </td></tr>
      </table>`
    : ''
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaparHtml(titulo)}</title></head>
<body style="margin:0;padding:0;background:${t.fondo};">
  ${preheader ? `<div data-preheader style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escaparHtml(preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${t.fondo};">
    <tr><td align="center" style="padding:32px 12px;font-family:${SANS};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:520px;background:#ffffff;border:1px solid ${t.borde};">
        <tr><td align="center" style="padding:32px 32px 0;text-align:center;">${encabezado}</td></tr>
        <tr><td align="center" style="padding:26px 32px 0;text-align:center;">
          ${icono ? `<img src="${iconoUrl(icono, t.texto)}" width="26" height="26" alt="" style="display:block;width:26px;height:26px;margin:0 auto 12px;border:0;outline:none;text-decoration:none;" />` : ''}
          <h1 style="margin:0;font-family:${SERIF};font-weight:400;font-size:27px;line-height:1.2;color:${t.texto};">${titulo}</h1>
          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:18px auto 0;"><tr><td width="40" style="width:40px;height:1px;line-height:1px;font-size:0;background:${t.primarioLegible};">&nbsp;</td></tr></table>
        </td></tr>
        <tr><td style="padding:26px 32px 8px;">${contenidoHtml}</td></tr>
        <tr><td style="padding:0 32px 32px;">${boton}</td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:520px;">
        <tr><td align="center" style="padding:18px 24px 0;text-align:center;font-size:12px;line-height:1.6;color:${t.textoSecundario};">
          ${motivoPie || `Recibís este email porque tenés una cuenta en ${clubSeguro}.`}${contacto ? '<br>Si tenés alguna duda, respondé este email.' : ''}<br>${clubSeguro} · con Retornar
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
