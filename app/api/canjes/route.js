import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { premioId } = body
  // Un cliente solo puede canjear para sí mismo, nunca en nombre de otro.
  const clienteId = session.user.role === 'cliente' ? session.user.id : body.clienteId

  const premio = await prisma.premio.findUnique({
    where: { id: premioId }
  })

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId }
  })

  if (cliente.puntos < premio.puntos) {
    return NextResponse.json({ error: 'Puntos insuficientes' }, { status: 400 })
  }

  const canje = await prisma.canje.create({
    data: { clienteId, premioId }
  })

  await prisma.cliente.update({
    where: { id: clienteId },
    data: { puntos: { decrement: premio.puntos } }
  })

  return NextResponse.json(canje)
}
