import test from 'node:test'
import assert from 'node:assert/strict'
import { restarMeses } from './restarMeses.js'
import { ventanaAviso, fechaVencimientoLote, resumenPorVencer, enPausaDeAviso, DIAS_AVISO_VENCIMIENTO } from './vencimientoPuntos.js'

const DIA_MS = 24 * 60 * 60 * 1000

// Simula la tarea diaria real (13:00 UTC, vence si createdAt <=
// restarMeses(ahora, meses)) y devuelve la primera corrida que vence el lote.
function primeraCorridaQueVence(createdAt, meses) {
  let corrida = new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate(), 13))
  while (!(createdAt <= restarMeses(corrida, meses))) corrida = new Date(corrida.getTime() + DIA_MS)
  return corrida
}

test('fechaVencimientoLote: caso simple, 9 meses', () => {
  assert.equal(fechaVencimientoLote(new Date('2026-03-10T15:00:00Z'), 9).toISOString(), '2026-12-11T13:00:00.000Z')
  // Antes de las 13 UTC del mismo día: vence ese mismo día.
  assert.equal(fechaVencimientoLote(new Date('2026-03-10T12:00:00Z'), 9).toISOString(), '2026-12-10T13:00:00.000Z')
})

test('fechaVencimientoLote: coincide con la tarea real día por día (fines de mes, bisiestos, 6/9/12 meses)', () => {
  for (const meses of [1, 6, 9, 12]) {
    let fecha = new Date('2027-01-01T00:00:00Z')
    for (let i = 0; i < 800; i++) {
      // Horas variadas, para cubrir antes y después de las 13 UTC.
      const createdAt = new Date(fecha.getTime() + ((i * 7) % 24) * 60 * 60 * 1000)
      assert.equal(
        fechaVencimientoLote(createdAt, meses).toISOString(),
        primeraCorridaQueVence(createdAt, meses).toISOString(),
        `${createdAt.toISOString()} + ${meses} meses`,
      )
      fecha = new Date(fecha.getTime() + DIA_MS)
    }
  }
})

test('ventanaAviso: incluye lo que vence en los próximos 30 días y excluye lo que ya vence hoy', () => {
  const ahora = new Date('2027-06-15T13:00:00Z')
  const { desde, hasta } = ventanaAviso(ahora, 9)
  const enVentana = (createdAt) => createdAt > desde && createdAt <= hasta
  for (const dias of [1, 10, DIAS_AVISO_VENCIMIENTO]) {
    // Un lote que la tarea vence exactamente dentro de `dias` días.
    const createdAt = restarMeses(new Date(ahora.getTime() + dias * DIA_MS), 9)
    assert.ok(enVentana(createdAt), `vence en ${dias} días`)
    assert.equal(fechaVencimientoLote(createdAt, 9).toISOString(), new Date(ahora.getTime() + dias * DIA_MS).toISOString())
  }
  assert.ok(!enVentana(restarMeses(ahora, 9)), 'vence hoy: lo vence la tarea, no se avisa')
  assert.ok(!enVentana(restarMeses(new Date(ahora.getTime() + (DIAS_AVISO_VENCIMIENTO + 1) * DIA_MS), 9)), 'vence en 31 días: todavía no')
})

test('resumenPorVencer: suma los lotes, toma la primera fecha y nunca supera el saldo', () => {
  const lotes = [
    { createdAt: new Date('2026-09-20T15:00:00Z'), saldoRestante: 200 },
    { createdAt: new Date('2026-09-05T15:00:00Z'), saldoRestante: 150 },
    { createdAt: new Date('2026-09-10T15:00:00Z'), saldoRestante: 0 },
  ]
  const r = resumenPorVencer(lotes, 9, 1000)
  assert.equal(r.puntos, 350)
  assert.equal(r.fecha.toISOString(), '2027-06-06T13:00:00.000Z')
  assert.equal(resumenPorVencer(lotes, 9, 300).puntos, 300)
  assert.equal(resumenPorVencer(lotes, 9, 0), null)
  assert.equal(resumenPorVencer([], 9, 100), null)
  assert.equal(resumenPorVencer([{ createdAt: new Date(), saldoRestante: 0 }], 9, 100), null)
})

test('enPausaDeAviso: 14 días entre un aviso y el siguiente', () => {
  const ahora = new Date('2027-06-15T13:00:00Z')
  assert.equal(enPausaDeAviso(null, ahora), false)
  assert.equal(enPausaDeAviso(new Date(ahora.getTime() - 13 * DIA_MS), ahora), true)
  assert.equal(enPausaDeAviso(new Date(ahora.getTime() - 14 * DIA_MS), ahora), false)
})
