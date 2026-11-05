// Cupones de premios-producto atados al producto en Tiendanube: código
// identificable, restricción real (`products`), todos los colores del
// producto, ningún otro producto ni combinación, un solo uso, stock antes de
// canjear, y qué pasa si Tiendanube no aplica la restricción. Base local
// descartable; Tiendanube simulado (pruebas/e2e/simulaciones). El checkout
// se evalúa con el MODELO de las reglas documentadas de Tiendanube
// (checkout-tiendanube.mjs), no con la tienda real: eso se verifica con
// docs/lanzamiento/cupones-por-producto.md.
//
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/cupones-producto.mjs
// (ver pruebas/e2e/README.md). Suite nueva (2026-11-05).
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { BASE, DIR, chromiumDePlaywright } from './entorno.mjs'
import { aplicarCupon, usarCupon } from './checkout-tiendanube.mjs'
import { PrismaClient } from '@prisma/client'
const chromium = chromiumDePlaywright()
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
const CUPONES = `${DIR}/tn-cupones.json`, CONTROL = `${DIR}/tn-control.json`, PRODUCTOS = `${DIR}/tn-productos.json`, ESTADOS = `${DIR}/tn-estado-cupones.json`
for (const f of [CUPONES, CONTROL, ESTADOS]) fs.rmSync(f, { force: true })
const control = (c) => fs.writeFileSync(CONTROL, JSON.stringify(c))
const enTienda = () => (fs.existsSync(CUPONES) ? JSON.parse(fs.readFileSync(CUPONES, 'utf8')) : [])
// El cupón como lo ve el checkout: products como ids.
const cuponEnTienda = (codigo) => { const c = enTienda().find((x) => x.code === codigo && !x.retirado); if (!c) return c; const { sinProductos, ...resto } = c; if (sinProductos) delete resto.products; return resto }
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin"')

// Productos de la tienda simulada.
const variante = (id, color, precio, stock) => ({ id, values: [{ es: color }], price: precio.toFixed(2), stock })
fs.writeFileSync(PRODUCTOS, JSON.stringify({
  111: { name: { es: 'Pañuelo de seda' }, variants: [variante(1, 'Rojo', 29000, 5), variante(2, 'Azul', 29000, 2), variante(3, 'Verde', 29000, null)] },
  222: { name: { es: 'Perfume' }, variants: [variante(4, '50 ml', 45000, 3)] },
  333: { name: { es: 'Cartera' }, variants: [variante(5, 'Negra', 60000, 1)] },
  444: { name: { es: 'Aromatizante' }, variants: [variante(6, 'Lavanda', 32000, 10)] },
  555: { name: { es: 'Vela' }, variants: [variante(7, 'Blanca', 18000, 0), variante(8, 'Negra', 18000, 0)] },
  666: { name: { es: 'Pañuelo estampado' }, variants: [variante(9, 'Flores', 32000, 2), variante(10, 'Rayas', 29000, 4), variante(11, 'Liso', 27000, 0)] },
  777: { published: false, name: { es: 'Bolso' }, variants: [variante(12, 'Único', 50000, 3)] },
}))
const item = (productoId, precio, variante, cantidad = 1) => ({ productoId, precio, variante, cantidad })
const PANUELO = { rojo: item(111, 29000, 'Rojo'), azul: item(111, 29000, 'Azul'), verde: item(111, 29000, 'Verde') }
const AROMATIZANTE = item(444, 32000, 'Lavanda'), PERFUME = item(222, 45000, '50 ml'), CARTERA = item(333, 60000, 'Negra')

