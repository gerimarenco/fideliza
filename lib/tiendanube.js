// Cliente mínimo de la API de Tiendanube: pedir el precio de un producto,
// crear cupones de descuento, y (desde el ítem de conexión OAuth2 real)
// intercambiar el código de autorización por un access_token. Todo lo demás
// usa el mismo Negocio.tiendanubeAccessToken sin importar si se cargó a
// mano (token de una app privada) o vía el flujo de conectar/route.js — si
// ese token es de una app privada creada solo con permiso de lectura de
// órdenes, crear cupones va a fallar con 401/403 hasta que se regenere con
// permiso de escritura de descuentos y lectura de productos (ver README).
const TIENDANUBE_API = 'https://api.tiendanube.com/2025-03'
const TIENDANUBE_AUTH_URL = 'https://www.tiendanube.com/apps/authorize/token'

async function tiendanubeFetch(negocio, path, options = {}) {
  const response = await fetch(`${TIENDANUBE_API}/${negocio.tiendanubeStoreId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${negocio.tiendanubeAccessToken}`,
      'User-Agent': 'Retornar (soporte@retornar.com.ar)',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const detalle = await response.text().catch(() => '')
    throw new Error(`Tiendanube API respondió ${response.status} en ${path}: ${detalle.slice(0, 300)}`)
  }

  return response.json()
}

// Precio de la primera variante del producto — para un producto con varias
// variantes de distinto precio (ej. colores con precios distintos) esto es
// una aproximación: el cupón que se arma con este valor solo cubre el precio
// de esa variante, no necesariamente el de la que termine eligiendo la
// clienta. Ver limitación documentada en docs/tareas-futuras.md.
export async function obtenerPrecioProducto(negocio, productoId) {
  const producto = await tiendanubeFetch(negocio, `/products/${productoId}`)
  const precio = parseFloat(producto.variants?.[0]?.price)
  if (!Number.isFinite(precio)) {
    throw new Error(`El producto ${productoId} no tiene un precio válido`)
  }
  return precio
}

// Código legible y suficientemente único como para no colisionar con otro
// cupón de la misma tienda (Tiendanube exige códigos únicos por tienda).
// Siempre el mismo para el mismo canje: así reintentar la creación de un
// cupón que falló nunca puede terminar en dos cupones para un solo canje
// (Tiendanube rechaza el segundo por código repetido).
export function codigoCuponDeCanje(canjeId) {
  return `RETORNAR-${canjeId.slice(-8).toUpperCase()}`
}
const generarCodigoCupon = codigoCuponDeCanje

// Cupón de un solo uso (max_uses: 1) por el valor total del producto
// canjeado, con min_price igual a ese valor para que no se pueda aplicar a
// un carrito más barato y terminar en un descuento parcial. La API de
// cupones de Tiendanube no permite restringir el cupón a un producto
// puntual (eso existe para "Descuentos" vía un partner app con webhook de
// checkout, una integración mucho más pesada que no corresponde acá) — por
// eso el resultado real es "un cupón que cubre el precio de este producto",
// no una garantía técnica de que solo se pueda usar en él.
export async function crearCuponProductoGratis(negocio, canjeId, precioProducto) {
  const codigo = generarCodigoCupon(canjeId)
  await tiendanubeFetch(negocio, '/coupons', {
    method: 'POST',
    body: JSON.stringify({
      code: codigo,
      type: 'absolute',
      value: precioProducto.toFixed(2),
      min_price: precioProducto,
      max_uses: 1,
      valid: true,
    }),
  })
  return codigo
}

// Cupón de descuento porcentual de un solo uso para premios tipo "10% off"
// (no ligados a un producto puntual). Tiendanube ya limita a un cupón por
// pedido en el checkout, así que max_uses: 1 alcanza para "no acumulable"
// con otro cupón — no hay forma de controlar por API que no se acumule con
// una promoción automática configurada aparte en el panel de la tienda.
export async function crearCuponPorcentaje(negocio, canjeId, porcentaje) {
  const codigo = generarCodigoCupon(canjeId)
  await tiendanubeFetch(negocio, '/coupons', {
    method: 'POST',
    body: JSON.stringify({
      code: codigo,
      type: 'percentage',
      value: porcentaje.toFixed(2),
      max_uses: 1,
      valid: true,
    }),
  })
  return codigo
}

