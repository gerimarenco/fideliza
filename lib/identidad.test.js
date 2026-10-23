import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarEmail, filtroEmail, mismoEmail, normalizarTelefono, ocultarEmail, emailValido } from './identidad.js'

test('ocultarEmail: deja reconocible el dominio pero no el email completo', () => {
  assert.equal(ocultarEmail('Maria.Gomez@Gmail.com'), 'ma***@gmail.com')
  assert.equal(ocultarEmail('a@b.com'), 'a***@b.com')
  assert.equal(ocultarEmail('sin-arroba'), '***')
  assert.equal(ocultarEmail(undefined), '')
})

test('normalizarEmail: minúsculas y sin espacios alrededor', () => {
  assert.equal(normalizarEmail('  Maria.Gomez@Gmail.COM '), 'maria.gomez@gmail.com')
  assert.equal(normalizarEmail('ya@normal.com'), 'ya@normal.com')
})

test('normalizarEmail: valores que no son texto quedan vacíos', () => {
  assert.equal(normalizarEmail(undefined), '')
  assert.equal(normalizarEmail(null), '')
  assert.equal(normalizarEmail(123), '')
})

test('filtroEmail: búsqueda sin distinguir mayúsculas', () => {
  assert.deepEqual(filtroEmail(' Ana@Mail.com'), { equals: 'ana@mail.com', mode: 'insensitive' })
})

test('mismoEmail: compara sin mayúsculas ni espacios, y vacío nunca coincide', () => {
  assert.equal(mismoEmail('Admin@Retornar.com.ar', 'admin@retornar.com.ar '), true)
  assert.equal(mismoEmail('a@b.com', 'c@b.com'), false)
  assert.equal(mismoEmail('', ''), false)
  assert.equal(mismoEmail(undefined, undefined), false)
})

test('normalizarTelefono: deja solo dígitos', () => {
  assert.equal(normalizarTelefono('(02324) 15-123 456'), '0232415123456')
  assert.equal(normalizarTelefono('2324123456'), '2324123456')
  assert.equal(normalizarTelefono(2324123456), '2324123456')
  assert.equal(normalizarTelefono(undefined), '')
})

test('emailValido: acepta emails comunes y rechaza los que no pueden recibir mails', () => {
  assert.equal(emailValido('lucia@gmail.com'), true)
  assert.equal(emailValido('  Lucia.Fernandez@Hotmail.com.ar '), true)
  assert.equal(emailValido('lucia@gmail'), false)
  assert.equal(emailValido('lucia gmail.com'), false)
  assert.equal(emailValido('lu cia@gmail.com'), false)
  assert.equal(emailValido(''), false)
  assert.equal(emailValido(null), false)
  assert.equal(emailValido(`${'a'.repeat(195)}@b.com`), false)
})