const pep = await prisma.negocio.findFirst({ where: { slug: 'peperina' } })
const demo = await prisma.negocio.findFirst({ where: { email: 'demo@prueba.test' } })
const panuelo = await prisma.premio.update({ where: { id: (await prisma.premio.findFirst({ where: { nombre: 'Pañuelo de seda' } })).id }, data: { tiendanubeProductoId: '111' } })
const nuevoPremio = (nombre, puntos, productoId, negocioId = pep.id) => prisma.premio.create({ data: { nombre, puntos, emoji: 'gift', negocioId, tiendanubeProductoId: productoId, tiendanubeProductoUrl: `https://peperina.com.ar/productos/${productoId}` } })
const perfume = await nuevoPremio('Perfume Peperina', 8000, '222')
const cartera = await nuevoPremio('Cartera de cuero', 12000, '333')
const vela = await nuevoPremio('Vela aromática', 3000, '555')
const estampado = await nuevoPremio('Pañuelo estampado', 5000, '666')
const bolso = await nuevoPremio('Bolso', 9000, '777')
const diez = await prisma.premio.findFirst({ where: { nombre: '10% en toda la tienda' } })
const lucia = await prisma.cliente.update({ where: { email: 'lucia@prueba.test' }, data: { puntos: 200000 } })
const puntos = async () => (await prisma.cliente.findUnique({ where: { id: lucia.id } })).puntos

const b = await chromium.launch()
async function sesion(email, password) {
  const ctx = await b.newContext()
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.getByRole('button', { name: /^Ingres/ }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 })
  return { ctx, page }
}
const cli = await sesion('lucia@prueba.test', 'clienta-123')
const neg = await sesion('negocio@prueba.test', 'negocio-123')
const pedir = (s, metodo, ruta, cuerpo) => s.page.evaluate(async ([m, u, c]) => { const x = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined }); const t = await x.text(); let j = {}; try { j = JSON.parse(t) } catch {} return { status: x.status, cuerpo: j, texto: t } }, [metodo, ruta, cuerpo])
const canjear = (premio, clave = `clave-${Math.random().toString(36).slice(2)}-${Date.now()}`) => pedir(cli, 'POST', '/api/canjes', { premioId: premio.id, claveIdempotencia: clave })
const FORMATO = (etiqueta) => new RegExp(`^RETORNAR-${etiqueta}-[A-Z0-9]{8}$`)

console.log('Pañuelo: código identificable y cupón atado al producto')
let antes = await puntos()
let r = await canjear(panuelo)
const codPanuelo = r.cuerpo.tiendanubeCuponCodigo
chequear(r.status === 200 && FORMATO('PANUELO').test(codPanuelo || ''), `código del pañuelo: ${codPanuelo}`)
chequear((await puntos()) === antes - panuelo.puntos, `se descuentan los mismos ${panuelo.puntos} puntos de siempre`)
let cupon = cuponEnTienda(codPanuelo)
chequear(cupon && JSON.stringify(cupon.products) === '[111]' && cupon.type === 'absolute' && cupon.value === '29000.00' && cupon.min_price === 29000 && cupon.max_uses === 1, 'en Tiendanube: products [111], $29.000 fijos, compra mínima $29.000, un solo uso')
chequear((await prisma.canje.findUnique({ where: { id: r.cuerpo.id } })).cuponCodigoPrevisto === codPanuelo && !('cuponCodigoPrevisto' in r.cuerpo), 'el código quedó guardado en el canje (y no viaja en la respuesta)')

