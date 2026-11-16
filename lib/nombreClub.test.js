import test from 'node:test'
import assert from 'node:assert/strict'
import { nombreClub, nombreRemitente } from './nombreClub.js'
import { remitente } from './plantillaEmail.js'

test('nombreClub: antepone "Club " al nombre del negocio', () => {
  assert.equal(nombreClub('Peperina'), 'Club Peperina')
  assert.equal(nombreClub(''), 'Club ')
})

test('nombreRemitente: el nombre del club de cada negocio, o el que cargó en Ajustes', () => {
  assert.equal(nombreRemitente({ nombre: 'Peperina' }), 'Club Peperina', 'sin nombre propio: el de su club')
  assert.equal(nombreRemitente({ nombre: 'La Huerta', emailRemitenteNombre: null }), 'Club La Huerta', 'cada negocio el suyo')
  assert.equal(nombreRemitente({ nombre: 'Peperina', emailRemitenteNombre: 'Peperina Mercedes' }), 'Peperina Mercedes', 'el que cargó el negocio manda')
  assert.equal(nombreRemitente({ nombre: 'Peperina', emailRemitenteNombre: '   ' }), 'Club Peperina', 'en blanco = el del club')
  assert.equal(nombreRemitente({ nombre: 'Club de demostración' }), 'Club de demostración', 'no duplica "Club"')
  assert.equal(nombreRemitente({ nombre: '  Peperina   Mercedes ' }), 'Club Peperina Mercedes')
  assert.equal(nombreRemitente({ nombre: 'Clubhouse' }), 'Club Clubhouse', '"Clubhouse" no empieza con la palabra Club')
  assert.equal(nombreRemitente(null), null, 'sin negocio: ninguno (queda el de Retornar)')
  assert.equal(nombreRemitente({ nombre: '' }), null)
})

test('remitente final: "Club Peperina <club@retornar.com.ar>", misma dirección para todos', () => {
  const BASE = 'Retornar <club@retornar.com.ar>'
  assert.equal(remitente(nombreRemitente({ nombre: 'Peperina' }), BASE), 'Club Peperina <club@retornar.com.ar>')
  assert.equal(remitente(nombreRemitente({ nombre: 'La Huerta' }), BASE), 'Club La Huerta <club@retornar.com.ar>')
  assert.equal(remitente(nombreRemitente(null), BASE), BASE, 'sin negocio: Retornar')
  // Un nombre de negocio con caracteres raros no rompe el encabezado.
  const raro = remitente(nombreRemitente({ nombre: 'Moda "X" <a@b.c>\r\nBcc: z@z.z' }), BASE)
  assert.ok(!/["\r\n]/.test(raro) && raro.endsWith('<club@retornar.com.ar>') && raro.split('<').length === 2, raro)
})
