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

  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId }
  })

  const puntosASumar = Math.floor(monto / negocio.puntosXPeso)

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
