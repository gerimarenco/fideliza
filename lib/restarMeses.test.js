import test from 'node:test'
import assert from 'node:assert/strict'
import { restarMeses } from './restarMeses.js'

function iso(fecha) {
  return fecha.toISOString().slice(0, 10)
}

test('restarMeses: caso simple, el mes de destino tiene suficientes días', () => {
  assert.equal(iso(restarMeses(new Date('2026-09-10'), 6)), '2026-03-10')
})

test('restarMeses: desborde de fin de mes -- 31 de agosto menos 6 meses', () => {
  // 31 de agosto - 6 meses = "31 de febrero", que no existe -- JS lo
  // normalizaría solo a principios de marzo si no se clampeara a mano.
  // Este es el bug real que tuvo la primera versión (ver docs/tareas-futuras.md).
  assert.equal(iso(restarMeses(new Date('2026-08-31'), 6)), '2026-02-28')
})

test('restarMeses: el mismo desborde, pero contra un febrero bisiesto', () => {
  assert.equal(iso(restarMeses(new Date('2024-08-31'), 6)), '2024-02-29')
})

test('restarMeses: 31 de marzo menos 1 mes -> 28/29 de febrero, no "3 de marzo"', () => {
  assert.equal(iso(restarMeses(new Date('2026-03-31'), 1)), '2026-02-28')
  assert.equal(iso(restarMeses(new Date('2024-03-31'), 1)), '2024-02-29')
})

test('restarMeses: cruzar de año', () => {
  assert.equal(iso(restarMeses(new Date('2026-01-15'), 2)), '2025-11-15')
})
