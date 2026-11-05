import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { estadoVariante, estadoEnlace, estadoParaPanel, armarEnlace, otrasVariantesConStock, urlProducto, resumenProducto, leerProducto, limpiarCacheDisponibilidad, textoTiendanube } from './disponibilidad.js'

// Productos como los devuelve la API de Tiendanube.
const variante = (id, color, precio, stock, extra = {}) => ({ id, values: [{ es: color }], price: precio.toFixed(2), stock_management: stock !== null, stock, ...extra })
const producto = (id, nombre, variantes, extra = {}) => ({ id, name: { es: nombre }, published: true, canonical_url: `https://peperina.com.ar/productos/${id}/`, images: [{ id: 900 + id, src: `https://cdn.tienda/${id}.jpg` }], variants: variantes, ...extra })

const panuelo = () => producto(111, 'Pañuelo de seda', [variante(1, 'Visón', 29000, 0), variante(2, 'Negro', 29000, 3), variante(3, 'Rosa', 31000, 2), variante(4, 'Gris', 29000, 0), variante(5, 'Crudo', 27000, 5)])

test('estado de una variante: solo "con stock" cuando Tiendanube lo confirma', () => {
  assert.equal(estadoVariante({ stock_management: true, stock: 3 }), 'con_stock')
  assert.equal(estadoVariante({ stock_management: true, stock: 0 }), 'sin_stock')
  assert.equal(estadoVariante({ stock_management: true, stock: -1 }), 'sin_stock')
  assert.equal(estadoVariante({ stock_management: false, stock: null }), 'con_stock', 'stock infinito')
  assert.equal(estadoVariante({ stock: null }), 'con_stock', 'API vieja: null = infinito')
  assert.equal(estadoVariante({ stock_management: true, stock: '2' }), 'con_stock')
  for (const raro of [{}, { stock_management: true }, { stock_management: true, stock: null }, { stock: 'muchos' }, null, 'x']) {
    assert.equal(estadoVariante(raro), 'desconocido', JSON.stringify(raro))
  }
})

test('textos de Tiendanube por idioma o planos', () => {
  assert.equal(textoTiendanube({ es: 'Pañuelo', pt: 'Lenço' }), 'Pañuelo')
  assert.equal(textoTiendanube({ pt: 'Lenço' }), 'Lenço')
  assert.equal(textoTiendanube('Pañuelo'), 'Pañuelo')
  assert.equal(textoTiendanube(null), '')
})

test('link a la tienda: el del producto, con la variante; nunca uno que no sea http(s)', () => {
  assert.equal(urlProducto(panuelo()), 'https://peperina.com.ar/productos/111/')
  assert.equal(urlProducto(panuelo(), 2), 'https://peperina.com.ar/productos/111/?variant=2')
  assert.equal(urlProducto({ canonical_url: 'javascript:alert(1)' }), null)
  assert.equal(urlProducto({}), null)
})

test('enlace a un color con stock: disponible', () => {
  const e = armarEnlace({ producto: panuelo(), varianteId: '2' })
  assert.equal(e.estado, 'disponible')
  assert.equal(e.variante.nombre, 'Negro')
  assert.equal(e.url, 'https://peperina.com.ar/productos/111/?variant=2')
  assert.deepEqual(e.otrasVariantes, [])
  assert.deepEqual(e.alternativas, [])
})

test('se agota el color del enlace (visón): mismo pañuelo en otros colores, primero los del mismo precio', () => {
  const e = armarEnlace({ producto: panuelo(), varianteId: '1' })
  assert.equal(e.estado, 'sin_stock')
  assert.deepEqual(e.otrasVariantes.map((v) => v.nombre), ['Negro', 'Crudo', 'Rosa'], 'Negro ($29.000, igual) primero; Gris sin stock no aparece')
})

