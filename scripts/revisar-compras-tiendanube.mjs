// Diagnóstico y recuperación de compras de Tiendanube que no sumaron puntos.
//
// POR DEFECTO NO CAMBIA NADA (simulación): solo lee de la base y hace GET a
// la API de Tiendanube con el token del negocio. Muestra:
//   1. La configuración: tienda conectada, a qué dirección manda Tiendanube
//      el aviso de "pedido pagado" (y si es la correcta), la última compra
//      online acreditada y cuántas por mes.
//   2. Las órdenes pagadas del período y qué haría Retornar con cada una:
//      ya acreditada, acreditaría N puntos, sin cuenta, cuenta creada
//      después de la compra, cancelada/reembolsada, etc. Sin emails completos.
//
// Solo con autorización:
//   --aplicar          acredita las órdenes que figuran "acreditaría". Es
//                      idempotente: usa la misma clave que el webhook
//                      (WebhookEvento), así que correrlo dos veces, o que el
//                      webhook llegue después, nunca acredita dos veces.
//   --enviar-mails     con --aplicar, manda el mail de "sumaste puntos".
//   --reparar-webhook  deja la suscripción order/paid de Tiendanube apuntando
//                      a la dirección correcta de Retornar (cambia la
//                      configuración de la tienda; no toca órdenes ni cupones).
//
//   DATABASE_URL=... node scripts/revisar-compras-tiendanube.mjs --negocio=peperina --desde=2026-09-01 [--hasta=2026-11-10]
import { PrismaClient } from '@prisma/client'
import { listarOrdenesPagadas, listarWebhooks, asegurarWebhookOrderPaid, urlWebhookTiendanube } from '../lib/tiendanube.js'
import { evaluarOrden, procesarOrden } from '../lib/acreditacionTiendanube.js'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.length ? v.join('=') : true]
}))
const slug = typeof args.negocio === 'string' ? args.negocio : null
const desde = new Date(`${typeof args.desde === 'string' ? args.desde : '2026-09-01'}T00:00:00-03:00`)
const hasta = typeof args.hasta === 'string' ? new Date(`${args.hasta}T23:59:59-03:00`) : new Date()
const aplicar = args.aplicar === true
const miles = (n) => Number(n).toLocaleString('es-AR')
const dia = (d) => (d ? new Date(d).toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 16) : '—')

if (!slug) {
  console.error('Falta --negocio=<slug> (por ejemplo, --negocio=peperina)')
  process.exit(1)
}
if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
  console.error('Fechas inválidas: usar --desde=AAAA-MM-DD y --hasta=AAAA-MM-DD')
  process.exit(1)
}

