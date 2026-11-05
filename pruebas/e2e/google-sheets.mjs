// Exportar clientes a Google Sheets: OAuth por negocio (solo drive.file,
// state firmado + cookie, token cifrado), crear o elegir la hoja,
// exportar sin duplicar (por ID, respetando el orden, las columnas y filas
// agregadas a mano), sin DNI, una exportación a la vez, multiempresa,
// desconectar y acceso revocado desde Google. Google simulado
// (simulaciones/google.mjs): no se crea ni modifica ninguna hoja real.
//
// El servidor tiene que correr con GOOGLE_SHEETS_CLIENT_ID,
// GOOGLE_SHEETS_CLIENT_SECRET, GOOGLE_PICKER_API_KEY y
// GOOGLE_CLOUD_PROJECT_NUMBER de prueba (ver pruebas/e2e/README.md).
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/google-sheets.mjs
import fs from 'node:fs'
import { BASE, DIR, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
import { nuevoEstado } from '../../lib/estadoOAuth.js'
import { descifrar } from '../../lib/cifrado.js'
const chromium = chromiumDePlaywright()
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
const HOJAS = `${DIR}/google-hojas.json`, CONTROL = `${DIR}/google-control.json`, TOKENS = `${DIR}/google-tokens.json`, PEDIDOS = `${DIR}/google-pedidos.log`
for (const f of [HOJAS, CONTROL, TOKENS, PEDIDOS]) fs.rmSync(f, { force: true })
const hojas = () => (fs.existsSync(HOJAS) ? JSON.parse(fs.readFileSync(HOJAS, 'utf8')) : {})
const guardarHojas = (h) => fs.writeFileSync(HOJAS, JSON.stringify(h))
const control = (c) => fs.writeFileSync(CONTROL, JSON.stringify(c))
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin"')

const pep = await prisma.negocio.findFirst({ where: { slug: 'peperina' } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo', activo: true } })
// Datos sensibles que nunca tienen que llegar a la hoja.
await prisma.cliente.update({ where: { email: 'lucia@prueba.test' }, data: { dni: '30111222', sexo: 'femenino', fechaNacimiento: new Date('1990-03-07T00:00:00Z') } })
const formula = await prisma.cliente.create({ data: { nombre: '=IMPORTXML("https://malo.test")', email: 'formula@prueba.test', password: 'x', negocioId: pep.id, puntos: 10 } })
const deDemo = await prisma.cliente.create({ data: { nombre: 'Clienta De Demo', email: 'solo.demo@prueba.test', password: 'x', negocioId: demo.id, puntos: 77, telefono: '2324000777' } })
const totalPep = await prisma.cliente.count({ where: { negocioId: pep.id } })

const b = await chromium.launch()
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
// "Google": en vez de la pantalla de permiso real, se pide /conectar con el
// mismo contexto del navegador (comparte las cookies: queda la del nonce),
// se lee a dónde manda y se vuelve al callback con el código.
let ultimaAutorizacion = null
async function conectar(s, code = 'codigo-ok') {
  const res = await s.page.request.get(`${BASE}/api/google-sheets/conectar`, { maxRedirects: 0 })
  ultimaAutorizacion = new URL(res.headers().location)
  const vuelta = new URL(ultimaAutorizacion.searchParams.get('redirect_uri'))
  vuelta.searchParams.set('code', code)
  vuelta.searchParams.set('state', ultimaAutorizacion.searchParams.get('state'))
  const fin = await s.page.goto(vuelta.toString())
  await s.page.waitForURL((u) => u.pathname === '/', { timeout: 60000 })
  return new URL(fin.url()).searchParams.get('google') // resultado que informa la vuelta: conectado, rechazado, sin-permiso…
}

console.log('Permisos')
const cli = await sesion('lucia@prueba.test', 'clienta-123')
chequear((await pedir(cli, 'GET', '/api/google-sheets/estado')).status === 403 && (await pedir(cli, 'POST', '/api/google-sheets/exportar')).status === 403, 'una clienta no puede ver ni usar la integración')
chequear((await fetch(`${BASE}/api/google-sheets/conectar`, { redirect: 'manual' })).status === 403, 'sin sesión no se puede conectar')
const neg = await sesion('negocio@prueba.test', 'negocio-123')
let r = await pedir(neg, 'GET', '/api/google-sheets/estado')
chequear(r.status === 200 && r.cuerpo.configurada === true && r.cuerpo.selectorHojas === true && r.cuerpo.conexion === null, 'estado inicial: configurada, sin conexión')

console.log('Conectar la cuenta (OAuth)')
chequear(await conectar(neg) === 'conectado', 'la vuelta de Google se acepta')
const permiso = ultimaAutorizacion
chequear(permiso?.searchParams.get('scope') === 'https://www.googleapis.com/auth/drive.file openid email', `pide solo drive.file (más el email): "${permiso?.searchParams.get('scope')}"`)
chequear(permiso?.searchParams.get('access_type') === 'offline' && permiso.searchParams.get('redirect_uri') === `${BASE}/api/google-sheets/callback` && permiso.searchParams.get('state')?.includes('.'), 'offline, con la URL de vuelta de Retornar y un state firmado')
await neg.page.getByText('Cuenta de Google conectada.').waitFor({ timeout: 30000 })
let conexion = await prisma.conexionGoogle.findUnique({ where: { negocioId: pep.id } })
chequear(conexion?.email === 'peperina@gmail.com', 'vuelve al panel, en Exportar clientes, conectada como peperina@gmail.com')
chequear(conexion && !conexion.refreshTokenCifrado.includes('rt-secreto') && descifrar(conexion.refreshTokenCifrado)?.startsWith('rt-secreto-'), 'el token de actualización se guarda cifrado (en la base no está en claro)')
r = await pedir(neg, 'GET', '/api/google-sheets/estado')
chequear(!JSON.stringify(r.cuerpo).includes('rt-secreto') && !JSON.stringify(r.cuerpo).includes('refresh') && r.cuerpo.conexion.email === 'peperina@gmail.com', 'el estado nunca devuelve tokens')

console.log('Vueltas de Google que se rechazan')
const conexionAntes = JSON.stringify(await prisma.conexionGoogle.findMany())
const vueltaCon = async (s, state) => (await s.page.goto(`${BASE}/api/google-sheets/callback?code=codigo-ok&state=${encodeURIComponent(state)}`)).url()
chequear((await vueltaCon(neg, 'estado-inventado.firma')).includes('google=rechazado'), 'state inventado → rechazado')
const { state: statePep } = nuevoEstado(pep.id)
chequear((await vueltaCon(neg, statePep)).includes('google=rechazado') && JSON.stringify(await prisma.conexionGoogle.findMany()) === conexionAntes, 'state válido pero sin la cookie de este navegador → rechazado, nada cambia')
const negDemo = await sesion('demo@prueba.test', 'demo-123')
const { state: stateDemoAjeno, nonce: nonceAjeno } = nuevoEstado(pep.id)
await negDemo.ctx.addCookies([{ name: 'retornar_oauth_google', value: nonceAjeno, domain: new URL(BASE).hostname, path: '/api/google-sheets/callback', httpOnly: true, sameSite: 'Lax' }])
chequear((await vueltaCon(negDemo, stateDemoAjeno)).includes('google=rechazado') && !(await prisma.conexionGoogle.findUnique({ where: { negocioId: demo.id } })) && JSON.stringify(await prisma.conexionGoogle.findMany()) === conexionAntes, 'un state de Peperina usado desde la sesión de otro negocio → rechazado')
chequear(await conectar(negDemo, 'codigo-sin-permiso') === 'sin-permiso' && !(await prisma.conexionGoogle.findUnique({ where: { negocioId: demo.id } })), 'si la cuenta no da el permiso de la hoja, no se conecta')

console.log('Crear la hoja y exportar')
chequear((await pedir(neg, 'POST', '/api/google-sheets/exportar')).status === 400, 'sin hoja elegida, exportar → 400')
r = await pedir(neg, 'POST', '/api/google-sheets/hoja', { accion: 'crear' })
const hojaId = r.cuerpo.hoja?.id
chequear(r.status === 200 && r.cuerpo.hoja.nombre === 'Clientes — Club Peperina' && hojas()[hojaId]?.pestanas.Clientes, `hoja nueva "${r.cuerpo.hoja?.nombre}" con la pestaña Clientes`)
r = await pedir(neg, 'POST', '/api/google-sheets/exportar')
let filas = hojas()[hojaId].pestanas.Clientes.filas
chequear(r.status === 200 && r.cuerpo.agregadas === totalPep && r.cuerpo.actualizadas === 0 && filas.length === totalPep + 1, `primera exportación: ${r.cuerpo.agregadas} clientas + encabezados`)
chequear(filas[0].join('|') === 'ID Retornar|Nombre y apellido|Email|Teléfono|Fecha de registro|Puntos actuales|Nivel|Puntos ganados en total|Compras registradas|Última actividad|Cumpleaños (día/mes)|Actualizado en Retornar' && hojas()[hojaId].pestanas.Clientes.negrita, 'encabezados claros, en negrita')
const filaLucia = filas.find((f) => f[2] === 'lucia@prueba.test')
const lucia = await prisma.cliente.findFirst({ where: { email: 'lucia@prueba.test' } })
chequear(filaLucia[0] === lucia.id && filaLucia[1] === 'Lucía Fernández' && filaLucia[5] === lucia.puntos && filaLucia[10] === '07/03', 'cada fila con su ID, nombre, puntos (número) y cumpleaños día/mes')
const contenido = JSON.stringify(filas)
chequear(!contenido.includes('30111222') && !contenido.includes('femenino') && !contenido.includes('1990') && !contenido.includes('$2'), 'sin DNI, género, año de nacimiento ni contraseña')
chequear(!contenido.includes('solo.demo@prueba.test'), 'sin clientas de otro negocio')
chequear(filas.some((f) => f[1] === formula.nombre) && hojas()[hojaId].escrituras.every((m) => m === 'RAW'), 'se escribe como valor (RAW): un nombre que empieza con "=" no se toma como fórmula')

console.log('Volver a exportar: sin duplicar, respetando la hoja')
const h = hojas()
const p = h[hojaId].pestanas.Clientes
p.filas = [p.filas[0], ...p.filas.slice(1).reverse()] // la ordenaron al revés
p.filas[0][12] = 'Notas'
p.filas.forEach((f, i) => { if (i > 0) f[12] = `nota ${f[0]}` }) // columna propia a la derecha
p.filas.push(['', 'Fila escrita a mano', 'a.mano@x.com'])
guardarHojas(h)
await prisma.cliente.update({ where: { id: lucia.id }, data: { puntos: 9999 } })
const nueva = await prisma.cliente.create({ data: { nombre: 'Clienta Nueva', email: 'nueva.sheets@prueba.test', password: 'x', negocioId: pep.id, puntos: 5 } })
r = await pedir(neg, 'POST', '/api/google-sheets/exportar')
filas = hojas()[hojaId].pestanas.Clientes.filas
const ids = filas.slice(1).map((f) => f[0]).filter(Boolean)
chequear(r.status === 200 && r.cuerpo.actualizadas === totalPep && r.cuerpo.agregadas === 1 && new Set(ids).size === ids.length && ids.length === totalPep + 1, `${r.cuerpo.actualizadas} actualizadas, 1 nueva, ninguna repetida`)
const posLucia = filas.findIndex((f) => f[0] === lucia.id)
chequear(filas[posLucia][5] === 9999 && posLucia === p.filas.findIndex((f) => f[0] === lucia.id), 'Lucía se actualiza (9.999) en la misma fila, aunque la hoja se haya reordenado')
chequear(filas.slice(1, totalPep + 1).every((f) => f[12] === `nota ${f[0]}`) && filas[0][12] === 'Notas', 'la columna propia del negocio queda intacta')
chequear(filas[totalPep + 1][1] === 'Fila escrita a mano' && filas[totalPep + 2][0] === nueva.id, 'la fila escrita a mano queda; la clienta nueva va al final')

console.log('Una exportación a la vez')
control({ demoraMs: 1500 })
const [e1, e2] = await Promise.all([pedir(neg, 'POST', '/api/google-sheets/exportar'), pedir(neg, 'POST', '/api/google-sheets/exportar')])
control({})
chequear([e1.status, e2.status].sort().join(',') === '200,409' && new Set(hojas()[hojaId].pestanas.Clientes.filas.slice(1).map((f) => f[0]).filter(Boolean)).size === totalPep + 1, `dos a la vez: una exporta y la otra espera (${e1.status}, ${e2.status}); nadie duplicado`)

console.log('Elegir una hoja existente (selector de Google)')
const hs = hojas()
const existente = `hojaexistente${'x'.repeat(20)}`
hs[existente] = { titulo: 'Planilla de Peperina', cuenta: 'peperina@gmail.com', creadaPorApp: false, elegida: false, pestanas: { Ventas: { id: 0, filas: [['no tocar']] } }, escrituras: [] }
guardarHojas(hs)
r = await pedir(neg, 'POST', '/api/google-sheets/hoja', { accion: 'elegir', hojaId: existente })
chequear(r.status === 400 && /no tiene acceso/.test(r.cuerpo.error), 'una hoja que no se eligió en el selector de Google: sin acceso (drive.file)')
const hs2 = hojas(); hs2[existente].elegida = true; guardarHojas(hs2)
r = await pedir(neg, 'POST', '/api/google-sheets/hoja', { accion: 'elegir', hojaId: existente })
chequear(r.status === 200 && hojas()[existente].pestanas.Clientes && hojas()[existente].pestanas.Ventas.filas[0][0] === 'no tocar', 'elegida en el selector: se usa, con una pestaña Clientes nueva; sus otras pestañas no se tocan')
r = await pedir(neg, 'GET', '/api/google-sheets/token')
chequear(r.status === 200 && r.cuerpo.accessToken?.startsWith('at-') && r.cuerpo.apiKey && r.cuerpo.appId, 'el selector recibe un token de acceso corto (no el de actualización)')
chequear((await pedir(neg, 'POST', '/api/google-sheets/hoja', { accion: 'elegir', hojaId: '../../etc' })).status === 400, 'un id de hoja inválido → 400')
await pedir(neg, 'POST', '/api/google-sheets/hoja', { accion: 'elegir', hojaId })

console.log('Multiempresa')
chequear((await pedir(negDemo, 'GET', '/api/google-sheets/estado')).cuerpo.conexion === null && (await pedir(negDemo, 'POST', '/api/google-sheets/exportar')).status === 400, 'otro negocio no ve ni usa la conexión de Peperina')
control({ cuenta: 'demo@gmail.com' })
const vueltaDemo = await conectar(negDemo)
control({})
chequear(vueltaDemo === 'conectado' && (await prisma.conexionGoogle.findUnique({ where: { negocioId: demo.id } }))?.email === 'demo@gmail.com', 'el otro negocio conecta su propia cuenta (demo@gmail.com)')
r = await pedir(negDemo, 'POST', '/api/google-sheets/hoja', { accion: 'elegir', hojaId })
chequear(r.status === 400 && /no tiene acceso/.test(r.cuerpo.error), 'con su propia cuenta, no puede abrir la hoja de Peperina')
r = await pedir(negDemo, 'POST', '/api/google-sheets/hoja', { accion: 'crear' })
const hojaDemo = r.cuerpo.hoja?.id
chequear(r.status === 200 && hojas()[hojaDemo]?.cuenta === 'demo@gmail.com', 'crea su propia hoja, en su cuenta')
const filasPepAntes = JSON.stringify(hojas()[hojaId].pestanas.Clientes.filas)
r = await pedir(negDemo, 'POST', '/api/google-sheets/exportar')
const filasDemo = hojas()[hojaDemo].pestanas.Clientes.filas
chequear(r.status === 200 && filasDemo.length === 2 && filasDemo[1][0] === deDemo.id, 'el otro negocio exporta solo su clienta a su propia hoja')
chequear(JSON.stringify(hojas()[hojaId].pestanas.Clientes.filas) === filasPepAntes, 'la hoja de Peperina no cambió')

console.log('Pantalla')
await neg.page.goto(`${BASE}/`)
await neg.page.getByRole('button', { name: /^Exportar clientes/ }).first().click()
await neg.page.getByText('Conectada como').waitFor({ timeout: 30000 })
chequear(await neg.page.getByText('Clientes — Club Peperina').isVisible() && await neg.page.getByRole('link', { name: 'Descargar para Excel' }).isVisible(), 'Exportar clientes: cuenta conectada, hoja, y la descarga para Excel como alternativa')
await neg.page.getByRole('button', { name: 'Exportar clientes a la hoja' }).click()
await neg.page.getByText(/Exportación lista: \d+ actualizadas, 0 nuevas/).waitFor({ timeout: 30000 })
chequear(true, 'desde la pantalla: "Exportar clientes a la hoja" → "Exportación lista"')
await neg.page.screenshot({ path: `${DIR}/exportar-clientes.png`, fullPage: true })

console.log('Desconectar y acceso revocado')
const refreshPep = descifrar((await prisma.conexionGoogle.findUnique({ where: { negocioId: pep.id } })).refreshTokenCifrado)
r = await pedir(neg, 'POST', '/api/google-sheets/desconectar')
const tokensSim = JSON.parse(fs.readFileSync(TOKENS, 'utf8'))
chequear(r.status === 200 && r.cuerpo.revocado === true && tokensSim.revocados.includes(refreshPep) && !(await prisma.conexionGoogle.findUnique({ where: { negocioId: pep.id } })), 'desconectar: revoca el permiso en Google y borra la conexión')
chequear(hojas()[hojaId].pestanas.Clientes.filas.length > 1, 'la hoja queda en el Drive del negocio')
control({ revocados: ['demo@gmail.com'] })
r = await pedir(negDemo, 'POST', '/api/google-sheets/exportar')
control({})
chequear(r.status === 409 && /Volvé a conectarla/.test(r.cuerpo.error) && !(await prisma.conexionGoogle.findUnique({ where: { negocioId: demo.id } })), 'si el negocio quitó el acceso desde Google: pide volver a conectar y borra la conexión')

console.log('Nada real')
const pedidos = fs.readFileSync(PEDIDOS, 'utf8').trim().split('\n')
chequear(pedidos.length > 10 && pedidos.every((l) => / https:\/\/(oauth2|sheets)\.googleapis\.com\//.test(l)), `${pedidos.length} pedidos a Google, todos a la simulación (oauth2 y sheets)`)

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
