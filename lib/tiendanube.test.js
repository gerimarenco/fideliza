import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { obtenerPrecioProducto, crearCuponProductoGratis, crearCuponPorcentaje, crearCuponMontoFijo, codigoCuponDeCanje } from './tiendanube.js'

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
