import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { obtenerProducto, valorCuponDeProducto, crearCuponDeProducto, crearCuponPorcentaje, crearCuponMontoFijo, codigoCuponDeCanje, codigoCuponConEtiqueta, etiquetaCupon, productosDelCupon, datosOrdenAcreditable, listarCupones, siguienteDeLink } from './tiendanube.js'

// Nunca se llama a Tiendanube de verdad: se reemplaza fetch y se mira qué
// se le habría mandado.
const negocio = { tiendanubeStoreId: '820719', tiendanubeAccessToken: 'token-de-prueba' }
let llamadas
let respuesta
// Respuestas en orden para pruebas con varias llamadas (si está vacía, se
// usa `respuesta` para todas).
let respuestas
const fetchOriginal = globalThis.fetch

beforeEach(() => {
  llamadas = []
  respuesta = { ok: true, status: 201, body: {} }
  respuestas = []
  globalThis.fetch = async (url, opciones = {}) => {
    llamadas.push({ url, opciones, body: opciones.body ? JSON.parse(opciones.body) : null })
    const r = respuestas.length ? respuestas.shift() : respuesta
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
      text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)),
    }
  }
})
afterEach(() => { globalThis.fetch = fetchOriginal })

test('código del cupón: determinístico por canje, así un reintento nunca crea un segundo cupón', () => {
  assert.equal(codigoCuponDeCanje('clxyz1234abcdefgh'), 'RETORNAR-ABCDEFGH', 'formato viejo, para reintentar canjes anteriores')
  assert.equal(codigoCuponConEtiqueta('clxyz1234abcdefgh', 'Pañuelo de seda'), 'RETORNAR-PANUELO-ABCDEFGH')
  assert.equal(codigoCuponConEtiqueta('clxyz1234abcdefgh', 'Pañuelo de seda'), codigoCuponConEtiqueta('clxyz1234abcdefgh', 'Pañuelo de seda'))
})

test('etiqueta del código: primera palabra con sentido, sin tildes ni ñ', () => {
  assert.equal(etiquetaCupon('Pañuelo de seda'), 'PANUELO')
  assert.equal(etiquetaCupon('Perfume Peperina 50 ml'), 'PERFUME')
  assert.equal(etiquetaCupon('Cartera de cuero'), 'CARTERA')
  assert.equal(etiquetaCupon('10% de descuento'), 'DESCUENTO')
  assert.equal(etiquetaCupon('10% en toda la tienda'), 'TIENDA')
  assert.equal(etiquetaCupon('$5.000 OFF en tu compra'), 'COMPRA')
  assert.equal(etiquetaCupon('Aromatizante textil grande'), 'AROMATIZAN', 'máximo 10 letras')
  assert.equal(etiquetaCupon(''), 'PREMIO')
  assert.equal(etiquetaCupon('🎁'), 'PREMIO')
  assert.match(codigoCuponConEtiqueta('c' + 'x'.repeat(24), 'Árbol ñandú'), /^RETORNAR-[A-Z0-9]+-[A-Z0-9]{8}$/)
})

// Producto como lo devuelve la API: un pañuelo en tres colores.
const panuelo = (variantes) => ({ id: 111, published: true, variants: variantes })

test('valor del cupón de producto: la variante más barata con stock (decisión de Genaro)', () => {
  const todosIgual = panuelo([{ price: '29000.00', stock: 3 }, { price: '29000.00', stock: 1 }, { price: '29000.00', stock: null }])
  assert.deepEqual(valorCuponDeProducto(todosIgual), { valor: 29000, disponible: true, motivo: null }, 'todos los colores al mismo precio: ese precio')
  const distintos = panuelo([{ price: '32000.00', stock: 2 }, { price: '29000.00', stock: 5 }, { price: '30000.00', stock: 1 }])
  assert.equal(valorCuponDeProducto(distintos).valor, 29000, 'precios distintos: el más barato')
  const baratoSinStock = panuelo([{ price: '32000.00', stock: 2 }, { price: '29000.00', stock: 0 }])
  assert.equal(valorCuponDeProducto(baratoSinStock).valor, 32000, 'la variante barata sin stock no cuenta')
  const promo = panuelo([{ price: '29000.00', promotional_price: '25000.00', stock: 2 }, { price: '29000.00', promotional_price: null, stock: 2 }])
  assert.equal(valorCuponDeProducto(promo).valor, 25000, 'precio promocional vigente: es lo que se paga')
  const sinControl = panuelo([{ price: '29000.00', stock: 0, stock_management: false }])
  assert.equal(valorCuponDeProducto(sinControl).disponible, true, 'sin control de stock: siempre se puede comprar')
})

