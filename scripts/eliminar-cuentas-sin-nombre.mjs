// Borra las cuentas de clientas que NO tienen nombre propio: el nombre está
// vacío o es un email (cuentas cargadas a mano con el mail como nombre, no
// creadas por la clienta). Pedido de Genaro, 2026-11-02: borrarlas todas,
// también las que tienen puntos, compras o canjes, menos
// genaromarenco110@gmail.com. Las que tienen nombre propio no se tocan.
//
// NO corre solo: no lo llama el build, ni Netlify, ni ninguna tarea
// programada. Se ejecuta a mano, con autorización.
//
//   1) Ver qué cuentas serían (no borra nada):
//        DATABASE_URL=... node scripts/eliminar-cuentas-sin-nombre.mjs --mostrar
//      Con --mostrar se ven los emails completos (para revisar la lista);
//      sin eso salen enmascarados.
//   2) Borrar, confirmando la cantidad que mostró el paso 1:
//        DATABASE_URL=... node scripts/eliminar-cuentas-sin-nombre.mjs --aplicar --esperadas=N
//
// Opciones: --negocio=<slug> (por defecto "peperina"), --conservar=a@x.com,b@y.com
// (se suman a las que se conservan siempre).
//
// Qué se borra de cada cuenta, en su propia transacción:
// - la cuenta;
// - sus movimientos de puntos (compras, bonos, canjes, vencimientos);
// - sus canjes (la base no deja borrar la cuenta sin borrarlos). Si alguno
//   tenía un cupón de Tiendanube sin usar, el cupón SIGUE vivo en la tienda:
//   el script lista esos códigos para desactivarlos a mano en Tiendanube;
// - sus pedidos de "olvidé mi contraseña".
// A las clientas que esa cuenta invitó se les borra "quién la invitó"
// (Cliente.referidoPorId); sus puntos y movimientos no cambian. No se toca
// ninguna otra cuenta, saldo ni movimiento.
//
// Las cuentas con un nombre de una sola palabra (sin apellido) NO se borran:
// se listan aparte para revisarlas.
//
// Antes de borrar se guarda una copia de todo lo borrado en un archivo local
// (respaldo-cuentas-eliminadas-<fecha>.json): tiene datos personales,
// guardarlo en un lugar seguro y borrarlo cuando ya no haga falta.
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { normalizarEmail, ocultarEmail } from '../lib/identidad.js'
import { sinNombrePropio, eliminarCuenta } from '../lib/eliminarCuenta.js'

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

const aBorrar = (c) => sinNombrePropio(c) && !conservar.has(normalizarEmail(c.email))

