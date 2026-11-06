// Scheduled Function de Netlify (cada 20 minutos, ver `config` abajo):
// red de seguridad del webhook de Tiendanube. Pide a la API las órdenes
// pagadas recientes de cada negocio con Tiendanube conectado y acredita las
// que el webhook no acreditó, con la misma lógica y la misma protección
// contra duplicados (ver lib/conciliarTiendanube.js). Solo lee de
// Tiendanube: no cambia órdenes ni cupones. Nunca acredita compras de antes
// de su primera corrida. Un error con un negocio no frena a los demás.
import { prisma } from '../../lib/db.js'
import { conciliarNegocio } from '../../lib/conciliarTiendanube.js'
import { enviarEmailPuntosAcreditados } from '../../lib/email.js'

async function conciliarTiendanube() {
  const ahora = new Date()
  const negocios = await prisma.negocio.findMany({
    where: { activo: true, tiendanubeStoreId: { not: null }, tiendanubeAccessToken: { not: null } },
  })
  const total = { negocios: negocios.length, revisadas: 0, acreditadas: 0, errores: 0 }
  for (const negocio of negocios) {
    try {
      const r = await conciliarNegocio(prisma, negocio, {
        ahora,
        alAcreditar: async (a) => {
          await enviarEmailPuntosAcreditados({ email: a.cliente.email, puntosAcreditados: a.puntos, puntosTotales: a.puntosTotales, negocioNombre: negocio.nombre, negocioId: negocio.id })
          if (a.referido) await enviarEmailPuntosAcreditados({ email: a.referido.invitadorEmail, motivo: 'referido', puntosAcreditados: a.referido.puntos, puntosTotales: a.referido.invitadorPuntosTotales, negocioNombre: negocio.nombre, negocioId: negocio.id })
        },
      })
      if (r.inicializado) console.log(`Conciliar Tiendanube: negocio ${negocio.id} empieza a conciliar desde ahora`)
      total.revisadas += r.revisadas
      total.acreditadas += r.acreditadas
      total.errores += r.errores || 0
      if (r.completo === false) console.warn(`Conciliar Tiendanube: negocio ${negocio.id}, listado de órdenes incompleto (se sigue en la próxima corrida)`)
    } catch (error) {
      total.errores++
      console.error(`Conciliar Tiendanube: error con el negocio ${negocio.id}`, error.message)
    }
  }
  console.log(`Conciliar Tiendanube: ${total.revisadas} orden(es) revisada(s), ${total.acreditadas} acreditada(s) que el webhook no había acreditado, ${total.errores} error(es)`)
  return new Response(JSON.stringify(total), { status: 200 })
}

export default conciliarTiendanube

export const config = {
  schedule: '*/20 * * * *',
}
