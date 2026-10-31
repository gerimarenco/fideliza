import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { obtenerPrecioProducto, crearCuponProductoGratis, crearCuponPorcentaje, crearCuponMontoFijo, codigoCuponDeCanje, datosOrdenAcreditable, listarCupones, siguienteDeLink } from './tiendanube.js'

// Nunca se llama a Tiendanube de verdad: se reemplaza fetch y se mira qué
// se le habría mandado.
const negocio = { tiendanubeStoreId: '820719', tiendanubeAccessToken: 'token-de-prueba' }
let llamadas
let respuesta
const fetchOriginal = globalThis.fetch

beforeEach(() => {
  llamadas = []
  respuesta = { ok: true, status: 201, body: {} }
  globalThis.fetch = async (url, opciones = {}) => {
    llamadas.push({ url, opciones, body: opciones.body ? JSON.parse(opciones.body) : null })
    return {
      ok: respuesta.ok,
      status: respuesta.status,
      json: async () => respuesta.body,
      text: async () => JSON.stringify(respuesta.body),
    }
  }
})
afterEach(() => { globalThis.fetch = fetchOriginal })

test('código del cupón: determinístico por canje, así un reintento nunca crea un segundo cupón', () => {
  assert.equal(codigoCuponDeCanje('clxyz1234abcdefgh'), 'RETORNAR-ABCDEFGH')
  assert.equal(codigoCuponDeCanje('clxyz1234abcdefgh'), codigoCuponDeCanje('clxyz1234abcdefgh'))
})

test('producto gratis: cupón por el precio del producto, con ese mismo piso de compra y un solo uso', async () => {
  const codigo = await crearCuponProductoGratis(negocio, 'canje00000001', 35000)
  assert.equal(codigo, 'RETORNAR-00000001')
  const { url, opciones, body } = llamadas[0]
  assert.equal(url, 'https://api.tiendanube.com/2025-03/820719/coupons')
  assert.equal(opciones.method, 'POST')
  assert.equal(opciones.headers.Authorization, 'Bearer token-de-prueba')
  assert.deepEqual(body, { code: 'RETORNAR-00000001', type: 'absolute', value: '35000.00', min_price: 35000, max_uses: 1, valid: true })
})

test('porcentaje: cupón porcentual de un solo uso, sin piso', async () => {
  await crearCuponPorcentaje(negocio, 'canje00000002', 10)
  assert.deepEqual(llamadas[0].body, { code: 'RETORNAR-00000002', type: 'percentage', value: '10.00', max_uses: 1, valid: true })
})

test('monto fijo con compra mínima: el piso es la compra mínima, no el monto', async () => {
  await crearCuponMontoFijo(negocio, 'canje00000003', 70000, 140000)
  assert.deepEqual(llamadas[0].body, { code: 'RETORNAR-00000003', type: 'absolute', value: '70000.00', min_price: 140000, max_uses: 1, valid: true })
})

test('monto fijo con compra mínima que no supera el monto: se rechaza antes de llamar a Tiendanube', async () => {
  await assert.rejects(crearCuponMontoFijo(negocio, 'canje00000004', 70000, null), /compra mínima/)
  await assert.rejects(crearCuponMontoFijo(negocio, 'canje00000004', 70000, 70000), /compra mínima/)
  assert.equal(llamadas.length, 0)
})

test('error de Tiendanube: se propaga con el status, para guardarlo en el canje', async () => {
  respuesta = { ok: false, status: 422, body: { code: ['has already been taken'] } }
  await assert.rejects(crearCuponPorcentaje(negocio, 'canje00000005', 10), /422/)
})

test('precio del producto: toma la primera variante y rechaza un precio inválido', async () => {
  respuesta = { ok: true, status: 200, body: { variants: [{ price: '35000.00' }, { price: '39000.00' }] } }
  assert.equal(await obtenerPrecioProducto(negocio, '123'), 35000)
  assert.equal(llamadas[0].url, 'https://api.tiendanube.com/2025-03/820719/products/123')

  respuesta = { ok: true, status: 200, body: { variants: [{ price: null }] } }
  await assert.rejects(obtenerPrecioProducto(negocio, '123'), /precio válido/)

  respuesta = { ok: false, status: 404, body: { description: 'Not found' } }
  await assert.rejects(obtenerPrecioProducto(negocio, '999'), /404/)
})

