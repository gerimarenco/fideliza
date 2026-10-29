import test from 'node:test'
import assert from 'node:assert/strict'
import { inicioDiaArgentina, finDiaArgentina, fechaArgentina, puntosBienvenida, celularComparable } from './bienvenida.js'

// La promoción de Peperina: del 30/10/2026 al 7/11/2026 inclusive, 150 puntos.
const peperina = {
  bienvenidaPuntos: 150,
  bienvenidaDesde: inicioDiaArgentina('2026-10-30'),
  bienvenidaHasta: finDiaArgentina('2026-11-07'),
}

test('fechas de Argentina a instantes', () => {
  assert.equal(inicioDiaArgentina('2026-10-30').toISOString(), '2026-10-30T03:00:00.000Z')
  assert.equal(finDiaArgentina('2026-11-07').toISOString(), '2026-11-08T03:00:00.000Z')
  assert.equal(fechaArgentina(peperina.bienvenidaDesde), '2026-10-30')
  assert.equal(fechaArgentina(peperina.bienvenidaHasta, { ultimoDia: true }), '2026-11-07')
  assert.equal(inicioDiaArgentina('2026-02-30'), null)
  assert.equal(inicioDiaArgentina('30/10/2026'), null)
})

test('registro el 30 de octubre (desde las 00:00 de Argentina): 150 puntos', () => {
  assert.equal(puntosBienvenida(peperina, new Date('2026-10-30T03:00:00Z')), 150) // 00:00 ART
  assert.equal(puntosBienvenida(peperina, new Date('2026-10-30T15:00:00Z')), 150)
})

test('registro el 7 de noviembre, hasta las 23:59:59 de Argentina: 150 puntos', () => {
  assert.equal(puntosBienvenida(peperina, new Date('2026-11-07T12:00:00Z')), 150)
  assert.equal(puntosBienvenida(peperina, new Date('2026-11-08T02:59:59Z')), 150) // 23:59:59 ART del 7
})

test('registro el 8 de noviembre: nada', () => {
  assert.equal(puntosBienvenida(peperina, new Date('2026-11-08T03:00:00Z')), 0) // 00:00 ART del 8
  assert.equal(puntosBienvenida(peperina, new Date('2026-11-20T12:00:00Z')), 0)
})

test('antes del 30 de octubre: nada (también las 23:59 del 29 en Argentina)', () => {
  assert.equal(puntosBienvenida(peperina, new Date('2026-10-30T02:59:59Z')), 0)
  assert.equal(puntosBienvenida(peperina, new Date('2026-10-01T12:00:00Z')), 0)
})

test('otro negocio sin promoción configurada: nada', () => {
  assert.equal(puntosBienvenida({ bienvenidaPuntos: null }, new Date('2026-11-01T12:00:00Z')), 0)
  assert.equal(puntosBienvenida({}, new Date('2026-11-01T12:00:00Z')), 0)
  assert.equal(puntosBienvenida({ bienvenidaPuntos: 150, bienvenidaDesde: null, bienvenidaHasta: null }, new Date('2026-11-01T12:00:00Z')), 0)
})

test('celularComparable: mismo número con o sin prefijo internacional', () => {
  assert.equal(celularComparable('+54 9 2324 55-5000'), '2324555000')
  assert.equal(celularComparable('2324555000'), '2324555000')
  assert.equal(celularComparable('02324-555000'), '2324555000')
})
