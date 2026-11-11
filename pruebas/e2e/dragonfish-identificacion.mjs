// Ventas del local (Dragon Fish): la clienta se reconoce por email, celular
// (campo Movil de la ficha, cualquier formato) o DNI (también desde el
// CUIT/CUIL); una venta anterior a la cuenta no suma; las que no se
// reconocen quedan con monto y nombre de la ficha en "Ventas del local sin
// identificar", donde el negocio las vuelve a revisar o las asigna con un
// clic (una sola vez, sin cuentas posteriores ni de otro negocio).
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/dragonfish-identificacion.mjs
import { BASE, chromiumDePlaywright } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin"')

const pep = await prisma.negocio.findFirst({ where: { slug: 'peperina' } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo', activo: true, dragonfishAgentToken: 'token-agente-demo' } })
const hace = (dias) => new Date(Date.now() - dias * 86400000)
const cuenta = (datos) => prisma.cliente.create({ data: { password: 'x', negocioId: pep.id, createdAt: hace(30), ...datos } })
const conEmail = await cuenta({ nombre: 'Email Cuenta', email: 'df.email@prueba.test', telefono: '+5492324000001' })
const conCelular = await cuenta({ nombre: 'Celu Movil', email: 'df.celu@prueba.test', telefono: '+5492324600700' })
const conDni = await cuenta({ nombre: 'Dni Ficha', email: 'df.dni@prueba.test', telefono: '+5492324000003', dni: '33444555' })
const conCuit = await cuenta({ nombre: 'Cuit Ficha', email: 'df.cuit@prueba.test', telefono: '+5492324000004', dni: '28999111' })
const laura = await cuenta({ nombre: 'Laura Pérez', email: 'laura.perez@prueba.test', telefono: '+5492324000005' })
const recien = await prisma.cliente.create({ data: { nombre: 'Recien Registrada', email: 'df.recien@prueba.test', password: 'x', negocioId: pep.id, telefono: '+5492324000006' } })
const deDemo = await prisma.cliente.create({ data: { nombre: 'Laura Pérez', email: 'laura.demo@prueba.test', password: 'x', negocioId: demo.id, createdAt: hace(30) } })

let n = 0
const factura = (createdAt = new Date(), negocioId = pep.id) => prisma.facturaPendiente.create({ data: { negocioId, codigo: `DF-${Date.now()}-${n++}`, entidad: 'FACTURA', fecha: '2026-11-11', hora: '12:00', createdAt } })
const resolver = async (codigo, cuerpo, token = 'token-agente-prueba') => {
  const r = await fetch(`${BASE}/api/dragonfish/resolver`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ codigo, ...cuerpo }) })
  return { status: r.status, cuerpo: await r.json().catch(() => ({})) }
}
const saldo = async (c) => (await prisma.cliente.findUnique({ where: { id: c.id } })).puntos
const ficha = (f) => prisma.facturaPendiente.findUnique({ where: { id: f.id } })

console.log('Reconocer a la clienta')
let f = await factura()
let r = await resolver(f.codigo, { monto: 25000, email: '  DF.Email@Prueba.TEST ', telefonos: [], nombre: 'CUENTA EMAIL' })
let fd = await ficha(f)
chequear(r.cuerpo.resultado === 'acreditado' && r.cuerpo.puntosAcreditados === 250 && await saldo(conEmail) === 250 && fd.clienteId === conEmail.id && fd.identificadaPor === 'email' && fd.monto === 25000, 'por email (mayúsculas y espacios): 250 puntos, queda a quién y por qué dato')
f = await factura()
r = await resolver(f.codigo, { monto: '8000', telefonos: ['(02324) 60-0700'], telefono: '(02324) 60-0700', nombre: 'MOVIL CELU' })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(conCelular) === 80 && (await ficha(f)).identificadaPor === 'celular', 'por el celular del campo Movil, aunque esté escrito distinto')
f = await factura()
r = await resolver(f.codigo, { monto: 5000, telefonos: [], dni: '33.444.555', nombre: 'FICHA DNI' })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(conDni) === 50 && (await ficha(f)).identificadaPor === 'dni', 'por DNI (NroDocumento), sin email ni celular')
f = await factura()
r = await resolver(f.codigo, { monto: 3000, telefonos: [], cuit: '27-28999111-4' })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(conCuit) === 30, 'por el DNI que va dentro del CUIT/CUIL')
f = await factura()
r = await resolver(f.codigo, { monto: 1000, email: 'otro@prueba.test', telefono: '2324-600700' })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(conCelular) === 90, 'el agente viejo (solo email/telefono) sigue funcionando')
r = await resolver(f.codigo, { monto: 1000, telefono: '2324-600700' })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(conCelular) === 90, 'el mismo reporte otra vez no suma de nuevo')

