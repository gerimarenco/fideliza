import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
  if (!clienteId || !Number.isFinite(montoNumerico) || montoNumerico <= 0) {
    return NextResponse.json({ error: 'clienteId y un monto mayor a 0 son obligatorios' }, { status: 400 })
  }

  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId }
  })

  if (!negocio) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Sin esto, cualquier negocio autenticado podía sumarle puntos a un
  // cliente de otro negocio: alcanzaba con mandar su propio negocioId (que
  // sí se valida arriba) junto con el clienteId de cualquier cliente ajeno.
  const clienteExistente = await prisma.cliente.findUnique({ where: { id: clienteId } })
  if (!clienteExistente || clienteExistente.negocioId !== negocioId) {
    return NextResponse.json({ error: 'El cliente no pertenece a este negocio' }, { status: 403 })
  }

  const puntosASumar = Math.floor(montoNumerico / negocio.puntosXPeso)

  const [clienteActualizado] = await prisma.$transaction([
    prisma.cliente.update({
      where: { id: clienteId },
      data: { puntos: { increment: puntosASumar } }
    }),
    prisma.movimientoPuntos.create({
      data: { clienteId, negocioId, puntos: puntosASumar, origen: 'manual' }
    }),
  ])

  const { password, ...cliente } = clienteActualizado

  return NextResponse.json({ cliente, puntosASumados: puntosASumar })
}
