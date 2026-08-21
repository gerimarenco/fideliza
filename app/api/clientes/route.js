import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'

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

  if (!body.email) {
    return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })
  }

  const passwordGenerada = Math.random().toString(36).slice(-8)

  const cliente = await prisma.cliente.create({
    data: {
      nombre: body.nombre,
      telefono: body.telefono,
      email: body.email,
      password: await hashPassword(passwordGenerada),
      negocioId: body.negocioId,
    }
  })

  // passwordGenerada va en texto plano en la respuesta: el negocio la
  // necesita para pasársela al cliente, en la base queda solo el hash.
  return NextResponse.json({ ...cliente, passwordGenerada })
}