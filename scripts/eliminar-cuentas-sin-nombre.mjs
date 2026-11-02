// Borra cuentas de clientas que NO tienen nombre propio: el nombre está
// vacío o es un email (cuentas cargadas a mano por el negocio con el mail
// como nombre, no creadas por la clienta). Pedido de Genaro, 2026-11-02.
//
// NO corre solo: no lo llama el build, ni Netlify, ni ninguna tarea
// programada. Se ejecuta a mano, con autorización.
//
//   1) Ver qué cuentas serían (no borra nada):
//        DATABASE_URL=... node scripts/eliminar-cuentas-sin-nombre.mjs
//      Con --mostrar se ven los emails completos (para revisar la lista);
//      sin eso salen enmascarados.
//   2) Borrar, confirmando la cantidad que mostró el paso 1:
//        DATABASE_URL=... node scripts/eliminar-cuentas-sin-nombre.mjs --aplicar --esperadas=N
//
// Opciones: --negocio=<slug> (por defecto "peperina"), --conservar=a@x.com,b@y.com
// (se suman a las que se conservan siempre).
//
// Reglas:
// - Se conservan siempre las cuentas con nombre propio y las de la lista
//   CONSERVAR_SIEMPRE.
// - Solo se borran cuentas SIN actividad: 0 puntos, sin movimientos de
//   puntos (compras, bonos, canjes), sin canjes y sin haber invitado a nadie.
//   Las que tienen actividad se listan aparte y NO se tocan: borrarlas
//   cambiaría el historial de compras y canjes del negocio (y los canjes ni
//   siquiera se pueden borrar sin borrar antes el canje). Para esas hace falta
//   otra decisión.
// - Cada cuenta se borra en su propia transacción, volviendo a comprobar que
//   siga sin actividad. Se borran también sus pedidos de "olvidé mi
//   contraseña". No se toca ninguna otra cuenta, saldo ni movimiento.
// - Antes de borrar se guarda una copia de las cuentas borradas en un archivo
//   local (respaldo-cuentas-eliminadas-<fecha>.json): tiene datos personales,
//   guardarlo en un lugar seguro y borrarlo cuando ya no haga falta.
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { normalizarEmail, ocultarEmail } from '../lib/identidad.js'

const CONSERVAR_SIEMPRE = ['genaromarenco110@gmail.com']

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.length ? v.join('=') : true]
}))
const aplicar = args.aplicar === true
const mostrar = args.mostrar === true
const slug = typeof args.negocio === 'string' ? args.negocio : 'peperina'
const conservar = new Set([
  ...CONSERVAR_SIEMPRE,
  ...(typeof args.conservar === 'string' ? args.conservar.split(',') : []),
].map(normalizarEmail).filter(Boolean))

function salir(mensaje) {
  console.error(mensaje)
  process.exit(1)
}

// Sin nombre propio: vacío, igual al email, o con forma de email.
function sinNombrePropio(cliente) {
  const nombre = String(cliente.nombre || '').trim()
  if (!nombre) return true
  if (normalizarEmail(nombre) === normalizarEmail(cliente.email)) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nombre)
}

