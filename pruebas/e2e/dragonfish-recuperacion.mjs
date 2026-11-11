// Recuperación de ventas del local de Club Peperina desde el 05/11/2026
// (lib/dragonfishFecha.js): cuenta la fecha de la venta que manda Dragon Fish
// (fecha/hora, hora de Argentina), no cuándo llegó el aviso a Retornar.
// Las anteriores al 05/11 no vuelven a revisarse, no se asignan a mano, no
// suman al vincular la ficha ni si el agente las reporta. Las compras nuevas
// y los demás negocios no cambian.
//
// Usa un negocio con la base de Dragon Fish "PEPERINA" (la que tiene el
// límite en el código); el "Peperina" de la semilla (base "PRUEBA") hace de
// negocio sin límite.
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/dragonfish-recuperacion.mjs
// (antes del 04/01/2027: "Volver a revisar" mira los últimos 60 días).
import { BASE, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin"')

const pf = await prisma.negocio.create({ data: {
  nombre: 'Club Peperina (base real)', tipo: 'Ropa', ciudad: 'Mercedes', emoji: '👗', slug: 'peperina-df',
  email: 'peperina.df@prueba.test', password: await bcrypt.hash('peperina-123', 10), puntosXPeso: 100,
  dragonfishBaseDeDatos: 'PEPERINA', dragonfishAgentToken: 'token-agente-peperina', dragonfishUltimoContacto: new Date(),
} })
const pep = await prisma.negocio.findFirst({ where: { slug: 'peperina' } }) // base "PRUEBA": sin límite

const cuenta = (negocioId, nombre, email, telefono, createdAt = new Date('2026-10-01T12:00:00Z')) => prisma.cliente.create({ data: { password: 'x', negocioId, nombre, email, telefono, createdAt } })
const ana = await cuenta(pf.id, 'Ana Rec', 'ana.rec@prueba.test', '+5492324700001')
const bea = await cuenta(pf.id, 'Bea Rec', 'bea.rec@prueba.test', '+5492324700002', new Date('2026-11-07T15:00:00Z')) // se registró el 07/11 a las 12:00
const gem1 = await cuenta(pf.id, 'Gema Uno', 'gema1@prueba.test', '+5492324700099')
const gem2 = await cuenta(pf.id, 'Gema Dos', 'gema2@prueba.test', '2324-700099')
const flor = await cuenta(pf.id, 'Flor Ficha', 'flor@prueba.test', '+5492324700004')
const otraEmp = await cuenta(pep.id, 'Otra Empresa', 'otra.empresa@prueba.test', '+5492324700005')

let n = 0
// Una venta ya procesada por el agente viejo (como las de producción).
// `fecha`/`hora`: lo que mandó Dragon Fish; `llegada`: cuándo llegó el aviso.
const venta = (negocioId, fecha, hora, llegada, extra = {}) => prisma.facturaPendiente.create({ data: {
  negocioId, codigo: `REC-${Date.now()}-${n++}`, entidad: 'FACTURA', fecha, hora, createdAt: new Date(llegada),
  procesado: true, resultado: 'sin_datos', monto: 10000, ...extra,
} })
const fila = (f) => prisma.facturaPendiente.findUnique({ where: { id: f.id } })
const saldo = async (c) => (await prisma.cliente.findUnique({ where: { id: c.id } })).puntos
const resolver = async (codigo, cuerpo, token = 'token-agente-peperina') => {
  const r = await fetch(`${BASE}/api/dragonfish/resolver`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ codigo, ...cuerpo }) })
  return { status: r.status, cuerpo: await r.json().catch(() => ({})) }
}

