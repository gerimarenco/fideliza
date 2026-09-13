import test from 'node:test'
import assert from 'node:assert/strict'
import { nombreClub } from './nombreClub.js'

test('nombreClub: antepone "Club " al nombre del negocio', () => {
  assert.equal(nombreClub('Peperina'), 'Club Peperina')
  assert.equal(nombreClub(''), 'Club ')
})
