// Conciliación de compras de Tiendanube (la usa la tarea programada
// netlify/functions/conciliar-tiendanube.mjs). Es la red de seguridad del
// webhook: aunque un aviso no llegue (dirección vieja, firma rechazada,
// Tiendanube caído, un timeout), cada tanto se piden a la API las órdenes
// pagadas recientes y se procesan con la misma lógica (y la misma protección
// contra duplicados) que el webhook.
//
// Nunca acredita compras de antes de empezar a conciliar: la primera corrida
// de cada negocio solo guarda Negocio.tiendanubeConciliarDesde = ahora. Las
// compras anteriores se revisan a mano con scripts/revisar-compras-tiendanube.mjs.
import { listarOrdenesPagadas } from './tiendanube.js'
import { procesarOrden, registrarError, ESTADOS_FINALES } from './acreditacionTiendanube.js'
import { marcarCuponesDeOrden } from './sincronizarCupones.js'

// Cuánto hacia atrás se vuelve a mirar en cada corrida (las órdenes que
// cambian después de esto ya no se reintentan solas).
export const VENTANA_DIAS = 7

export async function conciliarNegocio(db, negocio, { ahora = new Date(), alAcreditar } = {}) {
  if (!negocio.tiendanubeConciliarDesde) {
    await db.negocio.update({ where: { id: negocio.id }, data: { tiendanubeConciliarDesde: ahora } })
    return { inicializado: true, revisadas: 0, acreditadas: 0 }
  }
  const marca = new Date(negocio.tiendanubeConciliarDesde)
  const desde = new Date(Math.max(marca.getTime(), ahora.getTime() - VENTANA_DIAS * 86400000))
  const { ordenes, completo } = await listarOrdenesPagadas(negocio, { desde })
  const conocidas = new Map(
    (await db.ordenTiendanube.findMany({
      where: { negocioId: negocio.id, orderId: { in: ordenes.map((o) => String(o.id)) } },
      select: { orderId: true, estado: true },
    })).map((o) => [o.orderId, o.estado])
  )
  const resultado = { revisadas: 0, acreditadas: 0, errores: 0, completo }
  for (const orden of ordenes) {
    const creada = new Date(orden.created_at || 0)
    if (!(creada >= marca)) continue // de antes de conciliar: solo con el script, revisándola
    if (ESTADOS_FINALES.includes(conocidas.get(String(orden.id)))) continue
    resultado.revisadas++
    try {
      if (orden.status !== 'cancelled') await marcarCuponesDeOrden(negocio, orden).catch(() => {})
      const r = await procesarOrden(db, negocio, orden, { via: 'conciliacion' })
      if (r.estado === 'acreditada' && !r.duplicada) {
        resultado.acreditadas++
        if (alAcreditar) await alAcreditar(r).catch(() => {})
      }
    } catch (error) {
      resultado.errores++
      await registrarError(db, negocio.id, orden.id, 'conciliacion', error).catch(() => {})
    }
  }
  return resultado
}
