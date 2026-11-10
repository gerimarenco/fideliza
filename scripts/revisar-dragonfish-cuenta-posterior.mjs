// SOLO LECTURA. Lista las ventas del local (Dragon Fish) que se acreditaron a
// una cuenta creada DESPUÉS de la compra: pasó cuando el agente estuvo
// apagado y procesó de golpe ventas viejas (por ejemplo, compras de octubre
// acreditadas a clientas que se registraron en noviembre). Desde el cambio
// de 2026-11-11 eso ya no se acredita (lib/dragonfishIdentificacion.js).
//
// No cambia saldos ni movimientos: es para que el negocio decida qué hacer
// con esos puntos. Sin emails completos ni teléfonos.
//
//   DATABASE_URL=... node scripts/revisar-dragonfish-cuenta-posterior.mjs [--negocio=peperina]
import { PrismaClient } from '@prisma/client'
import { ocultarEmail } from '../lib/identidad.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.length ? v.join('=') : true]
}))
const slug = typeof args.negocio === 'string' ? args.negocio : 'peperina'
const dia = (d) => new Date(d).toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16)
const miles = (n) => Number(n).toLocaleString('es-AR')

const prisma = new PrismaClient()
try {
  const negocio = await prisma.negocio.findFirst({ where: { slug }, select: { id: true, nombre: true } })
  if (!negocio) throw new Error(`No existe un negocio con slug "${slug}"`)
  const facturas = await prisma.facturaPendiente.findMany({
    where: { negocioId: negocio.id, resultado: 'acreditado' },
    select: { codigo: true, createdAt: true, clienteId: true },
  })
  const filas = []
  for (const f of facturas) {
    let clienteId = f.clienteId
    let puntos = null
    // Antes de 2026-11-11 la factura no guardaba a quién se acreditó: se
    // reconstruye por el movimiento creado en la misma transacción que la
    // marca de "ya procesada" (WebhookEvento), segundos de diferencia.
    const evento = await prisma.webhookEvento.findUnique({ where: { proveedor_referenciaExterna: { proveedor: 'dragonfish', referenciaExterna: `${negocio.id}:${f.codigo}` } } })
    if (evento) {
      const mov = await prisma.movimientoPuntos.findFirst({
        where: {
          negocioId: negocio.id, origen: 'dragonfish', ...(clienteId ? { clienteId } : {}),
          createdAt: { gte: new Date(evento.createdAt.getTime() - 5000), lte: new Date(evento.createdAt.getTime() + 5000) },
        },
        orderBy: { createdAt: 'asc' },
      })
      if (mov) { clienteId = clienteId || mov.clienteId; puntos = mov.puntos }
    }
    if (!clienteId) continue
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, email: true, createdAt: true, puntos: true } })
    if (cliente && cliente.createdAt > f.createdAt) filas.push({ f, cliente, puntos, procesada: evento?.createdAt })
  }
  console.log(`${negocio.nombre}: ventas del local acreditadas a cuentas creadas después de la compra`)
  for (const { f, cliente, puntos, procesada } of filas.sort((a, b) => a.f.createdAt - b.f.createdAt)) {
    console.log(`  venta ${dia(f.createdAt)} · cuenta creada ${dia(cliente.createdAt)} · acreditada ${procesada ? dia(procesada) : '—'} · +${puntos != null ? miles(puntos) : '?'} puntos · ${ocultarEmail(cliente.email)} (cuenta ${cliente.id.slice(-6)}, saldo actual ${miles(cliente.puntos)})`)
  }
  const total = filas.reduce((t, x) => t + (x.puntos || 0), 0)
  console.log(`\n${filas.length} venta(s), ${miles(total)} puntos, ${new Set(filas.map((x) => x.cliente.id)).size} clienta(s).`)
  console.log('Solo lectura: no se modificó nada. Qué hacer con esos puntos lo decide el negocio.')
} catch (error) {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
