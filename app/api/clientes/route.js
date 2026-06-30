import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const negocioId = searchParams.get('negocioId')
  
  const clientes = await prisma.cliente.findMany({
    where: negocioId ? { negocioId } : {},
    include: { canjes: true }
  })
  return NextResponse.json(clientes)
}

export async function POST(request) {
  const body = await request.json()
  const cliente = await prisma.cliente.create({
    data: {
      nombre: body.nombre,
      telefono: body.telefono,
      email: body.email || null,
      negocioId: body.negocioId,
    }
  })
  return NextResponse.json(cliente)
}