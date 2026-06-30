import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const body = await request.json()
  const { clienteId, monto, negocioId } = body

  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId }
  })

  const puntosASumar = Math.floor(monto / negocio.puntosXPeso)

  const cliente = await prisma.cliente.update({
    where: { id: clienteId },
    data: { puntos: { increment: puntosASumar } }
  })

  return NextResponse.json({ cliente, puntosASumados: puntosASumar })
}