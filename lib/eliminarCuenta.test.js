import test from 'node:test'
import assert from 'node:assert/strict'
import { sinNombrePropio, cuentaProtegida, eliminableDesdePanel } from './eliminarCuenta.js'

test('sin nombre propio: vacío, igual al email o con forma de email', () => {
  assert.equal(sinNombrePropio({ nombre: null, email: 'a@x.com' }), true)
  assert.equal(sinNombrePropio({ nombre: '  ', email: 'a@x.com' }), true)
  assert.equal(sinNombrePropio({ nombre: 'A@X.com', email: 'a@x.com' }), true, 'igual al email, otra mayúscula')
  assert.equal(sinNombrePropio({ nombre: 'otra@x.com', email: 'a@x.com' }), true, 'otro email como nombre')
  assert.equal(sinNombrePropio({ nombre: 'Agustina Principi', email: 'a@x.com' }), false)
  assert.equal(sinNombrePropio({ nombre: 'Agustina', email: 'a@x.com' }), false, 'una sola palabra: tiene nombre')
})

test('genaromarenco110@gmail.com está protegida aunque no tenga nombre', () => {
  const genaro = { nombre: 'genaromarenco110@gmail.com', email: 'genaromarenco110@gmail.com' }
  assert.equal(sinNombrePropio(genaro), true)
  assert.equal(cuentaProtegida(genaro), true)
  assert.equal(cuentaProtegida({ email: ' GenaroMarenco110@Gmail.com ' }), true, 'sin importar mayúsculas ni espacios')
  assert.equal(eliminableDesdePanel(genaro), false)
})

test('desde el panel solo se pueden borrar las sin nombre no protegidas', () => {
  assert.equal(eliminableDesdePanel({ nombre: 'x@prueba.test', email: 'x@prueba.test' }), true)
  assert.equal(eliminableDesdePanel({ nombre: '', email: 'y@prueba.test' }), true)
  assert.equal(eliminableDesdePanel({ nombre: 'Kiara Marenco', email: 'k@prueba.test' }), false)
  assert.equal(eliminableDesdePanel({ nombre: 'Kiara', email: 'k@prueba.test' }), false)
})
