// SOLO LECTURA. Muestra la configuración real de premios y puntos de un
// negocio para la alerta de canje de las empleadas (lib/alertaCanje.js):
// premios activos con su puntaje, cuál es el primero, qué premio tiene
// elegido la alerta y cuántas clientas aparecerían marcadas. Sirve para
// confirmar, antes de activar la alerta, que el primer premio (el pañuelo en
// Peperina) cuesta lo que se espera (4.000 puntos). No cambia nada.
//
//   DATABASE_URL=... node scripts/revisar-alerta-canje.mjs [--negocio=peperina] [--esperado=4000]
import { PrismaClient } from '@prisma/client'
import { premioDeAlerta, filtroAlertaPendiente } from '../lib/alertaCanje.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.length ? v.join('=') : true]
}))
const slug = typeof args.negocio === 'string' ? args.negocio : 'peperina'
const esperado = Number(args.esperado ?? 4000)
const miles = (n) => Number(n).toLocaleString('es-AR')

const prisma = new PrismaClient()
try {
  const negocio = await prisma.negocio.findFirst({ where: { slug }, select: { id: true, nombre: true, puntosXPeso: true, alertaCanjePremioId: true } })
  if (!negocio) {
    console.error(`No existe un negocio con slug "${slug}"`)
    process.exit(1)
  }
  const premios = await prisma.premio.findMany({ where: { negocioId: negocio.id }, orderBy: { puntos: 'asc' }, select: { id: true, nombre: true, puntos: true, activo: true, negocioId: true } })
  const activos = premios.filter((p) => p.activo)
  console.log(`${negocio.nombre}: 1 punto cada $${miles(negocio.puntosXPeso)} de compra`)
  console.log('Premios (de menor a mayor):')
  for (const p of premios) console.log(`  ${miles(p.puntos).padStart(7)} puntos  ${p.nombre}${p.activo ? '' : '  (desactivado)'}  [${p.id}]`)

  const primero = activos[0]
  console.log('')
  if (!primero) console.log('No hay premios activos.')
  else {
    console.log(`Primer premio activo: ${primero.nombre} (${miles(primero.puntos)} puntos)`)
    console.log(primero.puntos === esperado
      ? `  Coincide con los ${miles(esperado)} puntos esperados.`
      : `  NO coincide con los ${miles(esperado)} puntos esperados: revisar antes de activar la alerta (no se cambió nada).`)
  }

  const elegido = premioDeAlerta(negocio, premios)
  if (elegido) {
    const pendientes = await prisma.cliente.count({ where: { negocioId: negocio.id, ...filtroAlertaPendiente(elegido) } })
    const contactadas = await prisma.cliente.count({ where: { negocioId: negocio.id, puntos: { gte: elegido.puntos }, alertaContactadaEn: { not: null } } })
    console.log(`Alerta: activada con ${elegido.nombre} (${miles(elegido.puntos)} puntos) → ${pendientes} clienta(s) para contactar, ${contactadas} ya contactada(s).`)
  } else {
    const llegan = primero ? await prisma.cliente.count({ where: { negocioId: negocio.id, puntos: { gte: primero.puntos } } }) : 0
    console.log(`Alerta: ${negocio.alertaCanjePremioId ? 'el premio elegido ya no está activo' : 'desactivada'}. Con ${primero ? primero.nombre : 'el primer premio'}, aparecerían ${llegan} clienta(s).`)
  }
  console.log('')
  console.log('Solo lectura: no se modificó nada.')
} finally {
  await prisma.$disconnect()
}
