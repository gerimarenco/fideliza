// Enlaces de premios con stock real de Tiendanube: página intermedia
// (disponible / sin stock / sin confirmar), otros colores del mismo producto
// primero, alternativas configuradas solo si tienen stock, etiquetas del
// panel de la clienta, sección "Enlace y alternativas" del negocio y que
// nunca se escriba en productos de Tiendanube. Base local descartable;
// Tiendanube simulado (pruebas/e2e/simulaciones).
//
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/enlaces-stock.mjs
// (ver pruebas/e2e/README.md). Suite nueva (2026-11-06). Tarda ~1 minuto
// (espera a que venza la caché de 20 s).
import fs from 'node:fs'
import { BASE, DIR, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
const chromium = chromiumDePlaywright()
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
const CONTROL = `${DIR}/tn-control.json`, PRODUCTOS = `${DIR}/tn-productos.json`, PEDIDOS = `${DIR}/tn-pedidos.log`
for (const f of [CONTROL, PEDIDOS, `${DIR}/tn-cupones.json`]) fs.rmSync(f, { force: true })
const control = (c) => fs.writeFileSync(CONTROL, JSON.stringify(c))
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin"')

const v = (id, nombre, precio, stock) => ({ id, values: [{ es: nombre }], price: precio.toFixed(2), stock_management: stock !== null, stock })
const prod = (id, nombre, variantes) => ({ name: { es: nombre }, canonical_url: `https://peperina.com.ar/productos/p${id}/`, images: [{ id: id * 10, src: `https://cdn.tienda.test/${id}.jpg` }], variants: variantes })
const catalogo = {
  111: prod(111, 'Pañuelo de seda', [v(1, 'Visón', 29000, 0), v(2, 'Negro', 29000, 3), v(3, 'Rosa', 31000, 2), v(4, 'Gris', 29000, 0), v(5, 'Crudo', 27000, 5)]),
  222: prod(222, 'Perfume Rosa', [v(20, '50 ml', 45000, 0), v(21, '100 ml', 62000, 0)]),
  223: prod(223, 'Perfume Jazmín', [v(22, '50 ml', 45000, 4)]),
  224: prod(224, 'Perfume Ámbar', [v(23, '50 ml', 45000, 0)]),
  225: prod(225, 'Colonia de lavanda', [v(24, '200 ml', 30000, 2)]),
  333: prod(333, 'Aromatizante textil', [v(30, 'Lavanda', 15000, 0), v(31, 'Vainilla', 15000, 3), v(32, 'Coco', 15000, 1)]),
  444: prod(444, 'Cartera de cuero', [v(40, 'Negra', 60000, 0)]),
  555: prod(555, 'Vela aromática', [v(50, 'Blanca', 18000, 2)]),
  666: prod(666, 'Bolso de mano', [v(60, 'Único', 50000, 2)]),
  777: prod(777, 'Billetera', [v(70, 'Única', 25000, 2)]),
}
const guardarCatalogo = () => fs.writeFileSync(PRODUCTOS, JSON.stringify(catalogo))
guardarCatalogo()

const pep = await prisma.negocio.findFirst({ where: { slug: 'peperina' } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo' } })
const premioDe = (nombre, puntos, productoId, negocioId = pep.id) => prisma.premio.create({ data: { nombre, puntos, emoji: 'gift', negocioId, tiendanubeProductoId: productoId, tiendanubeProductoUrl: `https://peperina.com.ar/productos/p${productoId}/` } })
const panuelo = await prisma.premio.update({ where: { id: (await prisma.premio.findFirst({ where: { nombre: 'Pañuelo de seda' } })).id }, data: { tiendanubeProductoId: '111', tiendanubeProductoUrl: 'https://manual.peperina.test/panuelo' } })
const perfume = await premioDe('Perfume Rosa', 8000, '222')
const aroma = await premioDe('Aromatizante', 3000, '333')
const cartera = await premioDe('Cartera de cuero', 12000, '444')
const vela = await premioDe('Vela aromática', 2000, '555')
const bolso = await premioDe('Bolso de mano', 9000, '666')
const billetera = await premioDe('Billetera', 4000, '777')
const premioDemo = await premioDe('Premio de demo', 100, '555', demo.id)
const diez = await prisma.premio.findFirst({ where: { nombre: '10% en toda la tienda' } })
await prisma.cliente.update({ where: { email: 'lucia@prueba.test' }, data: { puntos: 50000 } })

const b = await chromium.launch()
async function sesion(email, password, viewport = { width: 390, height: 844 }) {
  const ctx = await b.newContext({ viewport })
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.getByRole('button', { name: /^Ingres/ }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 })
  return { ctx, page }
}
const pedir = (s, metodo, ruta, cuerpo) => s.page.evaluate(async ([m, u, c]) => { const x = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined }); let j = {}; try { j = await x.json() } catch {} return { status: x.status, cuerpo: j } }, [metodo, ruta, cuerpo])
const enlace = async (premio, slug = 'peperina') => { const r = await fetch(`${BASE}/api/enlaces/${slug}/${premio.id}`); return { status: r.status, cuerpo: await r.json().catch(() => ({})) } }
const neg = await sesion('negocio@prueba.test', 'negocio-123', { width: 1280, height: 900 })

