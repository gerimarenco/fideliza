import test from 'node:test'
import assert from 'node:assert/strict'
import { buscarClientas } from './buscarClientas.js'

const clientas = [
  { id: '1', nombre: 'María Victoria Denapole', email: 'mvd@ejemplo.test' },
  { id: '2', nombre: 'Rosana Rassori', email: 'rosi@ejemplo.test' },
  { id: '3', nombre: null, email: 'sinnombre.garcia@ejemplo.test' },
  { id: '4', nombre: 'Maria Laura Gómez', email: 'mlg@ejemplo.test' },
]
const ids = (lista) => lista.map((c) => c.id).join()

test('sin texto devuelve todas', () => {
  assert.equal(ids(buscarClientas(clientas, '')), '1,2,3,4')
  assert.equal(ids(buscarClientas(clientas, '   ')), '1,2,3,4')
})

test('sin distinguir acentos ni mayúsculas', () => {
  assert.equal(ids(buscarClientas(clientas, 'MARIA')), '1,4')
  assert.equal(ids(buscarClientas(clientas, 'gomez')), '4')
  assert.equal(ids(buscarClientas(clientas, 'Gómez')), '4')
})

test('varias palabras en cualquier orden', () => {
  assert.equal(ids(buscarClientas(clientas, 'denapole maría')), '1')
  assert.equal(ids(buscarClientas(clientas, 'maria laura')), '4')
  assert.equal(ids(buscarClientas(clientas, 'maria rassori')), '')
})

test('busca también en el email (clientas sin nombre)', () => {
  assert.equal(ids(buscarClientas(clientas, 'garcia')), '3')
  assert.equal(ids(buscarClientas(clientas, 'rosi@')), '2')
})

test('lista vacía o sin lista', () => {
  assert.deepEqual(buscarClientas(undefined, 'x'), [])
  assert.deepEqual(buscarClientas(null, ''), [])
})
