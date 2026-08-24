import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'
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
    where: { activo: true },
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

  if (!body.nombre || !body.tipo || !body.ciudad || !body.emoji || !body.email) {
    return NextResponse.json({ error: 'Nombre, tipo, ciudad, emoji y email son obligatorios' }, { status: 400 })
  }

  const passwordGenerada = Math.random().toString(36).slice(-8)

  const { password, ...negocio } = await prisma.negocio.create({
    data: {
      nombre: body.nombre,
      tipo: body.tipo,
      ciudad: body.ciudad,
      emoji: body.emoji,
      email: body.email,
      password: await hashPassword(passwordGenerada),
    }
  })

  // passwordGenerada va en texto plano en la respuesta: el admin la
  // necesita para pasársela al negocio. El hash (password) se descarta acá,
  // en la base queda solo el hash.
  return NextResponse.json({ ...negocio, passwordGenerada })
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

  const data = {
    tiendanubeStoreId: body.tiendanubeStoreId,
    tiendanubeAccessToken: body.tiendanubeAccessToken,
  }

  // Nombre/tipo/ciudad/emoji son datos básicos del negocio: solo el admin
  // los edita (el negocio, desde su propio panel, solo carga credenciales
  // de Tiendanube).
  if (esAdmin) {
    if (body.nombre !== undefined) data.nombre = body.nombre
    if (body.tipo !== undefined) data.tipo = body.tipo
    if (body.ciudad !== undefined) data.ciudad = body.ciudad
    if (body.emoji !== undefined) data.emoji = body.emoji
  }

  const negocio = await prisma.negocio.update({
    where: { id: body.id },
    data,
  })
  return NextResponse.json(negocio)
}