console.log('Compra anterior a la cuenta')
const vieja = await factura(hace(10))
r = await resolver(vieja.codigo, { monto: 20000, email: 'df.recien@prueba.test', telefonos: [] })
chequear(r.cuerpo.resultado === 'cuenta_posterior' && await saldo(recien) === 0 && (await ficha(vieja)).clienteId === recien.id, 'venta de hace 10 días, cuenta creada hoy: no suma (queda "cuenta_posterior")')

console.log('Ventas que no se reconocen')
const soloNombre = await factura(hace(1)) // de ayer: antes de que se registrara "recien"
r = await resolver(soloNombre.codigo, { sinDatos: true, monto: 12000, nombre: 'PEREZ LAURA' })
fd = await ficha(soloNombre)
chequear(r.cuerpo.resultado === 'sin_datos' && fd.monto === 12000 && fd.nombreFicha === 'PEREZ LAURA', 'ficha con solo nombre: "sin_datos", con monto y nombre guardados')
const cantidad = await prisma.cliente.count()
const sinCuenta = await factura()
r = await resolver(sinCuenta.codigo, { monto: 7000, email: 'nadie@prueba.test', telefonos: ['2324999999'], nombre: 'NADIE' })
chequear(r.cuerpo.resultado === 'sin_cliente' && (await ficha(sinCuenta)).monto === 7000, 'datos que no coinciden con ninguna cuenta: "sin_cliente"')
chequear(cantidad === await prisma.cliente.count(), 'nunca se crea una cuenta sola')

console.log('Multiempresa')
r = await resolver(soloNombre.codigo, { monto: 12000, email: 'df.email@prueba.test' }, 'token-agente-demo')
chequear(r.status === 404, 'el agente de otro negocio no puede reportar ventas de Peperina')
const fDemo = await factura(new Date(), demo.id)
r = await resolver(fDemo.codigo, { monto: 5000, email: 'df.email@prueba.test' }, 'token-agente-demo')
chequear(r.cuerpo.resultado === 'sin_cliente' && await saldo(conEmail) === 250, 'una venta de otro negocio no suma a una cuenta de Peperina')

console.log('Pantalla "Ventas del local sin identificar" (API)')
const b = await chromium().launch()
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
function chromium() { return chromiumDePlaywright() }
const pedir = (s, metodo, ruta, cuerpo) => s.page.evaluate(async ([m, u, c]) => { const x = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: c ? JSON.stringify(c) : undefined }); let j = {}; try { j = await x.json() } catch {} return { status: x.status, cuerpo: j } }, [metodo, ruta, cuerpo])
const neg = await sesion('negocio@prueba.test', 'negocio-123')
const negDemo = await sesion('demo@prueba.test', 'demo-123')
const cli = await sesion('lucia@prueba.test', 'clienta-123')
const url = `/api/dragonfish/sin-identificar?negocioId=${pep.id}`
r = await pedir(neg, 'GET', url)
const vSolo = r.cuerpo.ventas?.find((v) => v.codigo === soloNombre.codigo)
chequear(r.status === 200 && vSolo?.monto === 12000 && vSolo.puntos === 120 && vSolo.nombreFicha === 'PEREZ LAURA' && vSolo.sugerencias.includes(laura.id) && !vSolo.sugerencias.includes(deDemo.id), 'lista la venta con monto, puntos, nombre de la ficha y sugiere a Laura Pérez de Peperina (no la de otro negocio)')
chequear(r.cuerpo.ventas.some((v) => v.codigo === sinCuenta.codigo) && !r.cuerpo.ventas.some((v) => [vieja.codigo, fDemo.codigo].includes(v.codigo)), 'no muestra la "cuenta posterior" ni ventas de otro negocio')
chequear((await pedir(negDemo, 'GET', url)).status === 403 && (await pedir(cli, 'GET', url)).status === 403, 'otro negocio o una clienta no pueden verla')

