import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolverTema, TEMA_DEFAULT } from './tema.js'
import { contraste } from './colores.js'

test('resolverTema: sin tema guardado usa los valores por defecto', () => {
  const t = resolverTema(null)
  assert.equal(t.fondo, TEMA_DEFAULT.fondo)
  assert.equal(t.primario, TEMA_DEFAULT.primario)
  assert.equal(t.primarioLegible, TEMA_DEFAULT.primario)
})

test('resolverTema: con la paleta de Peperina todo el texto queda legible', () => {
  const peperina = { fondo: '#F6EFE9', superficie: '#ffffff', borde: '#EBDAC6', texto: '#221f1a', textoSecundario: '#A99886', primario: '#877152', primarioTexto: '#F6EFE9', resaltado: '#F4D9D1' }
  const t = resolverTema(peperina)
  for (const fondo of [peperina.fondo, peperina.superficie, peperina.resaltado]) {
    assert.ok(contraste(t.textoSecundario, fondo) >= 4.5)
    assert.ok(contraste(t.primarioLegible, fondo) >= 4.5)
  }
  assert.ok(contraste(t.primarioTexto, t.primario) >= 4.5)
  assert.ok(contraste(t.bordeCampo, peperina.superficie) >= 3)
  assert.equal(t.borde, '#EBDAC6')
  // Lo que no hace falta ajustar queda igual
  assert.equal(t.primario, '#877152')
  assert.equal(t.fondo, '#F6EFE9')
})
