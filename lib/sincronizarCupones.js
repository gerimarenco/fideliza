// Sincroniza Canje.cuponEstado con Tiendanube (ver lib/estadoCupon.js).
// Dos caminos, los dos de solo lectura sobre Tiendanube:
// - marcarCuponesDeOrden: el webhook order/paid trae una orden pagada; si
//   usó uno de nuestros códigos, ese cupón queda "utilizado" con la orden.
// - sincronizarCuponesNegocio: la tarea programada lee los cupones de la
//   tienda y actualiza disponible / utilizado / vencido / anulado.
import { prisma } from './db.js'
import { listarCupones } from './tiendanube.js'
import { estadoDesdeTiendanube, codigosDeOrden } from './estadoCupon.js'

// Un cupón recién creado puede tardar en aparecer en el listado: no se da
// por borrado hasta que pasa este margen.
const MARGEN_CUPON_NUEVO_MS = 10 * 60 * 1000

// Solo canjes de ESTE negocio: el mismo código no puede marcar el canje de
// otra tienda.
const deEsteNegocio = (negocioId) => ({ premio: { negocioId } })

export async function marcarCuponesDeOrden(negocio, orden, ahora = new Date()) {
  const codigos = codigosDeOrden(orden).filter((c) => c.startsWith('RETORNAR-'))
  if (codigos.length === 0) return 0
  const { count } = await prisma.canje.updateMany({
    where: {
      ...deEsteNegocio(negocio.id),
      tiendanubeCuponCodigo: { in: codigos },
      OR: [{ cuponEstado: null }, { cuponEstado: { not: 'utilizado' } }],
    },
    data: { cuponEstado: 'utilizado', cuponUsadoEn: ahora, cuponVerificadoEn: ahora, cuponPedidoId: orden?.id != null ? String(orden.id) : null },
  })
  return count
}

// "utilizado" es definitivo (una orden pagada o el contador de Tiendanube lo
// confirmaron); el resto se vuelve a revisar en cada corrida.
export async function sincronizarCuponesNegocio(negocio, ahora = new Date()) {
  const canjes = await prisma.canje.findMany({
    where: {
      ...deEsteNegocio(negocio.id),
      tiendanubeCuponCodigo: { not: null },
      OR: [{ cuponEstado: null }, { cuponEstado: { not: 'utilizado' } }],
    },
    select: { id: true, tiendanubeCuponCodigo: true, createdAt: true },
  })
  if (canjes.length === 0) return { revisados: 0, actualizados: 0 }

  const { cupones, completo } = await listarCupones(negocio)
  const porCodigo = new Map(cupones.filter((c) => c?.code).map((c) => [String(c.code).trim().toUpperCase(), c]))

  // SIN_VERIFICAR: el cupón está en la tienda pero sin contador de usos;
  // vuelve a "Pendiente de verificación" (un "disponible" anterior podría ya
  // no ser cierto).
  const SIN_VERIFICAR = 'sin_verificar'
  const idsPorEstado = new Map()
  for (const canje of canjes) {
    const cupon = porCodigo.get(canje.tiendanubeCuponCodigo.toUpperCase())
    let estado = null
    if (cupon) estado = estadoDesdeTiendanube(cupon, ahora) ?? SIN_VERIFICAR
    else if (completo && ahora - canje.createdAt > MARGEN_CUPON_NUEVO_MS) estado = 'anulado'
    if (!estado) continue
    if (!idsPorEstado.has(estado)) idsPorEstado.set(estado, [])
    idsPorEstado.get(estado).push(canje.id)
  }

  let actualizados = 0
  for (const [estado, ids] of idsPorEstado) {
    const { count } = await prisma.canje.updateMany({
      // Se repite la condición: si el webhook lo marcó "utilizado" mientras
      // corría esto, no se pisa.
      where: { id: { in: ids }, OR: [{ cuponEstado: null }, { cuponEstado: { not: 'utilizado' } }] },
      data: estado === SIN_VERIFICAR ? { cuponEstado: null } : { cuponEstado: estado, cuponVerificadoEn: ahora },
    })
    actualizados += count
  }
  return { revisados: canjes.length, actualizados }
}
