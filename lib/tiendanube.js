import { urlBase } from './urlBase.js'
// Cliente mínimo de la API de Tiendanube: leer un producto (precio y stock),
// crear cupones de descuento (los de premio-producto, atados al producto), y (desde el ítem de conexión OAuth2 real)
// intercambiar el código de autorización por un access_token. Todo lo demás
// usa el mismo Negocio.tiendanubeAccessToken sin importar si se cargó a
// mano (token de una app privada) o vía el flujo de conectar/route.js — si
// ese token es de una app privada creada solo con permiso de lectura de
// órdenes, crear cupones va a fallar con 401/403 hasta que se regenere con
// permiso de escritura de descuentos y lectura de productos (ver README).
const TIENDANUBE_API = 'https://api.tiendanube.com/2025-03'
const TIENDANUBE_AUTH_URL = 'https://www.tiendanube.com/apps/authorize/token'

async function tiendanubeFetch(negocio, path, { timeoutMs, ...options } = {}) {
  const response = await fetch(`${TIENDANUBE_API}/${negocio.tiendanubeStoreId}${path}`, {
    ...options,
    // Con timeoutMs, si Tiendanube no responde a tiempo se corta con error
    // (quien llama lo toma como "no se pudo confirmar").
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
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

  // Un DELETE puede responder sin cuerpo.
  const texto = await response.text()
  return texto ? JSON.parse(texto) : {}
}

// El producto tal como lo devuelve la API (variantes con precio y stock).
// Solo lee.
export async function obtenerProducto(negocio, productoId, { timeoutMs } = {}) {
  return tiendanubeFetch(negocio, `/products/${encodeURIComponent(productoId)}`, { timeoutMs })
}

// Busca productos de la tienda por nombre (para elegir el producto de un
// premio y sus alternativas en el panel). Solo lee: GET /products?q=.
export async function buscarProductos(negocio, texto, { timeoutMs = 8000 } = {}) {
  const q = new URLSearchParams({ q: String(texto || '').trim().slice(0, 80), per_page: '20' })
  const lista = await tiendanubeFetch(negocio, `/products?${q}`, { timeoutMs })
  return Array.isArray(lista) ? lista : []
}

// Precio que paga la clienta por una variante: el promocional si la variante
// tiene uno vigente y menor, si no el de lista.
export function precioDeVariante(variante) {
  const precio = parseFloat(variante?.price)
  const promocional = parseFloat(variante?.promotional_price)
  if (Number.isFinite(promocional) && promocional > 0 && (!Number.isFinite(precio) || promocional < precio)) return promocional
  return Number.isFinite(precio) && precio > 0 ? precio : null
}

// Una variante se puede comprar si la tienda no controla su stock (stock
// null o stock_management false) o si tiene al menos una unidad.
function varianteConStock(variante) {
  if (variante?.stock_management === false || variante?.stock == null) return true
  return Number(variante.stock) > 0
}

// Cuánto vale el cupón de un premio-producto y si hoy se puede comprar.
// Decisión de Genaro (2026-11-05): si las variantes tienen precios
// distintos, el cupón vale la MÁS BARATA de las que tienen stock. Así ningún
// carrito saca más descuento que el precio de una unidad (con la variante
// barata sale gratis; con una más cara se paga la diferencia). Si todas
// valen lo mismo, es ese precio (igual que antes).
// → { valor, disponible, motivo } (motivo: 'sin_stock' | 'no_publicado' | null).
// Sin stock en ninguna variante, el valor es el de la más barata de todas
// (sirve para reintentar el cupón de un canje ya hecho).
export function valorCuponDeProducto(producto) {
  const variantes = (Array.isArray(producto?.variants) ? producto.variants : [])
    .map((v) => ({ precio: precioDeVariante(v), conStock: varianteConStock(v) }))
    .filter((v) => v.precio != null)
  if (variantes.length === 0) throw new Error(`El producto ${producto?.id ?? ''} no tiene un precio válido`)
  const conStock = variantes.filter((v) => v.conStock)
  const valor = Math.min(...(conStock.length ? conStock : variantes).map((v) => v.precio))
  const motivo = producto?.published === false ? 'no_publicado' : conStock.length === 0 ? 'sin_stock' : null
  return { valor, disponible: motivo == null, motivo }
}

// Etiqueta legible del código a partir del nombre del premio: la primera
// palabra con sentido, sin tildes ni ñ (Tiendanube compara códigos en
// mayúsculas). "Pañuelo de seda" → PANUELO, "10% de descuento" → DESCUENTO.
const PALABRAS_VACIAS = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'UN', 'UNA', 'CON', 'PARA', 'POR', 'EN', 'Y', 'OFF', 'TODA', 'TODO', 'TODAS', 'TODOS', 'TU', 'TUS', 'SU', 'SUS', 'MI', 'MIS'])
export function etiquetaCupon(nombre) {
  const palabras = String(nombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
  const palabra = palabras.find((p) => p.length >= 3 && /[A-Z]/.test(p) && !PALABRAS_VACIAS.has(p))
  return (palabra || 'PREMIO').slice(0, 10)
}

// Código de los cupones emitidos ANTES de los códigos con etiqueta. Se
// conserva para reintentar esos canjes con el mismo código que ya se le
// pidió a Tiendanube (así un reintento nunca crea un segundo cupón).
export function codigoCuponDeCanje(canjeId) {
  return `RETORNAR-${canjeId.slice(-8).toUpperCase()}`
}

// Código de los canjes nuevos: RETORNAR-<PREMIO>-<8 caracteres del canje>,
// por ejemplo RETORNAR-PANUELO-AB12CD34. Se guarda en el canje
// (Canje.cuponCodigoPrevisto) al crearlo, antes de llamar a Tiendanube: el
// reintento usa siempre ese mismo código aunque después cambie el nombre del
// premio. Las 8 letras del canje lo hacen único en la tienda (Tiendanube
// rechaza códigos repetidos). El nombre es solo para reconocerlo: la
// restricción real es la de `products` (ver crearCuponDeProducto).
export function codigoCuponConEtiqueta(canjeId, nombrePremio) {
  return `RETORNAR-${etiquetaCupon(nombrePremio)}-${canjeId.slice(-8).toUpperCase()}`
}

// Ids de producto de un cupón tal como lo devuelve Tiendanube (la
// documentación lo describe como lista de ids o de productos).
export function productosDelCupon(cupon) {
  if (!Array.isArray(cupon?.products)) return null
  return cupon.products.map((p) => String(typeof p === 'object' && p !== null ? p.id : p))
}

// Retira un cupón recién creado que no quedó como se pidió (nunca se le
// mostró a nadie). Devuelve true si se pudo.
async function retirarCupon(negocio, cuponId) {
  try {
    await tiendanubeFetch(negocio, `/coupons/${cuponId}`, { method: 'DELETE' })
    return true
  } catch {
    try {
      await tiendanubeFetch(negocio, `/coupons/${cuponId}`, { method: 'PUT', body: JSON.stringify({ valid: false }) })
      return true
    } catch {
      return false
    }
  }
}

// Cupón de un premio-producto, atado al producto en Tiendanube:
// - products: [id] — según la documentación de Tiendanube (API y centro de
//   ayuda), el cupón solo se aplica si TODOS los productos del carrito son
//   ese producto, y vale para todas sus variantes (colores, talles). Con
//   otro producto en el carrito (aunque cueste parecido) Tiendanube no lo
//   acepta, y no se puede combinar con otros productos.
// - type absolute + value: un monto (el de una unidad, ver
//   valorCuponDeProducto), así llevar dos unidades no da dos gratis.
// - min_price = ese valor y max_uses: 1 (un solo uso).
// Después de crearlo se comprueba que Tiendanube lo haya guardado atado al
// producto. Si no (por ejemplo, si la API ignorara el campo), el cupón se
// retira en el acto y se lanza RESTRICCION_NO_APLICADA: nunca se entrega un
// cupón que sirva para cualquier producto.
export async function crearCuponDeProducto(negocio, codigo, productoId, valor) {
  const id = String(productoId ?? '').trim()
  if (!/^\d+$/.test(id)) throw new Error(`El id de producto de Tiendanube "${id}" no es válido`)
  const creado = await tiendanubeFetch(negocio, '/coupons', {
    method: 'POST',
    body: JSON.stringify({
      code: codigo,
      type: 'absolute',
      value: valor.toFixed(2),
      min_price: valor,
      max_uses: 1,
      valid: true,
      products: [Number(id)],
    }),
  })
  let productos = productosDelCupon(creado)
  if (productos == null && creado?.id != null) {
    const leido = await tiendanubeFetch(negocio, `/coupons/${creado.id}`).catch(() => null)
    productos = productosDelCupon(leido)
  }
  if (productos == null || productos.length !== 1 || productos[0] !== id) {
    const retirado = creado?.id != null ? await retirarCupon(negocio, creado.id) : false
    throw new Error(`RESTRICCION_NO_APLICADA: Tiendanube no guardó el cupón ${codigo} atado al producto ${id}; ${retirado ? 'se retiró' : 'NO se pudo retirar: desactivarlo a mano'}`)
  }
  return codigo
}

// Cupón de descuento porcentual de un solo uso para premios tipo "10% off"
// (no ligados a un producto puntual). Tiendanube ya limita a un cupón por
// pedido en el checkout, así que max_uses: 1 alcanza para "no acumulable"
// con otro cupón — no hay forma de controlar por API que no se acumule con
// una promoción automática configurada aparte en el panel de la tienda.
export async function crearCuponPorcentaje(negocio, codigo, porcentaje) {
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
// compra que use el cupón. Es un descuento para toda la tienda (a propósito:
// no es un premio-producto).
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
export async function crearCuponMontoFijo(negocio, codigo, monto, montoMinimo) {
  if (!(montoMinimo > monto)) {
    throw new Error(`La compra mínima (${montoMinimo ?? 'sin cargar'}) tiene que ser mayor que el descuento (${monto})`)
  }
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
export const RUTA_WEBHOOK = '/api/webhooks/tiendanube'

// Dirección a la que Tiendanube tiene que mandar los avisos: siempre la del
// dominio público de Retornar (NEXT_PUBLIC_BASE_URL o retornar.com.ar), nunca
// la del pedido en curso (antes se tomaba del navegador al conectar, y quedaba
// la de Netlify si se conectaba desde ahí).
export const urlWebhookTiendanube = () => `${urlBase()}${RUTA_WEBHOOK}`

// Revisa la suscripción order/paid de la tienda y la deja apuntando a `url`
// (la dirección canónica de Retornar, ver urlWebhookTiendanube). Si hay una
// de Retornar con otra dirección (por ejemplo, la de Netlify de antes del
// dominio propio, que hoy responde con una redirección que Tiendanube no
// sigue), la corrige en vez de crear otra. Devuelve qué hizo:
// "ya_estaba" | "corregida" | "creada".
export async function asegurarWebhookOrderPaid(negocio, url) {
  const existentes = await tiendanubeFetch(negocio, '/webhooks')
  const deOrderPaid = (Array.isArray(existentes) ? existentes : []).filter((w) => w.event === 'order/paid')
  if (deOrderPaid.some((w) => w.url === url)) return 'ya_estaba'
  const deRetornar = deOrderPaid.find((w) => typeof w.url === 'string' && w.url.split('?')[0].endsWith(RUTA_WEBHOOK))
  if (deRetornar) {
    await tiendanubeFetch(negocio, `/webhooks/${deRetornar.id}`, { method: 'PUT', body: JSON.stringify({ event: 'order/paid', url }) })
    return 'corregida'
  }
  await tiendanubeFetch(negocio, '/webhooks', {
    method: 'POST',
    body: JSON.stringify({ event: 'order/paid', url }),
  })
  return 'creada'
}

// Solo lee: las suscripciones de webhooks de la tienda (para el diagnóstico).
export async function listarWebhooks(negocio) {
  const r = await tiendanubeFetch(negocio, '/webhooks', { timeoutMs: 15000 })
  return Array.isArray(r) ? r : []
}

// La orden completa (el webhook solo trae su id). Con límite de tiempo: si
// Tiendanube no responde, es un error temporal y se reintenta.
export async function obtenerOrden(negocio, orderId, { timeoutMs = 8000 } = {}) {
  return tiendanubeFetch(negocio, `/orders/${encodeURIComponent(String(orderId))}`, { timeoutMs })
}

// Solo lee: órdenes pagadas actualizadas desde `desde` (para la conciliación
// y el script de recuperación). Pagina con per_page=200 hasta que una página
// venga incompleta o se llegue a `maxPaginas` (`completo` dice si se leyó todo).
export async function listarOrdenesPagadas(negocio, { desde, hasta, maxPaginas = 10, timeoutMs = 15000 } = {}) {
  const ordenes = []
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const q = new URLSearchParams({ payment_status: 'paid', per_page: '200', page: String(pagina) })
    if (desde) q.set('updated_at_min', new Date(desde).toISOString())
    if (hasta) q.set('updated_at_max', new Date(hasta).toISOString())
    let lote
    try {
      lote = await tiendanubeFetch(negocio, `/orders?${q}`, { timeoutMs })
    } catch (error) {
      // Tiendanube responde 404 cuando se pide una página después de la última.
      if (pagina > 1 && /respondió 404/.test(error.message)) return { ordenes, completo: true }
      throw error
    }
    const lista = Array.isArray(lote) ? lote : []
    ordenes.push(...lista)
    if (lista.length < 200) return { ordenes, completo: true }
  }
  return { ordenes, completo: false }
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
