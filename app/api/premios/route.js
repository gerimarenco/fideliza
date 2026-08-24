import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
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
    prisma.premio.count({ where }),
    prisma.premio.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, nombre: true, puntos: true, emoji: true, activo: true, negocioId: true,
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

  if (!body.nombre || !body.puntos || !body.emoji) {
    return NextResponse.json({ error: 'Nombre, puntos y emoji son obligatorios' }, { status: 400 })
  }

  const premio = await prisma.premio.create({
    data: {
      nombre: body.nombre,
      puntos: parseInt(body.puntos),
      emoji: body.emoji,
      negocioId: body.negocioId,
    }
  })
  return NextResponse.json(premio)
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'El id del premio es obligatorio' }, { status: 400 })
  }

  const premio = await prisma.premio.findUnique({ where: { id: body.id } })
  if (!premio) {
    return NextResponse.json({ error: 'Premio no encontrado' }, { status: 404 })
  }

  const autorizado = session?.user?.role === 'admin' ||
    (session?.user?.role === 'negocio' && session.user.id === premio.negocioId)

  if (!autorizado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const data = {}
  if (body.nombre !== undefined) data.nombre = body.nombre
  if (body.puntos !== undefined) data.puntos = parseInt(body.puntos)
  if (body.emoji !== undefined) data.emoji = body.emoji
  if (body.activo !== undefined) data.activo = !!body.activo

  const actualizado = await prisma.premio.update({
    where: { id: body.id },
    data,
  })
  return NextResponse.json(actualizado)
}
