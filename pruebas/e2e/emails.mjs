// Emails a las clientas: remitente con el nombre del club (misma dirección),
// "responder a" el email de soporte, versión de texto, mail de bienvenida
// (solo si el negocio lo activó), canje con asunto neutro, aviso de
// vencimiento calculado por lote (no por saldo) con premios y cuánto
// comprar, sin avisos repetidos, y otros negocios sin cambios. Resend
// simulado (los mails van a un archivo): no sale ningún mail real.
//
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/emails.mjs
// (ver pruebas/e2e/README.md). Suite nueva (2026-11-07). Guarda capturas de
// cada mail en $RETORNAR_E2E_DIR/mail-*.png.
import fs from 'node:fs'
import { BASE, DIR, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
process.env.RESEND_API_KEY = 're_prueba_local'
delete process.env.RESEND_FROM_EMAIL
const vencimientoPuntos = (await import('../../netlify/functions/vencimiento-puntos.mjs')).default
const chromium = chromiumDePlaywright()
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
const MAILS = `${DIR}/mails-enviados.json`
fs.rmSync(MAILS, { force: true })
const mails = () => (fs.existsSync(MAILS) ? JSON.parse(fs.readFileSync(MAILS, 'utf8')) : [])
const mailsA = (email) => mails().filter((m) => JSON.stringify(m.to).includes(email))
const REMITENTE_BASE = 'Retornar <onboarding@resend.dev>'
const DIA = 24 * 60 * 60 * 1000
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin", "IntentoRegistro"')

const pep = await prisma.negocio.update({ where: { slug: 'peperina' }, data: { soporteEmail: 'hola@peperina.test', vencimientoPuntosMeses: 9, bienvenidaPuntos: 150, bienvenidaDesde: new Date(Date.now() - DIA), bienvenidaHasta: new Date(Date.now() + DIA) } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo', activo: true } })

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
const pedir = (s, metodo, ruta, cuerpo) => s.page.evaluate(async ([m, u, c]) => { const x = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined }); let j = {}; try { j = await x.json() } catch {} return { status: x.status, cuerpo: j } }, [metodo, ruta, cuerpo])
let dni = 38100000
const registrar = (slug, email, nombre) => fetch(`${BASE}/api/registro/${slug}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.40.0.${dni % 200}` }, body: JSON.stringify({ nombre, email, password: 'clienta-123', fechaNacimiento: '1993-03-03', telefono: `23246${String(++dni).slice(-5)}`, dni: String(dni) }) })

console.log('Ajustes: nombre del remitente y bienvenida')
const neg = await sesion('negocio@prueba.test', 'negocio-123')
let r = await pedir(neg, 'PATCH', '/api/negocios', { id: pep.id, emailRemitenteNombre: 'Club <Peperina>', emailBienvenida: true })
chequear(r.status === 400, `un nombre con < > → 400 "${r.cuerpo.error}"`)
r = await pedir(neg, 'PATCH', '/api/negocios', { id: pep.id, emailRemitenteNombre: '  Club   Peperina ', emailBienvenida: true })
const pepAhora = await prisma.negocio.findUnique({ where: { id: pep.id } })
chequear(r.status === 200 && pepAhora.emailRemitenteNombre === 'Club Peperina' && pepAhora.emailBienvenida === true, 'Peperina: remitente "Club Peperina" y bienvenida activada')
chequear((await pedir(neg, 'PATCH', '/api/negocios', { id: demo.id, emailBienvenida: true })).status === 403, 'Peperina no puede cambiar los ajustes de otro negocio')
const demoAhora = await prisma.negocio.findUnique({ where: { id: demo.id } })
chequear(demoAhora.emailRemitenteNombre === null && demoAhora.emailBienvenida === false, 'el otro negocio sigue igual (sin nombre de remitente, sin bienvenida)')

await neg.page.goto(`${BASE}/`)
await neg.page.getByRole('button', { name: /^Ajustes/ }).first().click()
await neg.page.getByText('Emails a tus clientas').waitFor({ timeout: 30000 })
chequear((await neg.page.getByLabel('Nombre del remitente (lo que se ve en la bandeja de entrada)').inputValue()) === 'Club Peperina' && await neg.page.getByLabel('Mandar un email de bienvenida a cada clienta que se registra').isChecked(), 'Ajustes muestra el remitente y la bienvenida guardados')

