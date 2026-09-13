import { createHmac, timingSafeEqual } from 'crypto'

// Verificación de firma de los webhooks de Tiendanube y Mercado Pago (ver
// docs/tareas-futuras.md, item sobre "Otros pendientes menores" que
// arrastraba esto sin resolver desde hacía varias sesiones) -- hasta ahora
// cualquiera que adivinara un store_id+orderId o un paymentId real podía
// dispararlos a mano.
//
// Las dos devuelven { verificable, valido } en vez de un booleano solo:
// `verificable` dice si había una clave secreta cargada como para poder
// comprobar algo (si no, `valido` queda en true a propósito, para no
// romper el flujo que ya funciona en producción mientras nadie cargue la
// variable de entorno correspondiente -- mismo criterio que
// RESEND_API_KEY/TIENDANUBE_APP_ID en el resto del proyecto: una
// integración opcional sin configurar no debe tirar abajo nada).

function compararHex(esperado, recibido) {
  if (typeof recibido !== 'string' || recibido.length === 0) return false
  const bufEsperado = Buffer.from(esperado, 'hex')
  const bufRecibido = Buffer.from(recibido, 'hex')
  // timingSafeEqual tira si los buffers no tienen el mismo largo -- eso ya
  // es "no coincide", no un caso para romper con una excepción.
  if (bufEsperado.length !== bufRecibido.length) return false
  return timingSafeEqual(bufEsperado, bufRecibido)
}

// Tiendanube firma el body crudo (los bytes tal cual, antes de parsear el
// JSON) con HMAC-SHA256, usando como clave el mismo Client Secret de la
// app del Partner Portal que ya se usa para el intercambio de código por
// token en el OAuth2 (ver lib/tiendanube.js) -- no es una clave nueva ni
// distinta, así que no hace falta ir a buscar nada más al Partner Portal.
// El resultado viaja en el header `x-linkedstore-hmac-sha256`, en hex.
//
// `rawBody` tiene que ser los bytes tal cual (un Buffer, no un string ya
// decodificado como UTF-8) -- decodificar y volver a codificar un body con
// algún caracter no-ASCII no siempre reproduce los bytes originales, y acá
// alcanza con que no coincidan una sola vez para que la firma calculada
// nunca más coincida con la real. `createHmac(...).update()` acepta un
// Buffer directamente, sin pasar por texto en el medio.
export function verificarFirmaTiendanube(rawBody, headerHmac, secret) {
  if (!secret) return { verificable: false, valido: true }
  if (!headerHmac) return { verificable: true, valido: false }
  const esperado = createHmac('sha256', secret).update(rawBody).digest('hex')
  return { verificable: true, valido: compararHex(esperado, headerHmac) }
}

// Mercado Pago arma un "manifest" de texto con el id del recurso (viene en
// el query string de la URL del webhook, como `data.id`, no en el body),
// el x-request-id, y el timestamp -- y lo firma con HMAC-SHA256 usando la
// "clave secreta" que Mercado Pago genera en Tus integraciones > Webhooks
// > Configurar notificación (hay que cargarla en MERCADOPAGO_WEBHOOK_SECRET,
// no existía esa variable hasta ahora). El resultado viaja en el header
// `x-signature`, con el formato `ts=<timestamp>,v1=<hash>`.
//
// Si `dataId` o `xRequestId` no vienen, el componente correspondiente se
// saca del manifest en vez de dejarlo vacío -- así lo pide la
// documentación oficial, para que el manifest coincida exactamente con el
// que arma Mercado Pago de su lado.
export function verificarFirmaMercadoPago({ xSignature, xRequestId, dataId, secret }) {
  if (!secret) return { verificable: false, valido: true }
  if (!xSignature) return { verificable: true, valido: false }

  const partes = {}
  for (const parte of xSignature.split(',')) {
    const [clave, valor] = parte.split('=').map((s) => s?.trim())
    if (clave && valor) partes[clave] = valor
  }
  const { ts, v1: hash } = partes
  if (!ts || !hash) return { verificable: true, valido: false }

  let manifest = ''
  if (dataId) manifest += `id:${dataId};`
  if (xRequestId) manifest += `request-id:${xRequestId};`
  manifest += `ts:${ts};`

  const esperado = createHmac('sha256', secret).update(manifest).digest('hex')
  return { verificable: true, valido: compararHex(esperado, hash) }
}