test('enlace al producto entero: disponible si alguna variante tiene stock', () => {
  assert.equal(armarEnlace({ producto: panuelo() }).estado, 'disponible')
  const agotado = producto(111, 'Pañuelo', [variante(1, 'Visón', 29000, 0), variante(2, 'Negro', 29000, 0)])
  assert.equal(armarEnlace({ producto: agotado }).estado, 'sin_stock')
  const dudoso = producto(111, 'Pañuelo', [variante(1, 'Visón', 29000, 0), { id: 2, price: '29000.00' }])
  assert.equal(armarEnlace({ producto: dudoso }).estado, 'desconocido', 'una sin stock y otra sin datos: no se sabe')
})

test('sin respuesta de Tiendanube: desconocido, sin alternativas', () => {
  const e = armarEnlace({ producto: null, varianteId: '1' }, [{ producto: panuelo() }])
  assert.equal(e.estado, 'desconocido')
  assert.deepEqual(e.alternativas, [])
  assert.deepEqual(e.otrasVariantes, [])
})

test('sin publicar o variante borrada: sin stock', () => {
  assert.equal(armarEnlace({ producto: { ...panuelo(), published: false } }).estado, 'sin_stock')
  const borrada = armarEnlace({ producto: panuelo(), varianteId: '99' })
  assert.equal(borrada.estado, 'sin_stock')
  assert.equal(borrada.motivo, 'variante_inexistente')
  assert.ok(borrada.otrasVariantes.length > 0, 'muestra los otros colores')
})

test('alternativas configuradas: solo las que tienen stock confirmado, en su orden, sin repetir el producto principal', () => {
  const agotado = producto(222, 'Perfume Rosa', [variante(10, '50 ml', 45000, 0)])
  const otroPerfume = producto(223, 'Perfume Jazmín', [variante(11, '50 ml', 45000, 4), variante(12, '100 ml', 62000, 1)])
  const sinStock = producto(224, 'Perfume Ámbar', [variante(13, '50 ml', 45000, 0)])
  const colonia = producto(225, 'Colonia', [variante(14, '200 ml', 30000, 2)])
  const e = armarEnlace({ producto: agotado }, [
    { producto: sinStock },
    { producto: null },
    { producto: otroPerfume },
    { producto: agotado },
    { producto: colonia, varianteId: '14' },
  ])
  assert.equal(e.estado, 'sin_stock')
  assert.deepEqual(e.alternativas.map((a) => a.nombre), ['Perfume Jazmín', 'Colonia'], 'la agotada y la que no respondió se ocultan; el mismo producto no se repite')
  assert.equal(e.alternativas[0].precio, 45000, 'el precio más bajo con stock')
  assert.equal(e.alternativas[1].url, 'https://peperina.com.ar/productos/225/?variant=14')
  assert.equal(e.alternativas[1].variante, '200 ml')
})

test('una alternativa que apunta a un color agotado no se muestra', () => {
  const principal = producto(444, 'Aromatizante Lavanda', [variante(20, 'Lavanda', 15000, 0)])
  const alt = producto(445, 'Aromatizante Vainilla', [variante(21, '250 ml', 15000, 0), variante(22, '500 ml', 22000, 3)])
  assert.deepEqual(armarEnlace({ producto: principal }, [{ producto: alt, varianteId: '21' }]).alternativas, [])
  assert.equal(armarEnlace({ producto: principal }, [{ producto: alt }]).alternativas.length, 1, 'al producto entero sí')
})

test('con stock no se muestran alternativas aunque estén configuradas', () => {
  const e = armarEnlace({ producto: panuelo(), varianteId: '2' }, [{ producto: producto(223, 'Otro', [variante(1, 'x', 1000, 3)]) }])
  assert.deepEqual(e.alternativas, [])
})

test('resumen del producto: imagen de la variante o la primera del producto', () => {
  const p = producto(111, 'Pañuelo', [variante(1, 'Visón', 29000, 1, { image_id: 5 }), variante(2, 'Negro', 29000, 1)], { images: [{ id: 4, src: 'https://cdn/a.jpg' }, { id: 5, src: 'https://cdn/b.jpg' }] })
  const r = resumenProducto(p)
  assert.equal(r.variantes[0].imagen, 'https://cdn/b.jpg')
  assert.equal(r.variantes[1].imagen, 'https://cdn/a.jpg')
  assert.deepEqual(otrasVariantesConStock(estadoEnlace(p, '1')).map((v) => v.nombre), ['Negro'], 'las otras con stock, sin la del enlace')
})

