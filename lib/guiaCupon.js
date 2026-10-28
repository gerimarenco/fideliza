// Qué se le muestra a la clienta para usar el cupón de Tiendanube de un
// canje (ventana "¡Tu premio está listo!" y "Mis movimientos" en
// app/page.js): a qué link de la tienda mandarla, qué beneficio da el cupón
// y los pasos. Solo presentación: el cupón lo genera lib/cuponCanje.js y
// nada de acá lo modifica.
//
// Los pasos se apoyan en lo que se sabe del cupón y de Tiendanube:
// - El cupón es de un solo uso (max_uses: 1, ver lib/tiendanube.js).
// - El checkout de Tiendanube siempre tiene un campo para el cupón de
//   descuento; el carrito lo muestra solo si el diseño de la tienda lo
//   tiene activado (centro de ayuda de Tiendanube). Por eso se nombra el
//   checkout y no un campo del carrito.
// - Producto gratis: el cupón es por el precio del producto y pide un
//   carrito de al menos ese valor; Tiendanube no permite atarlo al
//   producto, así que hay que agregar el producto al carrito.
import { formatearMiles } from './clienteStats.js'

// Solo links http(s): sitioWeb y la URL del producto los carga el negocio.
export function linkSeguro(url) {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

const pesos = (monto) => `$${formatearMiles(Math.round(Number(monto)))}`

export function guiaCupon(premio, { sitioWeb, negocioNombre } = {}) {
  const linkProducto = premio?.tiendanubeProductoId ? linkSeguro(premio.tiendanubeProductoUrl) : null
  const linkSitio = linkSeguro(sitioWeb)
  const tienda = negocioNombre ? `la tienda de ${negocioNombre}` : 'la tienda online'

  let beneficio
  let pasoCarrito
  if (premio?.tiendanubeProductoId) {
    beneficio = `El cupón cubre el precio de ${premio.nombre}: agregalo al carrito para usarlo.`
    pasoCarrito = linkProducto
      ? 'Abrí el producto en la tienda y agregalo al carrito. Podés sumar otros productos.'
      : `Entrá a ${tienda}, buscá ${premio.nombre} y agregalo al carrito. Podés sumar otros productos.`
  } else if (premio?.tiendanubeDescuentoMonto) {
    const minimo = premio.tiendanubeDescuentoMontoMinimo
    beneficio = minimo
      ? `${pesos(premio.tiendanubeDescuentoMonto)} de descuento en compras desde ${pesos(minimo)}.`
      : `${pesos(premio.tiendanubeDescuentoMonto)} de descuento en tu compra.`
    pasoCarrito = minimo
      ? `Entrá a ${tienda} y agregá productos al carrito hasta llegar a ${pesos(minimo)}.`
      : `Entrá a ${tienda} y agregá tus productos al carrito.`
  } else if (premio?.tiendanubeDescuentoPorcentaje) {
    beneficio = `${formatearMiles(Number(premio.tiendanubeDescuentoPorcentaje))}% de descuento en tu compra.`
    pasoCarrito = `Entrá a ${tienda} y agregá tus productos al carrito.`
  } else {
    beneficio = null
    pasoCarrito = `Entrá a ${tienda} y agregá tus productos al carrito.`
  }

  return {
    beneficio,
    linkTienda: linkProducto || linkSitio,
    textoBotonTienda: linkProducto ? 'Ver el producto en la tienda' : `Ir a ${tienda}`,
    pasos: [
      'Copiá el código.',
      pasoCarrito,
      'Avanzá hasta el checkout, pegá el código en el campo del cupón de descuento y aplicalo.',
    ],
  }
}