r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: soloNombre.codigo, clienteId: deDemo.id })
chequear(r.status === 404 && await saldo(deDemo) === 0, 'no se puede asignar a una clienta de otro negocio')
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: soloNombre.codigo, clienteId: recien.id })
chequear(r.status === 409 && /se registró después/.test(r.cuerpo.error), 'ni a una cuenta creada después de la compra')
r = await pedir(negDemo, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: soloNombre.codigo, clienteId: laura.id })
chequear(r.status === 403 && await saldo(laura) === 0, 'otro negocio no puede asignar ventas de Peperina')
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: soloNombre.codigo, clienteId: laura.id })
fd = await ficha(soloNombre)
chequear(r.status === 200 && r.cuerpo.puntos === 120 && await saldo(laura) === 120 && fd.resultado === 'acreditado_manual' && fd.identificadaPor === 'manual', 'asignada a mano: 120 puntos a Laura, queda "acreditado_manual"')
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: soloNombre.codigo, clienteId: laura.id })
chequear(r.status === 409 && await saldo(laura) === 120, 'asignarla otra vez no suma de nuevo')

console.log('Volver a revisar')
const muyVieja = await factura(hace(100))
await prisma.facturaPendiente.update({ where: { id: muyVieja.id }, data: { procesado: true, resultado: 'sin_cliente' } })
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'revisar', dias: 60 })
const sc = await ficha(sinCuenta)
chequear(r.status === 200 && r.cuerpo.enRevision >= 1 && sc.procesado === false && sc.resultado === null && (await ficha(muyVieja)).procesado === true && (await ficha(vieja)).resultado === 'cuenta_posterior', 'vuelven a la fila las sin identificar de los últimos 60 días (no las más viejas ni las de cuenta posterior)')
await prisma.cliente.update({ where: { id: laura.id }, data: { telefono: '+5492324999999' } })
r = await resolver(sinCuenta.codigo, { monto: 7000, email: 'nadie@prueba.test', telefonos: ['2324999999'], nombre: 'NADIE' })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(laura) === 190, 'el agente la revisa de nuevo y, con el dato corregido, ahora suma (70)')

console.log('Vincular la ficha de Dragon Fish (fichas sin datos)')
const marta = await cuenta({ nombre: 'Marta Sosa', email: 'marta.sosa@prueba.test', telefono: '+5492324000007' })
const ventaFicha = async (codigoFicha, nombre, monto, cuando = new Date(), token) => {
  const fx = await factura(cuando, token === 'token-agente-demo' ? demo.id : pep.id)
  const rx = await resolver(fx.codigo, { monto, codigoFicha, nombre, telefonos: [] }, token)
  return { f: fx, r: rx }
}
const antes = await ventaFicha('F-MARTA', 'SOSA MARTA', 9000, hace(40)) // antes de registrarse
const m1 = await ventaFicha('F-MARTA', 'SOSA MARTA', 10000, hace(2))
const m2 = await ventaFicha('F-MARTA', 'SOSA MARTA', 5000, hace(1))
chequear([antes, m1, m2].every((x) => x.r.cuerpo.resultado === 'sin_datos') && (await ficha(m1.f)).codigoFicha === 'F-MARTA', 'ficha con solo nombre, sin vincular: "sin_datos", con el código de la ficha guardado')
r = await pedir(neg, 'GET', url)
chequear(r.cuerpo.ventas.find((v) => v.codigo === m1.f.codigo)?.vinculable === true, 'en la lista figura como vinculable')
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: m1.f.codigo, clienteId: marta.id, vincular: true })
chequear(r.status === 200 && r.cuerpo.vinculada === true && r.cuerpo.puntos === 100 && r.cuerpo.otras === 1 && r.cuerpo.puntosOtras === 50 && await saldo(marta) === 150, 'asignar una y vincular: suma esa (100) y la otra de esa ficha (50)')
chequear((await ficha(antes.f)).resultado === 'sin_datos', 'la compra de antes de registrarse sigue sin sumar')
const m3 = await ventaFicha('F-MARTA', 'SOSA MARTA', 7000)
chequear(m3.r.cuerpo.resultado === 'acreditado' && (await ficha(m3.f)).identificadaPor === 'ficha' && await saldo(marta) === 220, 'la próxima compra de esa ficha suma sola (70), sin tocar nada')
const mDemo = await ventaFicha('F-MARTA', 'SOSA MARTA', 7000, new Date(), 'token-agente-demo')
chequear(mDemo.r.cuerpo.resultado === 'sin_datos' && await saldo(marta) === 220, 'el vínculo es solo de Peperina: el mismo código en otro negocio no suma')

