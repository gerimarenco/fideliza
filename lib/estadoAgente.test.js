import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estadoAgente, textoTiempo } from './estadoAgente.js'

const ahora = new Date('2026-10-22T15:00:00Z')
const haceMinutos = (m) => new Date(ahora.getTime() - m * 60 * 1000)

test('nunca se conectó', () => {
  assert.deepEqual(estadoAgente(null, ahora), { estado: 'nunca', minutos: null })
})

test('activo hasta 5 minutos, demorado hasta 60, después sin conexión', () => {
  assert.equal(estadoAgente(haceMinutos(0), ahora).estado, 'activo')
  assert.equal(estadoAgente(haceMinutos(5), ahora).estado, 'activo')
  assert.equal(estadoAgente(haceMinutos(6), ahora).estado, 'demorado')
  assert.equal(estadoAgente(haceMinutos(60), ahora).estado, 'demorado')
  assert.equal(estadoAgente(haceMinutos(61), ahora).estado, 'sin_conexion')
})

test('un reloj levemente adelantado no da minutos negativos', () => {
  assert.equal(estadoAgente(new Date(ahora.getTime() + 30000), ahora).minutos, 0)
})

test('textoTiempo', () => {
  assert.equal(textoTiempo(0), 'hace menos de un minuto')
  assert.equal(textoTiempo(1), 'hace 1 minuto')
  assert.equal(textoTiempo(45), 'hace 45 minutos')
  assert.equal(textoTiempo(60), 'hace 1 hora')
  assert.equal(textoTiempo(60 * 30), 'hace 30 horas')
  assert.equal(textoTiempo(60 * 24 * 3), 'hace 3 días')
})
