import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { clasificarOrden, emailsDeOrden, celularesDeOrden, claveIdempotencia, ESTADOS_FINALES, ESTADOS_A_REVISAR } from './acreditacionTiendanube.js'
import { asegurarWebhookOrderPaid, listarOrdenesPagadas, obtenerOrden, urlWebhookTiendanube } from './tiendanube.js'

test('clasificarOrden: pagada, pendiente, cancelada, reembolsada, incompleta', () => {
  const pagada = clasificarOrden({ payment_status: 'paid', status: 'open', total: '12500.50', paid_at: '2026-11-01T12:00:00Z' })
  assert.equal(pagada.estado, 'pagada')
  assert.equal(pagada.total, 12500.5)
  assert.equal(pagada.pagadaEn.toISOString(), '2026-11-01T12:00:00.000Z')
  assert.equal(clasificarOrden({ payment_status: 'paid', total: '100', created_at: '2026-11-02T00:00:00Z' }).pagadaEn.toISOString(), '2026-11-02T00:00:00.000Z')
  for (const p of ['pending', 'authorized', 'in_process', '', undefined]) assert.equal(clasificarOrden({ payment_status: p, total: '100' }).estado, 'pendiente_pago')
  for (const p of ['refunded', 'voided', 'abandoned']) assert.equal(clasificarOrden({ payment_status: p, total: '100' }).estado, 'reembolsada')
  assert.equal(clasificarOrden({ payment_status: 'paid', status: 'cancelled', total: '100' }).estado, 'cancelada')
  assert.equal(clasificarOrden({ payment_status: 'paid', total: 'abc' }).estado, 'incompleta')
  assert.equal(clasificarOrden(null).estado, 'pendiente_pago')
})

test('emailsDeOrden: contacto y cuenta de la tienda, normalizados y sin repetir', () => {
  assert.deepEqual(emailsDeOrden({ contact_email: '  Ana@Gmail.COM ', customer: { email: 'ana@gmail.com' } }), ['ana@gmail.com'])
  assert.deepEqual(emailsDeOrden({ contact_email: 'compra@x.com', customer: { email: 'Cuenta@X.com' } }), ['compra@x.com', 'cuenta@x.com'])
  assert.deepEqual(emailsDeOrden({ contact_email: '', customer: null }), [])
})

test('celularesDeOrden: solo números con suficientes dígitos, sin repetir', () => {
  assert.deepEqual(celularesDeOrden({ contact_phone: '+54 9 2324 50-0294', customer: { phone: '+54 9 2324 50-0294' }, billing_phone: '123' }), ['+54 9 2324 50-0294'])
  assert.deepEqual(celularesDeOrden({}), [])
})

test('claveIdempotencia: la misma que usaba el webhook (tienda:orden)', () => {
  assert.equal(claveIdempotencia('820719', 123), '820719:123')
})

test('estados: los finales no se reintentan; pendientes, sin cuenta y errores sí', () => {
  for (const e of ESTADOS_A_REVISAR) assert.ok(!ESTADOS_FINALES.includes(e))
  assert.ok(ESTADOS_FINALES.includes('acreditada'))
})

// --- Tiendanube (fetch simulado: nunca se llama a la API real) ---
const negocio = { tiendanubeStoreId: '820719', tiendanubeAccessToken: 'token-de-prueba' }
const fetchOriginal = globalThis.fetch
afterEach(() => { globalThis.fetch = fetchOriginal })
function simular(responder) {
  const llamadas = []
  globalThis.fetch = async (url, opciones = {}) => {
    llamadas.push({ url, metodo: opciones.method || 'GET', cuerpo: opciones.body ? JSON.parse(opciones.body) : null })
    const [status, cuerpo] = responder(url, opciones, llamadas.length)
    return new Response(JSON.stringify(cuerpo), { status })
  }
  return llamadas
}

test('urlWebhookTiendanube: siempre el dominio público, nunca el del navegador', () => {
  const antes = process.env.NEXT_PUBLIC_BASE_URL
  delete process.env.NEXT_PUBLIC_BASE_URL
  assert.equal(urlWebhookTiendanube(), 'https://retornar.com.ar/api/webhooks/tiendanube')
  process.env.NEXT_PUBLIC_BASE_URL = 'https://otro.test/'
  assert.equal(urlWebhookTiendanube(), 'https://otro.test/api/webhooks/tiendanube')
  if (antes === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
  else process.env.NEXT_PUBLIC_BASE_URL = antes
})

test('asegurarWebhookOrderPaid: ya estaba / corrige la dirección vieja / crea', async () => {
  const url = 'https://retornar.com.ar/api/webhooks/tiendanube'
  let l = simular(() => [200, [{ id: 5, event: 'order/paid', url }]])
  assert.equal(await asegurarWebhookOrderPaid(negocio, url), 'ya_estaba')
  assert.equal(l.length, 1)
  l = simular((u, o) => (o.method === 'PUT' ? [200, {}] : [200, [{ id: 7, event: 'order/paid', url: 'https://incomparable-zabaione-b58c21.netlify.app/api/webhooks/tiendanube' }, { id: 8, event: 'order/created', url: 'https://otra.app/x' }]]))
  assert.equal(await asegurarWebhookOrderPaid(negocio, url), 'corregida')
  assert.equal(l[1].metodo, 'PUT')
  assert.match(l[1].url, /\/820719\/webhooks\/7$/)
  assert.deepEqual(l[1].cuerpo, { event: 'order/paid', url })
  l = simular((u, o) => (o.method === 'POST' ? [201, {}] : [200, [{ id: 9, event: 'order/paid', url: 'https://otra.app/webhook' }]]))
  assert.equal(await asegurarWebhookOrderPaid(negocio, url), 'creada')
  assert.equal(l[1].metodo, 'POST')
})

test('listarOrdenesPagadas: pagina hasta una página incompleta, con filtros de pago y fecha', async () => {
  const l = simular((u, o, n) => [200, n === 1 ? Array.from({ length: 200 }, (_, i) => ({ id: i })) : [{ id: 999 }]])
  const r = await listarOrdenesPagadas(negocio, { desde: '2026-11-01T00:00:00Z' })
  assert.equal(r.ordenes.length, 201)
  assert.equal(r.completo, true)
  const q = new URL(l[0].url).searchParams
  assert.equal(q.get('payment_status'), 'paid')
  assert.equal(q.get('updated_at_min'), '2026-11-01T00:00:00.000Z')
  assert.equal(new URL(l[1].url).searchParams.get('page'), '2')
})

test('listarOrdenesPagadas: el 404 de "no hay más páginas" termina bien; un error real corta', async () => {
  simular((u, o, n) => (n === 1 ? [200, Array.from({ length: 200 }, (_, i) => ({ id: i }))] : [404, { message: 'Last page is 1' }]))
  assert.equal((await listarOrdenesPagadas(negocio, {})).completo, true)
  simular(() => [500, {}])
  await assert.rejects(listarOrdenesPagadas(negocio, {}), /500/)
})

test('obtenerOrden: pide la orden de esa tienda; un error de Tiendanube es una excepción', async () => {
  const l = simular(() => [200, { id: 42 }])
  assert.deepEqual(await obtenerOrden(negocio, 42), { id: 42 })
  assert.match(l[0].url, /\/820719\/orders\/42$/)
  simular(() => [503, {}])
  await assert.rejects(obtenerOrden(negocio, 42), /503/)
})