// El 04/11 a las 23:59:59 cuyo aviso llegó pasada la medianoche (05/11 00:00:30).
const f04 = await venta(pf.id, '04/11/2026', '23:59:59', '2026-11-05T03:00:30Z')
const f05 = await venta(pf.id, '05/11/2026', '00:00:00', '2026-11-05T03:00:20Z', { resultado: 'sin_cliente' })
// Reloj de la PC del local adelantado: Dragon Fish dice 05/11 00:10 y el aviso
// figura llegado el 04/11 23:58 (hora del servidor). Cuenta la de Dragon Fish.
const fReloj = await venta(pf.id, '05/11/2026', '00:10:00', '2026-11-05T02:58:00Z', { resultado: 'sin_cliente' })
const fOct = await venta(pf.id, '15/10/2026', '18:00:00', '2026-10-15T21:00:05Z', { resultado: 'sin_cliente' })
const fSep = await venta(pf.id, '20/09/2026', '11:00:00', '2026-09-20T14:00:05Z')
const fBeaAntes = await venta(pf.id, '06/11/2026', '10:00:00', '2026-11-06T13:00:04Z', { resultado: 'sin_cliente' })
const fBeaDespues = await venta(pf.id, '08/11/2026', '10:00:00', '2026-11-08T13:00:04Z', { resultado: 'sin_cliente', monto: 5000 })
const fAmb = await venta(pf.id, '09/11/2026', '17:00:00', '2026-11-09T20:00:03Z', { resultado: 'sin_cliente', monto: 8000 })
const fYa = await venta(pf.id, '06/11/2026', '12:00:00', '2026-11-06T15:00:02Z', { resultado: 'acreditado', clienteId: ana.id, identificadaPor: 'email' })
await prisma.webhookEvento.create({ data: { proveedor: 'dragonfish', referenciaExterna: `${pf.id}:${fYa.codigo}` } })
// Ficha de Dragon Fish con solo nombre (Flor): ventas antes y después del 05/11.
const ficha = { codigoFicha: 'F-FLOR', nombreFicha: 'FICHA FLOR' }
const flOct = await venta(pf.id, '30/10/2026', '16:00:00', '2026-10-30T19:00:02Z', { ...ficha, monto: 3000 })
const fl04 = await venta(pf.id, '04/11/2026', '22:00:00', '2026-11-05T01:00:02Z', { ...ficha, monto: 4000 })
const fl06 = await venta(pf.id, '06/11/2026', '11:00:00', '2026-11-06T14:00:02Z', { ...ficha, monto: 6000 })
const fl09 = await venta(pf.id, '09/11/2026', '11:00:00', '2026-11-09T14:00:02Z', { ...ficha, monto: 9000 })
// Pendiente desde antes (nunca la procesó el agente), del 03/11.
const fPend = await venta(pf.id, '03/11/2026', '10:00:00', '2026-11-03T13:00:02Z', { procesado: false, resultado: null, monto: null })
// Otro negocio, sin límite: una venta del 04/11.
const fOtra = await venta(pep.id, '04/11/2026', '15:00:00', '2026-11-04T18:00:02Z', { resultado: 'sin_cliente', monto: 7000 })

const b = await chromiumDePlaywright().launch()
async function sesion(email, password) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
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
const neg = await sesion('peperina.df@prueba.test', 'peperina-123')
const negOtro = await sesion('negocio@prueba.test', 'negocio-123')
const API = '/api/dragonfish/sin-identificar'

console.log('Lista de ventas sin identificar')
let r = await pedir(neg, 'GET', `${API}?negocioId=${pf.id}`)
const codigos = (r.cuerpo.ventas || []).map((v) => v.codigo)
chequear(r.status === 200 && r.cuerpo.desde === '2026-11-05T03:00:00.000Z', 'informa desde cuándo suman: 05/11/2026 00:00 de Argentina')
chequear([f05, fReloj, fBeaAntes, fBeaDespues, fAmb, fl06, fl09].every((f) => codigos.includes(f.codigo)), 'muestra las del 05/11 en adelante (también una cuyo aviso figura llegado el 04/11 por el reloj de la PC)')
chequear(![f04, fOct, fSep, flOct, fl04, fYa].some((f) => codigos.includes(f.codigo)), 'no muestra las anteriores al 05/11 (tampoco la del 04/11 23:59:59 cuyo aviso llegó el 05/11) ni las ya acreditadas')
chequear(r.cuerpo.ventas.find((v) => v.codigo === f05.codigo)?.fecha === '2026-11-05T03:00:00.000Z', 'la fecha que muestra es la de la venta en Dragon Fish')
r = await pedir(negOtro, 'GET', `${API}?negocioId=${pep.id}`)
chequear(r.cuerpo.desde === null && r.cuerpo.ventas.some((v) => v.codigo === fOtra.codigo), 'otro negocio: sin límite, ve su venta del 04/11')