const prisma = new PrismaClient()
try {
  const negocio = await prisma.negocio.findFirst({ where: { slug }, select: { id: true, nombre: true } })
  if (!negocio) salir(`No existe un negocio con slug "${slug}"`)

  const todas = await prisma.cliente.findMany({
    where: { negocioId: negocio.id },
    select: { id: true, nombre: true, email: true, puntos: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const borrables = todas.filter(aBorrar)
  const conservadasPorLista = todas.filter((c) => sinNombrePropio(c) && !aBorrar(c))
  const unaPalabra = todas.filter((c) => !sinNombrePropio(c) && !/\s/.test(String(c.nombre).trim()))
  const ids = borrables.map((c) => c.id)

  const [movs, canjes, invitadas, cuponesVivos] = await Promise.all([
    prisma.movimientoPuntos.groupBy({ by: ['clienteId'], where: { clienteId: { in: ids } }, _count: true }),
    prisma.canje.groupBy({ by: ['clienteId'], where: { clienteId: { in: ids } }, _count: true }),
    prisma.cliente.groupBy({ by: ['referidoPorId'], where: { referidoPorId: { in: ids } }, _count: true }),
    prisma.canje.findMany({
      where: { clienteId: { in: ids }, tiendanubeCuponCodigo: { not: null }, OR: [{ cuponEstado: null }, { cuponEstado: { not: 'utilizado' } }] },
      select: { clienteId: true, tiendanubeCuponCodigo: true, cuponEstado: true },
    }),
  ])
  const cuenta = (lista, campo) => Object.fromEntries(lista.map((x) => [x[campo], x._count]))
  const nMovs = cuenta(movs, 'clienteId'), nCanjes = cuenta(canjes, 'clienteId'), nInvitadas = cuenta(invitadas, 'referidoPorId')
  const email = (e) => (mostrar ? e : ocultarEmail(e))
  const nombre = (c) => (c.nombre && String(c.nombre).trim() ? JSON.stringify(mostrar ? c.nombre : '(email)') : '(vacío)')
  const fila = (c) => {
    const actividad = `puntos ${c.puntos}, movimientos ${nMovs[c.id] || 0}, canjes ${nCanjes[c.id] || 0}, invitó a ${nInvitadas[c.id] || 0}`
    return `  ${c.createdAt.toISOString().slice(0, 10)}  ${c.id}  ${email(c.email)}  nombre: ${nombre(c)}  (${actividad})`
  }
  const totalMovs = ids.reduce((t, id) => t + (nMovs[id] || 0), 0)
  const totalCanjes = ids.reduce((t, id) => t + (nCanjes[id] || 0), 0)
  const totalInvitadas = ids.reduce((t, id) => t + (nInvitadas[id] || 0), 0)

  console.log(`${negocio.nombre}: ${todas.length} cuentas en total`)
  console.log(`Con nombre propio (se conservan): ${todas.length - borrables.length - conservadasPorLista.length}`)
  console.log(`Sin nombre propio pero en la lista para conservar: ${conservadasPorLista.length}`)
  console.log(`Sin nombre propio (SE BORRAN): ${borrables.length}`)
  console.log(`  con ellas se borran ${totalMovs} movimientos de puntos y ${totalCanjes} canjes; ${totalInvitadas} clienta(s) invitada(s) pierden "quién la invitó"`)
  console.log('')
  console.log('Se borrarían:')
  for (const c of borrables) console.log(fila(c))
  if (cuponesVivos.length > 0) {
    console.log('')
    console.log('Cupones de Tiendanube de estos canjes que pueden seguir vivos en la tienda (desactivarlos a mano en Tiendanube):')
    for (const k of cuponesVivos) console.log(`  ${k.tiendanubeCuponCodigo}  (estado en Retornar: ${k.cuponEstado || 'pendiente de verificación'})`)
  }
  if (unaPalabra.length > 0) {
    console.log('')
    console.log(`Con un nombre de una sola palabra (NO se borran; revisarlas): ${unaPalabra.length}`)
    for (const c of unaPalabra) console.log(`  ${c.id}  ${email(c.email)}  nombre: ${mostrar ? JSON.stringify(c.nombre) : '(una palabra)'}`)
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
  const [cuentasCompletas, movimientosCompletos, canjesCompletos, invitadasCompletas] = await Promise.all([
    prisma.cliente.findMany({ where: { id: { in: ids } } }),
    prisma.movimientoPuntos.findMany({ where: { clienteId: { in: ids } } }),
    prisma.canje.findMany({ where: { clienteId: { in: ids } } }),
    prisma.cliente.findMany({ where: { referidoPorId: { in: ids } }, select: { id: true, referidoPorId: true } }),
  ])
  fs.writeFileSync(respaldo, JSON.stringify({ cuentas: cuentasCompletas, movimientos: movimientosCompletos, canjes: canjesCompletos, invitadas: invitadasCompletas }, null, 2), { mode: 0o600 })
  console.log(`Copia de todo lo que se borra: ${respaldo} (tiene datos personales)`)

  let borradas = 0
  for (const c of borrables) {
    const ok = await prisma.$transaction(async (tx) => {
      // Se vuelve a comprobar dentro de la transacción (por si cambió el
      // nombre mientras corría).
      const actual = await tx.cliente.findUnique({ where: { id: c.id }, select: { nombre: true, email: true } })
      if (!actual || !aBorrar(actual)) return false
      await eliminarCuenta(tx, c.id)
      return true
    })
    if (ok) borradas++
    else console.log(`  no se borró (cambió mientras corría): ${c.id}`)
  }
  console.log(`Borradas: ${borradas} de ${borrables.length}`)
} finally {
  await prisma.$disconnect()
}