console.log('Panel del negocio: enlace y alternativas (API)')
let r = await pedir(neg, 'GET', `/api/tiendanube/productos?negocioId=${pep.id}&q=perfume`)
chequear(r.status === 200 && r.cuerpo.items.map((p) => p.nombre).join(',') === 'Perfume Rosa,Perfume Jazmín,Perfume Ámbar', `buscar "perfume" en la tienda: ${r.cuerpo.items?.map((p) => p.nombre).join(', ')}`)
chequear(r.cuerpo.items[0].variantes.every((x) => x.estado === 'sin_stock') && r.cuerpo.items[1].variantes[0].estado === 'con_stock', 'cada resultado trae el stock de sus variantes')
chequear((await pedir(neg, 'GET', `/api/tiendanube/productos?negocioId=${demo.id}&q=perfume`)).status === 403, 'no puede buscar en la tienda de otro negocio')
chequear((await pedir(neg, 'GET', `/api/tiendanube/productos?negocioId=${pep.id}&q=p`)).status === 400, 'búsqueda de 1 letra → 400')

r = await pedir(neg, 'PUT', `/api/premios/${panuelo.id}/enlace`, { principal: { productoId: '111', varianteId: '1' }, alternativas: [] })
let p = await prisma.premio.findUnique({ where: { id: panuelo.id } })
chequear(r.status === 200 && p.tiendanubeVarianteId === '1' && p.tiendanubeProductoUrl === 'https://peperina.com.ar/productos/p111/', 'pañuelo → color visón; el link pasa a ser el de Tiendanube (no el cargado a mano)')
r = await pedir(neg, 'PUT', `/api/premios/${perfume.id}/enlace`, { principal: { productoId: '222' }, alternativas: [{ productoId: '224' }, { productoId: '223' }, { productoId: '225', varianteId: '24' }] })
chequear(r.status === 200 && (await prisma.premioAlternativa.count({ where: { premioId: perfume.id } })) === 3, 'perfume con 3 alternativas')
r = await pedir(neg, 'GET', `/api/premios/${perfume.id}/enlace`)
chequear(r.status === 200 && r.cuerpo.alternativas.map((a) => `${a.nombre}:${a.estado}`).join(',') === 'Perfume Ámbar:sin_stock,Perfume Jazmín:con_stock,Colonia de lavanda:con_stock' && r.cuerpo.principal.estado === 'sin_stock', 'el editor muestra el stock actual de cada una')
const malas = [
  [{ principal: { productoId: '222' }, alternativas: [{ productoId: '223' }, { productoId: '224' }, { productoId: '225' }, { productoId: '333' }] }, 400, 'más de 3 alternativas'],
  [{ principal: { productoId: '222' }, alternativas: [{ productoId: '222' }] }, 400, 'el mismo producto como alternativa'],
  [{ principal: { productoId: '222' }, alternativas: [{ productoId: '223' }, { productoId: '223' }] }, 400, 'alternativas repetidas'],
  [{ principal: { productoId: '222' }, alternativas: [{ productoId: '999' }] }, 400, 'un producto que no existe'],
  [{ principal: { productoId: '222', varianteId: '30' }, alternativas: [] }, 400, 'un color que no es de ese producto'],
  [{ principal: { productoId: 'abc' }, alternativas: [] }, 400, 'un id inválido'],
]
catalogo[999] = null
guardarCatalogo()
for (const [cuerpo, status, texto] of malas) {
  r = await pedir(neg, 'PUT', `/api/premios/${perfume.id}/enlace`, cuerpo)
  chequear(r.status === status, `${texto} → ${r.status} "${r.cuerpo.error}"`)
}
chequear((await prisma.premioAlternativa.count({ where: { premioId: perfume.id } })) === 3, 'ninguno de esos intentos cambió lo guardado')
control({ productosFalla: true })
r = await pedir(neg, 'PUT', `/api/premios/${perfume.id}/enlace`, { principal: { productoId: '222' }, alternativas: [] })
chequear(r.status === 503 && (await prisma.premioAlternativa.count({ where: { premioId: perfume.id } })) === 3, 'Tiendanube no responde → 503 y no se guarda nada')
control({})
// Un error de Tiendanube queda guardado 10 s (en ese rato el enlace dice
// "sin confirmar", nunca "disponible").
r = await enlace(perfume)
chequear(r.cuerpo.enlace.estado === 'desconocido', 'justo después de esa falla, el enlace del perfume dice "sin confirmar"')
await esperar(11000)
chequear((await pedir(neg, 'PUT', `/api/premios/${premioDemo.id}/enlace`, { principal: { productoId: '555' }, alternativas: [] })).status === 404, 'no puede tocar el premio de otro negocio')
await pedir(neg, 'PUT', `/api/premios/${aroma.id}/enlace`, { principal: { productoId: '333', varianteId: '30' }, alternativas: [] })

