import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mesArgentina } from './periodo.js'

test('mesArgentina: el mes arranca a las 00:00 de Argentina (03:00 UTC)', () => {
  const { inicio, fin } = mesArgentina(new Date('2026-10-15T12:00:00Z'))
  assert.equal(inicio.toISOString(), '2026-10-01T03:00:00.000Z')
  assert.equal(fin.toISOString(), '2026-11-01T03:00:00.000Z')
})

test('mesArgentina: las 22:00 del 31 en Argentina siguen siendo ese mes', () => {
  // 01:00 UTC del 1/11 = 22:00 del 31/10 en Argentina
  const { inicio } = mesArgentina(new Date('2026-11-01T01:00:00Z'))
  assert.equal(inicio.toISOString(), '2026-10-01T03:00:00.000Z')
})

test('mesArgentina: diciembre pasa al año siguiente', () => {
  const { fin } = mesArgentina(new Date('2026-12-20T12:00:00Z'))
  assert.equal(fin.toISOString(), '2027-01-01T03:00:00.000Z')
})
