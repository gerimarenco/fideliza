import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarCelular, numeroWhatsapp, MENSAJE_CELULAR_ARGENTINA } from './telefono.js'
import { mismoCelular } from './bienvenida.js'

test('Argentina: código de área + número → formato internacional con el 9', () => {
  assert.deepEqual(normalizarCelular('2324500294'), { telefono: '+5492324500294' }, 'Mercedes')
  assert.deepEqual(normalizarCelular('1155551234'), { telefono: '+5491155551234' }, 'Buenos Aires')
  assert.deepEqual(normalizarCelular('3514567890', 'AR'), { telefono: '+5493514567890' }, 'Córdoba')
  assert.deepEqual(normalizarCelular('2324 50-0294'), { telefono: '+5492324500294' }, 'con espacios y guiones')
})

test('Argentina: si igual escribe +54, 9, 0 o 15, no se duplican', () => {
  for (const v of ['+54 9 2324 500294', '5492324500294', '542324500294', '02324500294', '2324 15 500294', '02324 15 500294', '011 15 5555 1234']) {
    const r = normalizarCelular(v)
    assert.ok(r.telefono === '+5492324500294' || r.telefono === '+5491155551234', `${v} → ${JSON.stringify(r)}`)
  }
})

test('Argentina: longitud o código de área inválidos → error claro', () => {
  for (const v of ['232450029', '23245002941', '0800123456', '4123456789', '1234567890', '15500294', '9999999999']) {
    assert.equal(normalizarCelular(v).error, MENSAJE_CELULAR_ARGENTINA, v)
  }
  assert.match(normalizarCelular('').error, /obligatorio/)
  assert.match(normalizarCelular('23245abc94').error, /solo números/)
})

test('otros países: se agrega su código, sin indicador de celular', () => {
  assert.deepEqual(normalizarCelular('94123456', 'UY'), { telefono: '+59894123456' })
  assert.deepEqual(normalizarCelular('094 123 456', 'UY'), { telefono: '+59894123456' }, 'con el 0 de larga distancia')
  assert.deepEqual(normalizarCelular('+598 94 123 456', 'UY'), { telefono: '+59894123456' }, 'con el código ya escrito')
  assert.deepEqual(normalizarCelular('912345678', 'CL'), { telefono: '+56912345678' })
  assert.deepEqual(normalizarCelular('11912345678', 'BR'), { telefono: '+5511912345678' })
  assert.match(normalizarCelular('9412', 'UY').error, /Uruguay/)
  assert.match(normalizarCelular('2324500294', 'XX').error, /país/)
})

test('compatibilidad: el formato nuevo y los celulares viejos son el mismo número', () => {
  const nuevo = normalizarCelular('2324500294').telefono
  for (const viejo of ['2324500294', '2324-50-0294', '02324 15 500294', '5492324500294']) assert.ok(mismoCelular(nuevo, viejo), viejo)
  assert.equal(mismoCelular(nuevo, '+5492324500295'), false)
})

test('numeroWhatsapp: con código de país, también para celulares viejos', () => {
  assert.equal(numeroWhatsapp('+5492324500294'), '5492324500294')
  assert.equal(numeroWhatsapp('2324500294'), '5492324500294', 'viejo, sin código de país')
  assert.equal(numeroWhatsapp('2324-50-0294'), '5492324500294')
  assert.equal(numeroWhatsapp('+59894123456'), '59894123456')
  assert.equal(numeroWhatsapp(''), null)
  assert.equal(numeroWhatsapp(null), null)
})
