import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armarMensaje, enlaceWhatsapp, primerNombre, PLANTILLA_SUGERIDA } from './mensajeWhatsapp.js'

test('primerNombre: la primera palabra, con mayúscula inicial', () => {
  assert.equal(primerNombre('MARIA victoria Denapole'), 'Maria')
  assert.equal(primerNombre('  ana  '), 'Ana')
  assert.equal(primerNombre('ÉRICA Suarez'), 'Érica')
  assert.equal(primerNombre(null), '')
  assert.equal(primerNombre('   '), '')
})

test('armarMensaje: nombre, puntos con punto de miles y club', () => {
  const m = armarMensaje(PLANTILLA_SUGERIDA, { nombre: 'Ana Gómez', puntos: 3420, club: 'Club Peperina' })
  assert.ok(m.startsWith('¡Hola Ana! '), m)
  assert.ok(m.includes('Como sos parte de Club Peperina'))
  assert.ok(m.includes('hoy tenés 3.420'))
  assert.ok(!/\{(nombre|puntos|club)\}/.test(m))
})

test('armarMensaje: sin nombre queda "¡Hola!", y los datos se reemplazan todas las veces', () => {
  assert.equal(armarMensaje('¡Hola {nombre}! Tenés {puntos} puntos', { nombre: '', puntos: 0, club: 'X' }), '¡Hola! Tenés 0 puntos')
  assert.equal(armarMensaje('{nombre}, {nombre}: {puntos}/{puntos}', { nombre: 'luz', puntos: 1234567, club: '' }), 'Luz, Luz: 1.234.567/1.234.567')
})

test('enlaceWhatsapp: número con 549 y texto codificado; sin celular, null', () => {
  const link = enlaceWhatsapp('+5492324500294', '¡Hola Ana! 🖤 & más')
  assert.equal(link, `https://wa.me/5492324500294?text=${encodeURIComponent('¡Hola Ana! 🖤 & más')}`)
  assert.equal(enlaceWhatsapp('2324500294', 'x'), 'https://wa.me/5492324500294?text=x', 'celular argentino sin código de país')
  assert.equal(enlaceWhatsapp('', 'x'), null)
  assert.equal(enlaceWhatsapp('123', 'x'), null)
})
