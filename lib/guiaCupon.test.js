import test from 'node:test'
import assert from 'node:assert/strict'
import { guiaCupon, linkSeguro } from './guiaCupon.js'

const negocio = { sitioWeb: 'https://peperina.com.ar', negocioNombre: 'Peperina' }

test('producto gratis con link: prioriza la página del producto', () => {
  const g = guiaCupon({ nombre: 'Pañuelo de seda', tiendanubeProductoId: '123', tiendanubeProductoUrl: 'https://peperina.com.ar/productos/panuelo' }, negocio)
  assert.equal(g.linkTienda, 'https://peperina.com.ar/productos/panuelo')
  assert.equal(g.textoBotonTienda, 'Ver el producto en la tienda')
  assert.match(g.beneficio, /cubre el precio de Pañuelo de seda/)
  assert.match(g.pasos[1], /agregalo al carrito/)
  assert.equal(g.pasos.length, 3)
})

test('producto gratis sin link: va a la tienda y pide buscar el producto', () => {
  const g = guiaCupon({ nombre: 'Pañuelo de seda', tiendanubeProductoId: '123' }, negocio)
  assert.equal(g.linkTienda, 'https://peperina.com.ar/')
  assert.equal(g.textoBotonTienda, 'Ir a la tienda de Peperina')
  assert.match(g.pasos[1], /buscá Pañuelo de seda/)
})

test('porcentaje: beneficio y tienda principal', () => {
  const g = guiaCupon({ nombre: '10% en toda la tienda', tiendanubeDescuentoPorcentaje: 10 }, negocio)
  assert.equal(g.beneficio, '10% de descuento en tu compra.')
  assert.equal(g.linkTienda, 'https://peperina.com.ar/')
  assert.match(g.pasos[2], /checkout/)
})

test('monto fijo: avisa la compra mínima', () => {
  const g = guiaCupon({ nombre: '$70.000 de descuento', tiendanubeDescuentoMonto: 70000, tiendanubeDescuentoMontoMinimo: 140000 }, negocio)
  assert.equal(g.beneficio, '$70.000 de descuento en compras desde $140.000.')
  assert.match(g.pasos[1], /hasta llegar a \$140\.000/)
})

test('una URL de producto en un premio que no es de producto no se usa', () => {
  const g = guiaCupon({ nombre: '10%', tiendanubeDescuentoPorcentaje: 10, tiendanubeProductoUrl: 'https://peperina.com.ar/x' }, negocio)
  assert.equal(g.linkTienda, 'https://peperina.com.ar/')
})

test('sin sitio web cargado no hay botón de tienda', () => {
  const g = guiaCupon({ nombre: '10%', tiendanubeDescuentoPorcentaje: 10 }, { negocioNombre: 'Peperina' })
  assert.equal(g.linkTienda, null)
})

test('linkSeguro: solo http(s)', () => {
  assert.equal(linkSeguro('javascript:alert(1)'), null)
  assert.equal(linkSeguro('peperina.com.ar'), null)
  assert.equal(linkSeguro(''), null)
  assert.equal(linkSeguro(null), null)
  assert.equal(linkSeguro(' https://peperina.com.ar/productos/x '), 'https://peperina.com.ar/productos/x')
})

test('premioDelCanje: usa lo guardado al canjear aunque el premio se haya editado', async () => {
  const { premioDelCanje } = await import('./guiaCupon.js')
  const canje = {
    premioNombre: '10% en toda la tienda',
    puntosUsados: 2500,
    premioBeneficio: { tiendanubeDescuentoPorcentaje: 10 },
    premio: { nombre: '20% en toda la tienda', puntos: 4000, emoji: 'percent', tiendanubeDescuentoPorcentaje: 20 },
  }
  const p = premioDelCanje(canje)
  assert.equal(p.nombre, '10% en toda la tienda')
  assert.equal(p.puntos, 2500)
  assert.equal(p.tiendanubeDescuentoPorcentaje, 10)
  assert.equal(p.emoji, 'percent')
  assert.equal(guiaCupon(p, negocio).beneficio, '10% de descuento en tu compra.')
})

test('premioDelCanje: un canje viejo (sin datos guardados) usa el premio actual', async () => {
  const { premioDelCanje } = await import('./guiaCupon.js')
  const p = premioDelCanje({ premioNombre: null, puntosUsados: null, premioBeneficio: null, premio: { nombre: 'Pañuelo', puntos: 5000, tiendanubeProductoId: '123', tiendanubeProductoUrl: 'https://peperina.com.ar/p' } })
  assert.equal(p.nombre, 'Pañuelo')
  assert.equal(p.puntos, 5000)
  assert.equal(p.tiendanubeProductoId, '123')
})

test('beneficioDePremio: solo los datos del cupón, nada más del premio', async () => {
  const { beneficioDePremio } = await import('./guiaCupon.js')
  assert.deepEqual(Object.keys(beneficioDePremio({ id: 'x', negocioId: 'y', tiendanubeDescuentoMonto: 70000, tiendanubeDescuentoMontoMinimo: 140000 })).sort(), ['tiendanubeDescuentoMonto', 'tiendanubeDescuentoMontoMinimo', 'tiendanubeDescuentoPorcentaje', 'tiendanubeProductoId', 'tiendanubeProductoUrl'])
})