console.log('Página intermedia: sin stock en el color → mismo producto en otros colores')
r = await enlace(panuelo)
chequear(r.status === 200 && r.cuerpo.enlace.estado === 'sin_stock' && r.cuerpo.enlace.variante.nombre === 'Visón', 'pañuelo visón: sin stock')
chequear(r.cuerpo.enlace.otrasVariantes.map((x) => x.nombre).join(',') === 'Negro,Crudo,Rosa', `otros colores con stock, primero el del mismo precio: ${r.cuerpo.enlace.otrasVariantes.map((x) => x.nombre).join(', ')} (gris, agotado, no aparece)`)
chequear(r.cuerpo.enlace.otrasVariantes[0].url === 'https://peperina.com.ar/productos/p111/?variant=2', 'cada color lleva a su variante en la tienda')
chequear(!JSON.stringify(r.cuerpo).includes('token') && !('tiendanubeAccessToken' in r.cuerpo.negocio), 'la respuesta pública no trae datos internos del negocio')
r = await enlace(aroma)
chequear(r.cuerpo.enlace.estado === 'sin_stock' && r.cuerpo.enlace.otrasVariantes.map((x) => x.nombre).join(',') === 'Vainilla,Coco', 'aromatizante lavanda agotado: otros aromas del mismo producto (vainilla, coco)')

console.log('Página intermedia: producto agotado → alternativas configuradas con stock')
r = await enlace(perfume)
chequear(r.cuerpo.enlace.estado === 'sin_stock' && r.cuerpo.enlace.otrasVariantes.length === 0, 'perfume rosa: sin stock en ninguna variante')
chequear(r.cuerpo.enlace.alternativas.map((a) => a.nombre).join(',') === 'Perfume Jazmín,Colonia de lavanda', `alternativas con stock, en su orden: ${r.cuerpo.enlace.alternativas.map((a) => a.nombre).join(', ')} (el ámbar agotado no aparece)`)
chequear(r.cuerpo.enlace.alternativas[1].url === 'https://peperina.com.ar/productos/p225/?variant=24' && r.cuerpo.enlace.alternativas[1].variante === '200 ml', 'una alternativa con color elegido lleva a ese color')
r = await enlace(cartera)
chequear(r.cuerpo.enlace.estado === 'sin_stock' && r.cuerpo.enlace.otrasVariantes.length === 0 && r.cuerpo.enlace.alternativas.length === 0, 'cartera agotada y sin alternativas: solo el aviso')

console.log('Página intermedia: con stock')
await pedir(neg, 'PUT', `/api/premios/${vela.id}/enlace`, { principal: { productoId: '555', varianteId: '50' }, alternativas: [{ productoId: '223' }] })
r = await enlace(vela)
chequear(r.cuerpo.enlace.estado === 'disponible' && r.cuerpo.enlace.url === 'https://peperina.com.ar/productos/p555/?variant=50' && r.cuerpo.enlace.alternativas.length === 0, 'vela con stock: disponible, link a su color, sin mostrar alternativas')

