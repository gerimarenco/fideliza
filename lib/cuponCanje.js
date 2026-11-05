import { prisma } from './db.js'
import {
  obtenerProducto,
  valorCuponDeProducto,
  crearCuponDeProducto,
  crearCuponPorcentaje,
  crearCuponMontoFijo,
  codigoCuponDeCanje,
  codigoCuponConEtiqueta,
} from './tiendanube.js'
import { beneficioDePremio } from './guiaCupon.js'

export function premioGeneraCupon(premio) {
  return !!(premio.tiendanubeProductoId || premio.tiendanubeDescuentoPorcentaje || premio.tiendanubeDescuentoMonto)
}

// Código que se le pide a Tiendanube para un canje nuevo (se guarda en
// Canje.cuponCodigoPrevisto al crearlo).
export function codigoPrevistoDeCanje(canjeId, premio) {
  return codigoCuponConEtiqueta(canjeId, premio?.nombre)
}

// Código del cupón de un canje: el guardado al crearlo; los canjes
// anteriores a los códigos con etiqueta no lo tienen y usan el formato
// viejo, que es el que ya se le pidió a Tiendanube en su primer intento.
export function codigoDeCanje(canje) {
  return canje.cuponCodigoPrevisto || codigoCuponDeCanje(canje.id)
}

const MENSAJE_NO_DISPONIBLE = {
  sin_stock: 'Este premio no tiene stock en la tienda en este momento. No se descontaron puntos: probá más adelante.',
  no_publicado: 'Este premio no está publicado en la tienda en este momento. No se descontaron puntos.',
}

async function negocioConTiendanube(negocioId) {
  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: { tiendanubeStoreId: true, tiendanubeAccessToken: true },
  })
  return negocio?.tiendanubeStoreId && negocio?.tiendanubeAccessToken ? negocio : null
}

// Antes de descontar puntos por un premio-producto: ¿se puede comprar hoy
// en la tienda? Un cupón de un producto sin stock no le sirve a nadie, así
// que el canje se rechaza sin tocar los puntos. Si la tienda no responde,
// también se rechaza (mejor reintentar que descontar puntos sin poder
// verificar). Si el negocio no conectó Tiendanube no hay nada que mirar:
// el canje sigue como siempre (el cupón queda con error para resolver a
// mano). → { producto } para reutilizarlo al crear el cupón, o
// { error, status }.
export async function verificarPremioEnTienda(premio) {
  if (!premio.tiendanubeProductoId) return {}
  const negocio = await negocioConTiendanube(premio.negocioId)
  if (!negocio) return {}
  let producto
  try {
    producto = await obtenerProducto(negocio, premio.tiendanubeProductoId)
    const { disponible, motivo } = valorCuponDeProducto(producto)
    if (!disponible) return { error: MENSAJE_NO_DISPONIBLE[motivo], status: 409 }
  } catch (error) {
    console.error('No se pudo verificar el premio en Tiendanube', premio.id, error.message)
    // El producto ya no existe en la tienda (borrado o id mal cargado).
    if (/respondió 404/.test(error.message)) {
      return { error: 'Este premio no está disponible en la tienda en este momento. No se descontaron puntos.', status: 409 }
    }
    return { error: 'No se pudo verificar el premio en la tienda. No se descontaron puntos: probá de nuevo en unos minutos.', status: 503 }
  }
  return { producto }
}

// Genera el cupón de Tiendanube de un canje ya confirmado. Nunca tira error:
// devuelve { cuponCodigo } o { cuponError } para guardarlo en el canje — un
// problema con Tiendanube no tiene que deshacer un canje cuyos puntos ya se
// descontaron. Se usa al canjear y al reintentar desde el panel (ver
// app/api/canjes/reintentar-cupon); como el código del cupón es siempre el
// mismo para cada canje, reintentar nunca puede terminar en dos cupones.
//
// El beneficio es el que se guardó al canjear (Canje.premioBeneficio), no el
// del premio editado después; los canjes viejos sin esa copia usan el premio.
// `producto` (opcional) es el que ya se leyó al verificar el stock.
export async function generarCuponDeCanje(premio, canje, { producto } = {}) {
  const codigo = codigoDeCanje(canje)
  const beneficio = canje.premioBeneficio ? beneficioDePremio(canje.premioBeneficio) : beneficioDePremio(premio)
  try {
    const negocio = await negocioConTiendanube(premio.negocioId)
    if (!negocio) return { cuponError: 'El negocio todavía no conectó Tiendanube' }

    if (beneficio.tiendanubeProductoId) {
      const datos = producto ?? (await obtenerProducto(negocio, beneficio.tiendanubeProductoId))
      const { valor } = valorCuponDeProducto(datos)
      return { cuponCodigo: await crearCuponDeProducto(negocio, codigo, beneficio.tiendanubeProductoId, valor) }
    }
    if (beneficio.tiendanubeDescuentoMonto) {
      return { cuponCodigo: await crearCuponMontoFijo(negocio, codigo, beneficio.tiendanubeDescuentoMonto, beneficio.tiendanubeDescuentoMontoMinimo) }
    }
    if (beneficio.tiendanubeDescuentoPorcentaje) {
      return { cuponCodigo: await crearCuponPorcentaje(negocio, codigo, beneficio.tiendanubeDescuentoPorcentaje) }
    }
    return { cuponError: 'Este premio no genera cupón de Tiendanube' }
  } catch (error) {
    console.error('Error al crear el cupón de Tiendanube para el canje', canje.id, error.message)
    if (/RESTRICCION_NO_APLICADA/.test(error.message)) {
      return {
        cuponError: /NO se pudo retirar/.test(error.message)
          ? `Tiendanube no ató el cupón ${codigo} al producto y no se pudo retirar: desactivalo en Tiendanube → Descuentos → Cupones. No se le entregó a la clienta.`
          : 'Tiendanube no ató el cupón al producto, así que no se entregó (se retiró de la tienda). Revisá los permisos de la app y reintentá.',
      }
    }
    // Si el código ya existe en Tiendanube es porque un intento anterior sí
    // lo creó aunque no llegó la confirmación: el cupón es válido.
    if (/422/.test(error.message) && /taken|exist|duplicad/i.test(error.message)) {
      return {
        cuponError: beneficio.tiendanubeProductoId
          ? `Tiendanube dice que el cupón ${codigo} ya existe: revisá en Tiendanube → Descuentos → Cupones que esté activo y limitado al producto del premio`
          : 'Tiendanube dice que el cupón de este canje ya existe: revisá en Tiendanube → Descuentos → Cupones si está activo',
      }
    }
    return { cuponError: 'No se pudo generar el cupón automáticamente' }
  }
}