console.log('Checkout (modelo de las reglas de Tiendanube): pañuelo en todos sus colores')
for (const [color, it] of Object.entries(PANUELO)) {
  const x = aplicarCupon(cupon, [it])
  chequear(x.aceptado && x.aPagar === 0, `pañuelo ${color}: aceptado, se paga $${x.aPagar}`)
}
let x = aplicarCupon(cupon, [AROMATIZANTE])
chequear(!x.aceptado && /no son del cupón/.test(x.motivo), `pañuelo en un aromatizante de $32.000: rechazado (${x.motivo})`)
x = aplicarCupon(cupon, [PANUELO.rojo, AROMATIZANTE])
chequear(!x.aceptado, 'pañuelo + aromatizante en el mismo carrito: rechazado (no se puede combinar)')
x = aplicarCupon(cupon, [PANUELO.rojo, PANUELO.azul])
chequear(x.aceptado && x.descuento === 29000 && x.aPagar === 29000, `dos pañuelos: descuenta una unidad ($${x.descuento}), se paga la otra ($${x.aPagar})`)
x = aplicarCupon(cupon, [item(111, 29000, 'Rojo', 3)])
chequear(x.aceptado && x.descuento === 29000, 'tres unidades del mismo color: igual descuenta una sola')
usarCupon(cupon)
x = aplicarCupon(cupon, [PANUELO.verde])
chequear(!x.aceptado && x.motivo === 'ya usado', 'reutilizar el cupón ya usado: rechazado')

console.log('Perfume y cartera')
r = await canjear(perfume)
const codPerfume = r.cuerpo.tiendanubeCuponCodigo
const cuponPerfume = cuponEnTienda(codPerfume)
chequear(r.status === 200 && FORMATO('PERFUME').test(codPerfume || '') && JSON.stringify(cuponPerfume.products) === '[222]', `perfume: ${codPerfume}, atado al producto 222`)
x = aplicarCupon(cuponPerfume, [CARTERA])
chequear(!x.aceptado, 'cupón del perfume en una cartera: rechazado')
x = aplicarCupon(cuponPerfume, [PERFUME])
chequear(x.aceptado && x.aPagar === 0, 'cupón del perfume en el perfume: aceptado, $0')
r = await canjear(cartera)
const cuponCartera = cuponEnTienda(r.cuerpo.tiendanubeCuponCodigo)
chequear(FORMATO('CARTERA').test(r.cuerpo.tiendanubeCuponCodigo || '') && !aplicarCupon(cuponCartera, [PERFUME]).aceptado && aplicarCupon(cuponCartera, [CARTERA]).aPagar === 0, `cartera: ${r.cuerpo.tiendanubeCuponCodigo}; no sirve para el perfume, sí para la cartera`)
x = aplicarCupon(cuponCartera, [CARTERA, PERFUME])
chequear(!x.aceptado, 'cartera + perfume ($105.000) con el cupón de la cartera: rechazado')

console.log('Variantes con precios distintos: vale la más barata con stock')
r = await canjear(estampado)
const cuponEst = cuponEnTienda(r.cuerpo.tiendanubeCuponCodigo)
chequear(cuponEst?.value === '29000.00', `pañuelo estampado ($32.000 / $29.000 / $27.000 sin stock): cupón de $${cuponEst?.value}`)
chequear(aplicarCupon(cuponEst, [item(666, 29000, 'Rayas')]).aPagar === 0 && aplicarCupon(cuponEst, [item(666, 32000, 'Flores')]).aPagar === 3000, 'rayas sale gratis; flores paga la diferencia ($3.000)')
chequear(aplicarCupon(cuponEst, [item(666, 29000, 'Rayas', 2)]).aPagar === 29000, 'dos de rayas: descuenta exactamente una')

console.log('Sin stock o sin publicar: no se canjea y no se descuentan puntos')
antes = await puntos()
let canjesAntes = await prisma.canje.count()
let cuponesAntes = enTienda().length
r = await canjear(vela)
chequear(r.status === 409 && /no tiene stock/.test(r.cuerpo.error) && /No se descontaron puntos/.test(r.cuerpo.error), `vela sin stock en ninguna variante → 409 "${r.cuerpo.error}"`)
r = await canjear(bolso)
chequear(r.status === 409 && /no está publicado/.test(r.cuerpo.error), 'producto sin publicar → 409')
const borrado = await nuevoPremio('Producto borrado', 1000, '888')
fs.writeFileSync(PRODUCTOS, JSON.stringify({ ...JSON.parse(fs.readFileSync(PRODUCTOS, 'utf8')), 888: null }))
r = await canjear(borrado)
chequear(r.status === 409 && /no está disponible/.test(r.cuerpo.error), 'producto que ya no existe en la tienda (404) → 409')
chequear((await puntos()) === antes && (await prisma.canje.count()) === canjesAntes && enTienda().length === cuponesAntes, 'ni puntos descontados, ni canje, ni cupón')
control({ productosFalla: true })
r = await canjear(panuelo)
chequear(r.status === 503 && (await puntos()) === antes && (await prisma.canje.count()) === canjesAntes, 'la tienda no responde al verificar el stock → 503, sin descontar puntos')
control({})

