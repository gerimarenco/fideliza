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

export async function PATCH(request) {
  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'El id del negocio es obligatorio' }, { status: 400 })
  }

  const negocio = await prisma.negocio.update({
    where: { id: body.id },
    data: {
      tiendanubeStoreId: body.tiendanubeStoreId,
      tiendanubeAccessToken: body.tiendanubeAccessToken,
    }
  })
  return NextResponse.json(negocio)
}