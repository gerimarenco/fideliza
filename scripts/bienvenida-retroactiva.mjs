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
//   en el negocio: si el celular coincide con CUALQUIER otra cuenta del
//   negocio creada antes (también una clienta histórica de antes de la
//   promoción) o que ya la cobró, no se acredita y queda el motivo en la
//   cuenta (Cliente.bienvenidaMotivo). Es la misma regla del registro
//   (motivoSinBienvenida en lib/bienvenida.js), en la simulación y al aplicar.
// - Idempotente: cada cuenta se acredita en su propia transacción con
//   acreditarBienvenida, que solo suma si bienvenidaOtorgada todavía es
//   false. Correrlo dos veces no duplica nada.
// - Solo suma 150 puntos con su movimiento "bienvenida"; no toca ningún
//   otro saldo, movimiento ni canje.
import { PrismaClient } from '@prisma/client'
import { acreditarBienvenida, motivoSinBienvenida, celularComparable } from '../lib/bienvenida.js'
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

  const MOTIVOS = {
    celular_en_otra_cuenta: 'su celular ya está en otra cuenta del negocio',
    sin_celular: 'no tiene celular para comprobarlo',
    ya_otorgada: 'ya la tenía',
  }
  let acreditadas = 0
  const omitidas = {}
  for (const cliente of candidatas) {
    const etiqueta = `${cliente.createdAt.toISOString()}  ${cliente.id}  ${ocultarEmail(cliente.email).padEnd(28)} ${ocultarCelular(cliente.telefono)}`
    // Simulación: la misma regla, solo leyendo. Al aplicar, acreditarBienvenida
    // la vuelve a evaluar dentro de la transacción, con lock por celular.
    const { puntos: otorgados, motivo } = aplicar
      ? await prisma.$transaction((tx) => acreditarBienvenida(tx, cliente, negocio, puntos))
      : await motivoSinBienvenida(prisma, cliente, negocio).then((m) => ({ puntos: m ? 0 : puntos, motivo: m }))
    if (otorgados > 0) {
      acreditadas++
      console.log(`  ${aplicar ? 'acreditados' : 'recibiría'} ${otorgados}   ${etiqueta}`)
    } else {
      omitidas[motivo] = (omitidas[motivo] || 0) + 1
      console.log(`  sin bonificación (${MOTIVOS[motivo] || motivo})   ${etiqueta}`)
    }
  }

  console.log('')
  console.log(`${aplicar ? 'Acreditadas' : 'Recibirían la bonificación'}: ${acreditadas} cuenta(s), ${acreditadas * puntos} puntos en total`)
  for (const [motivo, cantidad] of Object.entries(omitidas)) {
    console.log(`Sin bonificación porque ${MOTIVOS[motivo] || motivo}: ${cantidad}`)
  }
  if (!aplicar && acreditadas > 0) console.log('\nPara acreditar de verdad, volver a correr con --aplicar (con autorización).')
} finally {
  await prisma.$disconnect()
}
