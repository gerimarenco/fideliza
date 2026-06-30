import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const negocios = await prisma.negocio.findMany({
    include: {
      clientes: true,
      premios: true,
    }
  })
  return NextResponse.json(negocios)
}

export async function POST(request) {
  const body = await request.json()
  const negocio = await prisma.negocio.create({
    data: {
      nombre: body.nombre,
      tipo: body.tipo,
      ciudad: body.ciudad,
      emoji: body.emoji,
    }
  })
  return NextResponse.json(negocio)
}