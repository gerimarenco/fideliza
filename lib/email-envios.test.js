import test from 'node:test'
import assert from 'node:assert/strict'

// Resend simulado: cada envío queda en `enviados`; un destinatario que
// empieza con "rechazo" recibe el error que devuelve la API de Resend.
process.env.RESEND_API_KEY = 're_prueba'
process.env.NEXT_PUBLIC_BASE_URL = 'https://retornar.test'
const enviados = []
globalThis.fetch = async (url, opciones) => {
  const cuerpo = JSON.parse(opciones.body)
  if (String(cuerpo.to).startsWith('rechazo')) {
    return new Response(JSON.stringify({ name: 'validation_error', message: 'Dominio sin verificar', statusCode: 403 }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }
  enviados.push(cuerpo)
  return new Response(JSON.stringify({ id: 'x' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
const { enviarEmailPuntosAcreditados, enviarEmailPuntosPorVencer } = await import('./email.js')
const base = { email: 'clienta@prueba.test', puntosAcreditados: 500, puntosTotales: 900, negocioNombre: 'Peperina' }

test('compra: el texto de siempre', async () => {
  enviados.length = 0
  await enviarEmailPuntosAcreditados(base)
  assert.equal(enviados[0].subject, '+500 puntos en Club Peperina')
  assert.match(enviados[0].html, /¡Gracias por tu compra!/)
  assert.match(enviados[0].html, /icono-compra-/)
})

test('cumpleaños: no dice "gracias por tu compra"', async () => {
  enviados.length = 0
  await enviarEmailPuntosAcreditados({ ...base, motivo: 'cumpleanos' })
  assert.equal(enviados[0].subject, '¡Feliz cumpleaños! +500 puntos de regalo en Club Peperina')
  assert.doesNotMatch(enviados[0].html, /Gracias por tu compra/)
  assert.match(enviados[0].html, /¡Feliz cumpleaños!/)
  assert.match(enviados[0].html, /icono-cumpleanos-/)
  assert.match(enviados[0].html, /\+500 puntos/)
})

test('referido: explica que es por invitar a una amiga', async () => {
  enviados.length = 0
  await enviarEmailPuntosAcreditados({ ...base, motivo: 'referido' })
  assert.equal(enviados[0].subject, '+500 puntos por invitar a una amiga en Club Peperina')
  assert.doesNotMatch(enviados[0].html, /Gracias por tu compra/)
  assert.match(enviados[0].html, /Una amiga que invitaste/)
})

test('un rechazo de Resend queda en el log y no rompe a quien llama', async () => {
  const errores = []
  const original = console.error
  console.error = (...args) => errores.push(args.join(' '))
  try {
    await enviarEmailPuntosAcreditados({ ...base, email: 'rechazo@prueba.test' })
    const ok = await enviarEmailPuntosPorVencer({ email: 'rechazo@prueba.test', puntosPorVencer: 100, fechaVencimiento: new Date('2026-11-04T13:00:00Z'), puntosTotales: 900, negocioNombre: 'Peperina' })
    assert.equal(ok, false)
  } finally {
    console.error = original
  }
  // El SDK de Resend también escribe su propia línea; acá se cuentan las nuestras.
  const nuestros = errores.filter((e) => e.startsWith('Error al enviar el email'))
  assert.equal(nuestros.length, 2)
  assert.match(nuestros[0], /puntos acreditados.*Dominio sin verificar/)
  assert.doesNotMatch(errores.join(' '), /rechazo@prueba\.test/, 'el email no aparece completo en el log')
})
