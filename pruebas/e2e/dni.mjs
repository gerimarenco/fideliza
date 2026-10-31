// DNI obligatorio en el registro (2026-10-30). Base local descartable con
// datos ficticios; Resend simulado (mails a un archivo). Nunca producción.
//
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/dni.mjs
// (ver pruebas/e2e/README.md). Es la suite usada en el PR #123, traída al
// repo y adaptada (2026-10-31) a los cambios de ese PR: los DNI con
// patrones llamativos ahora son válidos y los límites de intentos son por
// DNI, dispositivo e IP (secciones "Límites", nuevas). Las IP se simulan con
// el encabezado x-forwarded-for, que el servidor local usa como IP.
import fs from 'node:fs'
import { BASE, DIR, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
const chromium = chromiumDePlaywright()
const MAILS = `${DIR}/mails-enviados.json`
const LOG = process.env.RETORNAR_E2E_LOG || `${DIR}/servidor.log`
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
const H = 3600 * 1000
const MSJ_DNI = 'Este DNI ya está registrado. Ya existe una cuenta asociada a este documento. Iniciá sesión o recuperá tu cuenta.'
const MSJ_EMAIL = 'Este correo electrónico ya está registrado. Iniciá sesión o recuperá tu contraseña.'
const limpiarTope = () => prisma.$executeRawUnsafe('TRUNCATE "IntentoRegistro"')
await limpiarTope()
fs.rmSync(MAILS, { force: true })
const inicioLog = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0

const pep = await prisma.negocio.update({ where: { slug: 'peperina' }, data: { bienvenidaPuntos: 150, bienvenidaDesde: new Date(Date.now() - H), bienvenidaHasta: new Date(Date.now() + 48 * H), puntosReferido: 300 } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo', activo: true } })
const respuestas = []
// Cada pedido sale de una IP distinta salvo que se indique otra (opciones.ip)
// y sin cookie de dispositivo salvo opciones.cookie.
let ipSiguiente = 0
async function registrar(negocio, datos, opciones = {}) {
  const ip = opciones.ip || `10.20.${Math.floor(++ipSiguiente / 250)}.${(ipSiguiente % 250) + 1}`
  const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': ip }
  if (opciones.cookie) headers.cookie = opciones.cookie
  const res = await fetch(`${BASE}/api/registro/${negocio}`, { method: 'POST', headers, body: JSON.stringify({ nombre: 'Prueba Dni', password: 'clienta-123', fechaNacimiento: '1993-03-03', ...datos }) })
  const texto = await res.text()
  respuestas.push(texto)
  let cuerpo = {}
  try { cuerpo = JSON.parse(texto) } catch {}
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0]
  return { status: res.status, cuerpo, cookie }
}
const cliente = (email) => prisma.cliente.findFirst({ where: { email } })
const movs = async (email, origen) => { const c = await cliente(email); return c ? prisma.movimientoPuntos.count({ where: { clienteId: c.id, origen } }) : 0 }
const DNIS = ['36100001', '36100002', '36100003', '36100004', '36100005', '29876543', '36199999', '36200000', '11111111', '12345678', '36100006']

// Cuentas históricas como las de producción: sin DNI (la mayoría) y con DNI
// de septiembre/octubre (sin control de repetidos, uno con cero adelante).
const lucia = await cliente('lucia@prueba.test')
await prisma.cliente.create({ data: { nombre: 'Historica Con Dni', email: 'historica@prueba.test', password: 'x', negocioId: pep.id, dni: '029876543', telefono: '2324000999', fechaNacimiento: new Date('1980-01-01'), createdAt: new Date('2026-10-01T12:00:00Z'), puntos: 400 } })
const fotoAntes = JSON.stringify(await prisma.cliente.findMany({ orderBy: { id: 'asc' } }))
const idsAntes = (await prisma.cliente.findMany({ select: { id: true } })).map((c) => c.id)

console.log('Validación del DNI')
let r = await registrar('peperina', { email: 'sindni@prueba.test', telefono: '2324600900' })
chequear(r.status === 400 && r.cuerpo.error === 'El DNI es obligatorio.' && !(await cliente('sindni@prueba.test')), 'registro sin DNI → 400 "El DNI es obligatorio.", no se crea')
r = await registrar('peperina', { email: 'sindni@prueba.test', telefono: '2324600900', dni: '   ' })
chequear(r.status === 400 && r.cuerpo.error === 'El DNI es obligatorio.', 'DNI en blanco → 400')
for (const malo of ['abc', '30a12345', '12345', '123456789', '00000000', '30/123/456']) {
  r = await registrar('peperina', { email: 'sindni@prueba.test', telefono: '2324600900', dni: malo })
  chequear(r.status === 400 && /no es válido/.test(r.cuerpo.error) && !r.cuerpo.error.includes(malo), `DNI inválido "${malo}" → 400, sin repetir el número`)
}
chequear(!(await cliente('sindni@prueba.test')), 'ninguno de esos intentos creó la cuenta')

console.log('DNI con patrones llamativos (son documentos reales posibles)')
r = await registrar('peperina', { email: 'patron1@prueba.test', telefono: '2324600901', dni: '11.111.111' })
chequear(r.status === 201 && (await cliente('patron1@prueba.test'))?.dni === '11111111', '11.111.111 → 201, guardado "11111111"')
r = await registrar('peperina', { email: 'patron2@prueba.test', telefono: '2324600902', dni: '12 345 678' })
chequear(r.status === 201 && (await cliente('patron2@prueba.test'))?.dni === '12345678', '12 345 678 → 201, guardado "12345678"')
r = await registrar('peperina', { email: 'patron3@prueba.test', telefono: '2324600903', dni: '12-345-678' })
chequear(r.status === 409 && r.cuerpo.error === MSJ_DNI, 'y el mismo número escrito con guiones choca con el anterior')
await limpiarTope()

console.log('Registro válido y normalización')
r = await registrar('peperina', { email: 'ana.dni@prueba.test', telefono: '2324600001', dni: '36.100.001' })
const ana = await cliente('ana.dni@prueba.test')
chequear(r.status === 201 && ana?.dni === '36100001' && ana.negocioId === pep.id, 'DNI con puntos → 201, guardado "36100001" en la cuenta de Peperina')
chequear(!JSON.stringify(r.cuerpo).includes('36100001'), 'la respuesta del registro no incluye el DNI')
chequear(r.cuerpo.puntosBienvenida === 150 && (await movs('ana.dni@prueba.test', 'bienvenida')) === 1, 'bienvenida: 150 puntos, una vez')
for (const variante of ['36 100 001', '36-100-001', '036100001', ' 36.100.001 ']) {
  r = await registrar('peperina', { email: `otra-${variante.trim().replace(/\W/g, '')}@prueba.test`, telefono: '2324600777', dni: variante })
  chequear(r.status === 409 && r.cuerpo.error === MSJ_DNI, `mismo DNI escrito "${variante}" con otro email → 409 con el mensaje de DNI`)
}
chequear((await prisma.cliente.count({ where: { negocioId: pep.id, dni: '36100001' } })) === 1, 'sigue habiendo una sola cuenta con ese DNI en Peperina')
await limpiarTope()

console.log('Email repetido')
r = await registrar('peperina', { email: '  ANA.DNI@Prueba.test ', telefono: '2324600002', dni: '36100002' })
chequear(r.status === 409 && r.cuerpo.error === MSJ_EMAIL && !(await prisma.cliente.findFirst({ where: { dni: '36100002' } })), 'mismo email (mayúsculas y espacios) con otro DNI → 409 con el mensaje de email')
r = await registrar('demo', { email: 'ana.dni@prueba.test', telefono: '2324600002', dni: '36100002' })
chequear(r.status === 409 && r.cuerpo.error === MSJ_EMAIL, 'el email ya usado en Peperina tampoco se puede usar en otro negocio (el email es único en toda la base: es el usuario para entrar)')

console.log('Multiempresa')
r = await registrar('demo', { email: 'ana.en.demo@prueba.test', telefono: '2324600001', dni: '36100001' })
const anaDemo = await cliente('ana.en.demo@prueba.test')
chequear(r.status === 201 && anaDemo?.negocioId === demo.id && anaDemo.dni === '36100001', 'mismo DNI en otro negocio → 201 (cada negocio controla sus cuentas)')
chequear((await movs('ana.en.demo@prueba.test', 'bienvenida')) === 0, 'la bienvenida de Peperina no se paga en otro negocio')

console.log('Cuentas históricas')
r = await registrar('peperina', { email: 'copia.historica@prueba.test', telefono: '2324600003', dni: '29.876.543' })
chequear(r.status === 409 && r.cuerpo.error === MSJ_DNI, 'DNI de una cuenta de octubre (guardado con cero adelante) → 409')
await limpiarTope()

console.log('Registros simultáneos con el mismo DNI')
const simultaneos = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => registrar('peperina', { email: `simul${i}@prueba.test`, telefono: `23246010${i}0`, dni: '36100003' })))
const estados = simultaneos.map((x) => x.status).sort()
// El 6.º intento con el mismo documento en la hora puede recibir 429 (límite
// por DNI, ver lib/limiteRegistro.js) en vez de 409: igual no crea cuenta.
chequear(estados.filter((s) => s === 201).length === 1 && estados.filter((s) => s === 409 || s === 429).length === 5, `6 a la vez: una cuenta y 5 rechazos (${estados.join(',')})`)
chequear(simultaneos.filter((x) => x.status === 409).every((x) => x.cuerpo.error === MSJ_DNI), 'los rechazos dicen "Este DNI ya está registrado"')
const conEseDni = await prisma.cliente.findMany({ where: { dni: '36100003' }, select: { id: true } })
chequear(conEseDni.length === 1 && (await prisma.movimientoPuntos.count({ where: { clienteId: conEseDni[0].id, origen: 'bienvenida' } })) === 1, 'una sola cuenta con ese DNI y una sola bienvenida')
// La base lo garantiza aunque se saltee la API.
let choque = null
try { await prisma.cliente.create({ data: { email: 'directo@prueba.test', password: 'x', negocioId: pep.id, dni: '36100003' } }) } catch (e) { choque = e.code }
chequear(choque === 'P2002', `insertar otro con el mismo DNI directo en la base → rechazado por el índice único (${choque})`)
await limpiarTope()

