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

// Motivos por los que una cuenta nueva NO recibe la bonificación automática
// (Cliente.bienvenidaMotivo). La cuenta se crea igual; el negocio puede
// revisarlo a mano.
// - celular_en_otra_cuenta: el celular coincide con otra cuenta del mismo
//   negocio, creada antes o que ya cobró la bonificación (la misma persona
//   con otro email, o alguien que comparte el celular: no se puede saber
//   cuál, así que no se acredita sola).
// - sin_celular: sin celular no se puede comprobar que sea una persona nueva.
export const MOTIVO_CELULAR_EN_OTRA_CUENTA = 'celular_en_otra_cuenta'
export const MOTIVO_SIN_CELULAR = 'sin_celular'

// ¿Por qué esta cuenta no puede recibir la bonificación? null si puede. Solo
// lee: la usa acreditarBienvenida y la simulación del script retroactivo.
//
// Cuenta "anterior" = creada antes que esta (o en el mismo instante con un id
// menor), de cualquier fecha: una clienta histórica sin bonificación que se
// registra de nuevo con otro email no la cobra. También cuenta cualquier
// cuenta que ya la cobró, aunque sea posterior. Así, entre varias cuentas con
// el mismo celular, solo la primera puede recibirla. El celular se compara
// en la base con la misma regla que celularComparable (solo dígitos, los
// últimos 10), también para celulares viejos guardados con guiones.
export async function motivoSinBienvenida(db, cliente, negocio) {
  const celular = celularComparable(cliente.telefono)
  if (!celular) return MOTIVO_SIN_CELULAR
  const otras = await db.$queryRaw`
    SELECT 1 FROM "Cliente" otra, (SELECT "createdAt" FROM "Cliente" WHERE id = ${cliente.id}) esta
    WHERE otra."negocioId" = ${negocio.id}
      AND otra.id <> ${cliente.id}
      AND right(regexp_replace(coalesce(otra.telefono, ''), '[^0-9]', '', 'g'), 10) = ${celular}
      AND (otra."bienvenidaOtorgada"
           OR otra."createdAt" < esta."createdAt"
           OR (otra."createdAt" = esta."createdAt" AND otra.id < ${cliente.id}))
    LIMIT 1`
  return otras.length > 0 ? MOTIVO_CELULAR_EN_OTRA_CUENTA : null
}

// Acredita la bonificación dentro de la transacción que crea la cuenta
// (app/api/registro/[negocio]) o desde el script retroactivo. Devuelve
// { puntos, motivo }: los puntos acreditados (0 si no corresponde) y, si no
// se acreditó, por qué. Una sola vez por cuenta (Cliente.bienvenidaOtorgada)
// y una sola por celular dentro del negocio (motivoSinBienvenida). El lock
// por celular evita que dos registros simultáneos con el mismo número la
// cobren los dos: el segundo espera y ve la cuenta del primero. Si no
// corresponde por el celular, el motivo queda guardado en la cuenta
// (bienvenidaMotivo); nunca se tocan puntos ni movimientos de otras cuentas.
export async function acreditarBienvenida(tx, cliente, negocio, puntos) {
  if (!(puntos > 0)) return { puntos: 0, motivo: null }
  const celular = celularComparable(cliente.telefono)
  if (celular) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bienvenida:${negocio.id}:${celular}`}))`
  }
  const motivo = await motivoSinBienvenida(tx, cliente, negocio)
  if (motivo) {
    await tx.cliente.updateMany({
      where: { id: cliente.id, bienvenidaOtorgada: false },
      data: { bienvenidaMotivo: motivo },
    })
    return { puntos: 0, motivo }
  }

  const { count } = await tx.cliente.updateMany({
    where: { id: cliente.id, bienvenidaOtorgada: false },
    data: { bienvenidaOtorgada: true, bienvenidaMotivo: null, puntos: { increment: puntos } },
  })
  if (count === 0) return { puntos: 0, motivo: 'ya_otorgada' }
  await tx.movimientoPuntos.create({
    data: { clienteId: cliente.id, negocioId: negocio.id, puntos, origen: 'bienvenida', saldoRestante: puntos },
  })
  return { puntos, motivo: null }
}