console.log('Volver a revisar')
r = await pedir(neg, 'POST', API, { negocioId: pf.id, accion: 'revisar', dias: 60 })
const vuelven = [f05, fReloj, fBeaAntes, fBeaDespues, fAmb, fl06, fl09]
const quedan = [f04, fOct, fSep, flOct, fl04]
chequear(r.status === 200 && r.cuerpo.enRevision === vuelven.length, `vuelven a la fila exactamente las ${vuelven.length} del 05/11 en adelante (recibido: ${r.cuerpo.enRevision})`)
chequear((await Promise.all(vuelven.map(fila))).every((x) => x.procesado === false && x.resultado === null), 'esas quedan pendientes para el agente')
chequear((await Promise.all(quedan.map(fila))).every((x, i) => x.procesado === true && x.resultado === quedan[i].resultado), 'las de septiembre, octubre y 1 al 4 de noviembre no se tocan')
const ya = await fila(fYa)
chequear(ya.procesado === true && ya.resultado === 'acreditado', 'la ya acreditada no se toca')

console.log('El agente las procesa')
r = await resolver(f05.codigo, { monto: 10000, email: 'ana.rec@prueba.test', telefonos: [] })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(ana) === 100, 'venta del 05/11 00:00, cuenta de antes, una sola coincidencia: suma 100')
r = await resolver(fBeaAntes.codigo, { monto: 10000, email: 'bea.rec@prueba.test', telefonos: [] })
chequear(r.cuerpo.resultado === 'cuenta_posterior' && await saldo(bea) === 0, 'venta del 06/11, clienta registrada el 07/11: no suma')
r = await resolver(fBeaDespues.codigo, { monto: 5000, email: 'bea.rec@prueba.test', telefonos: [] })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(bea) === 50, 'venta del 08/11, después del registro: suma 50')
r = await resolver(fAmb.codigo, { monto: 8000, telefonos: ['2324700099'] })
chequear(r.cuerpo.resultado === 'ambigua' && await saldo(gem1) === 0 && await saldo(gem2) === 0, 'celular de dos cuentas: "ambigua", no suma a ninguna')
r = await resolver(fPend.codigo, { monto: 20000, email: 'ana.rec@prueba.test', telefonos: [] })
chequear(r.cuerpo.resultado === 'fuera_de_periodo' && await saldo(ana) === 100, 'una pendiente del 03/11 que el agente reporta ahora: "fuera_de_periodo", no suma')
r = await resolver(fYa.codigo, { monto: 10000, email: 'ana.rec@prueba.test', telefonos: [] })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(ana) === 100, 'la ya acreditada no vuelve a sumar')
r = await resolver(f05.codigo, { monto: 10000, email: 'ana.rec@prueba.test', telefonos: [] })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(ana) === 100 && await prisma.webhookEvento.count({ where: { referenciaExterna: `${pf.id}:${f05.codigo}` } }) === 1, 'el mismo reporte otra vez no suma de nuevo')
await pedir(neg, 'POST', API, { negocioId: pf.id, accion: 'revisar', dias: 60 })
chequear((await fila(f05)).resultado === 'acreditado' && (await fila(f04)).resultado === 'sin_datos', '"Volver a revisar" otra vez no toca las acreditadas ni las anteriores al 05/11')
for (const f of [fl06, fl09]) await resolver(f.codigo, { monto: f.monto, codigoFicha: 'F-FLOR', nombre: 'FICHA FLOR', telefonos: [] })