test('producto sin stock o sin publicar: no disponible (no se canjea)', () => {
  const sinStock = panuelo([{ price: '29000.00', stock: 0 }, { price: '31000.00', stock: 0 }])
  assert.deepEqual(valorCuponDeProducto(sinStock), { valor: 29000, disponible: false, motivo: 'sin_stock' })
  const oculto = { ...panuelo([{ price: '29000.00', stock: 4 }]), published: false }
  assert.deepEqual(valorCuponDeProducto(oculto), { valor: 29000, disponible: false, motivo: 'no_publicado' })
  assert.throws(() => valorCuponDeProducto(panuelo([{ price: null }])), /precio válido/)
  assert.throws(() => valorCuponDeProducto({ id: 1 }), /precio válido/)
})

test('obtenerProducto: lee el producto de la tienda', async () => {
  respuesta = { ok: true, status: 200, body: panuelo([{ price: '29000.00' }]) }
  assert.equal((await obtenerProducto(negocio, '111')).id, 111)
  assert.equal(llamadas[0].url, 'https://api.tiendanube.com/2025-03/820719/products/111')
  respuesta = { ok: false, status: 404, body: { description: 'Not found' } }
  await assert.rejects(obtenerProducto(negocio, '999'), /404/)
})

test('cupón de producto: atado al producto (products), por una unidad, con piso y un solo uso', async () => {
  respuesta = { ok: true, status: 201, body: { id: 77, code: 'RETORNAR-PANUELO-00000001', products: [{ id: 111, name: { es: 'Pañuelo' } }] } }
  const codigo = await crearCuponDeProducto(negocio, 'RETORNAR-PANUELO-00000001', '111', 29000)
  assert.equal(codigo, 'RETORNAR-PANUELO-00000001')
  const { url, opciones, body } = llamadas[0]
  assert.equal(url, 'https://api.tiendanube.com/2025-03/820719/coupons')
  assert.equal(opciones.method, 'POST')
  assert.equal(opciones.headers.Authorization, 'Bearer token-de-prueba')
  assert.deepEqual(body, { code: 'RETORNAR-PANUELO-00000001', type: 'absolute', value: '29000.00', min_price: 29000, max_uses: 1, valid: true, products: [111] })
  assert.equal(llamadas.length, 1, 'la respuesta ya confirma el producto: no hace falta otra consulta')
})

test('cupón de producto: también acepta la confirmación como lista de ids o leyendo el cupón', async () => {
  respuesta = { ok: true, status: 201, body: { id: 78, products: [111] } }
  await crearCuponDeProducto(negocio, 'RETORNAR-PANUELO-00000002', 111, 29000)
  assert.equal(llamadas.length, 1)
  respuestas = [{ ok: true, status: 201, body: { id: 79 } }, { ok: true, status: 200, body: { id: 79, products: ['111'] } }]
  llamadas = []
  await crearCuponDeProducto(negocio, 'RETORNAR-PANUELO-00000003', '111', 29000)
  assert.equal(llamadas[1].url, 'https://api.tiendanube.com/2025-03/820719/coupons/79', 'sin products en la respuesta: lo vuelve a leer')
})

