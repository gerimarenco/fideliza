import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fechaDeVenta, fechaVerificada, inicioDeVentas, anteriorAlInicio, controlDeFecha, INICIO_VENTAS_LOCAL } from './dragonfishFecha.js'
import { cuentaPosterior } from './dragonfishIdentificacion.js'

const peperina = { dragonfishBaseDeDatos: 'PEPERINA' }
const otro = { dragonfishBaseDeDatos: 'OTRO' }
// El aviso llega hoy (procesado tarde), la venta es de otro día.
const venta = (fecha, hora, createdAt = new Date('2026-11-11T15:00:00Z')) => ({ fecha, hora, createdAt })

test('fechaDeVenta: la fecha y hora de Dragon Fish, en hora de Argentina (UTC-3)', () => {
  assert.equal(fechaDeVenta(venta('21/08/2026', '12:53:14')).toISOString(), '2026-08-21T15:53:14.000Z')
  assert.equal(fechaDeVenta(venta('5/11/2026', '00:00:00')).toISOString(), '2026-11-05T03:00:00.000Z')
  assert.equal(fechaDeVenta(venta('04/11/2026', '23:59:59')).toISOString(), '2026-11-05T02:59:59.000Z')
  assert.equal(fechaDeVenta(venta('2026-11-05', '9:30')).toISOString(), '2026-11-05T12:30:00.000Z')
  // Sin hora: las 00:00 de ese día.
  assert.equal(fechaDeVenta(venta('05/11/2026', '')).toISOString(), '2026-11-05T03:00:00.000Z')
})

test('fechaDeVenta: no usa cuándo llegó el aviso si hay fecha; si no se puede leer, sí', () => {
  const llegada = new Date('2026-11-11T15:00:00Z')
  assert.notEqual(fechaDeVenta(venta('20/10/2026', '10:00:00', llegada)).getTime(), llegada.getTime())
  for (const malo of ['', '31/02/2026', '2026/11/05', 'ayer', null]) {
    assert.equal(fechaDeVenta(venta(malo, '10:00:00', llegada)).getTime(), llegada.getTime(), String(malo))
  }
  assert.equal(fechaDeVenta(venta('05/11/2026', '25:00:00', llegada)).getTime(), llegada.getTime())
  assert.equal(fechaDeVenta({ fecha: '' }), null)
})

test('inicioDeVentas: Peperina desde el 05/11/2026 00:00 de Argentina; los demás negocios, sin límite', () => {
  assert.equal(INICIO_VENTAS_LOCAL.PEPERINA, '2026-11-05')
  assert.equal(inicioDeVentas(peperina).toISOString(), '2026-11-05T03:00:00.000Z')
  assert.equal(inicioDeVentas({ dragonfishBaseDeDatos: ' peperina ' }).toISOString(), '2026-11-05T03:00:00.000Z')
  assert.equal(inicioDeVentas(otro), null)
  assert.equal(inicioDeVentas({ dragonfishBaseDeDatos: null }), null)
  assert.equal(inicioDeVentas(null), null)
})

test('anteriorAlInicio: el límite es por la fecha de la venta, no por cuándo llegó el aviso', () => {
  assert.equal(anteriorAlInicio(peperina, venta('04/11/2026', '23:59:59')), true, 'el 04/11 a las 23:59:59 queda afuera aunque el aviso haya llegado el 11/11')
  assert.equal(anteriorAlInicio(peperina, venta('05/11/2026', '00:00:00')), false, 'el 05/11 a las 00:00 entra')
  assert.equal(anteriorAlInicio(peperina, venta('15/10/2026', '18:00:00')), true)
  assert.equal(anteriorAlInicio(peperina, venta('01/09/2026', '18:00:00')), true)
  // Ventas futuras: siempre entran.
  assert.equal(anteriorAlInicio(peperina, venta('11/11/2026', '18:00:00')), false)
  assert.equal(anteriorAlInicio(peperina, venta('20/03/2027', '10:00:00', new Date('2027-03-20T13:00:05Z'))), false)
  // Sin fecha verificable: afuera, aunque el aviso haya llegado después del 05/11.
  assert.equal(anteriorAlInicio(peperina, venta('', '', new Date('2026-11-04T12:00:00Z'))), true)
  assert.equal(anteriorAlInicio(peperina, venta('', '', new Date('2026-11-06T12:00:00Z'))), true)
  // Otro negocio: nunca.
  assert.equal(anteriorAlInicio(otro, venta('04/11/2026', '23:59:59')), false)
  assert.equal(anteriorAlInicio(otro, venta('01/09/2026', '10:00:00')), false)
})

