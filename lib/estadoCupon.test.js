import test from 'node:test'
import assert from 'node:assert/strict'
import { estadoDesdeTiendanube, codigosDeOrden, estadoVisible } from './estadoCupon.js'

const ahora = new Date('2026-11-01T15:00:00Z')

test('estadoDesdeTiendanube: usado cuando llegó al máximo de usos', () => {
  assert.equal(estadoDesdeTiendanube({ used: 1, max_uses: 1, valid: true }, ahora), 'utilizado')
  assert.equal(estadoDesdeTiendanube({ used: 0, max_uses: 1, valid: true }, ahora), 'disponible')
  assert.equal(estadoDesdeTiendanube({ used: '1', max_uses: '1', valid: true }, ahora), 'utilizado')
})

test('estadoDesdeTiendanube: anulado si la tienda lo desactivó, vencido si pasó la fecha', () => {
  assert.equal(estadoDesdeTiendanube({ used: 0, max_uses: 1, valid: false }, ahora), 'anulado')
  assert.equal(estadoDesdeTiendanube({ used: 0, max_uses: 1, valid: true, end_date: '2026-10-31' }, ahora), 'vencido')
  assert.equal(estadoDesdeTiendanube({ used: 0, max_uses: 1, valid: true, end_date: '2026-11-01' }, ahora), 'disponible', 'vale todo el último día')
  // Un usado sigue siendo usado aunque después lo desactiven.
  assert.equal(estadoDesdeTiendanube({ used: 1, max_uses: 1, valid: false }, ahora), 'utilizado')
})

test('estadoDesdeTiendanube: sin contador de usos queda pendiente (null), nunca disponible', () => {
  for (const used of [undefined, null, '', 'abc']) {
    assert.equal(estadoDesdeTiendanube({ used, max_uses: 1, valid: true }, ahora), null, `used=${JSON.stringify(used)}`)
  }
  assert.equal(estadoDesdeTiendanube({ max_uses: 1, valid: true }, ahora), null, 'sin el campo used')
  assert.equal(estadoDesdeTiendanube({ used: 0, valid: true }, ahora), null, 'sin max_uses')
  assert.equal(estadoDesdeTiendanube({ used: 0, max_uses: null, valid: true }, ahora), null)
  // Aunque esté desactivado o vencido: sin contador no se sabe si se usó antes.
  assert.equal(estadoDesdeTiendanube({ max_uses: 1, valid: false }, ahora), null)
  assert.equal(estadoDesdeTiendanube({ max_uses: 1, valid: true, end_date: '2026-10-01' }, ahora), null)
  assert.equal(estadoDesdeTiendanube({}, ahora), null)
  assert.equal(estadoDesdeTiendanube(null, ahora), null)
})

test('codigosDeOrden: lista de códigos o de objetos', () => {
  assert.deepEqual(codigosDeOrden({ coupon: ['retornar-abc123'] }), ['RETORNAR-ABC123'])
  assert.deepEqual(codigosDeOrden({ coupon: [{ code: 'RETORNAR-X1', id: 5 }, { code: 'OTRO' }] }), ['RETORNAR-X1', 'OTRO'])
  assert.deepEqual(codigosDeOrden({ coupon: [] }), [])
  assert.deepEqual(codigosDeOrden({}), [])
})

test('estadoVisible: sin verificar nunca se muestra como usado ni disponible', () => {
  assert.equal(estadoVisible({ tiendanubeCuponCodigo: 'RETORNAR-1', cuponEstado: null }).clave, 'sin_verificar')
  assert.equal(estadoVisible({ tiendanubeCuponCodigo: 'RETORNAR-1', cuponEstado: null }).etiqueta, 'Pendiente de verificación')
  assert.equal(estadoVisible({ tiendanubeCuponCodigo: 'RETORNAR-1', cuponEstado: 'utilizado' }).etiqueta, 'Utilizado')
  assert.equal(estadoVisible({ tiendanubeCuponCodigo: null, tiendanubeCuponError: 'x' }).clave, 'en_preparacion')
  assert.equal(estadoVisible({ tiendanubeCuponCodigo: null, tiendanubeCuponError: null }), null)
})