console.log('Email de bienvenida')
r = await registrar('peperina', 'bienvenida@prueba.test', 'Camila Torres')
let m = mailsA('bienvenida@prueba.test')
chequear(r.status === 201 && m.length === 1 && m[0].subject === 'Te damos la bienvenida a Club Peperina', `al registrarse: un mail "${m[0]?.subject}"`)
chequear(m[0]?.from === 'Club Peperina <onboarding@resend.dev>', `remitente visible "Club Peperina", misma dirección (${m[0]?.from})`)
chequear(m[0]?.reply_to === 'hola@peperina.test' || JSON.stringify(m[0]?.reply_to) === '["hola@peperina.test"]', 'las respuestas van al email de soporte de Peperina')
chequear(m[0]?.html.includes('Hola, Camila:') && m[0].html.includes('150 puntos') && m[0].html.includes('de regalo para empezar') && m[0].html.includes('1 punto por cada $100'), 'saluda por el nombre, menciona el regalo de bienvenida y la equivalencia')
chequear(typeof m[0]?.text === 'string' && m[0].text.includes('Gracias por sumarte a Club Peperina') && !/<[a-z]/i.test(m[0].text), 'tiene versión de solo texto')
fs.writeFileSync(`${DIR}/mail-bienvenida.html`, m[0]?.html || '')
r = await registrar('demo', 'endemo.mail@prueba.test', 'Lola Demo')
chequear(r.status === 201 && mailsA('endemo.mail@prueba.test').length === 0, 'en un negocio sin la bienvenida activada no se manda')

console.log('Compra y canje')
const lucia = await prisma.cliente.update({ where: { email: 'lucia@prueba.test' }, data: { puntos: 40000 } })
r = await pedir(neg, 'POST', '/api/compras', { clienteId: lucia.id, monto: 25000, negocioId: pep.id })
m = mailsA('lucia@prueba.test').at(-1)
chequear(r.status === 200 && m?.subject === '+250 puntos en Club Peperina' && m.from === 'Club Peperina <onboarding@resend.dev>', `compra: "${m?.subject}" de "${m?.from}"`)
fs.writeFileSync(`${DIR}/mail-compra.html`, m?.html || '')
const cli = await sesion('lucia@prueba.test', 'clienta-123')
const diez = await prisma.premio.findFirst({ where: { nombre: '10% en toda la tienda' } })
r = await pedir(cli, 'POST', '/api/canjes', { premioId: diez.id, claveIdempotencia: `mail-${Date.now()}` })
m = mailsA('lucia@prueba.test').at(-1)
chequear(m?.subject === 'Confirmación de tu canje en Club Peperina' && !/[%$]|descuento|cup[oó]n/i.test(m.subject), `canje: asunto neutro, sin montos ni "descuento" ("${m?.subject}")`)
chequear(m?.html.includes(r.cuerpo.tiendanubeCuponCodigo) && m.text.includes(r.cuerpo.tiendanubeCuponCodigo) && m.html.includes('10% en toda la tienda'), 'el código y el premio están en el HTML y en el texto')
fs.writeFileSync(`${DIR}/mail-canje.html`, m?.html || '')

