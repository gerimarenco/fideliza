import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashEmailLogin, loginBloqueado, inicioVentana, MAXIMO_FALLOS, VENTANA_MS } from './limiteLogin.js'

test('hashEmailLogin: mismo hash sin importar mayúsculas ni espacios, y no deja ver el email', () => {
  const h = hashEmailLogin('Lucia@Gmail.com ')
  assert.equal(h, hashEmailLogin('lucia@gmail.com'))
  assert.notEqual(h, hashEmailLogin('otra@gmail.com'))
  assert.equal(h.length, 64)
  assert.ok(!h.includes('lucia'))
})

test('loginBloqueado: recién al llegar al máximo de fallos', () => {
  assert.equal(loginBloqueado(0), false)
  assert.equal(loginBloqueado(MAXIMO_FALLOS - 1), false)
  assert.equal(loginBloqueado(MAXIMO_FALLOS), true)
})

test('inicioVentana: 15 minutos para atrás', () => {
  const ahora = new Date('2026-10-24T12:00:00Z')
  assert.equal(ahora.getTime() - inicioVentana(ahora).getTime(), VENTANA_MS)
  assert.equal(inicioVentana(ahora).toISOString(), '2026-10-24T11:45:00.000Z')
})
