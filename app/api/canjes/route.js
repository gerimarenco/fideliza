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

  if (!negocioId) {
    return NextResponse.json({ error: 'negocioId es obligatorio' }, { status: 400 })
  }

  if (session.user.role === 'negocio' && negocioId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize')) || 20))
  const where = { premio: { negocioId } }

  const [total, items] = await Promise.all([
    prisma.canje.count({ where }),
    prisma.canje.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        entregado: true,
        cliente: { select: { id: true, nombre: true, email: true } },
        premio: { select: { id: true, nombre: true, puntos: true, emoji: true } },
      }
    })
  ])

  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { premioId } = body
  // Un cliente solo puede canjear para sí mismo, nunca en nombre de otro.
  const clienteId = session.user.role === 'cliente' ? session.user.id : body.clienteId

  const premio = await prisma.premio.findUnique({
    where: { id: premioId }
  })

  if (!premio || !premio.activo) {
    return NextResponse.json({ error: 'Este premio ya no está disponible' }, { status: 400 })
  }

  try {
    // updateMany con el saldo en el WHERE: Postgres serializa los UPDATE
    // concurrentes sobre la misma fila, así que si dos canjes llegan al
    // mismo tiempo, el segundo recién evalúa "puntos >= premio.puntos"
    // después de que el primero ya haya confirmado su descuento. Sin esto
    // (leer puntos y decidir aparte, en un paso separado del UPDATE), dos
    // pedidos simultáneos podían pasar los dos la validación antes de que
    // cualquiera descontara, dejando al cliente con saldo negativo.
    const canje = await prisma.$transaction(async (tx) => {
      const { count } = await tx.cliente.updateMany({
        where: { id: clienteId, puntos: { gte: premio.puntos } },
        data: { puntos: { decrement: premio.puntos } }
      })

      if (count === 0) {
        throw new Error('PUNTOS_INSUFICIENTES')
      }

      return tx.canje.create({ data: { clienteId, premioId } })
    })

    return NextResponse.json(canje)
  } catch (error) {
    if (error.message === 'PUNTOS_INSUFICIENTES') {
      return NextResponse.json({ error: 'Puntos insuficientes' }, { status: 400 })
    }
    throw error
  }
}
