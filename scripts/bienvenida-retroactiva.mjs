// Bonificación de bienvenida retroactiva: para las cuentas que se
// registraron solas (/registro/[slug]) dentro del período de la promoción
// pero ANTES de que se publicara el código que la acredita (PR #122).
//
// NO corre solo: no lo llama el build, ni Netlify, ni ninguna tarea
// programada. Se ejecuta a mano, una vez, con autorización.
//
//   Simulación (por defecto, no escribe nada):
//     DATABASE_URL=... node scripts/bienvenida-retroactiva.mjs --hasta=2026-10-31T15:00:00Z
//   Acreditar de verdad:
//     DATABASE_URL=... node scripts/bienvenida-retroactiva.mjs --hasta=2026-10-31T15:00:00Z --aplicar
//
// --hasta: el momento (UTC) en que se publicó el PR #122 en producción; las
//   cuentas creadas desde ahí ya recibieron la bonificación al registrarse.
// --negocio: slug del negocio (por defecto "peperina").
//
// Reglas (las mismas del registro, lib/bienvenida.js):
// - Desde: el inicio de la promoción configurada en el negocio
//   (Negocio.bienvenidaDesde); hasta: --hasta, sin pasar el fin de la
//   promoción. La promoción configurada no se modifica.
// - Solo cuentas autoregistradas (tienen fecha de nacimiento, que el
//   registro pide y el alta manual del negocio no carga).
// - Una vez por cuenta (Cliente.bienvenidaOtorgada) y una vez por celular
//   en el negocio: se procesan por orden de registro, así la primera cuenta
//   de cada celular es la que la recibe, como habría pasado al registrarse.
// - Idempotente: cada cuenta se acredita en su propia transacción con
//   acreditarBienvenida, que solo suma si bienvenidaOtorgada todavía es
//   false. Correrlo dos veces no duplica nada.
// - Solo suma 150 puntos con su movimiento "bienvenida"; no toca ningún
//   otro saldo, movimiento ni canje.
import { PrismaClient } from '@prisma/client'
import { acreditarBienvenida, celularComparable } from '../lib/bienvenida.js'
import { ocultarEmail } from '../lib/identidad.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.length ? v.join('=') : true]
}))
const aplicar = args.aplicar === true
const slug = typeof args.negocio === 'string' ? args.negocio : 'peperina'

function salir(mensaje) {
  console.error(mensaje)
  process.exit(1)
}

if (typeof args.hasta !== 'string') salir('Falta --hasta=<fecha y hora UTC de la publicación del PR #122>, por ejemplo --hasta=2026-10-31T15:00:00Z')
const hastaPedido = new Date(args.hasta)
if (Number.isNaN(hastaPedido.getTime())) salir(`--hasta no es una fecha válida: ${args.hasta}`)
if (hastaPedido > new Date()) salir('--hasta no puede estar en el futuro')

const ocultarCelular = (telefono) => {
  const d = celularComparable(telefono)
  return d ? `***${d.slice(-3)}` : '(sin celular)'
}

const prisma = new PrismaClient()
try {
  const negocio = await prisma.negocio.findFirst({
    where: { slug },
    select: { id: true, nombre: true, bienvenidaPuntos: true, bienvenidaDesde: true, bienvenidaHasta: true },
  })
  if (!negocio) salir(`No existe un negocio con slug "${slug}"`)
  const puntos = negocio.bienvenidaPuntos
  if (!Number.isInteger(puntos) || puntos <= 0 || !negocio.bienvenidaDesde || !negocio.bienvenidaHasta) {
    salir(`${negocio.nombre} no tiene una bonificación de bienvenida configurada`)
  }
  const desde = negocio.bienvenidaDesde
  const hasta = hastaPedido < negocio.bienvenidaHasta ? hastaPedido : negocio.bienvenidaHasta
  if (hasta <= desde) salir('--hasta es anterior al inicio de la promoción: no hay nada que acreditar')

  const enPeriodo = await prisma.cliente.findMany({
    where: { negocioId: negocio.id, createdAt: { gte: desde, lt: hasta } },
    select: { id: true, email: true, telefono: true, createdAt: true, fechaNacimiento: true, bienvenidaOtorgada: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  const autoregistradas = enPeriodo.filter((c) => c.fechaNacimiento)
  const candidatas = autoregistradas.filter((c) => !c.bienvenidaOtorgada)

  // Celulares que ya cobraron la bonificación en este negocio (cualquier
  // fecha), para la simulación; al aplicar lo vuelve a controlar
  // acreditarBienvenida dentro de la transacción, con lock por celular.
  const yaBonificadas = await prisma.cliente.findMany({
    where: { negocioId: negocio.id, bienvenidaOtorgada: true },
    select: { telefono: true },
  })
  const celularesUsados = new Set(yaBonificadas.map((c) => celularComparable(c.telefono)).filter(Boolean))

  console.log(`${negocio.nombre}: bonificación de ${puntos} puntos`)
  console.log(`Período: ${desde.toISOString()} → ${hasta.toISOString()} (UTC)`)
  console.log(`Modo: ${aplicar ? 'APLICAR (escribe en la base)' : 'simulación (no escribe nada)'}`)
  console.log('')
  console.log(`Cuentas creadas en el período:          ${enPeriodo.length}`)
  console.log(`  creadas por el negocio (sin bonif.):  ${enPeriodo.length - autoregistradas.length}`)
  console.log(`  autoregistradas:                      ${autoregistradas.length}`)
  console.log(`    ya tienen la bonificación:          ${autoregistradas.length - candidatas.length}`)
  console.log(`    sin la bonificación todavía:        ${candidatas.length}`)
  console.log('')

  let acreditadas = 0
  let repetidas = 0
  for (const cliente of candidatas) {
    const celular = celularComparable(cliente.telefono)
    const etiqueta = `${cliente.createdAt.toISOString()}  ${cliente.id}  ${ocultarEmail(cliente.email).padEnd(28)} ${ocultarCelular(cliente.telefono)}`
    if (!aplicar) {
      if (celular && celularesUsados.has(celular)) {
        repetidas++
        console.log(`  omitida (celular ya bonificado)  ${etiqueta}`)
        continue
      }
      if (celular) celularesUsados.add(celular)
      acreditadas++
      console.log(`  recibiría ${puntos}                   ${etiqueta}`)
      continue
    }
    const otorgados = await prisma.$transaction((tx) => acreditarBienvenida(tx, cliente, negocio, puntos))
    if (otorgados > 0) {
      acreditadas++
      console.log(`  acreditados ${otorgados}                 ${etiqueta}`)
    } else {
      repetidas++
      console.log(`  omitida (celular ya bonificado o ya acreditada)  ${etiqueta}`)
    }
  }

  console.log('')
  console.log(`${aplicar ? 'Acreditadas' : 'Recibirían la bonificación'}: ${acreditadas} cuenta(s), ${acreditadas * puntos} puntos en total`)
  console.log(`Omitidas por celular repetido: ${repetidas}`)
  if (!aplicar && acreditadas > 0) console.log('\nPara acreditar de verdad, volver a correr con --aplicar (con autorización).')
} finally {
  await prisma.$disconnect()
}
