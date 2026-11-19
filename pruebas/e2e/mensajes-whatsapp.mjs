// Mensajes por WhatsApp (panel del negocio): el negocio escribe el mensaje una
// vez con {nombre}, {puntos} y {club}; el panel arma el de cada clienta y un
// link de WhatsApp con el texto escrito, para mandarlo desde el WhatsApp del
// local. Retornar no manda nada (los links a wa.me se bloquean en la prueba).
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/mensajes-whatsapp.mjs
import { BASE, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin"')

const pep = await prisma.negocio.findFirst({ where: { slug: 'peperina' } })
const ana = await prisma.cliente.create({ data: { nombre: 'ANA maría Gómez', email: 'ana.wa@prueba.test', password: 'x', negocioId: pep.id, telefono: '+5492324500294', puntos: 3420 } })
const sinTel = await prisma.cliente.create({ data: { nombre: 'Sin Celular', email: 'sin.tel.wa@prueba.test', password: 'x', negocioId: pep.id, telefono: null, puntos: 10 } })
const demo = await prisma.negocio.findFirst({ where: { email: 'demo@prueba.test' } })
await prisma.cliente.create({ data: { nombre: 'Otra Negocio', email: 'otra.wa@prueba.test', password: 'x', negocioId: demo.id, telefono: '+5492324999111', puntos: 5 } })

const b = await chromiumDePlaywright().launch()
async function sesion(email, password) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.route('https://wa.me/**', (r) => r.abort())
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.getByRole('button', { name: /^Ingres/ }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 })
  return { ctx, page }
}
const pedir = (s, ruta) => s.page.evaluate(async (u) => { const x = await fetch(u); let j = {}; try { j = await x.json() } catch {} return { status: x.status, cuerpo: j } }, ruta)

console.log('API')
const neg = await sesion('negocio@prueba.test', 'negocio-123')
const negDemo = await sesion('demo@prueba.test', 'demo-123')
const cli = await sesion('lucia@prueba.test', 'clienta-123')
const url = `/api/clientes/whatsapp?negocioId=${pep.id}`
let r = await pedir(neg, url)
const filaAna = r.cuerpo.clientes?.find((c) => c.id === ana.id)
chequear(r.status === 200 && filaAna?.puntos === 3420 && filaAna.telefono === '+5492324500294' && Object.keys(filaAna).sort().join() === 'id,nombre,puntos,telefono', 'el negocio ve sus clientas con nombre, celular y puntos (nada más: ni email ni DNI)')
chequear(!r.cuerpo.clientes.some((c) => c.nombre === 'Otra Negocio'), 'no aparecen clientas de otro negocio')
chequear((await pedir(negDemo, url)).status === 403 && (await pedir(cli, url)).status === 403, 'otro negocio o una clienta no pueden verlas')
chequear((await fetch(`${BASE}${url}`)).status === 403, 'sin sesión, tampoco')

console.log('Pantalla')
const p = neg.page
await p.goto(`${BASE}/`)
await p.getByRole('button', { name: 'Mensajes por WhatsApp' }).first().click()
await p.getByRole('heading', { name: 'El mensaje' }).waitFor({ timeout: 30000 })
const ejemplo = await p.locator('[data-ejemplo-wa]').innerText()
chequear(ejemplo.startsWith('¡Hola Ana!') && ejemplo.includes('Club Peperina') && ejemplo.includes('3.420') && ejemplo.includes('Black Friday'), `muestra el mensaje sugerido de ejemplo: "${ejemplo.slice(0, 60)}…"`)
const filaPantalla = p.locator('li', { hasText: 'ANA maría Gómez' })
await filaPantalla.waitFor({ timeout: 30000 })
const href = await filaPantalla.getByRole('link', { name: /Enviar por WhatsApp/ }).getAttribute('href')
const texto = decodeURIComponent(href.split('?text=')[1] || '')
chequear(href.startsWith('https://wa.me/5492324500294?text=') && texto.startsWith('¡Hola Ana!') && texto.includes('hoy tenés 3.420'), 'el link abre el WhatsApp de la clienta con su mensaje (nombre y puntos)')
chequear(!(await p.locator('li', { hasText: 'Sin Celular' }).count()) && (await p.getByRole('status').filter({ hasText: 'sin un celular válido' }).count()) === 1, 'la clienta sin celular no aparece y se avisa cuántas son')

const popup = neg.ctx.waitForEvent('page')
await filaPantalla.getByRole('link', { name: /Enviar por WhatsApp/ }).click()
await (await popup).close()
await filaPantalla.getByText('Enviado').waitFor({ timeout: 10000 })
chequear(true, 'al tocar "Enviar por WhatsApp" queda marcada como enviada')
await p.reload()
await p.getByRole('button', { name: 'Mensajes por WhatsApp' }).first().click()
await p.locator('li', { hasText: 'ANA maría Gómez' }).getByText('Enviado').waitFor({ timeout: 30000 })
chequear(true, 'la marca se recuerda al volver a entrar')

await p.getByLabel('Mensaje', { exact: true }).fill('Hola {nombre}, tenés {puntos} puntos en {club}.')
const nuevo = await p.locator('li', { hasText: 'ANA maría Gómez' }).locator('p').innerText()
chequear(nuevo === 'Hola Ana, tenés 3.420 puntos en Club Peperina.', `al cambiar el mensaje, cambia el de cada clienta ("${nuevo}")`)
await p.locator('li', { hasText: 'ANA maría Gómez' }).getByRole('button', { name: 'Desmarcar' }).click()
chequear(!(await p.locator('li', { hasText: 'ANA maría Gómez' }).getByText('Enviado').count()), '"Desmarcar" la vuelve a dejar para enviar')
const mailsAntes = await prisma.movimientoPuntos.count()
chequear((await prisma.cliente.findUnique({ where: { id: ana.id } })).puntos === 3420 && mailsAntes === await prisma.movimientoPuntos.count(), 'no cambia ningún punto ni movimiento')
void sinTel

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
