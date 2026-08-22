import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Nunca incluir password/tiendanubeAccessToken acá: esta respuesta viaja
// tal cual al navegador de negocio y cliente.
const NEGOCIO_SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  ciudad: true,
  emoji: true,
  puntosXPeso: true,
  slug: true,
  clientes: {
    select: { id: true, nombre: true, email: true, puntos: true }
  },
  premios: {
    select: { id: true, nombre: true, puntos: true, emoji: true }
  },
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let where
  if (session.user.role === 'admin') {
    where = {}
  } else if (session.user.role === 'negocio') {
    where = { id: session.user.id }
  } else if (session.user.role === 'cliente') {
    where = { clientes: { some: { id: session.user.id } } }
  } else {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const negocios = await prisma.negocio.findMany({ where, select: NEGOCIO_SELECT })
  return NextResponse.json(negocios)
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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
  const session = await getServerSession(authOptions)
  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'El id del negocio es obligatorio' }, { status: 400 })
  }

  const esAdmin = session?.user?.role === 'admin'
  const esElMismoNegocio = session?.user?.role === 'negocio' && session.user.id === body.id

  if (!esAdmin && !esElMismoNegocio) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
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