console.log('Página intermedia: sin confirmar (nunca "disponible")')
control({ productosFalla: true })
r = await enlace(bolso)
chequear(r.cuerpo.enlace.estado === 'desconocido' && r.cuerpo.enlace.url === 'https://peperina.com.ar/productos/p666/', 'Tiendanube no responde: "desconocido", con el link del premio para ir a la tienda')
control({ productosLentos: 7000 })
const t0 = Date.now()
r = await enlace(billetera)
chequear(r.cuerpo.enlace.estado === 'desconocido' && Date.now() - t0 < 6500, `Tiendanube tarda más de 4 s: "desconocido" sin esperar de más (${Date.now() - t0} ms)`)
control({ productosFallan: ['225'] })
await esperar(21000)
r = await enlace(perfume)
chequear(r.cuerpo.enlace.alternativas.map((a) => a.nombre).join(',') === 'Perfume Jazmín', 'una alternativa que no se pudo confirmar se oculta')
control({})

console.log('El stock se actualiza (la caché dura 20 s)')
catalogo[111].variants[1].stock = 0
catalogo[111].variants[0].stock = 4
guardarCatalogo()
await esperar(21000)
r = await enlace(panuelo)
chequear(r.cuerpo.enlace.estado === 'disponible' && r.cuerpo.enlace.variante.nombre === 'Visón', 'repuso el visón: a los 20 s el enlace ya lo muestra disponible')
catalogo[111].variants[0].stock = 0
catalogo[111].variants[1].stock = 3
guardarCatalogo()
await esperar(21000)

console.log('Rutas que no corresponden')
chequear((await enlace(panuelo, 'demo')).status === 404, 'premio de Peperina pedido con el club de otro negocio → 404')
chequear((await enlace(diez)).status === 404, 'premio sin producto (10%) → 404')
await prisma.premio.update({ where: { id: billetera.id }, data: { activo: false } })
chequear((await enlace(billetera)).status === 404, 'premio desactivado → 404')

console.log('Panel de la clienta')
const cli = await sesion('lucia@prueba.test', 'clienta-123')
r = await pedir(cli, 'GET', `/api/premios/disponibilidad?negocioId=${pep.id}`)
chequear(r.status === 200 && r.cuerpo[panuelo.id] === 'otros_colores' && r.cuerpo[perfume.id] === 'sin_stock' && r.cuerpo[cartera.id] === 'sin_stock' && r.cuerpo[vela.id] === 'disponible', 'estados: pañuelo "otros colores", perfume y cartera sin stock, vela disponible')
chequear((await pedir(cli, 'GET', `/api/premios/disponibilidad?negocioId=${demo.id}`)).status === 403, 'una clienta no puede preguntar por otro negocio')
await cli.page.reload()
await cli.page.getByText('Podés canjear ahora').waitFor({ timeout: 60000 })
await cli.page.getByText('Sin stock por el momento').first().waitFor({ timeout: 30000 })
const filaCartera = cli.page.locator('li', { hasText: 'Cartera de cuero' })
chequear(await filaCartera.getByText('Sin stock por el momento').isVisible() && await filaCartera.getByRole('button', { name: 'Sin stock' }).isDisabled(), 'cartera: "Sin stock por el momento" y el botón de canje deshabilitado')
const filaPanuelo = cli.page.locator('li', { hasText: 'Pañuelo de seda' })
chequear(await filaPanuelo.getByText('Sin stock en este color · hay otros colores').isVisible() && await filaPanuelo.getByRole('button', { name: 'Canjear' }).isEnabled(), 'pañuelo: avisa que hay otros colores y se puede canjear (el cupón vale para cualquier color)')
chequear((await filaPanuelo.getByRole('link').first().getAttribute('href')) === `/club/peperina/producto/${panuelo.id}`, 'el nombre del premio lleva a la página intermedia, no a la tienda directo')
r = await pedir(cli, 'POST', '/api/canjes', { premioId: cartera.id, claveIdempotencia: `cartera-${Date.now()}` })
chequear(r.status === 409, 'y el servidor tampoco deja canjear la cartera sin stock')
await cli.page.screenshot({ path: `${DIR}/panel-clienta-stock.png`, fullPage: true })

