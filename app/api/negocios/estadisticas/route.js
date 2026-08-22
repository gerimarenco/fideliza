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

  const ahora = new Date()
  const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1))
  const inicioMesSiguiente = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1))

  const [clientesActivos, canjesEsteMes, movimientos] = await Promise.all([
    prisma.cliente.count({ where: { negocioId } }),

    prisma.canje.count({
      where: {
        createdAt: { gte: inicioMes, lt: inicioMesSiguiente },
        premio: { negocioId },
      },
    }),

    prisma.movimientoPuntos.aggregate({
      where: { negocioId, createdAt: { gte: inicioMes, lt: inicioMesSiguiente } },
      _sum: { puntos: true },
    }),
  ])

  return NextResponse.json({
    clientesActivos,
    puntosOtorgadosEsteMes: movimientos._sum.puntos || 0,
    canjesEsteMes,
  })
}
