// Cliente mínimo de la API de Tiendanube para el Grupo 7 (integración de
// premios): pedir el precio de un producto y crear cupones de descuento.
// Reutiliza el mismo token manual (Negocio.tiendanubeAccessToken) que ya usa
// el webhook de order/paid (ver app/api/webhooks/tiendanube) — no depende de
// un flujo de OAuth2 separado, pero si ese token es de una app privada
// creada solo con permiso de lectura de órdenes, crear cupones va a fallar
// con 401/403 hasta que se regenere con permiso de escritura de descuentos
// y lectura de productos (ver README).
const TIENDANUBE_API = 'https://api.tiendanube.com/2025-03'

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
