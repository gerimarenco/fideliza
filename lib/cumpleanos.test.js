import test from 'node:test'
import assert from 'node:assert/strict'
import { esCumpleanosHoy, diasHastaProximoCumpleanos } from './cumpleanos.js'

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

test('diasHastaProximoCumpleanos: es hoy mismo -> 0', () => {
  assert.equal(diasHastaProximoCumpleanos('1990-05-14', new Date('2026-05-14')), 0)
})

test('diasHastaProximoCumpleanos: todavía no pasó este año', () => {
  assert.equal(diasHastaProximoCumpleanos('1990-05-14', new Date('2026-05-04')), 10)
})

test('diasHastaProximoCumpleanos: ya pasó este año -> cuenta hasta el año que viene', () => {
  // 20/12/2026 a 14/5/2027: 11 días hasta fin de año + ene(31)+feb(28,
  // 2027 no bisiesto)+mar(31)+abr(30) + 14 de mayo = 145
  assert.equal(diasHastaProximoCumpleanos('1990-05-14', new Date('2026-12-20')), 145)
})

test('diasHastaProximoCumpleanos: nacido el 29 de febrero, próximo cumpleaños cae en año no bisiesto', () => {
  // Desde el 1/1/2026 (no bisiesto) al 28/2/2026: 27 (enero) + 28 = 58 días
  assert.equal(diasHastaProximoCumpleanos('1996-02-29', new Date('2026-01-01')), 58)
})

test('diasHastaProximoCumpleanos: nacido el 29 de febrero, próximo cumpleaños cae en año bisiesto', () => {
  // Desde el 1/1/2024 (bisiesto) al 29/2/2024: 30 (enero) + 29 = 59 días
  assert.equal(diasHastaProximoCumpleanos('1996-02-29', new Date('2024-01-01')), 59)
})