console.log('Asignar a mano y vincular la ficha')
r = await pedir(neg, 'POST', API, { negocioId: pf.id, accion: 'asignar', codigo: f04.codigo, clienteId: ana.id })
chequear(r.status === 409 && /suman desde el 05\/11\/2026/.test(r.cuerpo.error) && (await fila(f04)).resultado === 'sin_datos' && await saldo(ana) === 100, 'no se puede asignar a mano una venta del 04/11')
r = await pedir(neg, 'POST', API, { negocioId: pf.id, accion: 'asignar', codigo: fl09.codigo, clienteId: flor.id, vincular: true })
chequear(r.status === 200 && r.cuerpo.vinculada === true && r.cuerpo.puntos === 90 && r.cuerpo.otras === 1 && r.cuerpo.puntosOtras === 60 && await saldo(flor) === 150, 'vincular la ficha: suma la del 09/11 (90) y la otra del 06/11 (60)')
chequear((await fila(flOct)).resultado === 'sin_datos' && (await fila(fl04)).resultado === 'sin_datos', 'las de esa ficha del 30/10 y del 04/11 no suman')

console.log('Compras nuevas')
const ahora = new Date(Date.now() - 3 * 3600000) // hora de Argentina
const dd = (x) => String(x).padStart(2, '0')
const aviso = { Entidad: 'FACTURA', Evento: 'INGRESAR', Fecha: `${dd(ahora.getUTCDate())}/${dd(ahora.getUTCMonth() + 1)}/${ahora.getUTCFullYear()}`, Hora: `${dd(ahora.getUTCHours())}:${dd(ahora.getUTCMinutes())}:${dd(ahora.getUTCSeconds())}`, Version: '1.0.0.1', BaseDeDatos: 'PEPERINA' }
for (const [codigo, cuerpo, quien, esperado] of [
  ['NUEVA-ANA', { monto: 4000, email: 'ana.rec@prueba.test', telefonos: [] }, ana, 140],
  ['NUEVA-FLOR', { monto: 2000, codigoFicha: 'F-FLOR', nombre: 'FICHA FLOR', telefonos: [] }, flor, 170],
]) {
  await fetch(`${BASE}/api/webhooks/dragonfish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aviso, Codigo: `${codigo}-${Date.now()}` }) })
  const nueva = await prisma.facturaPendiente.findFirst({ where: { negocioId: pf.id, codigo: { startsWith: codigo } } })
  r = await resolver(nueva.codigo, cuerpo)
  chequear(nueva.fecha === aviso.Fecha && r.cuerpo.resultado === 'acreditado' && await saldo(quien) === esperado, `compra de hoy (aviso real de Dragon Fish) de ${quien.nombre}: suma sola (${esperado})`)
}

console.log('Otro negocio')
r = await pedir(negOtro, 'POST', API, { negocioId: pep.id, accion: 'revisar', dias: 60 })
chequear(r.status === 200 && r.cuerpo.enRevision >= 1 && (await fila(fOtra)).procesado === false, 'sin límite: su venta del 04/11 vuelve a revisarse')
r = await resolver(fOtra.codigo, { monto: 7000, email: 'otra.empresa@prueba.test', telefonos: [] }, 'token-agente-prueba')
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(otraEmp) === 70, 'y se acredita normalmente (70)')

console.log('Pantalla')
await neg.page.goto(`${BASE}/`)
await neg.page.getByRole('button', { name: /^Integraciones/ }).first().click()
chequear(await neg.page.getByRole('button', { name: 'Volver a revisar (desde el 05/11/2026)' }).isVisible(), 'el botón dice "Volver a revisar (desde el 05/11/2026)"')
await negOtro.page.goto(`${BASE}/`)
await negOtro.page.getByRole('button', { name: /^Integraciones/ }).first().click()
chequear(await negOtro.page.getByRole('button', { name: 'Volver a revisar (últimos 60 días)' }).isVisible(), 'en otro negocio sigue "Volver a revisar (últimos 60 días)"')

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
