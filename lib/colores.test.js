import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contraste, asegurarContraste, textoSobre } from './colores.js'

test('contraste: blanco y negro dan 21, un color consigo mismo da 1', () => {
  assert.equal(Math.round(contraste('#ffffff', '#000000')), 21)
  assert.equal(contraste('#877152', '#877152'), 1)
  assert.equal(Math.round(contraste('#fff', '#000')), 21)
})

test('contraste: hex inválido devuelve null', () => {
  assert.equal(contraste('rojo', '#ffffff'), null)
  assert.equal(contraste('#12345', '#ffffff'), null)
})

test('asegurarContraste: deja igual un color que ya se lee bien', () => {
  assert.equal(asegurarContraste('#55595e', ['#f8f8f5', '#ffffff'], '#17191b'), '#55595e')
})

test('asegurarContraste: oscurece el gris de Peperina hasta 4.5:1 sobre crema y blanco', () => {
  const fondos = ['#F6EFE9', '#ffffff']
  assert.ok(contraste('#A99886', '#F6EFE9') < 4.5)
  const legible = asegurarContraste('#A99886', fondos, '#221f1a')
  assert.notEqual(legible, '#A99886')
  for (const f of fondos) assert.ok(contraste(legible, f) >= 4.5)
})

test('asegurarContraste: con colores inválidos no toca nada', () => {
  assert.equal(asegurarContraste('#A99886', ['no-es-color'], '#221f1a'), '#A99886')
  assert.equal(asegurarContraste('gris', ['#ffffff'], '#000000'), 'gris')
})

test('textoSobre: respeta el preferido si se lee, si no elige blanco o casi negro', () => {
  assert.equal(textoSobre('#1e5b45', '#ffffff'), '#ffffff')
  // Crema sobre el topo de Peperina no llega a 4.5:1 -> blanco, que sí
  assert.equal(textoSobre('#877152', '#F6EFE9'), '#ffffff')
  assert.equal(textoSobre('#F4D9D1', '#ffffff'), '#17191b')
})
