import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'crypto'
import { verificarFirmaTiendanube, verificarFirmaMercadoPago } from './webhookSignature.js'

test('verificarFirmaTiendanube: sin secret configurado, no rompe el flujo (verificable: false, valido: true)', () => {
  const resultado = verificarFirmaTiendanube('{"event":"order/paid"}', 'cualquier-cosa', undefined)
  assert.deepEqual(resultado, { verificable: false, valido: true })
})

test('verificarFirmaTiendanube: firma correcta', () => {
  const secret = 'client-secret-de-prueba'
  const rawBody = '{"store_id":820719,"event":"order/paid","id":123}'
  const firma = createHmac('sha256', secret).update(rawBody).digest('hex')
  const resultado = verificarFirmaTiendanube(rawBody, firma, secret)
  assert.deepEqual(resultado, { verificable: true, valido: true })
})

test('verificarFirmaTiendanube: firma incorrecta o ausente', () => {
  const secret = 'client-secret-de-prueba'
  const rawBody = '{"store_id":820719,"event":"order/paid","id":123}'
  assert.equal(verificarFirmaTiendanube(rawBody, 'firma-inventada', secret).valido, false)
  assert.equal(verificarFirmaTiendanube(rawBody, null, secret).valido, false)
})

test('verificarFirmaTiendanube: funciona pasando un Buffer (como lo manda la ruta real, no un string)', () => {
  const secret = 'client-secret-de-prueba'
  // A propósito con un caracter no-ASCII (é): es justo el caso donde
  // decodificar a string y recodificar podría no reproducir los mismos
  // bytes -- pasar el Buffer directo evita el problema por completo.
  const rawBodyBuffer = Buffer.from('{"contact_name":"José"}', 'utf8')
  const firma = createHmac('sha256', secret).update(rawBodyBuffer).digest('hex')
  assert.equal(verificarFirmaTiendanube(rawBodyBuffer, firma, secret).valido, true)
})

test('verificarFirmaTiendanube: un body distinto (aunque sea un solo byte) no valida', () => {
  const secret = 'client-secret-de-prueba'
  const rawBody = '{"id":123}'
  const firma = createHmac('sha256', secret).update(rawBody).digest('hex')
  assert.equal(verificarFirmaTiendanube('{"id":124}', firma, secret).valido, false)
})

test('verificarFirmaMercadoPago: sin secret configurado, no rompe el flujo', () => {
  const resultado = verificarFirmaMercadoPago({ xSignature: null, xRequestId: null, dataId: null, secret: undefined })
  assert.deepEqual(resultado, { verificable: false, valido: true })
})

function firmarManifiestoMP({ secret, dataId, xRequestId, ts }) {
  let manifest = ''
  if (dataId) manifest += `id:${dataId};`
  if (xRequestId) manifest += `request-id:${xRequestId};`
  manifest += `ts:${ts};`
  return createHmac('sha256', secret).update(manifest).digest('hex')
}

test('verificarFirmaMercadoPago: firma correcta, con dataId y x-request-id', () => {
  const secret = 'mp-secret-de-prueba'
  const ts = '1700000000'
  const dataId = '123456789'
  const xRequestId = 'req-abc-123'
  const hash = firmarManifiestoMP({ secret, dataId, xRequestId, ts })

  const resultado = verificarFirmaMercadoPago({
    xSignature: `ts=${ts},v1=${hash}`,
    xRequestId,
    dataId,
    secret,
  })
  assert.deepEqual(resultado, { verificable: true, valido: true })
})

test('verificarFirmaMercadoPago: si falta x-request-id, se saca del manifest de los dos lados', () => {
  const secret = 'mp-secret-de-prueba'
  const ts = '1700000000'
  const dataId = '123456789'
  const hash = firmarManifiestoMP({ secret, dataId, xRequestId: null, ts })

  const resultado = verificarFirmaMercadoPago({
    xSignature: `ts=${ts},v1=${hash}`,
    xRequestId: null,
    dataId,
    secret,
  })
  assert.equal(resultado.valido, true)
})

test('verificarFirmaMercadoPago: firma inválida, header ausente, o dataId adulterado', () => {
  const secret = 'mp-secret-de-prueba'
  const ts = '1700000000'
  const hash = firmarManifiestoMP({ secret, dataId: '123456789', xRequestId: 'req-1', ts })

  assert.equal(verificarFirmaMercadoPago({ xSignature: `ts=${ts},v1=${hash}`, xRequestId: 'req-1', dataId: '999999999', secret }).valido, false)
  assert.equal(verificarFirmaMercadoPago({ xSignature: null, xRequestId: 'req-1', dataId: '123456789', secret }).valido, false)
  assert.equal(verificarFirmaMercadoPago({ xSignature: 'formato-invalido-sin-comas', xRequestId: 'req-1', dataId: '123456789', secret }).valido, false)
})