const prisma = new PrismaClient()
try {
  const negocio = await prisma.negocio.findFirst({ where: { slug }, select: { id: true, nombre: true } })
  if (!negocio) salir(`No existe un negocio con slug "${slug}"`)

  const todas = await prisma.cliente.findMany({
    where: { negocioId: negocio.id },
    select: { id: true, nombre: true, email: true, puntos: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const candidatas = todas.filter((c) => sinNombrePropio(c) && !conservar.has(normalizarEmail(c.email)))
  const conservadasPorLista = todas.filter((c) => sinNombrePropio(c) && conservar.has(normalizarEmail(c.email)))
  const ids = candidatas.map((c) => c.id)

  const [movs, canjes, invitadas] = await Promise.all([
    prisma.movimientoPuntos.groupBy({ by: ['clienteId'], where: { clienteId: { in: ids } }, _count: true }),
    prisma.canje.groupBy({ by: ['clienteId'], where: { clienteId: { in: ids } }, _count: true }),
    prisma.cliente.groupBy({ by: ['referidoPorId'], where: { referidoPorId: { in: ids } }, _count: true }),
  ])
  const cuenta = (lista, campo) => Object.fromEntries(lista.map((x) => [x[campo], x._count]))
  const nMovs = cuenta(movs, 'clienteId'), nCanjes = cuenta(canjes, 'clienteId'), nInvitadas = cuenta(invitadas, 'referidoPorId')
  const actividad = (c) => ({ puntos: c.puntos, movimientos: nMovs[c.id] || 0, canjes: nCanjes[c.id] || 0, invitadas: nInvitadas[c.id] || 0 })
  const tieneActividad = (a) => a.puntos !== 0 || a.movimientos > 0 || a.canjes > 0 || a.invitadas > 0

  const borrables = candidatas.filter((c) => !tieneActividad(actividad(c)))
  const conActividad = candidatas.filter((c) => tieneActividad(actividad(c)))
  const email = (e) => (mostrar ? e : ocultarEmail(e))
  const fila = (c) => `  ${c.createdAt.toISOString().slice(0, 10)}  ${c.id}  ${email(c.email)}  nombre: ${c.nombre ? JSON.stringify(mostrar ? c.nombre : '(email)') : '(vacío)'}`

  console.log(`${negocio.nombre}: ${todas.length} cuentas en total`)
  console.log(`Con nombre propio (se conservan): ${todas.length - candidatas.length - conservadasPorLista.length}`)
  console.log(`Sin nombre propio pero en la lista para conservar: ${conservadasPorLista.length}`)
  console.log(`Sin nombre propio: ${candidatas.length}`)
  console.log(`  sin actividad (se borrarían): ${borrables.length}`)
  console.log(`  CON actividad (NO se tocan, requieren otra decisión): ${conActividad.length}`)
  console.log('')
  console.log('Se borrarían:')
  for (const c of borrables) console.log(fila(c))
  if (conActividad.length > 0) {
    console.log('')
    console.log('Con actividad (no se borran):')
    for (const c of conActividad) {
      const a = actividad(c)
      console.log(`${fila(c)}  puntos ${a.puntos}, movimientos ${a.movimientos}, canjes ${a.canjes}, invitó a ${a.invitadas}`)
    }
  }
  console.log('')

  if (!aplicar) {
    console.log(`Modo simulación: no se borró nada. Para borrar las ${borrables.length}: --aplicar --esperadas=${borrables.length}`)
    process.exit(0)
  }
  if (Number(args.esperadas) !== borrables.length) {
    salir(`--esperadas=${args.esperadas ?? '(falta)'} no coincide con las ${borrables.length} que se borrarían ahora. No se borró nada.`)
  }

  const respaldo = `respaldo-cuentas-eliminadas-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const completas = await prisma.cliente.findMany({ where: { id: { in: borrables.map((c) => c.id) } } })
  fs.writeFileSync(respaldo, JSON.stringify(completas, null, 2), { mode: 0o600 })
  console.log(`Copia de las cuentas a borrar: ${respaldo} (tiene datos personales)`)

  let borradas = 0
  for (const c of borrables) {
    const ok = await prisma.$transaction(async (tx) => {
      // Se vuelve a comprobar dentro de la transacción: si en el medio la
      // cuenta sumó una compra o un canje, no se borra.
      const [actual, m, k, inv] = await Promise.all([
        tx.cliente.findUnique({ where: { id: c.id }, select: { puntos: true, nombre: true, email: true } }),
        tx.movimientoPuntos.count({ where: { clienteId: c.id } }),
        tx.canje.count({ where: { clienteId: c.id } }),
        tx.cliente.count({ where: { referidoPorId: c.id } }),
      ])
      if (!actual || actual.puntos !== 0 || m > 0 || k > 0 || inv > 0 || !sinNombrePropio(actual)) return false
      await tx.passwordResetToken.deleteMany({ where: { usuarioId: c.id, tipo: 'cliente' } })
      await tx.cliente.delete({ where: { id: c.id } })
      return true
    })
    if (ok) borradas++
    else console.log(`  no se borró (cambió mientras corría): ${c.id}`)
  }
  console.log(`Borradas: ${borradas} de ${borrables.length}`)
} finally {
  await prisma.$disconnect()
}