console.log('Aviso de vencimiento: por lote, no por saldo')
const hace = (dias) => new Date(Date.now() - dias * DIA)
const nueveMeses = (mas) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 9); return new Date(d.getTime() + mas * DIA) }
const sofia = await prisma.cliente.create({ data: { nombre: 'Sofía Vence', email: 'vence.lotes@prueba.test', password: 'x', negocioId: pep.id, puntos: 4700 } })
const lote = (cliente, puntos, saldoRestante, createdAt) => prisma.movimientoPuntos.create({ data: { clienteId: cliente.id, negocioId: pep.id, puntos, saldoRestante, origen: 'dragonfish', createdAt } })
await lote(sofia, 500, 500, nueveMeses(10)) // vence en ~10 días
await lote(sofia, 300, 200, nueveMeses(20)) // vence en ~20 días; 100 ya usados
await lote(sofia, 300, 0, nueveMeses(5)) // vence en ~5 días pero ya se usó entero
await lote(sofia, 900, 0, nueveMeses(-30)) // ya vencido antes (saldo 0)
await lote(sofia, 4000, 4000, hace(10)) // reciente: no vence en 30 días
const marta = await prisma.cliente.create({ data: { nombre: 'Marta Lejos', email: 'vence.poco@prueba.test', password: 'x', negocioId: pep.id, puntos: 800 } })
await lote(marta, 800, 800, nueveMeses(12))
const antesSaldos = (await prisma.cliente.findMany({ where: { id: { in: [sofia.id, marta.id] } }, select: { id: true, puntos: true } })).map((c) => c.puntos).join(',')
await vencimientoPuntos()
m = mailsA('vence.lotes@prueba.test')
chequear(m.length === 1 && /^Tenés 700 puntos que vencen el \d\d\/\d\d\/\d{4} en Club Peperina$/.test(m[0].subject), `Sofía (saldo 4.700): avisa 700 puntos, no el saldo ("${m[0]?.subject}")`)
chequear(m[0]?.html.includes('500 el ') && m[0].html.includes('200 el ') && m[0].html.includes('Hoy tenés 4.700 puntos'), 'detalle por fecha: 500 y 200 en fechas distintas (los 100 usados y los lotes vacíos no cuentan)')
chequear(m[0]?.html.includes('Ya te alcanza para un premio') && m[0].html.includes('Ya lo podés canjear'), 'le dice que ya puede canjear (10%)')
chequear(m[0]?.html.includes('Te faltan 300 puntos · comprando $30.000'), 'para el pañuelo: le faltan 300 puntos, comprando $30.000 (1 punto cada $100)')
chequear(m[0]?.from === 'Club Peperina <onboarding@resend.dev>' && m[0].text.includes('700 puntos'), 'con el remitente del club y versión de texto')
fs.writeFileSync(`${DIR}/mail-vencimiento.html`, m[0]?.html || '')
m = mailsA('vence.poco@prueba.test')
chequear(m.length === 1 && m[0].html.includes('Te faltan 1.700 puntos (unos $170.000 en compras) para <strong>10% en toda la tienda</strong>'), 'Marta (800): le faltan 1.700 puntos, unos $170.000 en compras, para el primer premio')
chequear((await prisma.cliente.findMany({ where: { id: { in: [sofia.id, marta.id] } }, select: { id: true, puntos: true } })).map((c) => c.puntos).join(',') === antesSaldos, 'el aviso no cambia ningún saldo')
const totalAntes = mails().length
await vencimientoPuntos()
chequear(mailsA('vence.lotes@prueba.test').length === 1 && mailsA('vence.poco@prueba.test').length === 1 && mails().length === totalAntes, 'correr la tarea otra vez no repite ningún aviso')

console.log('Contraseña y otros negocios')
await fetch(`${BASE}/api/password-reset/solicitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'negocio@prueba.test' }) })
m = mailsA('negocio@prueba.test').at(-1)
chequear(m?.from === REMITENTE_BASE && !m.reply_to, `el mail de contraseña al negocio sale de Retornar (${m?.from})`)
await fetch(`${BASE}/api/password-reset/solicitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'lucia@prueba.test' }) })
m = mailsA('lucia@prueba.test').at(-1)
chequear(m?.subject === 'Restablecer tu contraseña en Club Peperina' && m.from === 'Club Peperina <onboarding@resend.dev>', 'a una clienta, con el remitente del club y el asunto sin escapes')
const lola = await prisma.cliente.findFirst({ where: { email: 'endemo.mail@prueba.test' } })
const negDemo = await sesion('demo@prueba.test', 'demo-123')
r = await pedir(negDemo, 'POST', '/api/compras', { clienteId: lola.id, monto: 5000, negocioId: demo.id })
m = mailsA('endemo.mail@prueba.test').at(-1)
chequear(r.status === 200 && m?.from === REMITENTE_BASE && !m.reply_to, `el otro negocio sigue saliendo como siempre (${m?.from})`)

console.log('Ningún mail real')
chequear(mails().length > 0 && mails().every((x) => typeof x.html === 'string' && typeof x.text === 'string'), `${mails().length} mails, todos interceptados por la simulación, todos con HTML y texto`)

console.log('Capturas')
const pag = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage()
for (const nombre of ['bienvenida', 'compra', 'canje', 'vencimiento']) {
  await pag.setContent(fs.readFileSync(`${DIR}/mail-${nombre}.html`, 'utf8'))
  await pag.screenshot({ path: `${DIR}/mail-${nombre}.png`, fullPage: true })
}

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