console.log('Si Tiendanube no ata el cupón al producto, no se entrega')
control({ ignorarProductos: true })
antes = await puntos()
r = await canjear(panuelo)
const canjeSuelto = await prisma.canje.findUnique({ where: { id: r.cuerpo.id } })
const sueltos = enTienda().filter((c) => c.code === canjeSuelto.cuponCodigoPrevisto)
chequear(r.status === 200 && !r.cuerpo.tiendanubeCuponCodigo && r.cuerpo.tiendanubeCuponError === 'No se pudo generar el cupón automáticamente', 'el canje se hace, pero la clienta no recibe código (aviso genérico)')
chequear(!r.texto.includes(canjeSuelto.cuponCodigoPrevisto), 'el código no aparece en ninguna parte de la respuesta')
chequear(sueltos.length === 1 && sueltos[0].retirado === true, 'el cupón suelto se retiró de la tienda en el acto')
chequear(/no ató el cupón al producto/.test(canjeSuelto.tiendanubeCuponError) && canjeSuelto.tiendanubeCuponCodigo === null, `el negocio ve el motivo: "${canjeSuelto.tiendanubeCuponError}"`)
chequear((await puntos()) === antes - panuelo.puntos, 'los puntos se descontaron como en cualquier canje con cupón fallido (se resuelve con "Reintentar")')
const mis = await pedir(cli, 'GET', '/api/clientes/cupones')
const miSuelto = mis.cuerpo.items.find((c) => c.id === canjeSuelto.id)
chequear(miSuelto && miSuelto.codigo === null && miSuelto.estado.clave === 'en_preparacion' && !mis.texto.includes(canjeSuelto.cuponCodigoPrevisto), '"Mis cupones" lo muestra "en preparación", sin código')
control({})
r = await pedir(neg, 'POST', '/api/canjes/reintentar-cupon', { canjeId: canjeSuelto.id })
const cuponReintento = cuponEnTienda(r.cuerpo.tiendanubeCuponCodigo)
chequear(r.status === 200 && r.cuerpo.tiendanubeCuponCodigo === canjeSuelto.cuponCodigoPrevisto && JSON.stringify(cuponReintento?.products) === '[111]', `reintentar con la tienda bien: mismo código (${r.cuerpo.tiendanubeCuponCodigo}), ahora atado al producto`)
control({ ignorarProductos: true, borrarFalla: true, desactivarFalla: true })
r = await canjear(panuelo)
const canjeTrabado = await prisma.canje.findUnique({ where: { id: r.cuerpo.id } })
chequear(!r.cuerpo.tiendanubeCuponCodigo && !r.texto.includes(canjeTrabado.cuponCodigoPrevisto), 'si además no se puede retirar: la clienta tampoco recibe el código')
chequear(canjeTrabado.tiendanubeCuponError.includes(canjeTrabado.cuponCodigoPrevisto) && /desactivalo/.test(canjeTrabado.tiendanubeCuponError), 'y el negocio ve qué código desactivar a mano')
control({})

console.log('Repetir el mismo pedido (doble clic)')
const clave = `clave-repetida-${Date.now()}`
const r1 = await canjear(perfume, clave)
antes = await puntos()
const r2 = await canjear(perfume, clave)
chequear(r2.cuerpo.repetido === true && r2.cuerpo.id === r1.cuerpo.id && (await puntos()) === antes && !('cuponCodigoPrevisto' in r2.cuerpo), 'devuelve el mismo canje, sin descontar de nuevo ni mostrar el código previsto')