const huerfana = await factura(hace(1))
await prisma.facturaPendiente.update({ where: { id: huerfana.id }, data: { procesado: true, resultado: 'sin_datos', monto: 3000, codigoFicha: 'F-MARTA', nombreFicha: 'SOSA MARTA' } })
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: huerfana.codigo, clienteId: laura.id, vincular: true })
chequear(r.status === 409 && /ya está vinculada/.test(r.cuerpo.error) && (await ficha(huerfana)).resultado === 'sin_datos', 'una ficha ya vinculada a otra clienta: no se vincula de nuevo ni suma')

const cf = await ventaFicha('CF', 'CONSUMIDOR FINAL', 6000, hace(1))
r = await pedir(neg, 'GET', url)
chequear(r.cuerpo.ventas.find((v) => v.codigo === cf.f.codigo)?.vinculable === false, '"Consumidor final" no se puede vincular')
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: cf.f.codigo, clienteId: laura.id, vincular: true })
const cf2 = await ventaFicha('CF', 'CONSUMIDOR FINAL', 6000)
chequear(r.status === 200 && r.cuerpo.vinculada === false && !(await prisma.fichaDragonfish.findFirst({ where: { codigo: 'CF' } })) && cf2.r.cuerpo.resultado === 'sin_datos', 'asignar una venta de consumidor final suma solo esa: no vincula la ficha')

chequear((await pedir(negDemo, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'desvincular', codigoFicha: 'F-MARTA' })).status === 403, 'otro negocio no puede desvincular fichas de Peperina')
r = await pedir(neg, 'GET', url)
chequear(r.cuerpo.vinculadas.some((v) => v.codigo === 'F-MARTA' && v.clienteId === marta.id), 'la lista de fichas vinculadas la muestra')
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'desvincular', codigoFicha: 'F-MARTA' })
const m4 = await ventaFicha('F-MARTA', 'SOSA MARTA', 4000)
chequear(r.status === 200 && m4.r.cuerpo.resultado === 'sin_datos' && await saldo(marta) === 220, 'desvincular: las próximas compras vuelven a "sin identificar" y los puntos ya sumados no cambian')

console.log('Coincidencias ambiguas')
const hermana1 = await cuenta({ nombre: 'Rosa Gil', email: 'rosa.gil@prueba.test', telefono: '+5492324800800' })
const hermana2 = await cuenta({ nombre: 'Ana Gil', email: 'ana.gil@prueba.test', telefono: '2324-800800' })
const amb = await factura(hace(1))
r = await resolver(amb.codigo, { monto: 8000, codigoFicha: 'F-GIL', nombre: 'GIL', telefonos: ['2324800800'] })
fd = await ficha(amb)
chequear(r.cuerpo.resultado === 'ambigua' && await saldo(hermana1) === 0 && await saldo(hermana2) === 0 && fd.candidatas.length === 2 && fd.candidatas.includes(hermana1.id) && fd.candidatas.includes(hermana2.id), 'celular que tienen dos cuentas: no suma a ninguna, queda "ambigua" con las dos como candidatas')
const cruzada = await factura(hace(1))
r = await resolver(cruzada.codigo, { monto: 2000, email: 'rosa.gil@prueba.test', telefonos: ['2324600700'] })
chequear(r.cuerpo.resultado === 'ambigua' && await saldo(hermana1) === 0 && await saldo(conCelular) === 90, 'el email de una cuenta y el celular de otra: "ambigua", no suma a ninguna')
const coincide = await factura()
r = await resolver(coincide.codigo, { monto: 1000, email: 'df.dni@prueba.test', dni: '33444555', telefonos: ['2324000003'] })
chequear(r.cuerpo.resultado === 'acreditado' && await saldo(conDni) === 60, 'email, celular y DNI de la misma cuenta: suma sola (no es ambigua)')
r = await pedir(neg, 'GET', url)
const vAmb = r.cuerpo.ventas.find((v) => v.codigo === amb.codigo)
chequear(vAmb?.motivo === 'ambigua' && vAmb.sugerencias.slice(0, 2).sort().join() === [hermana1.id, hermana2.id].sort().join(), 'en el panel figura "ambigua" con las dos cuentas sugeridas primero')
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: amb.codigo, clienteId: hermana2.id, vincular: true })
const saldoAna = await saldo(hermana2)
const amb2 = await factura()
const r2 = await resolver(amb2.codigo, { monto: 3000, codigoFicha: 'F-GIL', nombre: 'GIL', telefonos: ['2324800800'] })
chequear(r.status === 200 && r.cuerpo.vinculada && saldoAna === 80 && r2.cuerpo.resultado === 'acreditado' && (await ficha(amb2)).identificadaPor === 'ficha' && await saldo(hermana2) === 110 && await saldo(hermana1) === 0, 'la empleada elige a Ana y vincula la ficha: suma 80, y la próxima compra de esa ficha le suma sola (30), nunca a Rosa')