console.log('Página intermedia en el navegador')
await cli.page.goto(`${BASE}/club/peperina/producto/${panuelo.id}`)
await cli.page.getByText('Este producto se encuentra sin stock por el momento en Visón.').waitFor({ timeout: 30000 })
const colores = await cli.page.getByRole('region', { name: 'Disponible en otros colores' }).getByRole('listitem').allInnerTexts()
chequear(colores.length === 3 && colores[0].startsWith('Negro'), `"Disponible en otros colores": ${colores.map((c) => c.split('\n')[0]).join(', ')}`)
chequear((await cli.page.getByRole('link', { name: 'Ver en la tienda' }).count()) === 0, 'sin stock: no hay botón para ir al producto agotado')
await cli.page.screenshot({ path: `${DIR}/enlace-sin-stock-color.png`, fullPage: true })
await cli.page.goto(`${BASE}/club/peperina/producto/${perfume.id}`)
await cli.page.getByText('También te puede gustar').waitFor({ timeout: 30000 })
const alts = await cli.page.getByRole('region', { name: 'También te puede gustar' }).getByRole('listitem').allInnerTexts()
chequear(alts.length === 2 && alts[0].includes('Perfume Jazmín') && !alts.join(' ').includes('Ámbar'), `"También te puede gustar": ${alts.map((a) => a.split('\n')[0]).join(', ')}`)
await cli.page.screenshot({ path: `${DIR}/enlace-alternativas.png`, fullPage: true })
await cli.page.goto(`${BASE}/club/peperina/producto/${vela.id}`)
await cli.page.getByText('Disponible en la tienda.').waitFor({ timeout: 30000 })
chequear((await cli.page.getByRole('link', { name: 'Ver en la tienda' }).getAttribute('href')) === 'https://peperina.com.ar/productos/p555/?variant=50', 'con stock: "Disponible en la tienda." y el botón al producto')
control({ productosFalla: true })
await esperar(21000) // el panel de la clienta acaba de leer el bolso bien
await cli.page.goto(`${BASE}/club/peperina/producto/${bolso.id}`)
await cli.page.getByText('No pudimos confirmar la disponibilidad en este momento.').waitFor({ timeout: 30000 })
chequear(await cli.page.getByRole('link', { name: 'Ver en la tienda' }).isVisible() && !(await cli.page.getByText('Disponible en la tienda.').count()), 'sin confirmar: el aviso, el botón a la tienda y nunca "disponible"')
await cli.page.screenshot({ path: `${DIR}/enlace-desconocido.png`, fullPage: true })
control({})

console.log('Panel del negocio: elegir alternativas desde la pantalla')
await neg.page.reload()
await neg.page.getByRole('button', { name: /^Premios/ }).first().click()
const filaPremio = neg.page.locator('li', { hasText: 'Cartera de cuero' }).first()
await filaPremio.getByRole('button', { name: 'Enlace y alternativas' }).click()
const editor = neg.page.getByRole('group', { name: 'Enlace y alternativas' })
await editor.getByText('Producto del premio').waitFor({ timeout: 30000 })
await editor.getByRole('button', { name: '+ Agregar alternativa' }).click()
await editor.getByLabel('Buscá una alternativa en la tienda').fill('perfume')
await editor.getByRole('button', { name: 'Buscar' }).click()
await editor.getByRole('list', { name: 'Productos encontrados' }).getByRole('listitem').filter({ hasText: 'Perfume Jazmín' }).getByRole('button', { name: 'Elegir' }).click()
await editor.getByRole('button', { name: '+ Agregar alternativa' }).click()
await editor.getByLabel('Buscá una alternativa en la tienda').fill('colonia')
await editor.getByRole('button', { name: 'Buscar' }).click()
await editor.getByRole('list', { name: 'Productos encontrados' }).getByRole('listitem').filter({ hasText: 'Colonia' }).getByRole('button', { name: 'Elegir' }).click()
await neg.page.screenshot({ path: `${DIR}/editor-enlace.png`, fullPage: true })
await editor.getByRole('button', { name: 'Guardar enlace' }).click()
await neg.page.getByText('Enlace y alternativas guardados.').waitFor({ timeout: 30000 })
const guardadas = await prisma.premioAlternativa.findMany({ where: { premioId: cartera.id }, orderBy: { orden: 'asc' } })
chequear(guardadas.map((a) => `${a.tiendanubeProductoId}:${a.nombre}`).join(',') === '223:Perfume Jazmín,225:Colonia de lavanda', `guardadas desde la pantalla: ${guardadas.map((a) => a.nombre).join(', ')}`)
r = await enlace(cartera)
chequear(r.cuerpo.enlace.alternativas.length === 2, 'y ya se ofrecen en la página de la cartera agotada')

console.log('Nunca se escribe en productos de Tiendanube')
const pedidos = fs.readFileSync(PEDIDOS, 'utf8').trim().split('\n')
chequear(pedidos.length > 10 && pedidos.filter((l) => l.includes('/products')).every((l) => l.startsWith('GET ')), `${pedidos.filter((l) => l.includes('/products')).length} consultas a productos, todas GET`)

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
