// Scheduled Function de Netlify (corre todos los días, ver `config` abajo)
// que vence los puntos que un cliente no usó dentro de los N meses de
// haberlos ganado — cada compra (o regalo de cumpleaños) vence por separado,
// según su propia fecha, no el saldo total del cliente de una sola vez.
// Se activa por negocio cargando `Negocio.vencimientoPuntosMeses` desde
// Ajustes en el panel (vacío/0 lo desactiva, igual que
// regaloCumpleanosPuntos) — por ahora solo Peperina lo tiene cargado, en 6.
//
// Depende de MovimientoPuntos.saldoRestante, que cada acreditación de puntos
// (compras, Mercado Pago, Tiendanube, Dragon Fish, regalo de cumpleaños)
// inicializa igual al monto ganado, y que un canje va descontando de a poco
// del lote más viejo primero (ver app/api/canjes). Los puntos de un cliente
// de antes de que este campo existiera no tienen lote asociado
// (`saldoRestante: null`) y por lo tanto nunca vencen — no hay forma de
// reconstruir de cuándo eran.
import { prisma } from '../../lib/db.js'
import { enviarEmailPuntosVencidos } from '../../lib/email.js'

// Restar meses a una fecha sin el bug clásico de JS: `setUTCMonth` no
// "clampea" el día si el mes de destino tiene menos días (ej. 31 de agosto
// menos 6 meses calcularía "31 de febrero", que Date normaliza de
// prepo a 2-3 de marzo). Si eso pasa, nos quedamos con el último día
// válido del mes de destino en vez de dejar que se corra a otro mes.
function restarMeses(fecha, meses) {
  const resultado = new Date(fecha)
  const diaOriginal = resultado.getUTCDate()
  resultado.setUTCMonth(resultado.getUTCMonth() - meses)
  if (resultado.getUTCDate() !== diaOriginal) {
    resultado.setUTCDate(0)
  }
  return resultado
}

// Vence un lote de forma atómica: pone su saldoRestante en 0 solo si en
// ESE MISMO INSTANTE todavía es mayor a 0, y devuelve cuánto tenía justo
// antes. Postgres serializa los UPDATE concurrentes sobre la misma fila,
// así que si un canje (ver app/api/canjes) llega a consumir parte de este
// mismo lote justo antes, esta consulta ve el saldoRestante ya
// actualizado — nunca vence puntos que un canje ya gastó legítimamente
// entre que se armó la lista de lotes vencidos y que se procesó cada uno.
async function vencerLoteAtomico(tx, loteId) {
  const [fila] = await tx.$queryRaw`
    UPDATE "MovimientoPuntos"
    SET "saldoRestante" = 0
    WHERE id = ${loteId} AND "saldoRestante" > 0
    RETURNING "saldoRestante" AS monto
  `
  return fila?.monto ?? 0
}

async function vencimientoPuntos() {
  const ahora = new Date()

  const negocios = await prisma.negocio.findMany({
    where: { activo: true, vencimientoPuntosMeses: { not: null } },
    select: { id: true, nombre: true, vencimientoPuntosMeses: true },
  })

  let clientesAfectados = 0

  for (const negocio of negocios) {
    const cortePorVencimiento = restarMeses(ahora, negocio.vencimientoPuntosMeses)

    const lotesVencidos = await prisma.movimientoPuntos.findMany({
      where: { negocioId: negocio.id, puntos: { gt: 0 }, saldoRestante: { gt: 0 }, createdAt: { lte: cortePorVencimiento } },
      select: { id: true, clienteId: true },
    })

    // Un mismo cliente puede tener varios lotes viejos venciendo el mismo
    // día (varias compras de hace 6+ meses) — se agrupan para mandar un
    // solo mail con el total, no uno por lote.
    const lotesPorCliente = new Map()
    for (const lote of lotesVencidos) {
      const lista = lotesPorCliente.get(lote.clienteId) || []
      lista.push(lote.id)
      lotesPorCliente.set(lote.clienteId, lista)
    }

    for (const [clienteId, loteIds] of lotesPorCliente) {
      const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { email: true } })
      if (!cliente) continue

      // Idempotente por construcción: una vez que un lote queda en
      // saldoRestante: 0 nunca vuelve a aparecer en el where de arriba, así
      // que un reintento del mismo día (o un disparo manual de nuevo) no
      // vence los mismos puntos dos veces.
      const resultado = await prisma.$transaction(async (tx) => {
        let total = 0
        for (const loteId of loteIds) {
          total += await vencerLoteAtomico(tx, loteId)
        }

        // Puede dar 0 si un canje consumió justo todos estos lotes entre
        // que se armó la lista y que se procesó cada uno — no hay nada
        // real que vencer ni que avisar en ese caso.
        if (total === 0) return null

        const clienteActualizado = await tx.cliente.update({
          where: { id: clienteId },
          data: { puntos: { decrement: total } },
        })
        await tx.movimientoPuntos.create({
          data: { clienteId, negocioId: negocio.id, puntos: -total, origen: 'vencimiento' },
        })
        return { clienteActualizado, total }
      })

      if (!resultado) continue

      await enviarEmailPuntosVencidos({
        email: cliente.email,
        puntosVencidos: resultado.total,
        puntosTotales: resultado.clienteActualizado.puntos,
        negocioNombre: negocio.nombre,
        meses: negocio.vencimientoPuntosMeses,
      })

      clientesAfectados++
    }
  }

  console.log(`Vencimiento de puntos: ${clientesAfectados} cliente(s) con puntos vencidos`)
  return new Response(JSON.stringify({ clientesAfectados }), { status: 200 })
}

export default vencimientoPuntos

export const config = {
  schedule: '0 13 * * *',
}
