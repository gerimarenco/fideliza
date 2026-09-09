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
function generarCodigoCupon(canjeId) {
  return `RETORNAR-${canjeId.slice(-8).toUpperCase()}`
}

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

// Paso final del OAuth2 (ver app/api/tiendanube/callback): cambia el `code`
// de la redirección por un access_token permanente (Tiendanube no los
// vence — solo se invalidan si se pide uno nuevo o la tienda desinstala la
// app) más el user_id, que es el id de la tienda. Tiendanube documenta los
// parámetros pero no el Content-Type exacto del POST; se manda
// form-urlencoded porque es el estándar de OAuth2 (RFC 6749) y es lo que
// usan sus propios SDKs oficiales (via la librería HTTP que envuelven) —
// sin una cuenta de partner real para probarlo en vivo, si Tiendanube
// esperara JSON acá el error va a aparecer clarito en los logs (ver el
// throw de abajo) la primera vez que alguien intente conectar de verdad.
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
