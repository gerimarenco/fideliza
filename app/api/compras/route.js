import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarEmailPuntosAcreditados } from '@/lib/email'
import { calcularPuntosPorCompra } from '@/lib/puntos'
import { acreditarSiEsPrimeraCompraReferida } from '@/lib/referidos'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const body = await request.json()
  const { clienteId, monto, negocioId } = body

  const autorizado = session?.user?.role === 'admin' ||
    (session?.user?.role === 'negocio' && session.user.id === negocioId)

  if (!autorizado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const montoNumerico = Number(monto)
  if (!negocioId || !clienteId || !Number.isFinite(montoNumerico) || montoNumerico <= 0) {
    return NextResponse.json({ error: 'negocioId, clienteId y un monto mayor a 0 son obligatorios' }, { status: 400 })
  }

  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId }
  })

  if (!negocio) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Desactivar un negocio (ver app/api/negocios) lo saca de circulación sin
  // borrar su historial — sin este chequeo, seguía pudiendo sumarle puntos
  // a sus clientes por esta vía aunque ya no tuviera que operar.
  if (!negocio.activo) {
    return NextResponse.json({ error: 'Este negocio está desactivado' }, { status: 403 })
  }

  // Sin esto, cualquier negocio autenticado podía sumarle puntos a un
  // cliente de otro negocio: alcanzaba con mandar su propio negocioId (que
  // sí se valida arriba) junto con el clienteId de cualquier cliente ajeno.
  const clienteExistente = await prisma.cliente.findUnique({ where: { id: clienteId } })
  if (!clienteExistente || clienteExistente.negocioId !== negocioId) {
    return NextResponse.json({ error: 'El cliente no pertenece a este negocio' }, { status: 403 })
  }

  const puntosASumar = calcularPuntosPorCompra(montoNumerico, negocio.puntosXPeso)

  const [clienteActualizado, referido] = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.cliente.update({
      where: { id: clienteId },
      data: { puntos: { increment: puntosASumar } }
    })
    await tx.movimientoPuntos.create({
      data: { clienteId, negocioId, puntos: puntosASumar, origen: 'manual', saldoRestante: puntosASumar }
    })
    const resultadoReferido = await acreditarSiEsPrimeraCompraReferida(tx, clienteExistente, negocio)
    return [actualizado, resultadoReferido]
  })

  const { password, ...cliente } = clienteActualizado

  // Si esta fue la primera compra de una clienta referida, su saldo final
  // (`clienteActualizado.puntos`) quedó desactualizado -- se le pagó el
  // bono después de leerlo, dentro de la misma transacción. Se relee una
  // sola vez, en vez de intentar cargar ese cálculo a mano acá.
  const puntosTotalesFinales = referido
    ? (await prisma.cliente.findUnique({ where: { id: clienteId }, select: { puntos: true } })).puntos
    : clienteActualizado.puntos

  await enviarEmailPuntosAcreditados({
    email: clienteActualizado.email,
    puntosAcreditados: puntosASumar,
    puntosTotales: puntosTotalesFinales,
    negocioNombre: negocio.nombre,
  })

  if (referido) {
    await enviarEmailPuntosAcreditados({
      email: referido.invitadorEmail,
      puntosAcreditados: referido.puntos,
      puntosTotales: referido.invitadorPuntosTotales,
      negocioNombre: negocio.nombre,
    })
  }

  return NextResponse.json({ cliente, puntosASumados: puntosASumar })
}