const prisma = new PrismaClient()
try {
  const negocio = await prisma.negocio.findFirst({ where: { slug } })
  if (!negocio) throw new Error(`No existe un negocio con slug "${slug}"`)
  console.log(`${negocio.nombre} — ${aplicar ? 'APLICANDO' : 'SIMULACIÓN (no se cambia nada)'}`)
  console.log(`Equivalencia vigente: 1 punto cada $${miles(negocio.puntosXPeso)} · negocio ${negocio.activo ? 'activo' : 'DESACTIVADO (no acredita)'}`)
  if (!negocio.tiendanubeStoreId || !negocio.tiendanubeAccessToken) throw new Error('El negocio no tiene Tiendanube conectado (falta tienda o token).')
  console.log(`Tienda ${negocio.tiendanubeStoreId}, token cargado: sí`)

  console.log('\n1. Aviso de "pedido pagado" (webhook)')
  const esperada = urlWebhookTiendanube()
  try {
    const webhooks = (await listarWebhooks(negocio)).filter((w) => w.event === 'order/paid')
    if (!webhooks.length) console.log('  ✗ La tienda NO tiene suscripción order/paid: Tiendanube no avisa ninguna compra.')
    for (const w of webhooks) console.log(`  ${w.url === esperada ? '✓' : '✗'} ${w.url}${w.url === esperada ? '' : `  (tendría que ser ${esperada})`}  · creada ${dia(w.created_at)}`)
    if (args['reparar-webhook'] === true) console.log(`  → Reparar: ${await asegurarWebhookOrderPaid(negocio, esperada)}`)
  } catch (error) {
    console.log(`  No se pudo leer de Tiendanube: ${error.message.slice(0, 200)}`)
    console.log('  (401/403: el token del negocio ya no es válido; hay que volver a conectar la tienda.)')
  }

  const ultima = await prisma.movimientoPuntos.findFirst({ where: { negocioId: negocio.id, origen: 'tiendanube' }, orderBy: { createdAt: 'desc' } })
  console.log(`  Última compra online acreditada: ${dia(ultima?.createdAt)}`)
  const porMes = await prisma.$queryRaw`
    SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'America/Argentina/Buenos_Aires'), 'YYYY-MM') AS mes, count(*)::int AS n
    FROM "MovimientoPuntos" WHERE "negocioId" = ${negocio.id} AND origen = 'tiendanube' GROUP BY 1 ORDER BY 1`
  console.log(`  Compras online acreditadas por mes: ${porMes.map((m) => `${m.mes}: ${m.n}`).join(' · ') || 'ninguna'}`)
  try {
    const estados = await prisma.ordenTiendanube.groupBy({ by: ['estado'], where: { negocioId: negocio.id }, _count: true })
    if (estados.length) console.log(`  Órdenes registradas desde el cambio: ${estados.map((e) => `${e.estado} ${e._count}`).join(' · ')}`)
  } catch {
    console.log('  (La tabla OrdenTiendanube todavía no existe en esta base: falta la migración.)')
  }

  console.log(`\n2. Órdenes pagadas del ${dia(desde).slice(0, 10)} al ${dia(hasta).slice(0, 10)}`)
  const { ordenes, completo } = await listarOrdenesPagadas(negocio, { desde, hasta, maxPaginas: 50 })
  const delPeriodo = ordenes.filter((o) => new Date(o.created_at) >= desde && new Date(o.created_at) <= hasta)
  if (!completo) console.log('  ⚠ Listado incompleto (demasiadas páginas): acotar el período con --desde/--hasta.')
  const conteo = {}
  const aAcreditar = []
  for (const orden of delPeriodo.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
    const ev = await evaluarOrden(prisma, negocio, orden)
    const clave = ev.estado === 'acreditar' ? 'acreditaría' : ev.estado
    conteo[clave] = (conteo[clave] || 0) + 1
    if (ev.estado === 'acreditar') aAcreditar.push({ orden, ev })
    const puntos = ev.estado === 'acreditar' ? `+${miles(ev.puntos)}` : ''
    console.log(`  #${ev.numero ?? ev.orderId}  ${dia(orden.created_at)}  $${miles(ev.total ?? orden.total)}  ${clave}${ev.motivo ? ` (${ev.motivo})` : ''} ${puntos}  ${ev.emailOculto || ''}${ev.clienteId ? `  cuenta ${ev.clienteId.slice(-6)}` : ''}`)
  }
  console.log(`\n  Resumen: ${delPeriodo.length} orden(es) pagada(s) · ${Object.entries(conteo).map(([k, v]) => `${k} ${v}`).join(' · ') || 'nada'}`)
  console.log(`  Puntos que se acreditarían: ${miles(aAcreditar.reduce((t, x) => t + x.ev.puntos, 0))} a ${new Set(aAcreditar.map((x) => x.ev.clienteId)).size} clienta(s)`)
  console.log('  "sin_cliente": ningún email ni celular de la orden coincide con una cuenta del negocio (revisar si la clienta usó otro email).')
  console.log('  "cuenta_posterior": la cuenta se creó después de pagar; por las reglas actuales no suma.')

  if (aplicar && aAcreditar.length) {
    console.log('\n3. Aplicando')
    const { enviarEmailPuntosAcreditados } = args['enviar-mails'] === true ? await import('../lib/email.js') : {}
    for (const { orden } of aAcreditar) {
      const r = await procesarOrden(prisma, negocio, orden, { via: 'recuperacion' })
      console.log(`  #${orden.number ?? orden.id}: ${r.estado}${r.duplicada ? ' (ya estaba)' : r.puntos ? ` +${miles(r.puntos)}` : ''}`)
      if (enviarEmailPuntosAcreditados && r.estado === 'acreditada' && !r.duplicada) {
        await enviarEmailPuntosAcreditados({ email: r.cliente.email, puntosAcreditados: r.puntos, puntosTotales: r.puntosTotales, negocioNombre: negocio.nombre, negocioId: negocio.id }).catch((e) => console.log(`    mail no enviado: ${e.message}`))
      }
    }
  } else if (!aplicar) {
    console.log('\nSimulación: no se modificó nada.')
  }
} catch (error) {
  console.error(`Error: ${error.message}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