// Cupón de un monto fijo en pesos, con una compra mínima obligatoria para
// poder usarlo (min_price) — pensado para premios tipo "$70.000 off, pero
// solo en compras de $140.000 o más". Sin ese mínimo, alguien podría armar
// un carrito de exactamente el valor del cupón y llevárselo gratis; con el
// mínimo, el negocio cobra al menos (compra mínima - monto) de cualquier
// compra que use el cupón.
//
// La compra mínima tiene que ser MAYOR que el monto: antes, si no se cargaba,
// se usaba el propio monto como piso, y un carrito de exactamente ese valor
// quedaba en $0 (el comentario anterior decía lo contrario). Se rechaza acá,
// antes de llamar a Tiendanube, además de validarse al guardar el premio.
//
// Lo que este código NO puede garantizar (depende de cómo Tiendanube evalúa
// min_price, no documentado): si el piso se compara contra el subtotal antes
// o después de otras promociones automáticas de la tienda, y si incluye el
// envío. Ver el protocolo de prueba real en docs/lanzamiento/.
export async function crearCuponMontoFijo(negocio, canjeId, monto, montoMinimo) {
  if (!(montoMinimo > monto)) {
    throw new Error(`La compra mínima (${montoMinimo ?? 'sin cargar'}) tiene que ser mayor que el descuento (${monto})`)
  }
  const codigo = generarCodigoCupon(canjeId)
  await tiendanubeFetch(negocio, '/coupons', {
    method: 'POST',
    body: JSON.stringify({
      code: codigo,
      type: 'absolute',
      value: monto.toFixed(2),
      min_price: montoMinimo,
      max_uses: 1,
      valid: true,
    }),
  })
  return codigo
}

// URL de la página siguiente según el encabezado Link de Tiendanube
// (`<https://...&page=2>; rel="next", <...>; rel="last"`). null si no hay.
export function siguienteDeLink(link) {
  if (typeof link !== 'string') return null
  for (const parte of link.split(',')) {
    const m = parte.match(/<([^>]+)>\s*;\s*rel="?next"?/i)
    if (m) return m[1].trim()
  }
  return null
}