test('cuentaPosterior: compara con la fecha de la venta, no con la llegada del aviso', () => {
  // Venta el 06/11 a las 10:00, aviso procesado el 11/11; cuenta creada el 08/11.
  const v = venta('06/11/2026', '10:00:00')
  assert.equal(cuentaPosterior({ createdAt: new Date('2026-11-08T12:00:00Z') }, v), true)
  assert.equal(cuentaPosterior({ createdAt: new Date('2026-11-06T12:59:59Z') }, v), false, '09:59:59 de Argentina: ya existía')
  assert.equal(cuentaPosterior({ createdAt: new Date('2026-11-06T13:00:01Z') }, v), true, '10:00:01 de Argentina: no existía todavía')
})

test('fechaVerificada: null si la fecha está vacía, es ilegible, no existe o es posterior al aviso', () => {
  const llegada = new Date('2026-11-06T15:00:00Z')
  assert.equal(fechaVerificada(venta('06/11/2026', '11:59:00', llegada)).toISOString(), '2026-11-06T14:59:00.000Z')
  for (const [fecha, hora] of [['', ''], ['  ', '10:00'], ['6 de noviembre', ''], ['06-11-2026', ''], ['2026/11/06', ''], ['31/11/2026', ''], ['00/11/2026', ''], ['06/13/2026', ''], ['06/11/2026', '25:00'], ['06/11/2026', 'mediodía'], ['06/11/2026', '10:61']]) {
    assert.equal(fechaVerificada(venta(fecha, hora, llegada)), null, `${fecha} ${hora}`)
  }
  // Más de un día después de que llegó el aviso: no es la fecha de esta venta.
  assert.equal(fechaVerificada(venta('20/11/2026', '10:00:00', llegada)), null)
  // Un reloj adelantado unas horas en la PC del local sí vale.
  assert.equal(fechaVerificada(venta('06/11/2026', '18:00:00', llegada)).toISOString(), '2026-11-06T21:00:00.000Z')
})

test('recuperación de Peperina: los cuatro casos de fecha', () => {
  // Sin fecha, recibida el 05/11: excluida.
  assert.equal(anteriorAlInicio(peperina, venta('', '', new Date('2026-11-05T15:00:00Z'))), true)
  // Fecha ilegible, recibida el 06/11: excluida.
  assert.equal(anteriorAlInicio(peperina, venta('6 de noviembre', '10:00', new Date('2026-11-06T13:00:05Z'))), true)
  // Fecha real 04/11, aviso recibido el 05/11: excluida.
  assert.equal(anteriorAlInicio(peperina, venta('04/11/2026', '23:59:59', new Date('2026-11-05T03:00:30Z'))), true)
  // Fecha real 05/11: incluida.
  assert.equal(anteriorAlInicio(peperina, venta('05/11/2026', '00:00:00', new Date('2026-11-05T03:00:20Z'))), false)
  // Otro negocio, sin fecha: sin límite (como antes).
  assert.equal(anteriorAlInicio(otro, venta('', '', new Date('2026-11-04T12:00:00Z'))), false)
})

test('controlDeFecha (agente): en Peperina, sin fecha verificable nunca suma, aunque el aviso sea de recién', () => {
  // Con fecha verificable: mismo criterio que la recuperación.
  assert.equal(controlDeFecha(peperina, venta('04/11/2026', '23:59:59', new Date('2026-11-05T03:00:30Z'))), 'fuera_de_periodo')
  assert.equal(controlDeFecha(peperina, venta('05/11/2026', '00:00:00', new Date('2026-11-05T03:00:20Z'))), null)
  assert.equal(controlDeFecha(peperina, venta('12/11/2026', '10:00:00', new Date('2026-11-12T13:00:05Z'))), null, 'compra nueva con fecha: normal')
  // Venta vieja reenviada el 05/11, con su fecha original: fuera de período.
  assert.equal(controlDeFecha(peperina, venta('20/10/2026', '17:00:00', new Date('2026-11-05T15:00:00Z'))), 'fuera_de_periodo')
  // Sin fecha, o con fecha inválida: "sin_fecha", aunque el aviso haya llegado recién.
  const ahora = new Date()
  assert.equal(controlDeFecha(peperina, venta('', '', ahora)), 'sin_fecha')
  assert.equal(controlDeFecha(peperina, venta('', '', new Date('2026-11-05T15:00:00Z'))), 'sin_fecha')
  for (const [fecha, hora] of [['31/11/2026', '10:00'], ['6 de noviembre', ''], ['12/11/2026', '25:00'], ['20/11/2026', '10:00']]) {
    assert.equal(controlDeFecha(peperina, venta(fecha, hora, new Date('2026-11-12T13:00:05Z'))), 'sin_fecha', `${fecha} ${hora}`)
  }
  // Otro negocio: nunca (sin cambios).
  assert.equal(controlDeFecha(otro, venta('', '', ahora)), null)
  assert.equal(controlDeFecha(otro, venta('01/09/2026', '10:00:00')), null)
})
