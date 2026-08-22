import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioId = searchParams.get('negocioId')

  if (session.user.role === 'negocio' && negocioId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize')) || 20))
  const where = negocioId ? { negocioId } : {}

  const [total, items] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, nombre: true, telefono: true, email: true, puntos: true,
        negocioId: true, createdAt: true,
      }
    })
  ])

  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const body = await request.json()

  const autorizado = session?.user?.role === 'admin' ||
    (session?.user?.role === 'negocio' && session.user.id === body.negocioId)

  if (!autorizado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!body.email) {
    return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })
  }

  const passwordGenerada = Math.random().toString(36).slice(-8)

  const { password, ...cliente } = await prisma.cliente.create({
    data: {
      nombre: body.nombre,
      telefono: body.telefono,
      email: body.email,
      password: await hashPassword(passwordGenerada),
      negocioId: body.negocioId,
    }
  })

  // passwordGenerada va en texto plano en la respuesta: el negocio la
  // necesita para pasársela al cliente. El hash (password) se descarta acá,
  // en la base queda solo el hash.
  return NextResponse.json({ ...cliente, passwordGenerada })
}