// Número de página de una URL de paginación (`...?page=3&per_page=200`).
function paginaDeUrl(url) {
  try {
    const n = Number(new URL(url).searchParams.get('page'))
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

// Todos los cupones de la tienda (GET /coupons), para leer su estado:
// `used`, `max_uses`, `valid`, `end_date`, `deleted_at` (ver
// lib/estadoCupon.js). Solo lee.
//
// Paginación como la documenta Tiendanube: se pide `per_page=200` (el
// máximo) y se pasa a la página que indica `rel="next"` en el encabezado
// Link hasta que no haya más; el encabezado `x-total-count` dice cuántos
// cupones hay en total. No se deduce el final de que una página traiga
// menos de 200: la tienda podría devolver páginas más chicas. De la URL
// `next` solo se toma el número de página (tiene que ser la siguiente): el
// pedido se arma siempre contra esta misma tienda, así el token nunca va a
// otra dirección.
//
// `completo` es true solo si se puede asegurar que se leyó todo: los
// cupones distintos leídos coinciden con `x-total-count` (y el total no
// cambió entre páginas: si se crearon o borraron cupones mientras se
// recorría, las páginas pueden correrse), o, si la tienda no manda ese
// encabezado, se llegó a la última página según Link. Sin ninguna de las
// dos señales, si el enlace es incoherente o si se corta antes, es false y
// la sincronización no cambia nada (ver lib/sincronizarCupones.js). Un
// error de Tiendanube en cualquier página corta todo con una excepción.
export async function listarCupones(negocio, { maxPaginas = 50 } = {}) {
  const base = `${TIENDANUBE_API}/${negocio.tiendanubeStoreId}/coupons`
  const cupones = []
  let pagina = 1
  let total = null
  let totalCambio = false
  // La última página tiene que traer su propio Link (sin `next`) para
  // saber que es la última.
  let ultimaConLink = false
  let pendiente = false
  for (;;) {
    const response = await fetch(`${base}?per_page=200&page=${pagina}`, {
      headers: {
        Authorization: `Bearer ${negocio.tiendanubeAccessToken}`,
        'User-Agent': 'Retornar (soporte@retornar.com.ar)',
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const detalle = await response.text().catch(() => '')
      throw new Error(`Tiendanube API respondió ${response.status} en /coupons (página ${pagina}): ${detalle.slice(0, 300)}`)
    }
    const lote = await response.json()
    if (!Array.isArray(lote)) throw new Error('Tiendanube devolvió una lista de cupones inválida')
    cupones.push(...lote)
    const totalEncabezado = parseInt(response.headers.get('x-total-count'), 10)
    if (Number.isFinite(totalEncabezado)) {
      if (total != null && total !== totalEncabezado) totalCambio = true
      total = totalEncabezado
    }
    const link = response.headers.get('link')
    ultimaConLink = Boolean(link)
    const siguiente = siguienteDeLink(link)
    if (!siguiente) break
    // Un `next` que no apunta a la página siguiente no se sigue: el
    // listado queda incompleto.
    if (paginaDeUrl(siguiente) !== pagina + 1 || pagina >= maxPaginas) {
      pendiente = true
      break
    }
    pagina++
  }

  const distintos = new Set(cupones.map((c) => c?.id ?? c?.code).filter((x) => x != null)).size
  const completo = !pendiente && !totalCambio && (total != null ? distintos >= total : ultimaConLink)
  return { cupones, completo, total }
}

// Paso final del OAuth2 (ver app/api/tiendanube/callback): cambia el `code`
// de la redirección por un access_token permanente (Tiendanube no los
// vence — solo se invalidan si se pide uno nuevo o la tienda desinstala la
// app) más el user_id, que es el id de la tienda. Confirmado funcionando
// en vivo (form-urlencoded, como documenta OAuth2/RFC 6749) conectando la
// tienda real de Peperina.
export async function intercambiarCodigoPorToken(code) {
  const response = await fetch(TIENDANUBE_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'Retornar (soporte@retornar.com.ar)',
    },
    body: new URLSearchParams({
      client_id: process.env.TIENDANUBE_APP_ID,
      client_secret: process.env.TIENDANUBE_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  })

  if (!response.ok) {
    const detalle = await response.text().catch(() => '')
    throw new Error(`Tiendanube OAuth respondió ${response.status} al intercambiar el código: ${detalle.slice(0, 300)}`)
  }

  const datos = await response.json()
  if (!datos.access_token || !datos.user_id) {
    throw new Error(`Tiendanube OAuth no devolvió access_token/user_id: ${JSON.stringify(datos).slice(0, 300)}`)
  }
  return datos
}

// Conectar la tienda (ya sea a mano o por OAuth2) no le avisa solo a
// Tiendanube que tiene que mandar el webhook de "pedido pagado" — eso es
// una suscripción aparte que hay que crear por API. Sin esto, quedaba como
// un paso manual más (crear el webhook a mano en la app, algo fácil de
// saltear u olvidar) del que dependía silenciosamente que las compras
// online sumen puntos. Se llama automáticamente después de un conectar
// exitoso (ver app/api/tiendanube/callback) — revisa primero si ya existe
// una suscripción igual (mismo evento y URL) antes de crear una nueva, para
// que reconectar la misma tienda no vaya dejando duplicados (que además de
// prolijo, entregarían el mismo webhook dos veces seguidas — inofensivo
// gracias a la protección de WebhookEvento, pero sin sentido).
export async function asegurarWebhookOrderPaid(negocio, url) {
  const existentes = await tiendanubeFetch(negocio, '/webhooks')
  const yaExiste = existentes.some((webhook) => webhook.event === 'order/paid' && webhook.url === url)
  if (yaExiste) return

  await tiendanubeFetch(negocio, '/webhooks', {
    method: 'POST',
    body: JSON.stringify({ event: 'order/paid', url }),
  })
}

// Qué se puede acreditar de una orden pedida a la API (ver
// app/api/webhooks/tiendanube): solo si figura pagada y trae email y total
// válidos. Devuelve { email, total } o { motivo } si no corresponde. El
// evento "order/paid" del webhook no alcanza solo: si la firma no se puede
// verificar, cualquiera podría mandarlo con el id de una orden pendiente o
// anulada.
export function datosOrdenAcreditable(orden) {
  if (orden?.payment_status !== 'paid') return { motivo: 'no_pagada' }
  // Una orden cancelada puede seguir con el pago en "paid" hasta que se
  // reintegra: si el aviso se procesa tarde, no tiene que sumar.
  if (orden.status === 'cancelled') return { motivo: 'cancelada' }
  const email = typeof orden.contact_email === 'string' ? orden.contact_email.trim().toLowerCase() : ''
  const total = parseFloat(orden.total)
  if (!email || !Number.isFinite(total) || total < 0) return { motivo: 'incompleta' }
  return { email, total }
}