console.log('Otros premios y otros negocios: como antes')
r = await canjear(diez)
const cuponDiez = cuponEnTienda(r.cuerpo.tiendanubeCuponCodigo)
chequear(FORMATO('TIENDA').test(r.cuerpo.tiendanubeCuponCodigo || '') && cuponDiez.type === 'percentage' && !('products' in cuponDiez), `10% en toda la tienda: ${r.cuerpo.tiendanubeCuponCodigo}, porcentaje para toda la tienda (sin products)`)
const premioDemo = await nuevoPremio('Pañuelo demo', 100, '111', demo.id)
const clienteDemo = await prisma.cliente.create({ data: { nombre: 'Clienta Demo', email: 'clienta.demo@prueba.test', password: (await prisma.cliente.findUnique({ where: { id: lucia.id } })).password, negocioId: demo.id, puntos: 1000 } })
const cliDemo = await sesion('clienta.demo@prueba.test', 'clienta-123')
r = await pedir(cliDemo, 'POST', '/api/canjes', { premioId: premioDemo.id, claveIdempotencia: `demo-${Date.now()}` })
chequear(r.status === 200 && (await prisma.cliente.findUnique({ where: { id: clienteDemo.id } })).puntos === 900 && (await prisma.canje.findUnique({ where: { id: r.cuerpo.id } })).tiendanubeCuponError === 'El negocio todavía no conectó Tiendanube', 'negocio sin Tiendanube: el canje sigue como siempre (sin verificar stock)')

console.log('Canjes anteriores a este cambio')
const viejo = await prisma.canje.create({ data: { clienteId: lucia.id, premioId: panuelo.id, tiendanubeCuponError: 'Tiendanube no respondió a tiempo', premioNombre: panuelo.nombre, puntosUsados: panuelo.puntos, premioBeneficio: { tiendanubeProductoId: '111' } } })
r = await pedir(neg, 'POST', '/api/canjes/reintentar-cupon', { canjeId: viejo.id })
chequear(r.cuerpo.tiendanubeCuponCodigo === `RETORNAR-${viejo.id.slice(-8).toUpperCase()}` && JSON.stringify(cuponEnTienda(r.cuerpo.tiendanubeCuponCodigo)?.products) === '[111]', `reintentar un canje viejo usa su código de siempre (${r.cuerpo.tiendanubeCuponCodigo}) y lo crea atado al producto`)
const martina = await prisma.canje.findFirst({ where: { tiendanubeCuponCodigo: 'RETORNAR-AB12CD34' } })
chequear(martina && martina.cuponCodigoPrevisto === null && martina.cuponEstado === null, 'el cupón viejo ya emitido (RETORNAR-AB12CD34) no se tocó')
const martinaAntes = JSON.stringify(await prisma.canje.findUnique({ where: { id: martina.id } }))
const tiendaAntes = JSON.stringify(enTienda())
const salida = execFileSync('node', ['scripts/cupones-producto-sin-restriccion.mjs', '--mostrar'], { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' })
chequear(salida.includes('RETORNAR-AB12CD34') && /1 cupón\(es\)/.test(salida) && !salida.includes(codPanuelo) && !salida.includes(r.cuerpo.tiendanubeCuponCodigo) && !salida.includes(cuponDiez.code), 'el script lista solo el cupón de producto viejo (ni los nuevos, ni el reintentado, ni el de 10%)')
chequear(/Solo lectura/.test(salida) && JSON.stringify(await prisma.canje.findUnique({ where: { id: martina.id } })) === martinaAntes && JSON.stringify(enTienda()) === tiendaAntes, 'el script no modifica nada (ni la base ni la tienda)')

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
