// Acreditación automática de compras de Tiendanube: webhook firmado, clienta
// con cuenta (por email con mayúsculas/espacios, email de la cuenta de la
// tienda o celular), sin cuenta, cuenta creada después, pendiente → pagada,
// cancelada y reembolsada, reenvíos y simultáneos sin duplicar, error
// temporal, multiempresa, conciliación programada (sin acreditar compras de
// antes) y el script de revisión (simulación, aplicar idempotente, reparar
// el webhook). Tiendanube y Resend simulados: nada real.
//
// El servidor tiene que correr con TIENDANUBE_CLIENT_SECRET=secreto-tn-prueba
// (y las simulaciones). Correr con:
//   TIENDANUBE_CLIENT_SECRET=secreto-tn-prueba node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/acreditacion-tiendanube.mjs
import fs from 'node:fs'
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { BASE, DIR } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
const SECRETO = process.env.TIENDANUBE_CLIENT_SECRET
if (!SECRETO) { console.error('Falta TIENDANUBE_CLIENT_SECRET (el mismo que el servidor)'); process.exit(1) }
const ORDENES = `${DIR}/tn-ordenes.json`, CONTROL = `${DIR}/tn-ordenes-control.json`, WEBHOOKS = `${DIR}/tn-webhooks.json`, MAILS = `${DIR}/mails-enviados.json`
for (const f of [ORDENES, CONTROL, WEBHOOKS, MAILS]) fs.rmSync(f, { force: true })
const leer = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d)
const ordenes = {}
const guardar = () => fs.writeFileSync(ORDENES, JSON.stringify(ordenes))
const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString()
let siguienteId = 9000
function orden(datos) {
  const id = siguienteId++
  ordenes[id] = { id, number: id - 8000, payment_status: 'paid', status: 'open', total: '10000.00', created_at: hace(0), updated_at: hace(0), paid_at: hace(0), ...datos }
  guardar()
  return id
}
const firmar = (cuerpo, secreto = SECRETO) => createHmac('sha256', secreto).update(cuerpo).digest('hex')
async function webhook(id, { store = 1, firma = 'buena' } = {}) {
  const cuerpo = JSON.stringify({ store_id: store, event: 'order/paid', id })
  const h = { 'Content-Type': 'application/json' }
  if (firma === 'buena') h['x-linkedstore-hmac-sha256'] = firmar(cuerpo)
  if (firma === 'mala') h['x-linkedstore-hmac-sha256'] = firmar(cuerpo, 'otra-clave')
  const r = await fetch(`${BASE}/api/webhooks/tiendanube`, { method: 'POST', headers: h, body: cuerpo })
  let j = {}
  try { j = await r.json() } catch {}
  return { status: r.status, cuerpo: j }
}
const saldo = async (id) => (await prisma.cliente.findUnique({ where: { id } })).puntos
const compras = (clienteId) => prisma.movimientoPuntos.count({ where: { clienteId, origen: 'tiendanube' } })
const registro = (orderId) => prisma.ordenTiendanube.findUnique({ where: { negocioId_orderId: { negocioId: pep.id, orderId: String(orderId) } } })

