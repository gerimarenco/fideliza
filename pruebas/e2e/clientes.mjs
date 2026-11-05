// Clientes: registro y "Nuevo cliente" con los mismos datos y reglas, DNI
// solo números, celular con país (+54 por defecto) guardado en formato
// internacional, compatibilidad con celulares viejos (bienvenida, Dragon
// Fish, WhatsApp) y cuentas sin nombre (marcarlas y borrarlas desde el
// panel). Base local descartable; nunca producción.
//
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/clientes.mjs
// (ver pruebas/e2e/README.md). Suite nueva (2026-11-02).
import { execFileSync } from 'node:child_process'
import { BASE, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
const chromium = chromiumDePlaywright()

const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
const H = 3600 * 1000
const MSJ_DNI = 'Este DNI ya está registrado. Ya existe una cuenta asociada a este documento. Iniciá sesión o recuperá tu cuenta.'
const MSJ_EMAIL = 'Este correo electrónico ya está registrado. Iniciá sesión o recuperá tu contraseña.'
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin", "IntentoRegistro"')

const pep = await prisma.negocio.update({ where: { slug: 'peperina' }, data: { bienvenidaPuntos: 150, bienvenidaDesde: new Date(Date.now() - 48 * H), bienvenidaHasta: new Date(Date.now() + 48 * H) } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo', activo: true } })
let ipSiguiente = 0
let dniSiguiente = 40100000
async function registrar(datos) {
  const res = await fetch(`${BASE}/api/registro/peperina`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.30.0.${++ipSiguiente}` },
    body: JSON.stringify({ nombre: 'Prueba Clientes', password: 'clienta-123', fechaNacimiento: '1992-02-02', dni: String(++dniSiguiente), ...datos }),
  })
  return { status: res.status, cuerpo: await res.json().catch(() => ({})) }
}
const cuenta = (email) => prisma.cliente.findFirst({ where: { email } })

console.log('Celular en el registro')
let r = await registrar({ email: 'tel.mercedes@prueba.test', telefono: '2324500294' })
chequear(r.status === 201 && (await cuenta('tel.mercedes@prueba.test'))?.telefono === '+5492324500294', 'Mercedes "2324500294" → guardado "+5492324500294"')
r = await registrar({ email: 'tel.caba@prueba.test', telefono: '1155551234' })
chequear(r.status === 201 && (await cuenta('tel.caba@prueba.test'))?.telefono === '+5491155551234', 'Buenos Aires "1155551234" → "+5491155551234"')
r = await registrar({ email: 'tel.conprefijo@prueba.test', telefono: '+54 9 2324 500295', paisTelefono: 'AR' })
chequear(r.status === 201 && (await cuenta('tel.conprefijo@prueba.test'))?.telefono === '+5492324500295', 'si igual escribe +54 9, no se duplica')
r = await registrar({ email: 'tel.con15@prueba.test', telefono: '02324 15 500296' })
chequear(r.status === 201 && (await cuenta('tel.con15@prueba.test'))?.telefono === '+5492324500296', 'si igual escribe 0 y 15, se sacan')
r = await registrar({ email: 'tel.area@prueba.test', telefono: '4123456789' })
chequear(r.status === 400 && /código de área/.test(r.cuerpo.error) && !(await cuenta('tel.area@prueba.test')), 'código de área imposible → 400 con explicación')
r = await registrar({ email: 'tel.corto@prueba.test', telefono: '232450029' })
chequear(r.status === 400 && /10 números/.test(r.cuerpo.error), 'longitud incorrecta → 400')
r = await registrar({ email: 'tel.uy@prueba.test', telefono: '094123456', paisTelefono: 'UY' })
chequear(r.status === 201 && (await cuenta('tel.uy@prueba.test'))?.telefono === '+59894123456', 'otro país (Uruguay) → "+59894123456"')

console.log('DNI solo números en el registro')
r = await registrar({ email: 'dni.puntos@prueba.test', telefono: '2324500297', dni: '30.111.222' })
chequear(r.status === 400 && /solo con números/.test(r.cuerpo.error) && !(await cuenta('dni.puntos@prueba.test')), 'DNI con puntos → 400 "solo números"')
r = await registrar({ email: 'dni.ok@prueba.test', telefono: '2324500297', dni: '30111222' })
chequear(r.status === 201 && (await cuenta('dni.ok@prueba.test'))?.dni === '30111222', 'DNI "30111222" → 201')

console.log('Formulario de registro')
const b = await chromium.launch()
const pub = await b.newPage({ viewport: { width: 390, height: 844 } })
await pub.goto(`${BASE}/registro/peperina`)
await pub.waitForSelector('text=Registrarme', { timeout: 90000 })
chequear((await pub.getByLabel('País del celular').inputValue()) === 'AR' && (await pub.getByLabel('País del celular').locator('option:checked').textContent()) === 'Argentina (+54)', 'el país del celular arranca en "Argentina (+54)"')
await pub.getByLabel('DNI').pressSequentially('12.345.678')
chequear((await pub.getByLabel('DNI').inputValue()) === '12345678', 'escribiendo "12.345.678" en el DNI, los puntos no entran (queda "12345678")')
chequear(/sin el 0 ni el 15/.test(await pub.locator('#registro-celular-ayuda').textContent()), 'el celular explica: código de área y número, sin 0 ni 15')
await pub.getByLabel('Nombre').fill('Pantalla')
await pub.getByLabel('Apellido').fill('Registro')
await pub.getByLabel('Email').fill('pantalla.tel@prueba.test')
await pub.locator('#registro-password').fill('clave-123')
await pub.getByLabel('Fecha de nacimiento').fill('1990-03-03')
await pub.getByLabel('DNI').fill('40999001')
await pub.locator('#registro-celular').fill('412345678')
await pub.getByRole('button', { name: 'Registrarme' }).click()
await pub.locator('p[role=alert]').waitFor({ timeout: 10000 })
chequear(/código de área/.test(await pub.locator('p[role=alert]').textContent()) && !(await cuenta('pantalla.tel@prueba.test')), 'un celular mal escrito se avisa en la pantalla antes de mandar')
await pub.locator('#registro-celular').fill('2324500298')
await pub.getByRole('button', { name: 'Registrarme' }).click()
await pub.waitForURL((u) => u.pathname === '/', { timeout: 90000 }).catch(() => {})
chequear((await cuenta('pantalla.tel@prueba.test'))?.telefono === '+5492324500298' && (await cuenta('pantalla.tel@prueba.test'))?.origen === 'registro', 'registrándose desde la pantalla: "+5492324500298", origen "registro"')

console.log('"Nuevo cliente" del panel: mismos datos y reglas')
const dialogos = []
async function sesion(email, password) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('dialog', (d) => { dialogos.push(d.message()); d.accept() })
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.getByRole('button', { name: /^Ingres/ }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 })
  await page.waitForFunction(() => !document.body.innerText.includes('Cargando'), null, { timeout: 60000 }).catch(() => {})
  return { ctx, page }
}
const neg = await sesion('negocio@prueba.test', 'negocio-123')
const api = (metodo, ruta, cuerpo) => neg.page.evaluate(async ([m, u, c]) => { const x = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined }); return { status: x.status, texto: await x.text() } }, [metodo, ruta, cuerpo])
const alta = (datos) => api('POST', '/api/clientes', { nombre: 'Carga Manual', email: 'manual@prueba.test', fechaNacimiento: '1985-05-05', dni: '41000001', telefono: '2324700500', negocioId: pep.id, ...datos })
const err = (x) => { try { return JSON.parse(x.texto).error } catch { return '' } }
let x = await alta({ dni: '' })
chequear(x.status === 400 && err(x) === 'El DNI es obligatorio.', 'sin DNI → 400 "El DNI es obligatorio."')
x = await alta({ dni: '41.000.001' })
chequear(x.status === 400 && /solo con números/.test(err(x)), 'DNI con puntos → 400')
x = await alta({ fechaNacimiento: '' })
chequear(x.status === 400 && /fecha de nacimiento/.test(err(x)), 'sin fecha de nacimiento → 400')
x = await alta({ telefono: '12345' })
chequear(x.status === 400 && /10 números/.test(err(x)), 'celular inválido → 400')
x = await alta({ nombre: 'manual@prueba.test' })
chequear(x.status === 400 && /no el email/.test(err(x)), 'el email como nombre → 400 (así no se vuelven a crear cuentas sin nombre)')
x = await alta({ dni: '30111222' })
chequear(x.status === 409 && err(x) === MSJ_DNI, 'DNI de una cuenta que se registró sola → 409 con el mensaje de DNI')
x = await alta({ email: 'TEL.MERCEDES@prueba.test' })
chequear(x.status === 409 && err(x) === MSJ_EMAIL, 'email ya registrado → 409 con el mensaje de email')
x = await alta({ sexo: 'femenino' })
const manual = await cuenta('manual@prueba.test')
chequear(x.status === 200 && manual && manual.origen === 'panel' && manual.telefono === '+5492324700500' && manual.dni === '41000001' && manual.fechaNacimiento && manual.sexo === 'femenino', 'completa → se crea con DNI, fecha, género, celular "+5492324700500" y origen "panel"')
chequear(!x.texto.includes('41000001') && !x.texto.includes('"dni"') && x.texto.includes('passwordGenerada'), 'la respuesta trae la contraseña generada y no el DNI')
chequear(manual.puntos === 0 && (await prisma.movimientoPuntos.count({ where: { clienteId: manual.id, origen: 'bienvenida' } })) === 0, 'la carga manual no acredita la bienvenida (como antes)')
const dobles = await Promise.all([1, 2].map((i) => alta({ email: `doble${i}@prueba.test`, dni: '41000002' })))
chequear(dobles.map((d) => d.status).sort().join(',') === '200,409' && (await prisma.cliente.count({ where: { dni: '41000002' } })) === 1, `dos cargas simultáneas con el mismo DNI: una sola cuenta (${dobles.map((d) => d.status).join(',')})`)
x = await alta({ email: 'otro.negocio@prueba.test', dni: '41000003', negocioId: demo.id })
chequear(x.status === 403, 'Peperina no puede cargar clientas en otro negocio')

console.log('"Nuevo cliente" desde la pantalla')
await neg.page.getByRole('button', { name: 'Nuevo cliente' }).first().click()
await neg.page.getByText('Agregar un cliente').waitFor({ timeout: 15000 })
const form = neg.page.getByRole('group', { name: 'Agregar un cliente' })
for (const etiqueta of ['Nombre *', 'Apellido *', 'Email *', 'Fecha de nacimiento *', 'DNI * (solo números)', 'Celular (WhatsApp) *', 'Género (opcional)']) {
  chequear((await form.getByText(etiqueta, { exact: true }).count()) > 0, `el formulario pide "${etiqueta}"`)
}
await form.getByLabel('Nombre *').fill('Paola')
await form.getByLabel('Apellido *').fill('Manual')
await form.getByLabel('Email *').fill('paola.manual@prueba.test')
await form.getByLabel('Fecha de nacimiento *').fill('1991-07-07')
await form.getByLabel('DNI * (solo números)').pressSequentially('41.000.004')
chequear((await form.getByLabel('DNI * (solo números)').inputValue()) === '41000004', 'en el DNI del panel tampoco se pueden escribir puntos')
chequear((await neg.page.getByLabel('País del celular').inputValue()) === 'AR', 'el país del celular arranca en Argentina')
await neg.page.locator('#nuevo-cliente-celular').fill('2324700501')
await form.getByRole('button', { name: 'Guardar cliente' }).click()
await neg.page.waitForFunction(() => true, null, { timeout: 500 }).catch(() => {})
for (let i = 0; i < 30 && !(await cuenta('paola.manual@prueba.test')); i++) await new Promise((ok) => setTimeout(ok, 300))
const paola = await cuenta('paola.manual@prueba.test')
chequear(paola?.nombre === 'Paola Manual' && paola.telefono === '+5492324700501' && paola.dni === '41000004' && paola.origen === 'panel', 'desde la pantalla: "Paola Manual", "+5492324700501", DNI y origen "panel"')

console.log('Celulares viejos (antes de este cambio)')
const vieja = await prisma.cliente.create({ data: { nombre: 'Clienta Vieja', email: 'vieja.tel@prueba.test', password: 'x', negocioId: pep.id, telefono: '2324-55-1234', createdAt: new Date('2026-09-10T12:00:00Z') } })
r = await registrar({ email: 'vieja.otra@prueba.test', telefono: '2324551234' })
const viejaOtra = await cuenta('vieja.otra@prueba.test')
chequear(r.status === 201 && viejaOtra.telefono === '+5492324551234' && viejaOtra.puntos === 0 && viejaOtra.bienvenidaMotivo === 'celular_en_otra_cuenta', 'el formato nuevo reconoce el celular viejo "2324-55-1234": sin bienvenida, con el motivo')
await prisma.facturaPendiente.createMany({ data: ['F-1', 'F-2', 'F-3', 'F-4'].map((codigo) => ({ negocioId: pep.id, codigo, entidad: 'FACTURA', fecha: '', hora: '' })) })
const resolver = (codigo, telefono) => fetch(`${BASE}/api/dragonfish/resolver`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-agente-prueba' }, body: JSON.stringify({ codigo, monto: 10000, telefono }) }).then((y) => y.json())
const merc = await cuenta('tel.mercedes@prueba.test')
let res = await resolver('F-1', '2324-50-0294')
chequear(res.resultado === 'acreditado' && (await cuenta('tel.mercedes@prueba.test')).puntos > merc.puntos, 'Dragon Fish con "2324-50-0294" encuentra a la clienta guardada como "+5492324500294"')
res = await resolver('F-2', '5492324500294')
chequear(res.resultado === 'acreditado', 'y también con "5492324500294"')
const puntosVieja = (await cuenta('vieja.tel@prueba.test')).puntos
res = await resolver('F-3', '2324551234')
chequear(res.resultado === 'acreditado' && (await cuenta('vieja.tel@prueba.test')).puntos > puntosVieja && (await cuenta('vieja.otra@prueba.test')).puntos === 0, 'celular compartido por una cuenta vieja y una nueva: se acredita a la más antigua')
res = await resolver('F-4', '2324999999')
chequear(res.resultado === 'sin_cliente', 'un celular que no es de nadie → sin_cliente (no se crea ninguna cuenta)')
await neg.page.reload()
await neg.page.waitForFunction(() => !document.body.innerText.includes('Cargando'), null, { timeout: 60000 }).catch(() => {})
await neg.page.getByRole('button', { name: /Clientes/ }).first().click()
await neg.page.getByPlaceholder('Ej. Lucía').fill('vieja.tel@')
await neg.page.getByText('Clienta Vieja').first().click()
const href = await neg.page.getByRole('link', { name: /Escribirle por WhatsApp/ }).getAttribute('href')
chequear(href.startsWith('https://wa.me/5492324551234?'), `WhatsApp de un celular viejo sin código de país: ${href.split('?')[0]}`)

console.log('Cuentas sin nombre en el panel')
const conActividad = await prisma.cliente.create({ data: { nombre: 'sin.nombre1@prueba.test', email: 'sin.nombre1@prueba.test', password: 'x', negocioId: pep.id, puntos: 200 } })
await prisma.movimientoPuntos.create({ data: { clienteId: conActividad.id, negocioId: pep.id, puntos: 200, origen: 'dragonfish', saldoRestante: 200 } })
const invitada = await prisma.cliente.create({ data: { nombre: 'Amiga Real', email: 'amiga.real2@prueba.test', password: 'x', negocioId: pep.id, puntos: 300, referidoPorId: conActividad.id } })
const vacia = await prisma.cliente.create({ data: { nombre: null, email: 'sin.nombre2@prueba.test', password: 'x', negocioId: pep.id } })
const enDemo = await prisma.cliente.create({ data: { nombre: 'endemo2@prueba.test', email: 'endemo2@prueba.test', password: 'x', negocioId: demo.id } })
// Cuenta protegida (pedido de Genaro): sin nombre propio, pero no se borra nunca.
const protegida = await prisma.cliente.create({ data: { nombre: 'genaromarenco110@gmail.com', email: 'genaromarenco110@gmail.com', password: 'x', negocioId: pep.id, puntos: 50 } })
// Nombre de una sola palabra: tiene nombre propio, no se puede borrar.
const unaPalabra = await prisma.cliente.create({ data: { nombre: 'Agustina', email: 'una.palabra@prueba.test', password: 'x', negocioId: pep.id } })
// Canjes con cupones de Tiendanube en cada estado posible.
const premio = await prisma.premio.findFirst({ where: { negocioId: pep.id } })
const ESTADOS = { 'CUP-DISP': 'disponible', 'CUP-SINVER': null, 'CUP-USADO': 'utilizado', 'CUP-VENC': 'vencido', 'CUP-ANUL': 'anulado' }
for (const [codigo, estado] of Object.entries(ESTADOS)) {
  await prisma.canje.create({ data: { clienteId: conActividad.id, premioId: premio.id, tiendanubeCuponCodigo: codigo, cuponEstado: estado } })
}
x = await api('GET', `/api/clientes?negocioId=${pep.id}&sinNombre=1&pageSize=100`)
const lista = JSON.parse(x.texto).items
const itemProtegida = lista.find((c) => c.id === protegida.id)
chequear(itemProtegida?.sinNombre === true && itemProtegida.eliminable === false && lista.find((c) => c.id === vacia.id)?.eliminable === true, 'genaromarenco110@gmail.com aparece como sin nombre pero NO eliminable')
chequear(!lista.some((c) => c.id === unaPalabra.id), 'un nombre de una sola palabra no figura como "sin nombre"')
for (const metodo of ['GET', 'DELETE']) {
  x = await api(metodo, `/api/clientes/${protegida.id}`)
  chequear(x.status === 400 && /protegida/.test(err(x)) && (await cuenta('genaromarenco110@gmail.com'))?.puntos === 50, `${metodo} sobre genaromarenco110@gmail.com → 400 "protegida", la cuenta sigue igual`)
}
x = await api('DELETE', `/api/clientes/${unaPalabra.id}`)
chequear(x.status === 400 && (await cuenta('una.palabra@prueba.test')), 'una cuenta con nombre de una palabra no se puede borrar')
chequear(lista.length >= 2 && lista.every((c) => c.sinNombre) && lista.some((c) => c.id === vacia.id) && !lista.some((c) => c.id === invitada.id || c.id === enDemo.id), `el filtro "sin nombre" trae solo esas cuentas de Peperina (${lista.length})`)
x = await api('GET', `/api/clientes/${invitada.id}`)
chequear(x.status === 400, 'una cuenta con nombre no se puede borrar desde el panel')
x = await api('DELETE', `/api/clientes/${enDemo.id}`)
chequear(x.status === 404 && (await cuenta('endemo2@prueba.test')), 'tampoco una de otro negocio')
chequear((await fetch(`${BASE}/api/clientes/${vacia.id}`, { method: 'DELETE' })).status === 403 && (await cuenta('sin.nombre2@prueba.test')), 'sin sesión → 403')
x = await api('GET', `/api/clientes/${conActividad.id}`)
const impacto = JSON.parse(x.texto)
chequear(impacto.puntos === 200 && impacto.movimientos === 1 && impacto.canjes === 5 && impacto.invitadas === 1, 'antes de borrar muestra lo que se pierde (puntos, movimientos, canjes, invitadas)')
chequear(impacto.cupones.length === 5 && impacto.cupones.every((k) => ESTADOS[k.codigo] === k.estado), 'muestra todos los cupones de Tiendanube con su estado')
chequear(JSON.stringify([...impacto.cuponesVivos].sort()) === JSON.stringify(['CUP-DISP', 'CUP-SINVER']), `cupones posiblemente activos = disponibles o sin verificar (${impacto.cuponesVivos.join(', ')}); no los utilizados, vencidos ni anulados`)
const canjesAjenos = await prisma.canje.count({ where: { clienteId: { not: conActividad.id } } })
const otrasAntes = JSON.stringify(await prisma.cliente.findMany({ where: { id: { notIn: [conActividad.id, invitada.id] } }, select: { id: true, puntos: true }, orderBy: { id: 'asc' } }))
x = await api('DELETE', `/api/clientes/${conActividad.id}`)
const invitadaDespues = await prisma.cliente.findUnique({ where: { id: invitada.id } })
chequear(x.status === 200 && !(await cuenta('sin.nombre1@prueba.test')) && (await prisma.movimientoPuntos.count({ where: { clienteId: conActividad.id } })) === 0 && (await prisma.canje.count({ where: { clienteId: conActividad.id } })) === 0, 'se borra con sus movimientos y canjes')
chequear(JSON.stringify(JSON.parse(x.texto).cuponesVivos.sort()) === JSON.stringify(['CUP-DISP', 'CUP-SINVER']), 'la respuesta del borrado recuerda los cupones a desactivar')
chequear((await prisma.canje.count({ where: { clienteId: { not: conActividad.id } } })) === canjesAjenos, 'los canjes de otras cuentas no cambian')
chequear(invitadaDespues.puntos === 300 && invitadaDespues.referidoPorId === null, 'la invitada conserva sus puntos; pierde "quién la invitó"')
chequear(JSON.stringify(await prisma.cliente.findMany({ where: { id: { notIn: [conActividad.id, invitada.id] } }, select: { id: true, puntos: true }, orderBy: { id: 'asc' } })) === otrasAntes, 'ninguna otra cuenta cambió')
await neg.page.getByPlaceholder('Ej. Lucía').fill('')
await neg.page.getByLabel('Solo cuentas sin nombre').check()
await neg.page.getByText('sin.nombre2@prueba.test').first().waitFor({ timeout: 15000 })
chequear((await neg.page.getByText('Sin nombre', { exact: true }).count()) > 0, 'en la lista se ven marcadas "Sin nombre"')
await neg.page.getByText('genaromarenco110@gmail.com').first().click()
await neg.page.getByText('Está protegida: no se puede eliminar.').waitFor({ timeout: 15000 })
chequear((await neg.page.getByRole('button', { name: 'Eliminar cuenta' }).count()) === 0, 'en la pantalla, la cuenta protegida no tiene botón "Eliminar cuenta"')
// Otra cuenta sin nombre con un cupón disponible, para ver el aviso en pantalla.
await prisma.canje.create({ data: { clienteId: vacia.id, premioId: premio.id, tiendanubeCuponCodigo: 'CUP-PANTALLA', cuponEstado: 'disponible' } })
await neg.page.getByText('sin.nombre2@prueba.test').first().click()
dialogos.length = 0
await neg.page.getByRole('button', { name: 'Eliminar cuenta' }).click()
for (let i = 0; i < 30 && (await cuenta('sin.nombre2@prueba.test')); i++) await new Promise((ok) => setTimeout(ok, 300))
chequear(!(await cuenta('sin.nombre2@prueba.test')), 'desde la pantalla: "Eliminar cuenta" y confirmar → borrada')
const aviso = dialogos[0] || ''
chequear(['Puntos: 0', 'Movimientos de puntos', 'Canjes: 1', 'Cupones de Tiendanube de esos canjes: 1', 'CUP-PANTALLA: disponible', 'pueden seguir activos en la tienda (CUP-PANTALLA)', 'Referidos: invitó a 0'].every((t) => aviso.includes(t)), 'antes de confirmar, la pantalla muestra puntos, movimientos, canjes, cupones (con estado y cuáles siguen activos) y referidos')
await neg.ctx.close()
await b.close()

console.log('Script retroactivo: una carga manual no cuenta como autoregistro')
const salida = execFileSync('node', ['scripts/bienvenida-retroactiva.mjs', `--hasta=${new Date().toISOString()}`, '--aplicar'], { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' })
const manualDespues = await cuenta('manual@prueba.test')
chequear(/Acreditadas:/.test(salida) && manualDespues.puntos === 0 && !manualDespues.bienvenidaOtorgada && manualDespues.bienvenidaMotivo === null, 'la cuenta cargada a mano (con fecha de nacimiento) no recibe la bienvenida retroactiva')

console.log('Script de borrado en bloque: lista los cupones antes de borrar y respeta las protegidas')
const conCupon = await prisma.cliente.create({ data: { nombre: 'script.cupon@prueba.test', email: 'script.cupon@prueba.test', password: 'x', negocioId: pep.id } })
await prisma.canje.create({ data: { clienteId: conCupon.id, premioId: premio.id, tiendanubeCuponCodigo: 'CUP-SCRIPT', cuponEstado: null } })
await prisma.canje.create({ data: { clienteId: conCupon.id, premioId: premio.id, tiendanubeCuponCodigo: 'CUP-SCRIPT-USADO', cuponEstado: 'utilizado' } })
const correrScript = (...args) => execFileSync('node', ['scripts/eliminar-cuentas-sin-nombre.mjs', ...args], { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' })
const totalAntes = await prisma.cliente.count()
const sim = correrScript('--mostrar')
const seBorrarian = sim.slice(sim.indexOf('Se borrarían:'), sim.indexOf('Cupones de Tiendanube'))
chequear(/CUP-SCRIPT\s+\(estado en Retornar: sin verificar; cuenta script\.cupon@prueba\.test\)/.test(sim) && !sim.includes('CUP-SCRIPT-USADO'), 'la simulación lista los cupones posiblemente activos con su cuenta (no los utilizados)')
chequear(!seBorrarian.includes('genaromarenco110@gmail.com') && !seBorrarian.includes('una.palabra@prueba.test') && seBorrarian.includes('script.cupon@prueba.test'), 'la simulación no incluye la cuenta protegida ni las que tienen nombre')
chequear((await prisma.cliente.count()) === totalAntes, 'la simulación no borra nada')
const esperadas = Number(/Sin nombre propio \(SE BORRAN\): (\d+)/.exec(sim)[1])
correrScript('--aplicar', `--esperadas=${esperadas}`)
chequear(!(await cuenta('script.cupon@prueba.test')) && (await cuenta('genaromarenco110@gmail.com'))?.puntos === 50 && (await cuenta('una.palabra@prueba.test')) && (await cuenta('amiga.real2@prueba.test'))?.puntos === 300, 'al aplicar: borra las sin nombre, conserva genaromarenco110@gmail.com y las que tienen nombre')
chequear((await prisma.cliente.findMany({ where: { negocioId: pep.id }, select: { nombre: true, email: true } })).filter((c) => !c.nombre || c.nombre.includes('@')).every((c) => c.email === 'genaromarenco110@gmail.com'), 'en Peperina solo queda sin nombre la cuenta protegida')
for (const f of (await import('node:fs')).readdirSync('.').filter((f) => f.startsWith('respaldo-cuentas-eliminadas-'))) (await import('node:fs')).unlinkSync(f)

console.log('Cuentas viejas intactas')
chequear((await prisma.cliente.findUnique({ where: { id: vieja.id } })).telefono === '2324-55-1234', 'el celular de la cuenta vieja no se modificó')

await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
