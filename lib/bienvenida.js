// Bonificación de bienvenida: puntos de regalo al crear la cuenta, solo
// durante el período que el negocio configura en Ajustes (Negocio.
// bienvenidaPuntos / bienvenidaDesde / bienvenidaHasta). Toda la regla vive
// acá: el registro (app/api/registro/[negocio]) y Ajustes la usan.
//
// Las fechas se eligen como días de calendario de Argentina (UTC-3, sin
// horario de verano) y se guardan como instantes: `desde` es el comienzo del
// primer día y `hasta` el comienzo del día SIGUIENTE al último (exclusivo),
// así "del 30/10 al 7/11 inclusive" queda [30/10 00:00, 8/11 00:00) en hora
// argentina.
const DESFASE_ARGENTINA_MS = 3 * 60 * 60 * 1000
const DIA_MS = 24 * 60 * 60 * 1000
const FECHA = /^\d{4}-\d{2}-\d{2}$/

// '2026-10-30' → instante de las 00:00 de ese día en Argentina.
export function inicioDiaArgentina(fecha) {
  if (typeof fecha !== 'string' || !FECHA.test(fecha)) return null
  const d = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fecha) return null
  return new Date(d.getTime() + DESFASE_ARGENTINA_MS)
}

// Último día inclusive → instante en que deja de valer (00:00 del día siguiente).
export function finDiaArgentina(fecha) {
  const inicio = inicioDiaArgentina(fecha)
  return inicio ? new Date(inicio.getTime() + DIA_MS) : null
}

// Instante guardado → 'aaaa-mm-dd' del día en Argentina (para el formulario).
// Para `hasta` (exclusivo) se pasa `{ ultimoDia: true }` y devuelve el día
// anterior, el que se ve como "hasta".
export function fechaArgentina(instante, { ultimoDia = false } = {}) {
  if (!instante) return ''
  const t = new Date(instante).getTime() - DESFASE_ARGENTINA_MS - (ultimoDia ? DIA_MS : 0)
  return new Date(t).toISOString().slice(0, 10)
}

// Cuántos puntos de bienvenida corresponden a una cuenta creada en `ahora`
// en este negocio (0 si no hay promoción o está fuera de fecha).
export function puntosBienvenida(negocio, ahora = new Date()) {
  const puntos = negocio?.bienvenidaPuntos
  if (!Number.isInteger(puntos) || puntos <= 0) return 0
  if (!negocio.bienvenidaDesde || !negocio.bienvenidaHasta) return 0
  const t = ahora.getTime()
  if (t < new Date(negocio.bienvenidaDesde).getTime() || t >= new Date(negocio.bienvenidaHasta).getTime()) return 0
  return puntos
}

// Celular comparable: solo dígitos, los últimos 10 (código de área + número),
// para que "+54 9 2324 55-5000" y "2324555000" cuenten como el mismo.
export function celularComparable(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '')
  return digitos.length >= 10 ? digitos.slice(-10) : digitos
}

// Acredita la bonificación dentro de la transacción que crea la cuenta
// (app/api/registro/[negocio]). Devuelve los puntos acreditados (0 si no
// corresponde). Una sola vez por cuenta (Cliente.bienvenidaOtorgada) y una
// sola vez por celular dentro del negocio: crear otra cuenta con otro email
// y el mismo celular no vuelve a cobrarla. El lock por celular evita que dos
// registros simultáneos con el mismo número la cobren los dos.
export async function acreditarBienvenida(tx, cliente, negocio, puntos) {
  if (!(puntos > 0)) return 0
  const celular = celularComparable(cliente.telefono)
  if (celular) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bienvenida:${negocio.id}:${celular}`}))`
    const candidatas = await tx.cliente.findMany({
      where: { negocioId: negocio.id, bienvenidaOtorgada: true, id: { not: cliente.id }, telefono: { endsWith: celular.slice(-8) } },
      select: { telefono: true },
    })
    if (candidatas.some((c) => celularComparable(c.telefono) === celular)) return 0
  }

  const { count } = await tx.cliente.updateMany({
    where: { id: cliente.id, bienvenidaOtorgada: false },
    data: { bienvenidaOtorgada: true, puntos: { increment: puntos } },
  })
  if (count === 0) return 0
  await tx.movimientoPuntos.create({
    data: { clienteId: cliente.id, negocioId: negocio.id, puntos, origen: 'bienvenida', saldoRestante: puntos },
  })
  return puntos
}
