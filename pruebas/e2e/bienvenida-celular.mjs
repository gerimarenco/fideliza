// Bonificación de bienvenida: una sola por persona en cada negocio. Si el
// celular de la cuenta nueva ya está en otra cuenta del negocio (también una
// histórica sin bonificación), la cuenta se crea igual pero sin los puntos, y
// queda el motivo (Cliente.bienvenidaMotivo). La misma regla en el script
// retroactivo. Base local descartable; nunca producción.
//
// Correr con: node --import ./pruebas/e2e/simulaciones/todas.mjs pruebas/e2e/bienvenida-celular.mjs
// (ver pruebas/e2e/README.md). Suite nueva (2026-10-31), no estaba antes fuera del repo.
import { execFileSync } from 'node:child_process'
import { BASE } from './entorno.mjs'
import { PrismaClient } from '@prisma/client'
import { acreditarBienvenida } from '../../lib/bienvenida.js'

const prisma = new PrismaClient()
let ok = 0, mal = 0
const chequear = (c, t) => { if (c) { ok++; console.log('  ok  ', t) } else { mal++; console.log('  MAL ', t) } }
const H = 3600 * 1000
await prisma.$executeRawUnsafe('TRUNCATE "IntentoLogin"')

const pep = await prisma.negocio.update({ where: { slug: 'peperina' }, data: { bienvenidaPuntos: 150, bienvenidaDesde: new Date(Date.now() - 48 * H), bienvenidaHasta: new Date(Date.now() + 48 * H) } })
const demo = await prisma.negocio.update({ where: { email: 'demo@prueba.test' }, data: { slug: 'demo', activo: true } })
let dniPrueba = 37100000
async function registrar(negocio, email, telefono) {
  const res = await fetch(`${BASE}/api/registro/${negocio}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: 'Prueba Celular', email, password: 'clienta-123', fechaNacimiento: '1991-01-01', telefono, dni: String(++dniPrueba) }) })
  return { status: res.status, cuerpo: await res.json().catch(() => ({})) }
}
const cuenta = (email) => prisma.cliente.findFirst({ where: { email } })
const movsBienvenida = async (email) => { const c = await cuenta(email); return c ? prisma.movimientoPuntos.count({ where: { clienteId: c.id, origen: 'bienvenida' } }) : -1 }
const foto = async () => JSON.stringify(await prisma.$queryRawUnsafe('SELECT md5(string_agg(id || \':\' || puntos || \':\' || "bienvenidaOtorgada" || \':\' || coalesce("bienvenidaMotivo", \'\'), \',\' ORDER BY id)) AS c, (SELECT count(*) FROM "MovimientoPuntos")::int AS m, (SELECT md5(coalesce(string_agg(id || \':\' || puntos || \':\' || coalesce("saldoRestante"::text, \'\'), \',\' ORDER BY id), \'\')) FROM "MovimientoPuntos") AS mm FROM "Cliente"'))

// Una clienta histórica (septiembre), sin DNI ni bonificación, con 800 puntos.
const historica = await prisma.cliente.create({ data: { nombre: 'Histórica', email: 'historica.cel@prueba.test', password: 'x', negocioId: pep.id, telefono: '2324-70-0001', puntos: 800, createdAt: new Date('2026-09-15T12:00:00Z') } })
await prisma.movimientoPuntos.create({ data: { clienteId: historica.id, negocioId: pep.id, puntos: 800, origen: 'dragonfish', saldoRestante: 800, createdAt: new Date('2026-09-15T12:00:00Z') } })
const historicaAntes = JSON.stringify(await prisma.cliente.findUnique({ where: { id: historica.id } }))
const movsHistoricaAntes = JSON.stringify(await prisma.movimientoPuntos.findMany({ where: { clienteId: historica.id }, orderBy: { id: 'asc' } }))

console.log('1. Cuenta histórica sin DNI y mismo celular')
let r = await registrar('peperina', 'historica.nueva@prueba.test', '549 2324 70 0001')
let c = await cuenta('historica.nueva@prueba.test')
chequear(r.status === 201 && c && r.cuerpo.puntosBienvenida === 0 && c.puntos === 0 && !c.bienvenidaOtorgada && (await movsBienvenida('historica.nueva@prueba.test')) === 0, 'se crea la cuenta, sin los 150 puntos')
chequear(c?.bienvenidaMotivo === 'celular_en_otra_cuenta', `queda el motivo en la cuenta: "${c?.bienvenidaMotivo}"`)
chequear(!JSON.stringify(r.cuerpo).includes('celular') && !('motivo' in r.cuerpo), 'la respuesta no dice el motivo (revelaría que ese celular tiene otra cuenta)')
chequear(JSON.stringify(await prisma.cliente.findUnique({ where: { id: historica.id } })) === historicaAntes && JSON.stringify(await prisma.movimientoPuntos.findMany({ where: { clienteId: historica.id }, orderBy: { id: 'asc' } })) === movsHistoricaAntes, 'la cuenta histórica no cambió: puntos y movimientos intactos')

console.log('2. Cuenta histórica sin DNI y celular diferente')
r = await registrar('peperina', 'historica.otrocel@prueba.test', '2324700002')
c = await cuenta('historica.otrocel@prueba.test')
chequear(r.status === 201 && r.cuerpo.puntosBienvenida === 150 && c.puntos === 150 && c.bienvenidaOtorgada && c.bienvenidaMotivo === null && (await movsBienvenida('historica.otrocel@prueba.test')) === 1, 'con un celular que no tiene otra cuenta: 150 puntos, un movimiento, sin motivo')

console.log('3. Dos personas que comparten celular')
r = await registrar('peperina', 'mama@prueba.test', '2324700003')
const mama = await cuenta('mama@prueba.test')
r = await registrar('peperina', 'hija@prueba.test', '2324 70-0003')
const hija = await cuenta('hija@prueba.test')
chequear(mama?.puntos === 150 && r.status === 201 && hija && hija.puntos === 0 && hija.bienvenidaMotivo === 'celular_en_otra_cuenta', 'la segunda persona se registra igual (no se bloquea la cuenta), pero sin los puntos automáticos y con el motivo')
chequear(hija?.email === 'hija@prueba.test' && hija.password && hija.negocioId === pep.id, 'la cuenta de la segunda persona queda creada normalmente en Peperina')

console.log('4. Dos registros simultáneos con el mismo celular')
const simultaneos = await Promise.all(['sim.a@prueba.test', 'sim.b@prueba.test', 'sim.c@prueba.test'].map((email) => registrar('peperina', email, '2324700004')))
const cuentasSim = await prisma.cliente.findMany({ where: { email: { in: ['sim.a@prueba.test', 'sim.b@prueba.test', 'sim.c@prueba.test'] } } })
const conBienvenida = cuentasSim.filter((x) => x.bienvenidaOtorgada)
chequear(simultaneos.every((x) => x.status === 201) && cuentasSim.length === 3, `las 3 cuentas se crean (${simultaneos.map((x) => x.status).join(',')})`)
chequear(conBienvenida.length === 1 && cuentasSim.filter((x) => x.bienvenidaMotivo === 'celular_en_otra_cuenta').length === 2 && cuentasSim.reduce((s, x) => s + x.puntos, 0) === 150, 'una sola recibe los 150; las otras dos quedan con el motivo')
chequear((await prisma.movimientoPuntos.count({ where: { clienteId: { in: cuentasSim.map((x) => x.id) }, origen: 'bienvenida' } })) === 1, 'un solo movimiento de bienvenida entre las tres')

console.log('5. Dos negocios diferentes')
await prisma.cliente.create({ data: { nombre: 'De Demo', email: 'de.demo@prueba.test', password: 'x', negocioId: demo.id, telefono: '2324700005', createdAt: new Date('2026-09-01T12:00:00Z') } })
r = await registrar('peperina', 'cel.de.demo@prueba.test', '2324700005')
c = await cuenta('cel.de.demo@prueba.test')
chequear(r.status === 201 && c.puntos === 150 && c.bienvenidaMotivo === null, 'un celular que solo existe en otro negocio no impide la bienvenida en Peperina')
r = await registrar('demo', 'otra.en.demo@prueba.test', '2324700006')
chequear(r.status === 201 && (await cuenta('otra.en.demo@prueba.test')).puntos === 0 && (await cuenta('otra.en.demo@prueba.test')).bienvenidaMotivo === null, 'la promo de Peperina no se paga en otro negocio (y no deja motivo: allá no hay promo)')

console.log('7. Una cuenta que ya recibió la bienvenida')
const yaTenia = await cuenta('historica.otrocel@prueba.test')
const repetida = await prisma.$transaction((tx) => acreditarBienvenida(tx, yaTenia, pep, 150))
const yaTeniaDespues = await cuenta('historica.otrocel@prueba.test')
chequear(repetida.puntos === 0 && yaTeniaDespues.puntos === 150 && (await movsBienvenida('historica.otrocel@prueba.test')) === 1, `acreditar de nuevo a una cuenta que ya la tiene no suma nada (${repetida.motivo})`)
r = await registrar('peperina', 'historica.otrocel@prueba.test', '2324700099')
chequear(r.status === 409, 'registrarse otra vez con el mismo email: rechazado')
r = await registrar('peperina', 'otra.vez@prueba.test', '2324700002')
chequear(r.status === 201 && (await cuenta('otra.vez@prueba.test')).puntos === 0, 'otra cuenta con el celular de quien ya la cobró: sin puntos')

console.log('6. Script retroactivo: misma regla e idempotente')
// Cuentas del período creadas "antes de publicar" (sin bonificación todavía).
const ayer = new Date(Date.now() - 24 * H)
const mk = (email, telefono, minutos) => prisma.cliente.create({ data: { nombre: 'Retro', email, password: 'x', negocioId: pep.id, telefono, fechaNacimiento: new Date('1990-01-01'), createdAt: new Date(ayer.getTime() + minutos * 60000) } })
await mk('retro.nueva@prueba.test', '2324700010', 0)          // celular nuevo → sí
await mk('retro.historica@prueba.test', '2324700001', 1)      // celular de la histórica de septiembre → no
await mk('retro.primera@prueba.test', '2324700011', 2)        // primera con este celular → sí
await mk('retro.segunda@prueba.test', '2324700011', 3)        // segunda con el mismo celular → no
await prisma.cliente.create({ data: { nombre: 'Manual', email: 'retro.manual@prueba.test', password: 'x', negocioId: pep.id, telefono: '2324700012', createdAt: new Date(ayer.getTime() + 4 * 60000) } }) // alta manual → no se considera
const hasta = new Date().toISOString()
const correr = (...extra) => execFileSync('node', ['scripts/bienvenida-retroactiva.mjs', `--hasta=${hasta}`, ...extra], { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' })
const antesSim = await foto()
const sim = correr()
chequear((await foto()) === antesSim, 'la simulación no escribe nada')
// Además de estas, el período incluye las cuentas registradas arriba en esta
// misma prueba que quedaron sin bonificación por el celular (5): también se
// reevalúan y siguen sin recibirla.
const sinPorCelular = Number(sim.match(/celular ya está en otra cuenta del negocio: (\d+)/)?.[1])
chequear(/Recibirían la bonificación: 2 cuenta/.test(sim) && sinPorCelular === 7, `la simulación aplica la regla: 2 recibirían; ${sinPorCelular} no, por el celular (las 2 del período + las 5 de arriba)`)
const ap1 = correr('--aplicar')
const retro = Object.fromEntries(await Promise.all(['retro.nueva', 'retro.historica', 'retro.primera', 'retro.segunda', 'retro.manual'].map(async (x) => [x, await cuenta(`${x}@prueba.test`)])))
chequear(/Acreditadas: 2 cuenta/.test(ap1) && retro['retro.nueva'].puntos === 150 && retro['retro.primera'].puntos === 150, 'al aplicar: las 2 elegibles reciben 150')
chequear(retro['retro.historica'].puntos === 0 && retro['retro.historica'].bienvenidaMotivo === 'celular_en_otra_cuenta' && retro['retro.segunda'].puntos === 0 && retro['retro.segunda'].bienvenidaMotivo === 'celular_en_otra_cuenta', 'las 2 con celular de otra cuenta: sin puntos y con el motivo guardado')
chequear(retro['retro.manual'].puntos === 0 && retro['retro.manual'].bienvenidaMotivo === null, 'el alta manual del negocio no se toca')
const antesAp2 = await foto()
const ap2 = correr('--aplicar')
chequear(/Acreditadas: 0 cuenta/.test(ap2) && (await foto()) === antesAp2, 'correrlo otra vez no acredita ni cambia nada')
chequear(JSON.stringify(await prisma.cliente.findUnique({ where: { id: historica.id } })) === historicaAntes && JSON.stringify(await prisma.movimientoPuntos.findMany({ where: { clienteId: historica.id }, orderBy: { id: 'asc' } })) === movsHistoricaAntes, 'la histórica sigue intacta después de todo')

await prisma.$disconnect()
console.log(`\n${ok} ok, ${mal} mal`)
process.exit(mal ? 1 : 0)