// --- Lectura con caché ---
const negocio = { tiendanubeStoreId: '820719', tiendanubeAccessToken: 'token-de-prueba' }
let llamadas, respuesta
const fetchOriginal = globalThis.fetch
beforeEach(() => {
  limpiarCacheDisponibilidad()
  llamadas = []
  respuesta = { ok: true, status: 200, body: panuelo() }
  globalThis.fetch = async (url, opciones = {}) => {
    llamadas.push({ url, opciones })
    if (respuesta.tira) throw respuesta.tira
    return { ok: respuesta.ok, status: respuesta.status, text: async () => JSON.stringify(respuesta.body), json: async () => respuesta.body }
  }
})
afterEach(() => { globalThis.fetch = fetchOriginal })

test('leerProducto: solo GET, con tiempo máximo, y guarda unos segundos', async () => {
  let t = 1_000_000
  const ahora = () => t
  assert.equal((await leerProducto(negocio, '111', { ahora })).producto.id, 111)
  assert.equal(llamadas[0].url, 'https://api.tiendanube.com/2025-03/820719/products/111')
  assert.equal(llamadas[0].opciones.method, undefined, 'GET')
  assert.ok(llamadas[0].opciones.signal, 'con tiempo máximo de espera')
  t += 10_000
  await leerProducto(negocio, '111', { ahora })
  assert.equal(llamadas.length, 1, 'a los 10 s usa lo guardado')
  t += 15_000
  await leerProducto(negocio, '111', { ahora })
  assert.equal(llamadas.length, 2, 'a los 25 s vuelve a preguntar')
})

test('leerProducto: error o tiempo agotado → sin respuesta (nunca disponible); 404 → no existe', async () => {
  respuesta = { tira: Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }) }
  assert.deepEqual(await leerProducto(negocio, '111'), { error: 'sin_respuesta' })
  limpiarCacheDisponibilidad()
  respuesta = { ok: false, status: 503, body: {} }
  assert.deepEqual(await leerProducto(negocio, '111'), { error: 'sin_respuesta' })
  limpiarCacheDisponibilidad()
  respuesta = { ok: false, status: 404, body: {} }
  assert.deepEqual(await leerProducto(negocio, '111'), { error: 'no_existe' })
  limpiarCacheDisponibilidad()
  respuesta = { ok: true, status: 200, body: { id: 111 } }
  assert.deepEqual(await leerProducto(negocio, '111'), { error: 'sin_respuesta' }, 'respuesta sin variantes: no se confía')
  assert.deepEqual(await leerProducto({}, '111'), { error: 'sin_tienda' })
})

test('leerProducto: un error se guarda menos tiempo que un dato', async () => {
  let t = 0
  const ahora = () => t
  respuesta = { ok: false, status: 503, body: {} }
  await leerProducto(negocio, '111', { ahora })
  t += 5_000
  await leerProducto(negocio, '111', { ahora })
  assert.equal(llamadas.length, 1)
  t += 6_000
  respuesta = { ok: true, status: 200, body: panuelo() }
  assert.equal((await leerProducto(negocio, '111', { ahora })).producto.id, 111, 'a los 11 s reintenta')
})

test('etiqueta del panel: "otros colores" si solo se agotó el color del enlace (se puede canjear)', () => {
  assert.equal(estadoParaPanel(panuelo(), '2'), 'disponible')
  assert.equal(estadoParaPanel(panuelo(), '1'), 'otros_colores', 'visón agotado, hay negro')
  assert.equal(estadoParaPanel(panuelo()), 'disponible', 'producto entero')
  const agotado = producto(111, 'Pañuelo', [variante(1, 'Visón', 29000, 0), variante(2, 'Negro', 29000, 0)])
  assert.equal(estadoParaPanel(agotado, '1'), 'sin_stock')
  assert.equal(estadoParaPanel(agotado), 'sin_stock')
  assert.equal(estadoParaPanel({ ...panuelo(), published: false }, '2'), 'sin_stock')
  assert.equal(estadoParaPanel(null, '2'), 'desconocido')
})
