import test from 'node:test'
import assert from 'node:assert/strict'
import { generarCodigoReferido } from './referidos.js'

test('generarCodigoReferido: 6 caracteres, siempre del alfabeto sin ambigüedades', () => {
  for (let i = 0; i < 200; i++) {
    const codigo = generarCodigoReferido()
    assert.equal(codigo.length, 6)
    assert.match(codigo, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
    // Nada de 0/O ni 1/I/L, que se confunden fácil al escribir a mano.
    assert.doesNotMatch(codigo, /[01IOL]/)
  }
})

test('generarCodigoReferido: no siempre da el mismo código', () => {
  const codigos = new Set(Array.from({ length: 50 }, () => generarCodigoReferido()))
  assert.ok(codigos.size > 1)
})