console.log('Volver a revisar no duplica')
const rev = await factura(hace(1))
await resolver(rev.codigo, { monto: 6000, codigoFicha: 'F-REV', nombre: 'REVISAR NUEVA', telefonos: [] })
const revisada = await cuenta({ nombre: 'Revisar Nueva', email: 'revisar.nueva@prueba.test', telefono: '+5492324880088', createdAt: hace(5) })
await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'revisar', dias: 60 })
await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'revisar', dias: 60 })
r = await resolver(rev.codigo, { sinDatos: true }) // agente viejo: no trae ni el código de la ficha
fd = await ficha(rev)
chequear(r.cuerpo.resultado === 'sin_datos' && fd.codigoFicha === 'F-REV' && fd.monto === 6000 && fd.nombreFicha === 'REVISAR NUEVA', 'un agente viejo al volver a revisar no borra el código de la ficha, el monto ni el nombre')
await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'asignar', codigo: rev.codigo, clienteId: revisada.id, vincular: true })
const antesRevisar = await saldo(revisada)
r = await pedir(neg, 'POST', '/api/dragonfish/sin-identificar', { negocioId: pep.id, accion: 'revisar', dias: 60 })
const yaAcreditada = await ficha(rev)
const otraVez = await resolver(rev.codigo, { monto: 6000, codigoFicha: 'F-REV', telefonos: [] })
chequear(antesRevisar === 60 && yaAcreditada.procesado === true && yaAcreditada.resultado === 'acreditado_manual' && otraVez.cuerpo.resultado === 'acreditado_manual' && await saldo(revisada) === 60 && await prisma.webhookEvento.count({ where: { proveedor: 'dragonfish', referenciaExterna: `${pep.id}:${rev.codigo}` } }) === 1, '"Volver a revisar" no toca las ya acreditadas y un reporte repetido no suma de nuevo (60, una sola vez)')

console.log('Pantalla')
const otra = await factura()
await resolver(otra.codigo, { sinDatos: true, monto: 4100, nombre: 'PEREZ LAURA' })
await neg.page.goto(`${BASE}/`)
await neg.page.getByRole('button', { name: /^Integraciones/ }).first().click()
await neg.page.getByRole('button', { name: 'Ver ventas sin identificar' }).click()
const fila = neg.page.locator('li', { hasText: '$4.100' }).first()
await fila.waitFor({ timeout: 30000 })
chequear((await fila.innerText()).includes('PEREZ LAURA') && (await fila.innerText()).includes('41 puntos'), 'muestra la venta con monto, puntos y nombre de la ficha')
await fila.getByRole('combobox', { name: 'Clienta' }).selectOption(laura.id)
await fila.getByRole('button', { name: 'Sumar puntos' }).click()
await neg.page.getByText('Listo: 41 puntos sumados.').waitFor({ timeout: 30000 })
chequear(await saldo(laura) === 291, 'elegir a la clienta y "Sumar puntos": suma 41 y la venta sale de la lista')

await b.close()
await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
