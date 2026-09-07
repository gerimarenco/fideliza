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

async function vencimientoPuntos() {
  const ahora = new Date()

  const negocios = await prisma.negocio.findMany({
    where: { activo: true, vencimientoPuntosMeses: { not: null } },
    select: { id: true, nombre: true, vencimientoPuntosMeses: true },
  })

  let clientesAfectados = 0

  for (const negocio of negocios) {
    const cortePorVencimiento = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - negocio.vencimientoPuntosMeses, ahora.getUTCDate()))

    const lotesVencidos = await prisma.movimientoPuntos.findMany({
      where: { negocioId: negocio.id, puntos: { gt: 0 }, saldoRestante: { gt: 0 }, createdAt: { lte: cortePorVencimiento } },
      select: { id: true, clienteId: true, saldoRestante: true },
    })

    // Un mismo cliente puede tener varios lotes viejos venciendo el mismo
    // día (varias compras de hace 6+ meses) — se agrupan para mandar un
    // solo mail con el total, no uno por lote.
    const porCliente = new Map()
    for (const lote of lotesVencidos) {
      const acumulado = porCliente.get(lote.clienteId) || { lotes: [], total: 0 }
      acumulado.lotes.push(lote)
      acumulado.total += lote.saldoRestante
      porCliente.set(lote.clienteId, acumulado)
    }

    for (const [clienteId, { lotes, total }] of porCliente) {
      const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { email: true } })
      if (!cliente) continue

      // Idempotente por construcción: una vez que un lote queda en
      // saldoRestante: 0 nunca vuelve a aparecer en el where de arriba, así
      // que un reintento del mismo día (o un disparo manual de nuevo) no
      // vence los mismos puntos dos veces.
      const resultados = await prisma.$transaction([
        ...lotes.map((lote) => prisma.movimientoPuntos.update({
          where: { id: lote.id },
          data: { saldoRestante: 0 },
        })),
        prisma.cliente.update({
          where: { id: clienteId },
          data: { puntos: { decrement: total } },
        }),
        prisma.movimientoPuntos.create({
          data: { clienteId, negocioId: negocio.id, puntos: -total, origen: 'vencimiento' },
        }),
      ])
      const clienteActualizado = resultados[lotes.length]

      await enviarEmailPuntosVencidos({
        email: cliente.email,
        puntosVencidos: total,
        puntosTotales: clienteActualizado.puntos,
        negocioNombre: negocio.nombre,
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