console.log('Login y recuperación de contraseña')
const b = await chromium.launch()
async function sesion(email, password) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.getByRole('button', { name: /^Ingres/ }).click()
  const entro = await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).then(() => true).catch(() => false)
  return { ctx, page, entro }
}
const sAna = await sesion('ana.dni@prueba.test', 'clienta-123')
chequear(sAna.entro, 'la cuenta nueva con DNI inicia sesión')
const codigoAna = (await (await sAna.page.request.get(`${BASE}/api/clientes/referidos`)).json()).codigo
const perfil = await (await sAna.page.request.get(`${BASE}/api/clientes/cupones`)).text()
chequear(!perfil.includes('36100001'), 'sus pantallas de clienta no reciben el DNI')
await sAna.ctx.close()
const sLucia = await sesion('lucia@prueba.test', 'clienta-123')
chequear(sLucia.entro, 'una cuenta histórica sin DNI sigue entrando')
await sLucia.ctx.close()
await fetch(`${BASE}/api/password-reset/solicitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ana.dni@prueba.test' }) })
const mailReset = (fs.existsSync(MAILS) ? JSON.parse(fs.readFileSync(MAILS, 'utf8')) : []).filter((m) => JSON.stringify(m.to).includes('ana.dni@prueba.test')).pop()
const token = mailReset?.html.match(/token=([A-Za-z0-9_-]+)/)?.[1]
const conf = await fetch(`${BASE}/api/password-reset/confirmar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, passwordNueva: 'clave-nueva-1' }) })
const sNueva = await sesion('ana.dni@prueba.test', 'clave-nueva-1')
chequear(token && conf.ok && sNueva.entro, 'recuperar la contraseña funciona y entra con la nueva')
await sNueva.ctx.close()
await fetch(`${BASE}/api/password-reset/solicitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'historica@prueba.test' }) })
chequear((JSON.parse(fs.readFileSync(MAILS, 'utf8'))).some((m) => JSON.stringify(m.to).includes('historica@prueba.test')), 'una cuenta histórica también puede pedir recuperar la contraseña')

console.log('Referidos y autorreferidos')
r = await registrar('peperina', { email: 'ana.otra@prueba.test', telefono: '549 2324 60-0001', dni: '36100004', codigoReferido: codigoAna })
const anaOtra = await cliente('ana.otra@prueba.test')
chequear(r.status === 201 && anaOtra.referidoPorId === null, 'otra cuenta con otro email y DNI pero el mismo celular que quien invita: se crea, sin quedar como referida')
chequear(r.cuerpo.puntosBienvenida === 0, 'y sin bienvenida (ese celular ya la cobró)')
r = await registrar('peperina', { email: 'ana.tercera@prueba.test', telefono: '2324600777', dni: '36.100.001', codigoReferido: codigoAna })
chequear(r.status === 409 && r.cuerpo.error === MSJ_DNI && !(await cliente('ana.tercera@prueba.test')), 'con el DNI de quien invita: rechazada entera (no hay cuenta ni bono)')
r = await registrar('peperina', { email: 'amiga.real@prueba.test', telefono: '2324600555', dni: '36100005', codigoReferido: codigoAna })
const amiga = await cliente('amiga.real@prueba.test')
chequear(r.status === 201 && amiga.referidoPorId === ana.id && r.cuerpo.puntosBienvenida === 150, 'una amiga con otro DNI y otro celular: referida por Ana y con su bienvenida')
const sNeg = await sesion('negocio@prueba.test', 'negocio-123')
const compra = async (clienteId) => sNeg.page.evaluate(async (d) => { const x = await fetch('/api/compras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }); return { status: x.status, texto: await x.text() } }, { clienteId, monto: 10000, negocioId: pep.id })
await compra(anaOtra.id)
chequear((await movs('ana.dni@prueba.test', 'referido_invitador')) === 0, 'la compra de la "autorreferida" no le paga bono a quien invitó')
await compra(amiga.id)
await compra(amiga.id)
chequear((await movs('ana.dni@prueba.test', 'referido_invitador')) === 1 && (await movs('amiga.real@prueba.test', 'referido_invitado')) === 1, 'la amiga real: bono de referidos una sola vez (dos compras)')

console.log('Privacidad')
const historica = await cliente('historica@prueba.test')
const c1 = await compra(historica.id)
chequear(c1.status === 200 && !c1.texto.includes('"dni"') && !c1.texto.includes('9876543'), 'la respuesta de una compra (cuenta con DNI) ya no incluye el DNI')
const lista = await sNeg.page.evaluate(async (id) => (await fetch(`/api/clientes?negocioId=${id}&pageSize=100`)).text(), pep.id)
chequear(lista.includes('ana.dni@prueba.test') && !lista.includes('"dni"') && !DNIS.some((d) => lista.includes(d)), 'la lista de clientas del negocio no trae DNI')
const alta = await sNeg.page.evaluate(async (id) => (await fetch('/api/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Alta Manual', email: 'manual.dni@prueba.test', telefono: '2324600444', negocioId: id }) })).text(), pep.id)
chequear(alta.includes('passwordGenerada') && !alta.includes('"dni"'), '"Nuevo cliente" desde el panel sigue funcionando (sin DNI, sin devolverlo)')
const excel = await sNeg.page.evaluate(async (id) => (await fetch(`/api/clientes/exportar?negocioId=${id}`)).text(), pep.id)
chequear(excel.length > 0 && !/DNI/.test(excel.split('\n')[0]) && !DNIS.some((d) => excel.includes(d)), 'el Excel exportado no tiene DNI')
const ajena = await sNeg.page.evaluate(async (id) => (await fetch(`/api/clientes?negocioId=${id}`)).status, demo.id)
chequear(ajena === 403, 'Peperina no puede listar las clientas de otro negocio')
await sNeg.ctx.close()
// Un error inesperado del registro: el log no guarda los datos enviados.
r = await registrar('peperina', { nombre: 12345, email: 'error.log@prueba.test', telefono: '2324600333', dni: '36199999' })
chequear(r.status >= 400, `registro con datos rotos → ${r.status}`)
chequear(respuestas.every((t) => !DNIS.some((d) => t.includes(d))), `ninguna de las ${respuestas.length} respuestas del registro contiene un DNI`)
await new Promise((ok) => setTimeout(ok, 1500))
const log = fs.readFileSync(LOG, 'utf8').slice(inicioLog)
chequear(log.length > 0 && !DNIS.some((d) => log.includes(d)) && !log.includes('9876543'), 'el log del servidor no contiene ningún DNI')
const mails = fs.existsSync(MAILS) ? fs.readFileSync(MAILS, 'utf8') : ''
chequear(mails.length > 0 && !DNIS.some((d) => mails.includes(d)), 'ningún mail enviado contiene un DNI')

console.log('Límites: varias clientas desde el mismo Wi-Fi')
await limpiarTope()
const WIFI = '203.0.113.10'
const equivocadas = []
for (const i of [1, 2, 3]) equivocadas.push((await registrar('peperina', { email: `equivocada${i}@prueba.test`, telefono: `23248000${i}0`, dni: '36100001' }, { ip: WIFI })).status)
chequear(equivocadas.every((x) => x === 409), `3 personas del Wi-Fi reciben "DNI ya registrado" (${equivocadas.join(',')})`)
const reales = await Promise.all(Array.from({ length: 12 }, (_, i) => registrar('peperina', { email: `wifi${i}@prueba.test`, telefono: `232481${String(i).padStart(4, '0')}`, dni: String(38100000 + i) }, { ip: WIFI })))
chequear(reales.every((x) => x.status === 201), `12 clientas reales del mismo Wi-Fi, a la vez, se registran igual (${[...new Set(reales.map((x) => x.status))].join(',')})`)

console.log('Límites: intentos masivos contra un mismo DNI')
await limpiarTope()
const contra = []
for (let i = 0; i < 7; i++) contra.push((await registrar('peperina', { email: `ataque.dni${i}@prueba.test`, telefono: '2324820000', dni: '36100005' }, { ip: `198.51.100.${i + 1}` })).status)
chequear(contra.slice(0, 5).every((x) => x === 409) && contra.slice(5).every((x) => x === 429), `5 respuestas por documento y hora, aunque cada intento venga de otra IP (${contra.join(',')})`)
const yaRegistrada = 'ana.dni@prueba.test'
const inexistente = []
let mensaje429 = null
for (let i = 0; i < 6; i++) {
  const x = await registrar('peperina', { email: yaRegistrada, telefono: '2324820001', dni: '39999001' }, { ip: `198.51.101.${i + 1}` })
  inexistente.push(x.status)
  if (x.status === 429) mensaje429 = x.cuerpo.error
}
const mensajeDni = (await registrar('peperina', { email: 'ataque.dni9@prueba.test', telefono: '2324820000', dni: '36100005' }, { ip: '198.51.100.99' })).cuerpo.error
chequear(inexistente[5] === 429 && mensaje429 === mensajeDni && !/registrado/.test(mensaje429), 'un DNI que NO existe recibe el mismo "demasiados intentos": no revela si el documento tiene cuenta')
await limpiarTope()
const rafaga = await Promise.all(Array.from({ length: 15 }, (_, i) => registrar('peperina', { email: `rafaga${i}@prueba.test`, telefono: '2324830000', dni: '36100004' }, { ip: `192.0.2.${i + 1}` })))
const respondidas = rafaga.filter((x) => x.status !== 429).length
chequear(respondidas <= 5 && rafaga.filter((x) => x.status === 429).length >= 10, `15 pedidos simultáneos con el mismo DNI: como mucho 5 respuestas (${respondidas}); el intento se anota antes de contar`)

console.log('Límites: un mismo dispositivo')
await limpiarTope()
const primero = await registrar('peperina', { email: yaRegistrada, telefono: '2324840000', dni: '39100000' }, { ip: '203.0.113.20' })
const cookie = primero.cookie
const delDispositivo = [primero.status]
for (let i = 1; i < 11; i++) delDispositivo.push((await registrar('peperina', { email: yaRegistrada, telefono: '2324840000', dni: String(39100000 + i) }, { ip: '203.0.113.20', cookie })).status)
chequear(/^retornar_registro=[0-9a-f]{32}$/.test(cookie) && delDispositivo.slice(0, 10).every((x) => x === 409) && delDispositivo[10] === 429, `10 envíos desde un dispositivo y el 11.º → 429 (${delDispositivo.join(',')})`)
r = await registrar('peperina', { email: 'otro.dispositivo@prueba.test', telefono: '2324840001', dni: '39100099' }, { ip: '203.0.113.20' })
chequear(r.status === 201, 'otra clienta con otro celular, en el mismo Wi-Fi, se registra sin problema')

console.log('Límites: una misma IP sin cookies (un script)')
await limpiarTope()
const deUnaIp = []
for (let i = 0; i < 61; i++) deUnaIp.push((await registrar('peperina', { email: yaRegistrada, telefono: '2324850000', dni: String(39200000 + i) }, { ip: '203.0.113.30' })).status)
chequear(deUnaIp.slice(0, 60).every((x) => x === 409) && deUnaIp[60] === 429, `60 envíos desde una IP en 15 minutos y el 61.º → 429 (${deUnaIp.filter((x) => x === 409).length}×409, ${deUnaIp.filter((x) => x === 429).length}×429)`)
r = await registrar('peperina', { email: 'otra.ip@prueba.test', telefono: '2324850001', dni: '39200099' }, { ip: '203.0.113.31' })
chequear(r.status === 201, 'desde otra IP se registra normalmente')

console.log('Límites: probar documentos desde muchas IP (modo protección)')
await limpiarTope()
for (let i = 1; i <= 25; i++) await prisma.cliente.create({ data: { nombre: 'Existente', email: `existente${i}@prueba.test`, password: 'x', negocioId: pep.id, dni: String(39300000 + i), telefono: `23248600${String(i).padStart(2, '0')}` } })
const distribuidas = []
for (let i = 1; i <= 20; i++) distribuidas.push((await registrar('peperina', { email: `sonda${i}@prueba.test`, telefono: '2324870000', dni: String(39300000 + i) }, { ip: `100.64.0.${i}` })).status)
chequear(distribuidas.every((x) => x === 409), '20 IP distintas, una consulta cada una: 20 respuestas "DNI ya registrado" (el negocio entra en modo protección)')
r = await registrar('peperina', { email: 'sonda21@prueba.test', telefono: '2324870000', dni: '39300021' }, { ip: '100.64.0.1' })
chequear(r.status === 409, 'una IP con 1 respuesta previa todavía puede consultar (una clienta que se equivocó una vez no frena su Wi-Fi)')
r = await registrar('peperina', { email: 'sonda22@prueba.test', telefono: '2324870000', dni: '39399999' }, { ip: '100.64.0.1' })
chequear(r.status === 429 && !(await cliente('sonda22@prueba.test')), 'con 2 respuestas previas: 429, incluso para un DNI que no existe (no revela nada y no crea la cuenta)')
const sondaCookie = await registrar('peperina', { email: 'sonda23@prueba.test', telefono: '2324870000', dni: '39300022' }, { ip: '100.64.0.50' })
r = await registrar('peperina', { email: 'sonda24@prueba.test', telefono: '2324870000', dni: '39300023' }, { ip: '100.64.0.51', cookie: sondaCookie.cookie })
chequear(sondaCookie.status === 409 && r.status === 429, 'un dispositivo que ya recibió un "DNI ya registrado" no puede probar otro aunque cambie de IP')
r = await registrar('peperina', { email: 'legitima.en.ataque@prueba.test', telefono: '2324870099', dni: '39400001' }, { ip: '100.64.0.200' })
chequear(r.status === 201, 'una clienta nueva, sin respuestas previas, se registra normalmente durante el modo protección')
const filas = await prisma.intentoRegistro.findMany()
chequear(filas.length > 0 && filas.every((f) => /^[0-9a-f]{64}$/.test(f.clave)) && !JSON.stringify(filas).match(/393000\d\d|100\.64\.0/), `la tabla de límites solo guarda HMAC: ni DNI ni IP en claro (${filas.length} filas)`)
await limpiarTope()
await new Promise((ok) => setTimeout(ok, 1500))
const logFinal = fs.readFileSync(LOG, 'utf8').slice(inicioLog)
chequear(!/\b(36|38|39)\d{6}\b/.test(logFinal) && !/(11111111|12345678)/.test(logFinal), 'el log del servidor no contiene ningún DNI de las pruebas de límites')

console.log('Cuentas existentes')
const despues = JSON.stringify(await prisma.cliente.findMany({ where: { id: { in: idsAntes } }, orderBy: { id: 'asc' } }))
const fotoAntesSinHistorica = JSON.parse(fotoAntes).filter((c) => c.email !== 'historica@prueba.test')
const despuesSinHistorica = JSON.parse(despues).filter((c) => c.email !== 'historica@prueba.test')
chequear(JSON.stringify(fotoAntesSinHistorica) === JSON.stringify(despuesSinHistorica), `las ${idsAntes.length - 1} cuentas que ya existían quedaron idénticas (Ana invitó; ninguna previa cambió)`)
const histDespues = await cliente('historica@prueba.test')
chequear(histDespues.dni === '029876543', 'la cuenta histórica conserva su DNI tal como estaba (solo sumó la compra de prueba)')
chequear((await prisma.cliente.findUnique({ where: { id: lucia.id } })).puntos === lucia.puntos && (await prisma.cliente.findUnique({ where: { id: lucia.id } })).dni === null, 'una histórica sin DNI no cambió')

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
