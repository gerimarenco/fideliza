// SOLO LECTURA. Muestra cómo devuelve Tiendanube los productos de los premios
// de un negocio (y sus alternativas): variantes, precio, stock, si la tienda
// controla el stock y, si la tienda usa varias ubicaciones (por ejemplo el
// local y el depósito), el stock de cada una. Sirve para confirmar con datos
// reales lo que asume lib/disponibilidad.js (ver
// docs/lanzamiento/enlaces-con-stock.md). Solo hace pedidos GET: no cambia
// productos, precios, stock ni nada en Retornar.
//
//   DATABASE_URL=... node scripts/diagnostico-productos-tiendanube.mjs [--negocio=peperina] [--producto=<id>]
//
// --producto: un producto puntual en vez de los de los premios.
// No muestra el token de la tienda.
import { PrismaClient } from '@prisma/client'
import { estadoVariante, nombreVariante, textoTiendanube } from '../lib/disponibilidad.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.length ? v.join('=') : true]
}))
const slug = typeof args.negocio === 'string' ? args.negocio : 'peperina'

const prisma = new PrismaClient()
try {
  const negocio = await prisma.negocio.findFirst({ where: { slug }, select: { id: true, nombre: true, tiendanubeStoreId: true, tiendanubeAccessToken: true } })
  if (!negocio?.tiendanubeStoreId || !negocio?.tiendanubeAccessToken) {
    console.error(`El negocio "${slug}" no existe o no tiene Tiendanube conectado.`)
    process.exit(1)
  }
  const get = async (ruta) => {
    let res
    try {
      res = await fetch(`https://api.tiendanube.com/2025-03/${negocio.tiendanubeStoreId}${ruta}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${negocio.tiendanubeAccessToken}`, 'User-Agent': 'Retornar (soporte@retornar.com.ar)' },
      signal: AbortSignal.timeout(15000),
      })
    } catch (error) {
      return { error: `sin respuesta (${error.cause?.code || error.name})` }
    }
    const texto = await res.text()
    if (!res.ok) return { error: `${res.status} ${texto.slice(0, 200)}` }
    return { datos: texto ? JSON.parse(texto) : null }
  }

  console.log(`${negocio.nombre} (tienda ${negocio.tiendanubeStoreId})`)
  const ubicaciones = await get('/locations')
  if (ubicaciones.error) console.log(`Ubicaciones: no se pudieron leer (${ubicaciones.error}). Puede que la tienda no use varias ubicaciones o que la app no tenga ese permiso.`)
  else {
    const lista = Array.isArray(ubicaciones.datos) ? ubicaciones.datos : []
    console.log(`Ubicaciones de stock: ${lista.length}`)
    for (const u of lista) console.log(`  ${u.id}  ${textoTiendanube(u.name)}${u.is_default ? '  (predeterminada)' : ''}`)
  }
  console.log('')

  let productos
  if (typeof args.producto === 'string') productos = [{ id: args.producto, para: 'pedido a mano' }]
  else {
    const premios = await prisma.premio.findMany({
      where: { negocioId: negocio.id, tiendanubeProductoId: { not: null } },
      select: { nombre: true, activo: true, tiendanubeProductoId: true, tiendanubeVarianteId: true, alternativas: { orderBy: { orden: 'asc' }, select: { tiendanubeProductoId: true, tiendanubeVarianteId: true } } },
    })
    productos = premios.flatMap((p) => [
      { id: p.tiendanubeProductoId, para: `premio "${p.nombre}"${p.activo ? '' : ' (desactivado)'}${p.tiendanubeVarianteId ? `, variante ${p.tiendanubeVarianteId}` : ''}` },
      ...p.alternativas.map((a, i) => ({ id: a.tiendanubeProductoId, para: `alternativa ${i + 1} de "${p.nombre}"${a.tiendanubeVarianteId ? `, variante ${a.tiendanubeVarianteId}` : ''}` })),
    ])
  }

  for (const { id, para } of productos) {
    const r = await get(`/products/${encodeURIComponent(id)}`)
    console.log(`Producto ${id} — ${para}`)
    if (r.error) { console.log(`  ERROR: ${r.error}\n`); continue }
    const p = r.datos
    console.log(`  nombre: ${textoTiendanube(p.name)} | publicado: ${p.published} | link: ${p.canonical_url}`)
    for (const v of p.variants || []) {
      const niveles = Array.isArray(v.inventory_levels) ? v.inventory_levels.map((n) => `${n.location_id}: ${n.stock ?? '∞'}`).join(', ') : '(sin inventory_levels)'
      console.log(`  variante ${v.id}  ${nombreVariante(v) || '(sin nombre)'}  precio ${v.price}${v.promotional_price ? ` (promo ${v.promotional_price})` : ''}  stock_management ${v.stock_management}  stock ${v.stock ?? 'null'}  → Retornar lo toma como: ${estadoVariante(v)}`)
      console.log(`      por ubicación: ${niveles}`)
    }
    console.log('')
  }
  console.log('Solo lectura: no se modificó nada.')
} finally {
  await prisma.$disconnect()
}
