import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularNivel, formatearMiles, descripcionNiveles } from './clienteStats.js'

test('calcularNivel: umbrales exactos y los bordes de cada nivel', () => {
  assert.equal(calcularNivel(0).nombre, 'Bronce')
  assert.equal(calcularNivel(999).nombre, 'Bronce')
  assert.equal(calcularNivel(1000).nombre, 'Plata')
  assert.equal(calcularNivel(2999).nombre, 'Plata')
  assert.equal(calcularNivel(3000).nombre, 'Oro')
  assert.equal(calcularNivel(5999).nombre, 'Oro')
  assert.equal(calcularNivel(6000).nombre, 'Diamante')
  assert.equal(calcularNivel(9999).nombre, 'Diamante')
  assert.equal(calcularNivel(10000).nombre, 'VIP')
  assert.equal(calcularNivel(999999).nombre, 'VIP')
})

test('calcularNivel: nunca deja a un cliente sin nivel', () => {
  // Bronce (mínimo 0) siempre tiene que "atrapar" cualquier valor negativo
  // -- no debería pasar en la práctica, pero calcularStatsClientes arranca
  // sumando movimientos uno por uno, así que un estado intermedio negativo
  // no debería nunca dejar `nivel` en undefined.
  assert.equal(calcularNivel(-100).nombre, 'Bronce')
})

test('formatearMiles: separador de miles con punto, sin Intl', () => {
  assert.equal(formatearMiles(0), '0')
  assert.equal(formatearMiles(999), '999')
  assert.equal(formatearMiles(1000), '1.000')
  assert.equal(formatearMiles(15000), '15.000')
  assert.equal(formatearMiles(1234567), '1.234.567')
})

test('descripcionNiveles: de menor a mayor, sin huecos entre rangos', () => {
  const texto = descripcionNiveles()
  const lineas = texto.split('\n')
  assert.equal(lineas.length, 5)
  // Ascendente: Bronce primero, VIP al final (al revés del array NIVELES,
  // que va de mayor a menor porque calcularNivel() necesita encontrar el
  // primero que el cliente supera).
  assert.match(lineas[0], /^Bronce: 0 a 999 puntos$/)
  assert.match(lineas[1], /^Plata: 1\.000 a 2\.999 puntos$/)
  assert.match(lineas[2], /^Oro: 3\.000 a 5\.999 puntos$/)
  assert.match(lineas[3], /^Diamante: 6\.000 a 9\.999 puntos$/)
  assert.match(lineas[4], /^VIP: 10\.000\+ puntos$/)
})
