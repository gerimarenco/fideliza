import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashEmailLogin, hashIpLogin, ipDeEncabezados, loginBloqueado, inicioVentana, MAXIMO_POR_CUENTA, MAXIMO_POR_CONEXION, VENTANA_MS } from './limiteLogin.js'

test('hashEmailLogin: mismo valor sin importar mayúsculas ni espacios, y no deja ver el email', () => {
  const h = hashEmailLogin('Lucia@Gmail.com ')
  assert.equal(h, hashEmailLogin('lucia@gmail.com'))
  assert.notEqual(h, hashEmailLogin('otra@gmail.com'))
  assert.equal(h.length, 64)
  assert.ok(!h.includes('lucia'))
})

test('hashIpLogin: distinto por IP y distinto del hash de un email', () => {
  assert.notEqual(hashIpLogin('1.2.3.4'), hashIpLogin('1.2.3.5'))
  assert.equal(hashIpLogin(''), hashIpLogin(undefined))
  assert.notEqual(hashIpLogin('a@b.com'), hashEmailLogin('a@b.com'))
})

test('ipDeEncabezados: prefiere la IP que pone Netlify, si no x-forwarded-for', () => {
  assert.equal(ipDeEncabezados({ 'x-nf-client-connection-ip': '200.1.1.1', 'x-forwarded-for': '9.9.9.9' }), '200.1.1.1')
  assert.equal(ipDeEncabezados({ 'x-forwarded-for': '181.2.2.2, 10.0.0.1' }), '181.2.2.2')
  assert.equal(ipDeEncabezados({}), '')
  assert.equal(ipDeEncabezados(undefined), '')
})

test('loginBloqueado: contando el intento actual, recién pasado el máximo', () => {
  assert.equal(loginBloqueado(1, 1), false)
  assert.equal(loginBloqueado(MAXIMO_POR_CUENTA, 1), false)
  assert.equal(loginBloqueado(MAXIMO_POR_CUENTA + 1, 1), true)
  assert.equal(loginBloqueado(1, MAXIMO_POR_CONEXION), false)
  assert.equal(loginBloqueado(1, MAXIMO_POR_CONEXION + 1), true)
})

test('inicioVentana: 15 minutos para atrás', () => {
  const ahora = new Date('2026-10-24T12:00:00Z')
  assert.equal(ahora.getTime() - inicioVentana(ahora).getTime(), VENTANA_MS)
  assert.equal(inicioVentana(ahora).toISOString(), '2026-10-24T11:45:00.000Z')
})