test('cupón de producto: si Tiendanube no lo ató al producto, se retira y no se entrega', async () => {
  // La respuesta y la relectura no traen el producto: cupón suelto.
  respuestas = [{ ok: true, status: 201, body: { id: 80, products: [] } }, { ok: true, status: 200, body: undefined }]
  await assert.rejects(crearCuponDeProducto(negocio, 'RETORNAR-PANUELO-00000004', '111', 29000), /RESTRICCION_NO_APLICADA.*se retiró/)
  assert.equal(llamadas[1].url, 'https://api.tiendanube.com/2025-03/820719/coupons/80')
  assert.equal(llamadas[1].opciones.method, 'DELETE')

  // Atado a OTRO producto: tampoco sirve.
  llamadas = []
  respuestas = [{ ok: true, status: 201, body: { id: 81, products: [{ id: 222 }] } }, { ok: true, status: 200, body: undefined }]
  await assert.rejects(crearCuponDeProducto(negocio, 'RETORNAR-PANUELO-00000005', '111', 29000), /RESTRICCION_NO_APLICADA/)
  assert.equal(llamadas[1].opciones.method, 'DELETE')

  // Si no se puede borrar, se desactiva; si tampoco, el error lo dice.
  llamadas = []
  respuestas = [{ ok: true, status: 201, body: { id: 82 } }, { ok: true, status: 200, body: { id: 82 } }, { ok: false, status: 500, body: {} }, { ok: true, status: 200, body: {} }]
  await assert.rejects(crearCuponDeProducto(negocio, 'RETORNAR-PANUELO-00000006', '111', 29000), /se retiró/)
  assert.deepEqual([llamadas[2].opciones.method, llamadas[3].opciones.method], ['DELETE', 'PUT'])
  assert.deepEqual(llamadas[3].body, { valid: false })
  llamadas = []
  respuestas = [{ ok: true, status: 201, body: { id: 83 } }, { ok: true, status: 200, body: { id: 83 } }, { ok: false, status: 500, body: {} }, { ok: false, status: 500, body: {} }]
  await assert.rejects(crearCuponDeProducto(negocio, 'RETORNAR-PANUELO-00000007', '111', 29000), /NO se pudo retirar/)
})

test('cupón de producto: id de producto inválido → no llama a Tiendanube', async () => {
  for (const id of ['', null, 'abc', '12a', 'https://tienda.com/productos/1']) {
    await assert.rejects(crearCuponDeProducto(negocio, 'RETORNAR-X-00000001', id, 29000), /no es válido/)
  }
  assert.equal(llamadas.length, 0)
})

test('productosDelCupon: ids como texto, o null si la respuesta no los trae', () => {
  assert.deepEqual(productosDelCupon({ products: [{ id: 1 }, 2, '3'] }), ['1', '2', '3'])
  assert.equal(productosDelCupon({}), null)
  assert.equal(productosDelCupon(null), null)
})

test('porcentaje: cupón porcentual de un solo uso, sin piso', async () => {
  await crearCuponPorcentaje(negocio, 'RETORNAR-00000002', 10)
  assert.deepEqual(llamadas[0].body, { code: 'RETORNAR-00000002', type: 'percentage', value: '10.00', max_uses: 1, valid: true })
})

test('monto fijo con compra mínima: el piso es la compra mínima, no el monto', async () => {
  await crearCuponMontoFijo(negocio, 'RETORNAR-00000003', 70000, 140000)
  assert.deepEqual(llamadas[0].body, { code: 'RETORNAR-00000003', type: 'absolute', value: '70000.00', min_price: 140000, max_uses: 1, valid: true })
})

test('monto fijo con compra mínima que no supera el monto: se rechaza antes de llamar a Tiendanube', async () => {
  await assert.rejects(crearCuponMontoFijo(negocio, 'RETORNAR-00000004', 70000, null), /compra mínima/)
  await assert.rejects(crearCuponMontoFijo(negocio, 'RETORNAR-00000004', 70000, 70000), /compra mínima/)
  assert.equal(llamadas.length, 0)
})

test('error de Tiendanube: se propaga con el status, para guardarlo en el canje', async () => {
  respuesta = { ok: false, status: 422, body: { code: ['has already been taken'] } }
  await assert.rejects(crearCuponPorcentaje(negocio, 'RETORNAR-00000005', 10), /422/)
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
