// Modelo del checkout de Tiendanube para un cupón, con las reglas que
// documenta Tiendanube (API de cupones y centro de ayuda, consultados el
// 2026-11-05). NO es la tienda real: sirve para comprobar que los cupones que
// crea Retornar tienen los campos que, según esas reglas, producen el
// resultado buscado. Lo que la tienda real haga de verdad se verifica con el
// protocolo de docs/lanzamiento/cupones-por-producto.md.
//
// Reglas modeladas:
// 1. Un cupón retirado (borrado) o desactivado (valid: false) no se acepta.
// 2. Con max_uses, un cupón que ya llegó a ese número de usos no se acepta.
// 3. Si el cupón tiene `products`, TODOS los productos del carrito tienen que
//    estar en esa lista (centro de ayuda: "todos los productos del carrito de
//    tu cliente deben estar dentro de las categorías o productos
//    configurados"); vale para todas las variantes del producto.
// 4. El subtotal tiene que llegar a min_price.
// 5. Un cupón de monto fijo descuenta ese monto, como mucho el subtotal; uno
//    de porcentaje, ese porcentaje del subtotal.
//
// carrito: [{ productoId, variante, precio, cantidad }]
export function aplicarCupon(cupon, carrito) {
  if (!cupon || cupon.retirado) return { aceptado: false, motivo: 'no existe' }
  if (cupon.valid === false) return { aceptado: false, motivo: 'desactivado' }
  if (cupon.max_uses != null && (cupon.used || 0) >= cupon.max_uses) return { aceptado: false, motivo: 'ya usado' }
  const productos = Array.isArray(cupon.products) ? cupon.products.map(String) : []
  if (productos.length && !carrito.every((item) => productos.includes(String(item.productoId)))) {
    return { aceptado: false, motivo: 'el carrito tiene productos que no son del cupón' }
  }
  const subtotal = carrito.reduce((t, item) => t + item.precio * (item.cantidad || 1), 0)
  if (cupon.min_price != null && subtotal < Number(cupon.min_price)) return { aceptado: false, motivo: 'no llega a la compra mínima' }
  const valor = Number(cupon.value)
  const descuento = cupon.type === 'percentage' ? Math.round((subtotal * valor) / 100) : Math.min(valor, subtotal)
  return { aceptado: true, subtotal, descuento, aPagar: subtotal - descuento }
}

// Usa el cupón (el checkout lo marca como usado).
export function usarCupon(cupon) {
  cupon.used = (cupon.used || 0) + 1
}
