// Scheduled Function de Netlify (corre todos los días, ver `config` abajo)
// que vence los puntos que un cliente no usó dentro de los N meses de
// haberlos ganado — cada compra (o regalo de cumpleaños) vence por separado,
// según su propia fecha, no el saldo total del cliente de una sola vez.
// Se activa por negocio cargando `Negocio.vencimientoPuntosMeses` desde
// Ajustes en el panel (vacío/0 lo desactiva, igual que
// regaloCumpleanosPuntos) — Peperina lo tiene en 9 meses (2026-10-24).
// Después de vencer, la misma corrida avisa por mail lo que vence en los
// próximos 30 días (ver avisarPuntosPorVencer, abajo).
//
// Depende de MovimientoPuntos.saldoRestante, que cada acreditación de puntos
// (compras, Mercado Pago, Tiendanube, Dragon Fish, regalo de cumpleaños)
// inicializa igual al monto ganado, y que un canje va descontando de a poco
// del lote más viejo primero (ver app/api/canjes). Los puntos de un cliente
// de antes de que este campo existiera no tienen lote asociado
// (`saldoRestante: null`) y por lo tanto nunca vencen — no hay forma de
// reconstruir de cuándo eran.
import { prisma } from '../../lib/db.js'
import { enviarEmailPuntosVencidos, enviarEmailPuntosPorVencer } from '../../lib/email.js'
import { restarMeses } from '../../lib/restarMeses.js'
import { ventanaAviso, resumenPorVencer, enPausaDeAviso } from '../../lib/vencimientoPuntos.js'

