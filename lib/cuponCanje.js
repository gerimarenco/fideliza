import { prisma } from './db.js'
import { obtenerPrecioProducto, crearCuponProductoGratis, crearCuponPorcentaje, crearCuponMontoFijo } from './tiendanube.js'

export function premioGeneraCupon(premio) {
  return !!(premio.tiendanubeProductoId || premio.tiendanubeDescuentoPorcentaje || premio.tiendanubeDescuentoMonto)
}

// Genera el cupón de Tiendanube de un canje ya confirmado. Nunca tira error:
// devuelve { cuponCodigo } o { cuponError } para guardarlo en el canje — un
// problema con Tiendanube no tiene que deshacer un canje cuyos puntos ya se
// descontaron. Se usa al canjear y al reintentar desde el panel (ver
// app/api/canjes/reintentar-cupon); como el código del cupón es siempre el
// mismo para cada canje, reintentar nunca puede terminar en dos cupones.
export async function generarCuponDeCanje(premio, canjeId) {
  try {
    const negocio = await prisma.negocio.findUnique({
      where: { id: premio.negocioId },
      select: { tiendanubeStoreId: true, tiendanubeAccessToken: true },
    })

    if (!negocio?.tiendanubeStoreId || !negocio?.tiendanubeAccessToken) {
      return { cuponError: 'El negocio todavía no conectó Tiendanube' }
    }
    if (premio.tiendanubeProductoId) {
      const precio = await obtenerPrecioProducto(negocio, premio.tiendanubeProductoId)
      return { cuponCodigo: await crearCuponProductoGratis(negocio, canjeId, precio) }
    }
    if (premio.tiendanubeDescuentoMonto) {
      return { cuponCodigo: await crearCuponMontoFijo(negocio, canjeId, premio.tiendanubeDescuentoMonto, premio.tiendanubeDescuentoMontoMinimo) }
    }
    return { cuponCodigo: await crearCuponPorcentaje(negocio, canjeId, premio.tiendanubeDescuentoPorcentaje) }
  } catch (error) {
    console.error('Error al crear el cupón de Tiendanube para el canje', canjeId, error.message)
    // Si el código ya existe en Tiendanube es porque un intento anterior sí
    // lo creó aunque no llegó la confirmación: el cupón es válido.
    if (/422/.test(error.message) && /taken|exist|duplicad/i.test(error.message)) {
      return { cuponError: 'Tiendanube dice que el cupón de este canje ya existe: revisá en Tiendanube → Descuentos → Cupones si está activo' }
    }
    return { cuponError: 'No se pudo generar el cupón automáticamente' }
  }
}
