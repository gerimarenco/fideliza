// SOLO LECTURA. Lista los cupones de premios-producto que se emitieron ANTES
// de atar los cupones al producto (2026-11): son cupones de monto fijo por el
// precio del producto que Tiendanube acepta con cualquier producto (por
// ejemplo, el del pañuelo de $29.000 sirve para un aromatizante de $32.000
// pagando $3.000). No cambia nada: ni en la base ni en Tiendanube.
//
//   DATABASE_URL=... node scripts/cupones-producto-sin-restriccion.mjs [--negocio=peperina] [--mostrar]
//
// --mostrar: emails completos (sin eso salen enmascarados).
//
// Cuáles lista: canjes de un premio con producto de Tiendanube que tienen
// cupón (tiendanubeCuponCodigo) creado sin código previsto
// (Canje.cuponCodigoPrevisto vacío: los canjes nuevos y los reintentos lo
// guardan, y esos ya se crean atados al producto), con el cupón disponible o
// todavía sin verificar. Los utilizados, vencidos o anulados no se listan:
// ya no se pueden usar.
//
// Qué hacer con ellos lo decide Genaro (ver docs/tareas-futuras.md, ítem 78, y docs/lanzamiento/cupones-por-producto.md):
// Tiendanube no deja cambiar las condiciones de un cupón activo; para
// restringirlo habría que desactivarlo y entregar otro, y eso afecta a la
// clienta que ya lo tiene. Este script no hace nada de eso.
import { PrismaClient } from '@prisma/client'
import { ocultarEmail } from '../lib/identidad.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.length ? v.join('=') : true]
}))
const slug = typeof args.negocio === 'string' ? args.negocio : 'peperina'
const mostrar = args.mostrar === true

const prisma = new PrismaClient()
try {
  const negocio = await prisma.negocio.findFirst({ where: { slug }, select: { id: true, nombre: true } })
  if (!negocio) {
    console.error(`No existe un negocio con slug "${slug}"`)
    process.exit(1)
  }
  const canjes = await prisma.canje.findMany({
    where: {
      premio: { negocioId: negocio.id },
      tiendanubeCuponCodigo: { not: null },
      cuponCodigoPrevisto: null,
      OR: [{ cuponEstado: null }, { cuponEstado: 'disponible' }],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, createdAt: true, tiendanubeCuponCodigo: true, cuponEstado: true, premioNombre: true, premioBeneficio: true,
      premio: { select: { nombre: true, tiendanubeProductoId: true } },
      cliente: { select: { email: true } },
    },
  })
  // Premio-producto según lo que se guardó al canjear (o el premio actual en
  // canjes viejos sin esa copia).
  const deProducto = canjes.filter((c) => (c.premioBeneficio ? c.premioBeneficio.tiendanubeProductoId : c.premio.tiendanubeProductoId))
  console.log(`${negocio.nombre}: ${deProducto.length} cupón(es) de premio-producto emitidos sin restricción al producto, todavía usables (disponibles o sin verificar)`)
  for (const c of deProducto) {
    const producto = c.premioBeneficio?.tiendanubeProductoId ?? c.premio.tiendanubeProductoId
    console.log(`  ${c.createdAt.toISOString().slice(0, 10)}  ${c.tiendanubeCuponCodigo}  premio: ${c.premioNombre ?? c.premio.nombre} (producto ${producto})  estado: ${c.cuponEstado || 'sin verificar'}  clienta: ${mostrar ? c.cliente.email : ocultarEmail(c.cliente.email)}`)
  }
  console.log('')
  console.log('Solo lectura: no se modificó nada.')
} finally {
  await prisma.$disconnect()
}
