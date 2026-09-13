import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularPuntosPorCompra } from './puntos.js'

test('calcularPuntosPorCompra: caso simple', () => {
  assert.equal(calcularPuntosPorCompra(1000, 100), 10)
})

test('calcularPuntosPorCompra: redondea siempre hacia abajo', () => {
  assert.equal(calcularPuntosPorCompra(999, 100), 9)
  assert.equal(calcularPuntosPorCompra(199, 100), 1)
  assert.equal(calcularPuntosPorCompra(99, 100), 0)
})

test('calcularPuntosPorCompra: monto inválido nunca genera puntos', () => {
  assert.equal(calcularPuntosPorCompra(0, 100), 0)
  assert.equal(calcularPuntosPorCompra(-500, 100), 0)
  assert.equal(calcularPuntosPorCompra(NaN, 100), 0)
  assert.equal(calcularPuntosPorCompra(Infinity, 100), 0)
})

test('calcularPuntosPorCompra: puntosXPeso inválido nunca genera puntos (en vez de Infinity/NaN)', () => {
  assert.equal(calcularPuntosPorCompra(1000, 0), 0)
  assert.equal(calcularPuntosPorCompra(1000, -100), 0)
  assert.equal(calcularPuntosPorCompra(1000, NaN), 0)
})
