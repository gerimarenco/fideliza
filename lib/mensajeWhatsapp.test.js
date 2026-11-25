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

test('el mensaje de Black Days de Peperina: [nombre] con corchetes y **negrita** de WhatsApp', () => {
  const plantilla = '¡Hola [nombre]! 🤎\n\nTenemos una novedad que queremos compartir con vos antes que con nadie.\n\n¡Se vienen los **BLACK DAYS en PEPERINA**!\n\nPreparamos una selección muy especial, donde vas a encontrar prendas bellísimas, de excelente calidad y con esos detalles que tanto nos gustan, todas a un **precio único de $30.000**.\n\nPor ser parte del **Club Peperina**, tenés el beneficio de acceder desde el miércoles 25/11, un día antes del lanzamiento general, para elegir tus favoritas.\n\n¡Nos encanta que seas parte de nuestro Club!\n\nTe esperamos en el local. 🖤'
  const m = armarMensaje(plantilla, { nombre: 'MARIA victoria Denapole', puntos: 120, club: 'Club Peperina' })
  assert.ok(m.startsWith('¡Hola Maria! 🤎\n\nTenemos una novedad'), m.slice(0, 40))
  assert.ok(m.includes('¡Se vienen los *BLACK DAYS en PEPERINA*!'))
  assert.ok(m.includes('a un *precio único de $30.000*.'))
  assert.ok(m.includes('Por ser parte del *Club Peperina*,'))
  assert.ok(!m.includes('**') && !m.includes('[nombre]'))
  assert.ok(m.endsWith('Te esperamos en el local. 🖤'))
  assert.equal(armarMensaje('¡Hola [Nombre]!', { nombre: '', puntos: 0, club: '' }), '¡Hola!', 'sin nombre, "¡Hola!"')
  assert.equal(armarMensaje('[puntos] / {PUNTOS} en [club]', { nombre: 'x', puntos: 1500, club: 'Club X' }), '1.500 / 1.500 en Club X')
})
