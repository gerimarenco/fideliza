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
// - Producto gratis: el cupón está atado al producto en Tiendanube (ver
//   crearCuponDeProducto en lib/tiendanube.js): vale para cualquier color o
//   variante de ese producto, y Tiendanube no lo acepta si el carrito tiene
//   otro producto. Vale una unidad de la variante más barata con stock: con
//   una más cara se paga la diferencia. Los cupones de producto emitidos
//   antes de este cambio no están atados (ver docs/tareas-futuras.md).
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

// Lo que define el beneficio del cupón de un premio, para guardarlo en el
// canje al momento de canjear (Canje.premioBeneficio): si el negocio edita
// el premio después, las instrucciones del historial siguen siendo las del
// cupón que se emitió.
export function beneficioDePremio(premio) {
  return {
    tiendanubeProductoId: premio?.tiendanubeProductoId || null,
    tiendanubeProductoUrl: premio?.tiendanubeProductoUrl || null,
    tiendanubeDescuentoPorcentaje: premio?.tiendanubeDescuentoPorcentaje ?? null,
    tiendanubeDescuentoMonto: premio?.tiendanubeDescuentoMonto ?? null,
    tiendanubeDescuentoMontoMinimo: premio?.tiendanubeDescuentoMontoMinimo ?? null,
  }
}

// El premio tal como se canjeó: los datos guardados en el canje si los
// tiene, si no (canjes anteriores a esos campos) los del premio actual.
export function premioDelCanje(canje) {
  const actual = canje.premio || {}
  return {
    // Para armar el enlace a la página intermedia del premio.
    id: canje.premioId ?? actual.id ?? null,
    nombre: canje.premioNombre ?? actual.nombre,
    puntos: canje.puntosUsados ?? actual.puntos,
    emoji: actual.emoji,
    ...(canje.premioBeneficio ? beneficioDePremio(canje.premioBeneficio) : beneficioDePremio(actual)),
  }
}

const pesos = (monto) => `$${formatearMiles(Math.round(Number(monto)))}`

// enlaceProducto (opcional): la página intermedia del premio en Retornar
// (/club/<negocio>/producto/<premio>), que consulta el stock antes de mandar
// a la tienda. Si no se pasa, se usa el link del producto cargado en el premio.
export function guiaCupon(premio, { sitioWeb, negocioNombre, enlaceProducto } = {}) {
  const enlacePropio = typeof enlaceProducto === 'string' && /^\/club\/[^/]+\/producto\/[^/]+$/.test(enlaceProducto) ? enlaceProducto : null
  const linkProducto = premio?.tiendanubeProductoId ? enlacePropio || linkSeguro(premio.tiendanubeProductoUrl) : null
  const linkSitio = linkSeguro(sitioWeb)
  const tienda = negocioNombre ? `la tienda de ${negocioNombre}` : 'la tienda online'

  let beneficio
  let pasoCarrito
  if (premio?.tiendanubeProductoId) {
    beneficio = `El cupón vale solo para ${premio.nombre}, en cualquier color o variante. No sirve para otros productos.`
    pasoCarrito = linkProducto
      ? 'Abrí el producto en la tienda, elegí el color o la variante y agregá una unidad al carrito, sin otros productos: si el carrito tiene otro producto, la tienda no acepta el cupón.'
      : `Entrá a ${tienda}, buscá ${premio.nombre}, elegí el color o la variante y agregá una unidad al carrito, sin otros productos: si el carrito tiene otro producto, la tienda no acepta el cupón.`
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
