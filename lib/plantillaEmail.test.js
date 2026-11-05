import test from 'node:test'
import assert from 'node:assert/strict'
import { remitente, htmlATexto, armarEmailHtml, seccionPremiosHtml, destacado, escaparHtml } from './plantillaEmail.js'
import { resolverTema } from './tema.js'

const BASE = 'Retornar <club@retornar.com.ar>'
const t = resolverTema({ fondo: '#F6EFE9', borde: '#EBDAC6', texto: '#221f1a', textoSecundario: '#A99886', primario: '#877152', primarioTexto: '#F6EFE9' })

test('remitente: el nombre del club con la misma dirección verificada', () => {
  assert.equal(remitente('Club Peperina', BASE), 'Club Peperina <club@retornar.com.ar>')
  assert.equal(remitente('Club Peperina', 'club@retornar.com.ar'), 'Club Peperina <club@retornar.com.ar>', 'dirección sin nombre')
  assert.equal(remitente(null, BASE), BASE, 'sin nombre: el de siempre')
  assert.equal(remitente('   ', BASE), BASE)
  const raro = remitente('Club "X" <otro@mal.com>\r\nBcc: a@b.c', BASE)
  assert.ok(!/["\r\n]/.test(raro) && raro.endsWith('<club@retornar.com.ar>') && raro.split('<').length === 2, `sin comillas, saltos ni otra dirección: ${raro}`)
  assert.ok(remitente('x'.repeat(200), BASE).length <= 60 + ' <club@retornar.com.ar>'.length)
})

test('versión de texto: sin etiquetas, con los links y sin la línea de vista previa', () => {
  const html = '<div data-preheader style="display:none">Vista previa</div><h1>Hola</h1><p>Tenés <strong>500 puntos</strong> &amp; más.</p><a href="https://retornar.com.ar/login">Ver mi cuenta</a><img src="x.png">'
  const texto = htmlATexto(html)
  assert.ok(!texto.includes('Vista previa'))
  assert.ok(!/<[^>]+>/.test(texto))
  assert.ok(texto.includes('Tenés 500 puntos & más.'))
  assert.ok(texto.includes('Ver mi cuenta (https://retornar.com.ar/login)'))
})

test('plantilla: escapa los datos y lleva preheader, botón y pie', () => {
  const html = armarEmailHtml({ t, clubSeguro: escaparHtml('Club <Peperina>'), titulo: 'Bienvenida', preheader: 'Hola <b>', contenidoHtml: '<p>ok</p>', botonUrl: 'https://retornar.com.ar/login', textoBoton: 'Ver mi cuenta', contacto: true })
  assert.ok(html.includes('Club &lt;Peperina&gt;') && !html.includes('Club <Peperina>'))
  assert.ok(html.includes('Hola &lt;b&gt;'))
  assert.ok(html.includes('href="https://retornar.com.ar/login"'))
  assert.ok(html.includes('Si tenés alguna duda, respondé este email.'))
  assert.ok(html.includes(t.fondo) && html.includes('Georgia'), 'colores del negocio y título en serif')
  assert.ok(!/display:\s*flex/.test(html), 'sin flex (Outlook)')
})

test('premios: los que alcanza y, para los otros, cuántos puntos y cuánto comprar', () => {
  const premios = [{ nombre: 'Aromatizante', puntos: 300 }, { nombre: 'Pañuelo de seda', puntos: 500 }, { nombre: 'Cartera', puntos: 2000 }]
  const html = seccionPremiosHtml(t, premios, 400, { puntosXPeso: 100 })
  assert.ok(html.includes('Ya lo podés canjear'))
  assert.ok(html.includes('Te faltan 100 puntos · comprando $10.000'), 'pañuelo: 100 puntos = $10.000 a $100 por punto')
  assert.ok(html.includes('Te faltan 1.600 puntos · comprando $160.000'))
  assert.ok(!seccionPremiosHtml(t, premios, 400).includes('comprando'), 'sin equivalencia, sin monto')
  assert.equal(seccionPremiosHtml(t, [], 400), '')
})

test('destacado: el número en serif con el color de marca legible', () => {
  const html = destacado(t, '500 puntos', 'vencen el 10/12/2026')
  assert.ok(html.includes('500 puntos') && html.includes(t.primarioLegible) && html.includes('vencen el 10/12/2026'))
})
