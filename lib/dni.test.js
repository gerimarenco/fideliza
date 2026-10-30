import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarDni, MENSAJE_DNI_REPETIDO, MENSAJE_EMAIL_REPETIDO } from './dni.js'
import { registroBloqueado, MAXIMO_RECHAZOS_POR_CONEXION } from './limiteRegistro.js'

test('normalizarDni: puntos, espacios y guiones son el mismo documento', () => {
  for (const v of ['30123456', '30.123.456', '30 123 456', '30-123-456', ' 30.123.456 ', '030123456']) {
    assert.equal(normalizarDni(v), '30123456', v)
  }
  assert.equal(normalizarDni('5.123.456'), '5123456')
  assert.equal(normalizarDni(30123456), '30123456')
  assert.equal(normalizarDni('94.123.456'), '94123456', 'DNI de extranjero')
})

test('normalizarDni: vacío, con letras o de largo imposible → null', () => {
  for (const v of [undefined, null, '', '   ', 'abc', '30a123456', '30/123/456', '123456', '123456789', '0001234', {}, []]) {
    assert.equal(normalizarDni(v), null, JSON.stringify(v))
  }
})

test('normalizarDni: datos claramente inventados → null', () => {
  for (const v of ['11111111', '00000000', '9999999', '12345678', '1234567', '87654321', '7654321', '23456789']) {
    assert.equal(normalizarDni(v), null, v)
  }
  assert.equal(normalizarDni('12345679'), '12345679', 'parecido a una escalera pero real')
})

test('mensajes de repetido: claros y sin datos personales', () => {
  assert.match(MENSAJE_DNI_REPETIDO, /Este DNI ya está registrado/)
  assert.match(MENSAJE_EMAIL_REPETIDO, /Este correo electrónico ya está registrado/)
  assert.doesNotMatch(MENSAJE_DNI_REPETIDO + MENSAJE_EMAIL_REPETIDO, /\d/)
})

test('tope de registros rechazados por conexión', () => {
  assert.equal(registroBloqueado(0), false)
  assert.equal(registroBloqueado(MAXIMO_RECHAZOS_POR_CONEXION - 1), false)
  assert.equal(registroBloqueado(MAXIMO_RECHAZOS_POR_CONEXION), true)
})
