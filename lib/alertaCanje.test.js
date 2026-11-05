import test from 'node:test'
import assert from 'node:assert/strict'
import { premioDeAlerta, estadoAlerta, filtroAlertaPendiente, mensajeAlerta } from './alertaCanje.js'

const negocio = { id: 'n1', alertaCanjePremioId: 'p2' }
const premios = [
  { id: 'p1', nombre: '10% en toda la tienda', puntos: 2500, activo: true, negocioId: 'n1' },
  { id: 'p2', nombre: 'Pañuelo de seda', puntos: 4000, activo: true, negocioId: 'n1' },
  { id: 'p3', nombre: 'Cartera de cuero', puntos: 9000, activo: true, negocioId: 'n1' },
  { id: 'p4', nombre: 'Viejo', puntos: 5000, activo: false, negocioId: 'n1' },
]
const panuelo = premios[1]

test('premio de la alerta: el elegido por el negocio, activo y suyo', () => {
  assert.equal(premioDeAlerta(negocio, premios).id, 'p2')
  assert.equal(premioDeAlerta({ id: 'n1', alertaCanjePremioId: null }, premios), null, 'sin alerta configurada')
  assert.equal(premioDeAlerta({ id: 'n1', alertaCanjePremioId: 'p4' }, premios), null, 'premio desactivado')
  assert.equal(premioDeAlerta({ id: 'otro', alertaCanjePremioId: 'p2' }, premios), null, 'premio de otro negocio')
})

test('alerta: desde el puntaje del premio, con lo que falta para el siguiente', () => {
  assert.equal(estadoAlerta({ puntos: 3999 }, panuelo, premios), null, 'con 3.999 todavía no')
  const a = estadoAlerta({ puntos: 4000 }, panuelo, premios)
  assert.deepEqual(a.premio, { id: 'p2', nombre: 'Pañuelo de seda', puntos: 4000 })
  assert.equal(a.puntos, 4000)
  assert.deepEqual(a.siguiente, { nombre: 'Cartera de cuero', puntos: 9000, faltan: 5000 }, 'el siguiente premio activo (no el desactivado de 5.000)')
  assert.equal(a.pendiente, true)
  assert.equal(estadoAlerta({ puntos: 9500 }, panuelo, premios).siguiente, null, 'ya alcanza para todos')
  assert.equal(estadoAlerta({ puntos: 5000 }, null, premios), null, 'negocio sin alerta')
})

test('alerta contactada: deja de estar pendiente, recuerda cuándo y con cuántos puntos', () => {
  const en = new Date('2026-11-08T15:00:00Z')
  const a = estadoAlerta({ puntos: 4300, alertaContactadaEn: en, alertaContactadaPuntos: 4100 }, panuelo, premios)
  assert.equal(a.pendiente, false)
  assert.equal(a.contactadaEn, en)
  assert.equal(a.contactadaPuntos, 4100)
})

test('filtro de pendientes: puntos >= premio y sin contacto', () => {
  assert.deepEqual(filtroAlertaPendiente(panuelo), { puntos: { gte: 4000 }, alertaContactadaEn: null })
})

test('mensaje sugerido: el de Genaro, con el premio en minúscula', () => {
  assert.equal(
    mensajeAlerta({ premioNombre: 'Pañuelo', club: 'Club Peperina', haySiguiente: true }),
    '¡Hola! ¿Cómo estás? Te contamos que ya tenés los puntos necesarios para canjear tu pañuelo en Club Peperina. Además, estás cada vez más cerca de conseguir tu próximo premio.',
  )
  assert.equal(
    mensajeAlerta({ premioNombre: 'Pañuelo de seda', club: 'Club Peperina', haySiguiente: false }),
    '¡Hola! ¿Cómo estás? Te contamos que ya tenés los puntos necesarios para canjear tu pañuelo de seda en Club Peperina.',
    'sin siguiente premio, no lo promete',
  )
  assert.match(mensajeAlerta({ premioNombre: '10% en toda la tienda', club: 'Club X', haySiguiente: false }), /canjear tu 10% en toda la tienda en Club X\./)
})
