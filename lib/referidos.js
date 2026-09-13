import { randomBytes } from 'crypto'

// Sin 0/O ni 1/I/L, para que nadie confunda letras y números al escribir
// el código a mano desde un mensaje de WhatsApp.
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LARGO_CODIGO = 6

// Código corto para compartir por WhatsApp/link (ver app/api/clientes/referidos,
// que lo genera la primera vez que alguien abre "Referí a una amiga" en el
// panel del cliente -- no al crear la cuenta, para no tener que hacerle un
// backfill a las cuentas que ya existían antes de este campo).
export function generarCodigoReferido() {
  const bytes = randomBytes(LARGO_CODIGO)
  let codigo = ''
  for (let i = 0; i < LARGO_CODIGO; i++) {
    codigo += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length]
  }
  return codigo
}

// Acredita el bono de referidos (mismo monto para quien invitó y para
// quien fue invitada, `Negocio.puntosReferido`) cuando corresponde: la
// primera compra real de una clienta que se registró con el link de otra.
// Se llama SIEMPRE dentro de la misma transacción que ya está acreditando
// los puntos de esa compra (ver app/api/compras, los webhooks de
// Tiendanube/Mercado Pago y app/api/dragonfish/resolver) -- nunca en vez
// de esos puntos, es un bono aparte.
//
// No hace nada (devuelve `null`) si el negocio no tiene el programa
// activado, si esta clienta no fue referida por nadie, o si ya se le
// pagó el bono a quien la invitó antes (con esta misma compra reintentada
// o con una compra anterior -- solo se paga en la primera).
//
// Devuelve los datos de quien invitó (no manda el mail de aviso acá
// adentro -- mismo criterio que el resto del proyecto, nunca una llamada
// externa dentro de una transacción de Prisma) para que el llamador le
// avise por mail después de confirmar la transacción, igual que
// `enviarEmailPuntosAcreditados` en cualquier otra acreditación.
export async function acreditarSiEsPrimeraCompraReferida(tx, cliente, negocio) {
  if (!negocio.puntosReferido || !cliente.referidoPorId || cliente.referidoRecompensado) return null

  // updateMany con la condición en el WHERE, no un find + update aparte:
  // si esta función se llamara dos veces para la misma clienta casi al
  // mismo tiempo, Postgres serializa los UPDATE concurrentes sobre la
  // misma fila, así que como mucho una de las dos ve `count > 0` y paga
  // el bono una sola vez -- mismo criterio que la validación de puntos
  // suficientes en app/api/canjes.
  const { count } = await tx.cliente.updateMany({
    where: { id: cliente.id, referidoRecompensado: false },
    data: { referidoRecompensado: true },
  })
  if (count === 0) return null

  const invitador = await tx.cliente.update({
    where: { id: cliente.referidoPorId },
    data: { puntos: { increment: negocio.puntosReferido } },
  })
  await tx.movimientoPuntos.create({
    data: {
      clienteId: cliente.referidoPorId,
      negocioId: negocio.id,
      puntos: negocio.puntosReferido,
      origen: 'referido_invitador',
      saldoRestante: negocio.puntosReferido,
    },
  })

  await tx.cliente.update({
    where: { id: cliente.id },
    data: { puntos: { increment: negocio.puntosReferido } },
  })
  await tx.movimientoPuntos.create({
    data: {
      clienteId: cliente.id,
      negocioId: negocio.id,
      puntos: negocio.puntosReferido,
      origen: 'referido_invitado',
      saldoRestante: negocio.puntosReferido,
    },
  })

  return { invitadorEmail: invitador.email, invitadorPuntosTotales: invitador.puntos, puntos: negocio.puntosReferido }
}