test('datosOrdenAcreditable: solo órdenes pagadas con email y total', () => {
  assert.deepEqual(datosOrdenAcreditable({ payment_status: 'paid', contact_email: ' Lucia@Gmail.com ', total: '12500.50' }), { email: 'lucia@gmail.com', total: 12500.5 })
  for (const estado of ['pending', 'authorized', 'voided', 'refunded', 'abandoned', undefined]) {
    assert.deepEqual(datosOrdenAcreditable({ payment_status: estado, contact_email: 'a@b.com', total: '100' }), { motivo: 'no_pagada' })
  }
  assert.deepEqual(datosOrdenAcreditable({ payment_status: 'paid', contact_email: '', total: '100' }), { motivo: 'incompleta' })
  assert.deepEqual(datosOrdenAcreditable({ payment_status: 'paid', contact_email: 'a@b.com', total: 'abc' }), { motivo: 'incompleta' })
  assert.deepEqual(datosOrdenAcreditable(null), { motivo: 'no_pagada' })
  assert.deepEqual(datosOrdenAcreditable({ payment_status: 'paid', status: 'cancelled', contact_email: 'a@b.com', total: '100' }), { motivo: 'cancelada' })
  assert.deepEqual(datosOrdenAcreditable({ payment_status: 'paid', status: 'open', contact_email: 'a@b.com', total: '100' }), { email: 'a@b.com', total: 100 })
})

// --- Listado de cupones (GET /coupons) con la paginación de Tiendanube ---

const BASE = 'https://api.tiendanube.com/2025-03/820719/coupons'
const cupon = (i) => ({ id: i, code: `RETORNAR-${String(i).padStart(8, '0')}`, used: 0, max_uses: 1, valid: true })

// Tienda simulada: `porPagina` cupones por página (aunque se pidan 200),
// con encabezados Link (next/last) y x-total-count opcionales.
function tiendaPaginada(total, { porPagina = 200, conLink = true, conTotal = true, totalPorPagina } = {}) {
  const todos = Array.from({ length: total }, (_, i) => cupon(i + 1))
  const ultima = Math.max(1, Math.ceil(total / porPagina))
  globalThis.fetch = async (url) => {
    llamadas.push({ url })
    const pagina = Number(new URL(url).searchParams.get('page'))
    const encabezados = {}
    if (conTotal) encabezados['x-total-count'] = String(totalPorPagina ? totalPorPagina(pagina) : total)
    if (conLink) {
      const partes = []
      if (pagina < ultima) partes.push(`<${BASE}?page=${pagina + 1}&per_page=200>; rel="next"`)
      partes.push(`<${BASE}?page=${ultima}&per_page=200>; rel="last"`)
      encabezados.link = partes.join(', ')
    }
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => encabezados[k.toLowerCase()] ?? null },
      json: async () => todos.slice((pagina - 1) * porPagina, pagina * porPagina),
      text: async () => '',
    }
  }
}

test('siguienteDeLink: toma la URL rel="next" del encabezado Link', () => {
  assert.equal(siguienteDeLink(`<${BASE}?page=2&per_page=200>; rel="next", <${BASE}?page=5&per_page=200>; rel="last"`), `${BASE}?page=2&per_page=200`)
  assert.equal(siguienteDeLink(`<${BASE}?page=1>; rel="first", <${BASE}?page=3>; rel="prev"`), null)
  assert.equal(siguienteDeLink(null), null)
  assert.equal(siguienteDeLink(''), null)
})

test('listarCupones: páginas de menos de 200 no cortan la lectura; sigue Link hasta el final', async () => {
  tiendaPaginada(95, { porPagina: 30 })
  const { cupones, completo, total } = await listarCupones(negocio)
  assert.equal(cupones.length, 95)
  assert.equal(total, 95)
  assert.equal(completo, true)
  assert.equal(llamadas.length, 4)
  assert.equal(llamadas[0].url, `${BASE}?per_page=200&page=1`)
  assert.equal(llamadas[3].url, `${BASE}?per_page=200&page=4`)
})

test('listarCupones: más de 200 cupones, varias páginas completas', async () => {
  tiendaPaginada(450)
  const { cupones, completo } = await listarCupones(negocio)
  assert.equal(cupones.length, 450)
  assert.equal(completo, true)
  assert.equal(llamadas.length, 3)
})

