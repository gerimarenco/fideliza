import test from 'node:test'
import assert from 'node:assert/strict'
import { logoParaEmail } from './email.js'

test('logoParaEmail: solo imágenes https que los clientes de correo muestran', () => {
  assert.equal(logoParaEmail('https://cdn.ejemplo.com/logo.png'), 'https://cdn.ejemplo.com/logo.png')
  assert.equal(logoParaEmail(' https://cdn.ejemplo.com/logo.jpg '), 'https://cdn.ejemplo.com/logo.jpg')
  assert.equal(logoParaEmail('https://cdn.ejemplo.com/logo.SVG'), null, 'Gmail y Outlook no muestran SVG')
  assert.equal(logoParaEmail('http://cdn.ejemplo.com/logo.png'), null, 'http suele quedar bloqueado')
  assert.equal(logoParaEmail('javascript:alert(1)'), null)
  assert.equal(logoParaEmail('/images/logo.png'), null)
  assert.equal(logoParaEmail(''), null)
  assert.equal(logoParaEmail(undefined), null)
})