// Vence un lote de forma atómica: pone su saldoRestante en 0 solo si en
// ESE MISMO INSTANTE todavía es mayor a 0, y devuelve cuánto tenía justo
// antes. Postgres serializa los UPDATE concurrentes sobre la misma fila,
// así que si un canje (ver app/api/canjes) llega a consumir parte de este
// mismo lote justo antes, esta consulta ve el saldoRestante ya
// actualizado — nunca vence puntos que un canje ya gastó legítimamente
// entre que se armó la lista de lotes vencidos y que se procesó cada uno.
//
// OJO con `RETURNING`: en Postgres siempre devuelve la fila DESPUÉS del
// UPDATE, nunca la de antes — un primer intento con
// `SET "saldoRestante" = 0 ... RETURNING "saldoRestante"` devolvía
// siempre 0 (verificado corriendo esto contra una base real), así que
// nunca se descontaba nada de Cliente.puntos aunque el lote sí quedaba
// vaciado. Por eso el valor viejo se lee en un FROM con FOR UPDATE (toma
// el lock de fila ahí mismo, antes del SET) y se devuelve ESE valor, no
// una columna de la fila ya actualizada.
async function vencerLoteAtomico(tx, loteId) {
  const [fila] = await tx.$queryRaw`
    UPDATE "MovimientoPuntos" AS mp
    SET "saldoRestante" = 0
    FROM (
      SELECT id, "saldoRestante" AS monto_anterior
      FROM "MovimientoPuntos"
      WHERE id = ${loteId} AND "saldoRestante" > 0
      FOR UPDATE
    ) AS antes
    WHERE mp.id = antes.id
    RETURNING antes.monto_anterior AS monto
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
      // Un error con una clienta no tiene que frenar el vencimiento de las
      // demás: se reintenta sola al día siguiente (es idempotente, ver abajo).
      try {
        if (await vencerLotesDeCliente(negocio, clienteId, loteIds)) clientesAfectados++
      } catch (error) {
        console.error(`Vencimiento de puntos: error con el cliente ${clienteId}`, error.message)
      }
    }
  }

  // Después de vencer lo de hoy, avisar lo que vence en los próximos días
  // (ver lib/vencimientoPuntos.js). Va aparte para que un error acá nunca
  // frene el vencimiento, que es lo que mueve saldos.
  let clientesAvisados = 0
  const cupo = { restantes: MAXIMO_AVISOS_POR_CORRIDA }
  for (const negocio of negocios) {
    try {
      clientesAvisados += await avisarPuntosPorVencer(negocio, ahora, cupo)
    } catch (error) {
      console.error(`Aviso de puntos por vencer: error con el negocio ${negocio.id}`, error.message)
    }
  }

  console.log(`Vencimiento de puntos: ${clientesAfectados} cliente(s) con puntos vencidos, ${clientesAvisados} avisada(s) de puntos por vencer`)
  return new Response(JSON.stringify({ clientesAfectados, clientesAvisados }), { status: 200 })
}

// Devuelve true si le venció algo a esta clienta.
async function vencerLotesDeCliente(negocio, clienteId, loteIds) {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { email: true } })
  if (!cliente) return false

  // Idempotente por construcción: una vez que un lote queda en
  // saldoRestante: 0 nunca vuelve a aparecer en el where de arriba, así que
  // un reintento del mismo día (o un disparo manual de nuevo) no vence los
  // mismos puntos dos veces.
  const resultado = await prisma.$transaction(async (tx) => {
    let total = 0
    for (const loteId of loteIds) {
      total += await vencerLoteAtomico(tx, loteId)
    }

    // Puede dar 0 si un canje consumió justo todos estos lotes entre que se
    // armó la lista y que se procesó cada uno — no hay nada real que vencer
    // ni que avisar en ese caso.
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

  if (!resultado) return false

  await enviarEmailPuntosVencidos({
    email: cliente.email,
    puntosVencidos: resultado.total,
    puntosTotales: resultado.clienteActualizado.puntos,
    negocioNombre: negocio.nombre,
    negocioId: negocio.id,
    meses: negocio.vencimientoPuntosMeses,
  })
  return true
}

// Tope de avisos por corrida y pausa entre uno y otro: Resend acepta pocos
// mails por segundo y una Scheduled Function de Netlify tiene unos 30
// segundos. Lo que no entra hoy queda sin marcar y sale mañana (los avisos
// se mandan con 30 días de anticipación, sobra margen); se avisa primero a
// quien tiene los puntos más cerca de vencer.
const MAXIMO_AVISOS_POR_CORRIDA = 25
const PAUSA_ENTRE_AVISOS_MS = 600

// Avisa por mail a cada clienta con lotes que vencen dentro de
// DIAS_AVISO_VENCIMIENTO días y que todavía no se avisaron. Devuelve a
// cuántas se les mandó el mail.
async function avisarPuntosPorVencer(negocio, ahora, cupo) {
  const { desde, hasta } = ventanaAviso(ahora, negocio.vencimientoPuntosMeses)
  const lotes = await prisma.movimientoPuntos.findMany({
    where: { negocioId: negocio.id, puntos: { gt: 0 }, saldoRestante: { gt: 0 }, avisoVencimientoEn: null, createdAt: { gt: desde, lte: hasta } },
    select: { id: true, clienteId: true },
    orderBy: { createdAt: 'asc' },
  })

  const lotesPorCliente = new Map()
  for (const lote of lotes) {
    const lista = lotesPorCliente.get(lote.clienteId) || []
    lista.push(lote.id)
    lotesPorCliente.set(lote.clienteId, lista)
  }

  let avisadas = 0
  for (const [clienteId, loteIds] of lotesPorCliente) {
    if (cupo.restantes <= 0) break
    try {
      const resultado = await avisarCliente(negocio, clienteId, loteIds, ahora)
      if (resultado === 'omitido') continue
      cupo.restantes--
      if (resultado === 'enviado') avisadas++
      await new Promise((r) => setTimeout(r, PAUSA_ENTRE_AVISOS_MS))
    } catch (error) {
      console.error(`Aviso de puntos por vencer: error con el cliente ${clienteId}`, error.message)
    }
  }
  return avisadas
}

// 'enviado', 'fallo' (se desmarca para reintentar mañana) u 'omitido' (nada
// para avisar todavía, o en la pausa entre avisos: no se intentó mandar nada).
async function avisarCliente(negocio, clienteId, loteIds, ahora) {
  // Se marca primero y se manda después, con un lock por clienta: dos
  // corridas a la vez (un reintento, un disparo manual) nunca mandan el
  // mismo aviso dos veces. La pausa entre avisos se chequea adentro del
  // mismo lock por la misma razón.
  const aviso = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'aviso-vencimiento:' + clienteId}))`
    const ultimo = await tx.movimientoPuntos.findFirst({
      where: { clienteId, negocioId: negocio.id, avisoVencimientoEn: { not: null } },
      orderBy: { avisoVencimientoEn: 'desc' },
      select: { avisoVencimientoEn: true },
    })
    if (enPausaDeAviso(ultimo?.avisoVencimientoEn, ahora)) return null

    const { count } = await tx.movimientoPuntos.updateMany({
      where: { id: { in: loteIds }, avisoVencimientoEn: null, saldoRestante: { gt: 0 } },
      data: { avisoVencimientoEn: ahora },
    })
    if (count === 0) return null

    const marcados = await tx.movimientoPuntos.findMany({
      where: { id: { in: loteIds }, avisoVencimientoEn: ahora },
      select: { id: true, createdAt: true, saldoRestante: true },
    })
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { email: true, puntos: true } })
    return { marcados, cliente }
  })
  if (!aviso?.cliente) return 'omitido'

  const resumen = resumenPorVencer(aviso.marcados, negocio.vencimientoPuntosMeses, aviso.cliente.puntos)
  if (!resumen) return 'omitido'

  const enviado = await enviarEmailPuntosPorVencer({
    email: aviso.cliente.email,
    puntosPorVencer: resumen.puntos,
    fechaVencimiento: resumen.fecha,
    puntosTotales: aviso.cliente.puntos,
    negocioNombre: negocio.nombre,
    negocioId: negocio.id,
  })
  if (!enviado) {
    // Desmarcar para que se reintente mañana (por ejemplo, si Resend
    // rechazó el envío por límite de mails por segundo).
    await prisma.movimientoPuntos.updateMany({
      where: { id: { in: aviso.marcados.map((l) => l.id) }, avisoVencimientoEn: ahora },
      data: { avisoVencimientoEn: null },
    })
    return 'fallo'
  }
  return 'enviado'
}

export default vencimientoPuntos

export const config = {
  schedule: '0 13 * * *',
}
