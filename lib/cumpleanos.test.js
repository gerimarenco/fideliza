import test from 'node:test'
import assert from 'node:assert/strict'
import { esCumpleanosHoy } from './cumpleanos.js'

// Fechas en UTC a propósito (mismo criterio que la función real) -- pasar
// un string 'YYYY-MM-DD' a `new Date` ya lo interpreta como medianoche UTC,
// sin depender de la zona horaria de quien corra el test.

test('esCumpleanosHoy: cumpleaños normal, coincide el mes y el día', () => {
  assert.equal(esCumpleanosHoy('1990-05-14', new Date('2026-05-14')), true)
})

test('esCumpleanosHoy: no es el día', () => {
  assert.equal(esCumpleanosHoy('1990-05-14', new Date('2026-05-15')), false)
  assert.equal(esCumpleanosHoy('1990-05-14', new Date('2026-06-14')), false)
})

test('esCumpleanosHoy: nacido el 29 de febrero festeja el 28 en año NO bisiesto', () => {
  assert.equal(esCumpleanosHoy('1996-02-29', new Date('2026-02-28')), true)
  assert.equal(esCumpleanosHoy('1996-02-29', new Date('2026-03-01')), false)
})

test('esCumpleanosHoy: nacido el 29 de febrero festeja el 29 en año SÍ bisiesto', () => {
  assert.equal(esCumpleanosHoy('1996-02-29', new Date('2024-02-29')), true)
  assert.equal(esCumpleanosHoy('1996-02-29', new Date('2024-02-28')), false)
})

test('esCumpleanosHoy: años bisiestos "de siglo" (regla /100 y /400)', () => {
  // 2000 es bisiesto (divisible por 400), 2100 no lo es (divisible por 100
  // pero no por 400) -- la regla ingenua "año % 4 === 0" se equivoca en
  // ambos casos si no chequea también %100 y %400. "hoy" siempre es una
  // fecha real (nunca un 29/2 en un año no bisiesto, eso no existe).
  assert.equal(esCumpleanosHoy('1996-02-29', new Date('2000-02-29')), true)
  assert.equal(esCumpleanosHoy('1996-02-29', new Date('2100-02-28')), true)
  assert.equal(esCumpleanosHoy('1996-02-29', new Date('2100-03-01')), false)
})
