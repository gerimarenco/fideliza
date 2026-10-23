import { test } from 'node:test'
import assert from 'node:assert/strict'
import { puedeEnviarReset, MAXIMO_POR_HORA } from './limiteReset.js'

const ahora = new Date('2026-10-22T15:00:00Z')
const haceMinutos = (m) => new Date(ahora.getTime() - m * 60 * 1000)

test('sin pedidos previos, se puede enviar', () => {
  assert.equal(puedeEnviarReset([], ahora), true)
})

test('un pedido hace menos de 2 minutos bloquea el siguiente', () => {
  assert.equal(puedeEnviarReset([haceMinutos(1)], ahora), false)
  assert.equal(puedeEnviarReset([haceMinutos(3)], ahora), true)
})

test(`más de ${MAXIMO_POR_HORA} pedidos en la última hora bloquea`, () => {
  const cinco = [10, 20, 30, 40, 50].map(haceMinutos)
  assert.equal(puedeEnviarReset(cinco, ahora), false)
  const cuatro = [10, 20, 30, 40].map(haceMinutos)
  assert.equal(puedeEnviarReset(cuatro, ahora), true)
})

test('los pedidos de hace más de una hora no cuentan', () => {
  const viejos = [61, 70, 80, 90, 100].map(haceMinutos)
  assert.equal(puedeEnviarReset(viejos, ahora), true)
})
