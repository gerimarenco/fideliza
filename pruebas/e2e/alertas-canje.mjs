// Alerta de canje para las empleadas: clientas que ya pueden canjear el
// premio elegido por el negocio (el pañuelo en Peperina), con sus puntos, lo
// que falta para el siguiente premio y un WhatsApp con el mensaje sugerido
// (nunca se manda solo). Marcar el contacto, deshacerlo, que no se repita,
// que un canje la reinicie, configuración por negocio y multiempresa.
// Base local descartable; Tiendanube y Resend simulados.
//
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/alertas-canje.mjs
// (ver pruebas/e2e/README.md). Suite nueva (2026-11-08).
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { BASE, DIR, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
const chromium = chromiumDePlaywright()
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
for (const f of ['tn-control.json', 'tn-productos.json']) fs.rmSync(`${DIR}/${f}`, { force: true })
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin"')

// Datos de prueba como los de Peperina: el pañuelo es el primer premio, a 4.000 puntos.
const pep = await prisma.negocio.findFirst({ where: { slug: 'peperina' } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo', activo: true } })
const panuelo = await prisma.premio.update({ where: { id: (await prisma.premio.findFirst({ where: { nombre: 'Pañuelo de seda' } })).id }, data: { puntos: 4000 } })
const diez = await prisma.premio.update({ where: { id: (await prisma.premio.findFirst({ where: { nombre: '10% en toda la tienda' } })).id }, data: { activo: false } })
const setenta = await prisma.premio.findFirst({ where: { nombre: '$70.000 de descuento' } })
const premioDemo = await prisma.premio.create({ data: { nombre: 'Café gratis', puntos: 100, emoji: 'gift', negocioId: demo.id } })
const porEmail = (email) => prisma.cliente.findFirst({ where: { email } })
const lucia = await prisma.cliente.update({ where: { email: 'lucia@prueba.test' }, data: { puntos: 4000 } })
const paula = await prisma.cliente.findFirst({ where: { email: 'paula@prueba.test' } }) // 4.150
await prisma.cliente.update({ where: { email: 'sofia@prueba.test' }, data: { puntos: 3999 } })
const clienteDemo = await prisma.cliente.create({ data: { nombre: 'Clienta Demo', email: 'alerta.demo@prueba.test', password: lucia.password, negocioId: demo.id, puntos: 10000, telefono: '2324000999' } })
const saldos = async () => JSON.stringify(await prisma.cliente.findMany({ select: { id: true, puntos: true }, orderBy: { id: 'asc' } }))

console.log('Configuración real (script de solo lectura)')
const antes = await saldos()
let salida = execFileSync('node', ['scripts/revisar-alerta-canje.mjs'], { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' })
chequear(salida.includes('Primer premio activo: Pañuelo de seda (4.000 puntos)') && salida.includes('Coincide con los 4.000 puntos esperados.'), 'muestra el primer premio y que coincide con 4.000')
chequear(salida.includes('Alerta: desactivada') && salida.includes('aparecerían 2 clienta(s)'), 'sin alerta configurada, dice cuántas aparecerían (Lucía 4.000 y Paula 4.150; Sofía 3.999 no)')
salida = execFileSync('node', ['scripts/revisar-alerta-canje.mjs', '--esperado=5000'], { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' })
chequear(salida.includes('NO coincide con los 5.000 puntos esperados') && (await saldos()) === antes && (await prisma.premio.findUnique({ where: { id: panuelo.id } })).puntos === 4000, 'si no coincide lo avisa, y no cambia premios ni saldos')

const b = await chromium.launch()
async function sesion(email, password, viewport = { width: 1280, height: 900 }) {
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
const neg = await sesion('negocio@prueba.test', 'negocio-123')
const lista = async (extra = '') => (await pedir(neg, 'GET', `/api/clientes?negocioId=${pep.id}&pageSize=100${extra}`)).cuerpo.items
const resumen = async () => (await pedir(neg, 'GET', `/api/clientes/alertas?negocioId=${pep.id}`)).cuerpo

console.log('Sin configurar: no hay alerta')
chequear((await lista()).every((c) => c.alerta === null) && (await resumen()).premio === null, 'ninguna clienta marcada mientras el negocio no la active')

console.log('Configuración por negocio')
let r = await pedir(neg, 'PATCH', '/api/negocios', { id: pep.id, alertaCanjePremioId: premioDemo.id })
chequear(r.status === 400, `un premio de otro negocio → 400 "${r.cuerpo.error}"`)
r = await pedir(neg, 'PATCH', '/api/negocios', { id: pep.id, alertaCanjePremioId: diez.id })
chequear(r.status === 400, 'un premio desactivado → 400')
chequear((await pedir(neg, 'PATCH', '/api/negocios', { id: demo.id, alertaCanjePremioId: premioDemo.id })).status === 403, 'no puede configurar la alerta de otro negocio')
r = await pedir(neg, 'PATCH', '/api/negocios', { id: pep.id, alertaCanjePremioId: panuelo.id })
chequear(r.status === 200 && (await prisma.negocio.findUnique({ where: { id: pep.id } })).alertaCanjePremioId === panuelo.id && (await prisma.premio.findUnique({ where: { id: panuelo.id } })).puntos === 4000, 'Peperina: alerta con el pañuelo; el premio no cambia')

console.log('Qué muestra la alerta')
let todas = await lista()
const aLucia = todas.find((c) => c.id === lucia.id)?.alerta
const aPaula = todas.find((c) => c.id === paula.id)?.alerta
chequear(aLucia?.pendiente && aLucia.premio.nombre === 'Pañuelo de seda' && aLucia.puntos === 4000, 'Lucía (4.000 justos): puede canjear el pañuelo')
chequear(aPaula?.pendiente && aPaula.puntos === 4150 && aPaula.siguiente?.nombre === '$70.000 de descuento' && aPaula.siguiente.faltan === 8350, 'Paula (4.150): le faltan 8.350 para el siguiente premio ($70.000 de descuento)')
chequear(todas.filter((c) => c.alerta).length === 2 && !todas.find((c) => c.email === 'sofia@prueba.test').alerta, 'solo esas dos (Sofía, con 3.999, no)')
chequear((await resumen()).pendientes === 2 && (await lista('&alerta=1')).length === 2, 'resumen: 2 pendientes; el filtro "solo para avisar" trae esas 2')
chequear((await saldos()) === antes, 'mostrar la alerta no cambia ningún saldo')

console.log('Multiempresa')
const negDemo = await sesion('demo@prueba.test', 'demo-123')
const listaDemo = (await pedir(negDemo, 'GET', `/api/clientes?negocioId=${demo.id}&pageSize=100`)).cuerpo.items
chequear(listaDemo.every((c) => c.alerta === null) && (await pedir(negDemo, 'GET', `/api/clientes/alertas?negocioId=${demo.id}`)).cuerpo.premio === null, 'el otro negocio (sin alerta configurada) no marca a nadie, aunque su clienta tenga 10.000 puntos')
chequear((await pedir(negDemo, 'GET', `/api/clientes/alertas?negocioId=${pep.id}`)).status === 403 && (await pedir(negDemo, 'POST', `/api/clientes/${paula.id}/alerta`, { contactada: true })).status === 404, 'otro negocio no ve ni marca las alertas de Peperina')
const cli = await sesion('lucia@prueba.test', 'clienta-123', { width: 390, height: 844 })
chequear((await pedir(cli, 'POST', `/api/clientes/${lucia.id}/alerta`, { contactada: true })).status === 403, 'una clienta no puede marcarse a sí misma')

console.log('Marcar el contacto')
chequear((await pedir(neg, 'POST', `/api/clientes/${paula.id}/alerta`, { contactada: 'si' })).status === 400, 'un valor inválido → 400')
r = await pedir(neg, 'POST', `/api/clientes/${paula.id}/alerta`, { contactada: true })
let paulaDb = await porEmail('paula@prueba.test')
chequear(r.status === 200 && paulaDb.alertaContactadaEn && paulaDb.alertaContactadaPuntos === 4150, 'Paula marcada como contactada (cuándo y con 4.150 puntos)')
todas = await lista()
chequear(todas.find((c) => c.id === paula.id).alerta.pendiente === false && (await resumen()).pendientes === 1 && (await lista('&alerta=1')).map((c) => c.id).join() === lucia.id, 'deja de estar pendiente: queda 1 para avisar (Lucía)')
await pedir(neg, 'POST', `/api/clientes/${paula.id}/alerta`, { contactada: true })
chequear((await resumen()).pendientes === 1, 'marcarla otra vez no la duplica ni la vuelve a mostrar')
await pedir(neg, 'POST', `/api/clientes/${paula.id}/alerta`, { contactada: false })
chequear((await resumen()).pendientes === 2 && (await porEmail('paula@prueba.test')).alertaContactadaEn === null, 'deshacer: vuelve a estar pendiente')
await pedir(neg, 'POST', `/api/clientes/${paula.id}/alerta`, { contactada: true })
chequear((await saldos()) === antes, 'marcar y desmarcar no cambia ningún saldo')

console.log('El canje la reinicia')
r = await pedir(neg, 'POST', '/api/canjes', { premioId: panuelo.id, clienteId: paula.id, claveIdempotencia: `alerta-${Date.now()}` })
paulaDb = await porEmail('paula@prueba.test')
chequear(r.status === 200 && paulaDb.puntos === 150 && paulaDb.alertaContactadaEn === null, 'Paula canjea el pañuelo: le quedan 150 puntos y se borra el contacto')
chequear(!(await lista()).find((c) => c.id === paula.id).alerta && (await resumen()).pendientes === 1, 'sin puntos suficientes ya no aparece')
r = await pedir(neg, 'POST', '/api/compras', { clienteId: paula.id, monto: 400000, negocioId: pep.id })
chequear(r.status === 200 && (await lista()).find((c) => c.id === paula.id).alerta?.pendiente === true && (await resumen()).pendientes === 2, 'cuando vuelve a llegar a 4.000 (compra de $400.000 → +4.000), aparece de nuevo para avisarle')

console.log('Pantalla: Inicio, Clientes y Ajustes')
await neg.page.goto(`${BASE}/`)
await neg.page.getByText('2 clientas ya pueden canjear').first().waitFor({ timeout: 60000 })
chequear(await neg.page.getByText('Avisales por WhatsApp.').isVisible(), 'Inicio: "2 clientas ya pueden canjear Pañuelo de seda. Avisales por WhatsApp."')
chequear((await neg.page.getByRole('img', { name: 'Ya puede canjear Pañuelo de seda' }).count()) === 2, 'Inicio: el "!" junto al nombre de las 2 en la lista de clientes')
await neg.page.screenshot({ path: `${DIR}/alerta-inicio.png` })
await neg.page.getByRole('button', { name: 'Ver clientas' }).click()
await neg.page.getByRole('button', { name: 'Ver todas las clientas' }).waitFor({ timeout: 30000 })
const filas = neg.page.locator('li').filter({ has: neg.page.getByText('Puede canjear', { exact: true }) })
await filas.first().waitFor({ timeout: 30000 })
chequear((await filas.count()) === 2, 'Clientes, "Ver solo esas": las 2, cada una con "Puede canjear" junto al nombre')
const filaLucia = neg.page.locator('li', { hasText: 'Lucía Fernández' }).first()
await filaLucia.getByRole('button').first().click()
const caja = filaLucia.getByRole('group', { name: 'Alerta de canje' })
await caja.waitFor({ timeout: 30000 })
const textoCaja = await caja.innerText()
chequear(textoCaja.includes('Ya puede canjear Pañuelo de seda.') && textoCaja.includes('Tiene 4.000 puntos.') && textoCaja.includes('Le faltan 8.500 para el siguiente premio, $70.000 de descuento (12.500).'), 'detalle: puede canjear el pañuelo, tiene 4.000, le faltan 8.500 para el siguiente')
const href = await caja.getByRole('link', { name: 'Avisarle por WhatsApp' }).getAttribute('href')
const esperado = '¡Hola! ¿Cómo estás? Te contamos que ya tenés los puntos necesarios para canjear tu pañuelo de seda en Club Peperina. Además, estás cada vez más cerca de conseguir tu próximo premio.'
chequear(href === `https://wa.me/5492324555000?text=${encodeURIComponent(esperado)}`, 'WhatsApp con el mensaje sugerido, para que la empleada lo revise y lo mande ella')
await neg.page.screenshot({ path: `${DIR}/alerta-clientes.png`, fullPage: true })
await caja.getByRole('button', { name: 'Marcar como contactada' }).click()
await neg.page.getByText('Marcada como contactada.').waitFor({ timeout: 30000 })
await neg.page.getByText('1 clienta ya puede canjear').waitFor({ timeout: 30000 })
chequear((await porEmail('lucia@prueba.test')).alertaContactadaEn !== null, 'desde la pantalla: "Marcar como contactada" la saca de la lista para avisar y el aviso pasa a 1')
await neg.page.getByRole('button', { name: /^Ajustes/ }).first().click()
await neg.page.getByText('Alerta de canje').first().waitFor({ timeout: 30000 })
const opcion = await neg.page.getByLabel('Avisar cuando una clienta llegue a').evaluate((s) => s.options[s.selectedIndex].text)
chequear(opcion === 'Pañuelo de seda — 4.000 puntos', `Ajustes muestra la alerta elegida: "${opcion}"`)

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
