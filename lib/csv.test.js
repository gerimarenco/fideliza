import { test } from 'node:test'
import assert from 'node:assert/strict'
import { celdaCsv, fechaCorta } from './csv.js'

test('celdaCsv: valores comunes quedan igual', () => {
  assert.equal(celdaCsv('Lucía Fernández'), 'Lucía Fernández')
  assert.equal(celdaCsv(3420), '3420')
  assert.equal(celdaCsv(null), '')
  assert.equal(celdaCsv(undefined), '')
})

test('celdaCsv: separador, comillas y saltos de línea van entre comillas', () => {
  assert.equal(celdaCsv('a;b'), '"a;b"')
  assert.equal(celdaCsv('dijo "hola"'), '"dijo ""hola"""')
  assert.equal(celdaCsv('dos\nlíneas'), '"dos\nlíneas"')
})

test('celdaCsv: neutraliza fórmulas de Excel', () => {
  assert.equal(celdaCsv('=HYPERLINK("http://x","clic")'), `"'=HYPERLINK(""http://x"",""clic"")"`)
  assert.equal(celdaCsv('+5491123456'), "'+5491123456")
  assert.equal(celdaCsv('-1'), "'-1")
  assert.equal(celdaCsv('@SUMA(A1)'), "'@SUMA(A1)")
})

test('fechaCorta: dd/mm/aaaa en hora argentina o en UTC', () => {
  // 02:00 UTC del 5/3 es todavía 4/3 en Argentina
  assert.equal(fechaCorta('2026-03-05T02:00:00Z'), '04/03/2026')
  assert.equal(fechaCorta('2026-03-05T02:00:00Z', { utc: true }), '05/03/2026')
  assert.equal(fechaCorta(new Date(Date.UTC(1990, 0, 9))), '08/01/1990')
  assert.equal(fechaCorta(new Date(Date.UTC(1990, 0, 9)), { utc: true }), '09/01/1990')
  assert.equal(fechaCorta(null), '')
  assert.equal(fechaCorta('no-es-fecha'), '')
})
