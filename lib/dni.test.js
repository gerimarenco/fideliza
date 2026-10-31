import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarDni, MENSAJE_DNI_REPETIDO, MENSAJE_EMAIL_REPETIDO } from './dni.js'
import { limiteSuperado, LIMITES, claveDni, claveIp, claveDispositivo } from './limiteRegistro.js'

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

test('normalizarDni: patrones llamativos son documentos posibles (no se rechazan)', () => {
  for (const v of ['11111111', '11.111.111', '22222222', '9999999', '12345678', '12.345.678', '1234567', '87654321', '23456789', '7654321']) {
    assert.equal(normalizarDni(v), v.replace(/\./g, ''), v)
  }
  assert.equal(normalizarDni('00000000'), null, 'solo ceros: sin dígitos significativos')
})

test('mensajes de repetido: claros y sin datos personales', () => {
  assert.match(MENSAJE_DNI_REPETIDO, /Este DNI ya está registrado/)
  assert.match(MENSAJE_EMAIL_REPETIDO, /Este correo electrónico ya está registrado/)
  assert.doesNotMatch(MENSAJE_DNI_REPETIDO + MENSAJE_EMAIL_REPETIDO, /\d/)
})

const normal = { dni: 1, dispositivo: 1, ip: 1, rechazosNegocio: 0, rechazosDispositivo: 0, rechazosIp: 0 }

test('límites: un Wi-Fi compartido con muchas clientas legítimas no se bloquea', () => {
  assert.equal(limiteSuperado({ ...normal, ip: 40 }), null)
  assert.equal(limiteSuperado({ ...normal, ip: LIMITES.ip.maximo }), null)
  // Aunque otras personas de ese Wi-Fi hayan recibido "DNI ya registrado".
  assert.equal(limiteSuperado({ ...normal, ip: 30, rechazosIp: 5, rechazosNegocio: 3 }), null)
})

test('límites: cada uno se cuenta por separado, el del DNI es el más estricto', () => {
  assert.equal(limiteSuperado({ ...normal, dni: LIMITES.dni.maximo }), null)
  assert.equal(limiteSuperado({ ...normal, dni: LIMITES.dni.maximo + 1 }), 'dni')
  assert.equal(limiteSuperado({ ...normal, dispositivo: LIMITES.dispositivo.maximo + 1 }), 'dispositivo')
  assert.equal(limiteSuperado({ ...normal, dispositivo: null }), null, 'sin cookie no hay historial del dispositivo')
  assert.equal(limiteSuperado({ ...normal, ip: LIMITES.ip.maximo + 1 }), 'ip')
  assert.ok(LIMITES.dni.maximo < LIMITES.dispositivo.maximo && LIMITES.dispositivo.maximo < LIMITES.ip.maximo)
})

test('límites: modo protección contra probar documentos desde muchas IP', () => {
  const ataque = { ...normal, rechazosNegocio: LIMITES.proteccion.rechazosNegocio }
  assert.equal(limiteSuperado(ataque), null, 'quien no recibió ningún "DNI ya registrado" sigue pudiendo registrarse')
  assert.equal(limiteSuperado({ ...ataque, rechazosDispositivo: 1 }), 'proteccion')
  assert.equal(limiteSuperado({ ...ataque, rechazosIp: 1 }), null, 'una clienta que se equivocó una vez no frena a todo su Wi-Fi')
  assert.equal(limiteSuperado({ ...ataque, rechazosIp: 2 }), 'proteccion')
  assert.equal(limiteSuperado({ ...normal, rechazosNegocio: LIMITES.proteccion.rechazosNegocio - 1, rechazosIp: 10, rechazosDispositivo: 10 }), null, 'fuera del modo protección no se frena por rechazos')
})

test('límites: las claves son HMAC, nunca el dato en claro', () => {
  const k = [claveDni('neg1', '30123456'), claveIp('203.0.113.5'), claveDispositivo('abc')]
  for (const x of k) assert.match(x, /^[0-9a-f]{64}$/)
  assert.ok(!k.join('').includes('30123456') && !k.join('').includes('203.0.113.5'))
  assert.notEqual(claveDni('neg1', '30123456'), claveDni('neg2', '30123456'), 'por negocio')
})