const pep = await prisma.negocio.findFirst({ where: { slug: 'peperina' } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo', activo: true, tiendanubeStoreId: '2', tiendanubeAccessToken: 'token-demo' } })
const reglasAntes = JSON.stringify(await prisma.negocio.findMany({ select: { id: true, puntosXPeso: true }, orderBy: { id: 'asc' } }))
const pass = 'x'
const ayer = new Date(Date.now() - 86400000 * 2)
const ana = await prisma.cliente.create({ data: { nombre: 'Ana Compra', email: 'ana.compra@prueba.test', password: pass, negocioId: pep.id, telefono: '+5492324111111', createdAt: ayer } })
// Cuenta vieja guardada tal cual se tipeó (mayúsculas y espacio al final).
const vieja = await prisma.cliente.create({ data: { nombre: 'Vieja Mayus', email: 'Vieja.Mayus@Prueba.Test ', password: pass, negocioId: pep.id, telefono: '+5492324333444', createdAt: ayer } })
const cuenta = await prisma.cliente.create({ data: { nombre: 'Cuenta Tienda', email: 'cuenta@prueba.test', password: pass, negocioId: pep.id, telefono: '+5492324555666', createdAt: ayer } })
const celu = await prisma.cliente.create({ data: { nombre: 'Celu Viejo', email: 'celu@prueba.test', password: pass, negocioId: pep.id, telefono: '2324-777888', createdAt: ayer } })
const nueva = await prisma.cliente.create({ data: { nombre: 'Recién Registrada', email: 'recien@prueba.test', password: pass, negocioId: pep.id, telefono: '+5492324999000' } })
const deDemo = await prisma.cliente.create({ data: { nombre: 'Ana en Demo', email: 'ana.demo@prueba.test', password: pass, negocioId: demo.id, createdAt: ayer } })

console.log('1. Compra pagada de una clienta con cuenta')
const o1 = orden({ contact_email: 'ana.compra@prueba.test', total: '25050.00' })
let r = await webhook(o1)
chequear(r.status === 200 && r.cuerpo.puntosAcreditados === 250 && await saldo(ana.id) === 250 && await compras(ana.id) === 1, `acredita 250 puntos ($25.050 con 1 punto cada $100): ${r.status} ${JSON.stringify(r.cuerpo)}`)
let reg = await registro(o1)
chequear(reg?.estado === 'acreditada' && reg.via === 'webhook' && reg.puntos === 250 && reg.clienteId === ana.id && reg.emailOculto === 'an***@prueba.test', 'queda registrada: acreditada por el webhook, sin el email completo')
const mails = leer(MAILS, [])
chequear(mails.some((m) => (Array.isArray(m.to) ? m.to : [m.to]).includes('ana.compra@prueba.test')), 'le llega el mail de puntos sumados')

console.log('12 y 5. Sin duplicar: reenvíos y avisos simultáneos')
r = await webhook(o1)
chequear(r.status === 200 && r.cuerpo.duplicado === true && await saldo(ana.id) === 250 && await compras(ana.id) === 1, 'el mismo aviso otra vez: 200 "duplicado", el saldo no cambia')
const o1b = orden({ contact_email: 'ana.compra@prueba.test', total: '3000.00' })
const simultaneos = await Promise.all([webhook(o1b), webhook(o1b), webhook(o1b)])
chequear(simultaneos.every((x) => x.status === 200) && await saldo(ana.id) === 280 && await compras(ana.id) === 2, `tres avisos a la vez de otra compra: se acredita una sola vez (${simultaneos.map((x) => x.status).join(',')})`)

console.log('11. Dos compras distintas de la misma clienta')
const o11 = orden({ contact_email: 'ana.compra@prueba.test', total: '1000.00' })
await webhook(o11)
chequear(await saldo(ana.id) === 290 && await compras(ana.id) === 3 && await prisma.webhookEvento.count({ where: { proveedor: 'tiendanube', referenciaExterna: { in: [o1, o1b, o11].map((x) => `1:${x}`) } } }) === 3, 'cada compra suma por separado (3 compras, 3 movimientos)')

console.log('6. Firma')
const o6 = orden({ contact_email: 'ana.compra@prueba.test', total: '50000.00' })
r = await webhook(o6, { firma: 'mala' })
const r6b = await webhook(o6, { firma: 'ninguna' })
chequear(r.status === 401 && r6b.status === 401 && await saldo(ana.id) === 290 && !(await registro(o6)), 'firma inválida o sin firma: 401, no suma ni registra nada')

console.log('2. Compra de alguien sin cuenta')
const cantidadAntes = await prisma.cliente.count()
const o2 = orden({ contact_email: 'nadie.registrada@prueba.test', total: '20000.00', contact_phone: '+5491100000000' })
r = await webhook(o2)
reg = await registro(o2)
chequear(r.status === 200 && reg?.estado === 'sin_cliente' && reg.motivo === 'email_sin_cuenta' && await prisma.cliente.count() === cantidadAntes, 'no suma ni crea una cuenta; queda registrada "sin_cliente" para revisar')

console.log('Cuenta creada después de pagar (regla de siempre)')
const oPost = orden({ contact_email: 'recien@prueba.test', total: '20000.00', paid_at: hace(1), created_at: hace(1), updated_at: hace(1) })
r = await webhook(oPost)
chequear(r.status === 200 && (await registro(oPost))?.estado === 'cuenta_posterior' && await saldo(nueva.id) === 0, 'compra pagada antes de registrarse: no suma (como Dragon Fish)')

console.log('3 y 4. Pendiente de pago y después pagada')
const o3 = orden({ contact_email: 'cuenta@prueba.test', total: '15000.00', payment_status: 'pending', paid_at: null })
r = await webhook(o3)
chequear(r.status === 409 && (await registro(o3))?.estado === 'pendiente_pago' && await saldo(cuenta.id) === 0, 'pendiente: 409 (Tiendanube reintenta), sin puntos, registrada "pendiente_pago"')
Object.assign(ordenes[o3], { payment_status: 'paid', paid_at: hace(0), updated_at: hace(0) }); guardar()
r = await webhook(o3)
chequear(r.status === 200 && await saldo(cuenta.id) === 150 && (await registro(o3))?.estado === 'acreditada', 'cuando se confirma el pago: acredita 150')

console.log('10. Cancelada y reembolsada')
const o10a = orden({ contact_email: 'cuenta@prueba.test', status: 'cancelled' })
const o10b = orden({ contact_email: 'cuenta@prueba.test', payment_status: 'refunded' })
const ra = await webhook(o10a), rb = await webhook(o10b)
chequear(ra.status === 200 && rb.status === 200 && (await registro(o10a))?.estado === 'cancelada' && (await registro(o10b))?.estado === 'reembolsada' && await saldo(cuenta.id) === 150, 'no suman; responden 200 (no se reintentan para siempre)')

console.log('8. Email con mayúsculas o espacios')
const o8 = orden({ contact_email: '  VIEJA.MAYUS@prueba.TEST ', total: '7000.00' })
r = await webhook(o8)
chequear(r.status === 200 && await saldo(vieja.id) === 70, 'la encuentra aunque la cuenta vieja tenga mayúsculas y un espacio guardados')

console.log('9. Email de la compra distinto del de la cuenta')
const o9a = orden({ contact_email: 'otro.mail@prueba.test', customer: { email: 'Cuenta@Prueba.test' }, total: '5000.00' })
await webhook(o9a)
chequear(await saldo(cuenta.id) === 200 && (await registro(o9a))?.motivo === 'email', 'por el email de la cuenta de la tienda (customer.email)')
const o9b = orden({ contact_email: 'celu.otro@prueba.test', contact_phone: '+54 9 2324 77-7888', total: '4000.00' })
await webhook(o9b)
chequear(await saldo(celu.id) === 40 && (await registro(o9b))?.motivo === 'celular', 'por celular, aunque esté guardado con otro formato ("2324-777888")')
const o9c = orden({ contact_email: 'compartido@prueba.test', contact_phone: '2324555000', total: '4000.00' })
await webhook(o9c)
reg = await registro(o9c)
chequear(reg?.estado === 'sin_cliente' && reg.motivo === 'celular_en_varias_cuentas', 'un celular que tienen varias cuentas: no adivina a quién acreditar')

console.log('7. Error temporal')
const o7 = orden({ contact_email: 'ana.compra@prueba.test', total: '2000.00' })
fs.writeFileSync(CONTROL, JSON.stringify({ fallar: { [o7]: 1 } }))
r = await webhook(o7)
reg = await registro(o7)
chequear(r.status === 500 && reg?.estado === 'error' && /503/.test(reg.ultimoError) && await saldo(ana.id) === 290, 'Tiendanube no responde: 500 (para que reintente), queda "error" con el motivo, sin puntos')
r = await webhook(o7)
chequear(r.status === 200 && await saldo(ana.id) === 310 && (await registro(o7))?.estado === 'acreditada', 'el reintento la acredita')

console.log('Multiempresa')
const oDemo = orden({ contact_email: 'ana.compra@prueba.test', total: '9900.00', store_id: 2 })
r = await webhook(oDemo, { store: 2 })
chequear(r.status === 200 && await saldo(ana.id) === 310 && (await prisma.ordenTiendanube.findFirst({ where: { negocioId: demo.id, orderId: String(oDemo) } }))?.estado === 'sin_cliente', 'una compra en la tienda de otro negocio no suma en Peperina')
const oDemo2 = orden({ contact_email: 'ana.demo@prueba.test', total: '9900.00', store_id: 2 })
await webhook(oDemo2, { store: 2 })
chequear(await saldo(deDemo.id) === 99, 'y sí en la cuenta de ese negocio')
r = await webhook(orden({ contact_email: 'ana.compra@prueba.test', store_id: 999 }), { store: 999 })
chequear(r.status === 200 && r.cuerpo.message === 'Negocio no configurado', 'tienda desconocida: no suma')

console.log('13. Recuperación: conciliación programada')
const conciliar = (await import('../../netlify/functions/conciliar-tiendanube.mjs')).default
const oVieja = orden({ contact_email: 'ana.compra@prueba.test', total: '12300.00', created_at: hace(1), updated_at: hace(1), paid_at: hace(1) })
let saldoAntes = await saldo(ana.id)
await conciliar()
const pepDb = await prisma.negocio.findUnique({ where: { id: pep.id } })
chequear(pepDb.tiendanubeConciliarDesde && await saldo(ana.id) === saldoAntes && !(await registro(oVieja)), 'primera corrida: solo marca desde cuándo concilia; no acredita compras de antes')
const oPerdida = orden({ contact_email: 'ana.compra@prueba.test', total: '4500.00' }) // pagada, el aviso nunca llegó
const oError = orden({ contact_email: 'cuenta@prueba.test', total: '1000.00' })
fs.writeFileSync(CONTROL, JSON.stringify({ fallar: { [oError]: 1 } }))
await webhook(oError) // queda "error"
await conciliar()
chequear(await saldo(ana.id) === saldoAntes + 45 && (await registro(oPerdida))?.via === 'conciliacion' && (await registro(oPerdida))?.estado === 'acreditada', 'una compra cuyo aviso nunca llegó: la conciliación la acredita')
chequear((await registro(oError))?.estado === 'acreditada' && await saldo(cuenta.id) === 210, 'una que quedó en "error": la conciliación la retoma')
await conciliar()
await webhook(oPerdida)
chequear(await saldo(ana.id) === saldoAntes + 45 && await saldo(cuenta.id) === 210, 'otra corrida y el aviso tardío después: nada se acredita dos veces')

console.log('Script de revisión y recuperación')
fs.writeFileSync(WEBHOOKS, JSON.stringify([{ id: 1, event: 'order/paid', url: 'https://incomparable-zabaione-b58c21.netlify.app/api/webhooks/tiendanube', created_at: '2026-09-09T12:00:00Z' }]))
const correr = (...extra) => execFileSync('node', ['--import', './pruebas/e2e/simulaciones/todas.mjs', 'scripts/revisar-compras-tiendanube.mjs', '--negocio=peperina', `--desde=${hace(10).slice(0, 10)}`, ...extra], { encoding: 'utf8', env: { ...process.env, NEXT_PUBLIC_BASE_URL: BASE } })
const huella = async () => JSON.stringify(await prisma.cliente.findMany({ select: { id: true, puntos: true }, orderBy: { id: 'asc' } })) + await prisma.movimientoPuntos.count() + await prisma.webhookEvento.count()
const antes = await huella()
let salida = correr()
chequear(await huella() === antes, 'simulación: no cambia saldos, movimientos ni registros')
chequear(salida.includes('✗ https://incomparable-zabaione-b58c21.netlify.app/api/webhooks/tiendanube') && salida.includes(`tendría que ser ${BASE}/api/webhooks/tiendanube`), 'detecta que el aviso apunta a la dirección vieja de Netlify')
const lineaVieja = salida.split('\n').find((l) => l.includes(`#${ordenes[oVieja].number} `))
chequear(lineaVieja?.includes('acreditaría') && lineaVieja.includes('+123') && lineaVieja.includes('an***@prueba.test') && !salida.includes('ana.compra@prueba.test'), `muestra la compra de antes sin acreditar (+123) sin el email completo: "${lineaVieja?.trim()}"`)
chequear(salida.split('\n').find((l) => l.includes(`#${ordenes[o1].number} `))?.includes('acreditada (ya_acreditada)'), 'las ya acreditadas figuran como tales')
saldoAntes = await saldo(ana.id)
salida = correr('--aplicar')
const difAplicar = await saldo(ana.id) - saldoAntes
chequear(difAplicar === 623 && (await registro(oVieja))?.via === 'recuperacion' && (await registro(o6))?.via === 'recuperacion', `--aplicar: acredita la compra de antes (+123) y la del aviso rechazado por firma (+500): +${difAplicar}`)
salida = correr('--aplicar')
chequear(await saldo(ana.id) === saldoAntes + 623 && salida.includes('Puntos que se acreditarían: 0'), 'correrlo otra vez no acredita nada de nuevo')
salida = correr('--reparar-webhook')
const whs = leer(WEBHOOKS, [])
chequear(whs.length === 1 && whs[0].url === `${BASE}/api/webhooks/tiendanube` && salida.includes('Reparar: corregida'), '--reparar-webhook: corrige la dirección de la suscripción existente (sin duplicarla)')
chequear(correr().includes(`✓ ${BASE}/api/webhooks/tiendanube`), 'y después figura correcta')

console.log('Reglas del negocio')
chequear(JSON.stringify(await prisma.negocio.findMany({ select: { id: true, puntosXPeso: true }, orderBy: { id: 'asc' } })) === reglasAntes, 'la equivalencia de puntos de los negocios no cambió')

await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
