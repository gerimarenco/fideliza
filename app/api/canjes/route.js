import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const body = await request.json()
  const { clienteId, premioId } = body

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