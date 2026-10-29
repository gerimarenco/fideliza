// Scheduled Function de Netlify (cada hora, ver `config` abajo): actualiza el
// estado de los cupones de canje de cada negocio con Tiendanube conectado
// (ver lib/sincronizarCupones.js). Solo lee de Tiendanube; no crea, cambia
// ni borra cupones, puntos ni canjes. Un error con un negocio no frena a
// los demás: el estado queda como estaba y se reintenta en la próxima hora.
import { prisma } from '../../lib/db.js'
import { sincronizarCuponesNegocio } from '../../lib/sincronizarCupones.js'

async function sincronizarCupones() {
  const ahora = new Date()
  const negocios = await prisma.negocio.findMany({
    where: { activo: true, tiendanubeStoreId: { not: null }, tiendanubeAccessToken: { not: null } },
    select: { id: true, tiendanubeStoreId: true, tiendanubeAccessToken: true },
  })
  let revisados = 0
  let actualizados = 0
  for (const negocio of negocios) {
    try {
      const r = await sincronizarCuponesNegocio(negocio, ahora)
      revisados += r.revisados
      actualizados += r.actualizados
    } catch (error) {
      console.error(`Sincronizar cupones: error con el negocio ${negocio.id}`, error.message)
    }
  }
  console.log(`Sincronizar cupones: ${revisados} revisado(s), ${actualizados} actualizado(s)`)
  return new Response(JSON.stringify({ revisados, actualizados }), { status: 200 })
}

export default sincronizarCupones

export const config = {
  schedule: '25 * * * *',
}