test('listarCupones: sin Link pero con x-total-count, completo solo si coincide el total', async () => {
  // La tienda dice 300 pero sin Link no hay cómo pedir la siguiente página.
  tiendaPaginada(300, { conLink: false })
  const r = await listarCupones(negocio)
  assert.equal(r.cupones.length, 200)
  assert.equal(r.completo, false)

  tiendaPaginada(40, { conLink: false })
  assert.equal((await listarCupones(negocio)).completo, true)
})

test('listarCupones: sin Link ni x-total-count no se puede asegurar que esté completo', async () => {
  tiendaPaginada(40, { conLink: false, conTotal: false })
  const r = await listarCupones(negocio)
  assert.equal(r.cupones.length, 40)
  assert.equal(r.completo, false)
})

test('listarCupones: solo Link (sin x-total-count), completo al llegar a la última página', async () => {
  tiendaPaginada(250, { conTotal: false })
  const r = await listarCupones(negocio)
  assert.equal(r.cupones.length, 250)
  assert.equal(r.completo, true)
})

test('listarCupones: si el total cambia entre páginas (cupones creados o borrados mientras se lee), no está completo', async () => {
  tiendaPaginada(400, { totalPorPagina: (p) => (p === 1 ? 401 : 400) })
  assert.equal((await listarCupones(negocio)).completo, false)
})

test('listarCupones: si se leyeron menos cupones que el total informado, no está completo', async () => {
  tiendaPaginada(100, { porPagina: 50, totalPorPagina: () => 120 })
  const r = await listarCupones(negocio)
  assert.equal(r.cupones.length, 100)
  assert.equal(r.completo, false)
})

test('listarCupones: corta en maxPaginas y lo informa como incompleto', async () => {
  tiendaPaginada(100, { porPagina: 10 })
  const r = await listarCupones(negocio, { maxPaginas: 3 })
  assert.equal(r.cupones.length, 30)
  assert.equal(r.completo, false)
})

test('listarCupones: de un enlace a otro dominio solo toma el número de página; el token nunca sale de la tienda', async () => {
  globalThis.fetch = async (url) => {
    llamadas.push({ url })
    const pagina = Number(new URL(url).searchParams.get('page'))
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => ({ link: pagina === 1 ? '<https://otro.example/coupons?page=2>; rel="next"' : '<https://otro.example/coupons?page=1>; rel="first"', 'x-total-count': '2' })[k.toLowerCase()] ?? null },
      json: async () => [cupon(pagina)],
      text: async () => '',
    }
  }
  const r = await listarCupones(negocio)
  assert.deepEqual(llamadas.map((l) => l.url), [`${BASE}?per_page=200&page=1`, `${BASE}?per_page=200&page=2`])
  assert.equal(r.completo, true)
})

test('listarCupones: un `next` que no es la página siguiente no se sigue y el listado queda incompleto', async () => {
  globalThis.fetch = async (url) => {
    llamadas.push({ url })
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => ({ link: `<${BASE}?page=5&per_page=200>; rel="next"`, 'x-total-count': '1' })[k.toLowerCase()] ?? null },
      json: async () => [cupon(1)],
      text: async () => '',
    }
  }
  const r = await listarCupones(negocio)
  assert.equal(llamadas.length, 1)
  assert.equal(r.completo, false)
})

test('listarCupones: sin x-total-count, si la última página no trae Link no se puede asegurar que sea la última', async () => {
  globalThis.fetch = async (url) => {
    llamadas.push({ url })
    const pagina = Number(new URL(url).searchParams.get('page'))
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === 'link' && pagina === 1 ? `<${BASE}?page=2&per_page=200>; rel="next"` : null) },
      json: async () => [cupon(pagina)],
      text: async () => '',
    }
  }
  const r = await listarCupones(negocio)
  assert.equal(r.cupones.length, 2)
  assert.equal(r.completo, false)
})

test('listarCupones: listado completo sin ningún cupón usado', async () => {
  tiendaPaginada(3)
  const r = await listarCupones(negocio)
  assert.equal(r.completo, true)
  assert.ok(r.cupones.every((c) => c.used === 0))
})

test('listarCupones: un error de Tiendanube en cualquier página se propaga (no se toma como lista vacía)', async () => {
  tiendaPaginada(300)
  const fetchPaginado = globalThis.fetch
  globalThis.fetch = async (url) => (url.includes('page=2') ? { ok: false, status: 503, text: async () => 'caído' } : fetchPaginado(url))
  await assert.rejects(listarCupones(negocio), /503/)
})
