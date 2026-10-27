// Cálculos del aviso "tus puntos vencen pronto": cuándo vence cada lote de
// puntos y qué lotes entran en la ventana de aviso. El vencimiento en sí
// lo hace netlify/functions/vencimiento-puntos.mjs, que corre todos los
// días a las 13:00 UTC y vence un lote cuando
// `createdAt <= restarMeses(ahora, meses)`. Todo lo de acá usa esa misma
// regla, para que la fecha que se le avisa a la clienta sea exactamente el
// día en que la tarea le va a vencer los puntos (ni antes ni después).
import { restarMeses } from './restarMeses.js'

// Con cuánta anticipación se avisa, y cuánto esperar como mínimo entre un
// aviso y el siguiente a la misma clienta (si compra seguido, cada compra
// es un lote distinto y sin esta pausa le llegaría un mail por cada una).
// Como la pausa es menor que la anticipación, todo lote se avisa al menos
// 16 días antes de vencer.
export const DIAS_AVISO_VENCIMIENTO = 30
export const DIAS_ENTRE_AVISOS = 14

const DIA_MS = 24 * 60 * 60 * 1000
// Horario de netlify/functions/vencimiento-puntos.mjs (config.schedule).
const HORA_TAREA_UTC = 13

// Límites de createdAt de los lotes que vencen entre la corrida de hoy
// (excluida: esos ya se vencen hoy mismo) y la de dentro de
// DIAS_AVISO_VENCIMIENTO días (incluida).
export function ventanaAviso(ahora, meses) {
  return {
    desde: restarMeses(ahora, meses),
    hasta: restarMeses(new Date(ahora.getTime() + DIAS_AVISO_VENCIMIENTO * DIA_MS), meses),
  }
}

// Día y hora de la primera corrida de la tarea diaria que vence un lote
// creado en `createdAt`. Se parte de "createdAt + meses" y se ajusta al día
// exacto con la misma comparación que usa la tarea: restarMeses recorta el
// día cuando el mes de destino es más corto (31 de agosto - 6 meses), así
// que la cuenta inversa puede correrse uno o dos días.
export function fechaVencimientoLote(createdAt, meses) {
  const creado = new Date(createdAt)
  const aprox = restarMeses(creado, -meses)
  let corrida = new Date(Date.UTC(aprox.getUTCFullYear(), aprox.getUTCMonth(), aprox.getUTCDate(), HORA_TAREA_UTC))
  const vence = (fecha) => creado <= restarMeses(fecha, meses)
  for (let i = 0; i < 5 && !vence(corrida); i++) corrida = new Date(corrida.getTime() + DIA_MS)
  for (let i = 0; i < 5 && vence(new Date(corrida.getTime() - DIA_MS)); i++) corrida = new Date(corrida.getTime() - DIA_MS)
  return corrida
}

// Total que vence y la primera fecha, a partir de los lotes en la ventana
// (`{ createdAt, saldoRestante }`). Nunca más que el saldo actual de la
// clienta: los lotes son un registro auxiliar, el saldo real es
// Cliente.puntos. null si no hay nada por vencer.
export function resumenPorVencer(lotes, meses, saldoActual) {
  const conSaldo = lotes.filter((l) => l.saldoRestante > 0)
  if (conSaldo.length === 0) return null
  const total = conSaldo.reduce((suma, l) => suma + l.saldoRestante, 0)
  const puntos = Math.min(total, Math.max(0, saldoActual ?? total))
  if (puntos <= 0) return null
  const fecha = conSaldo
    .map((l) => fechaVencimientoLote(l.createdAt, meses))
    .reduce((primera, f) => (f < primera ? f : primera))
  return { puntos, fecha }
}

export function enPausaDeAviso(ultimoAviso, ahora) {
  return !!ultimoAviso && ahora.getTime() - new Date(ultimoAviso).getTime() < DIAS_ENTRE_AVISOS * DIA_MS
}
