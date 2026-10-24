import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mesArgentina } from '@/lib/periodo'
import { ORIGENES_COMPRA } from '@/lib/clienteStats'

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

  // Mes calendario en hora de Argentina, no en UTC.
  const { inicio: inicioMes, fin: inicioMesSiguiente } = mesArgentina()

  const [clientesActivos, canjesEsteMes, movimientos, clientesConCompra] = await Promise.all([
    // Total de clientes registrados (el nombre quedó de antes; no son solo
    // los que compraron -- para eso está clientesConCompraEsteMes).
    prisma.cliente.count({ where: { negocioId } }),

    prisma.canje.count({
      where: {
        createdAt: { gte: inicioMes, lt: inicioMesSiguiente },
        premio: { negocioId },
      },
    }),

    // puntos: { gt: 0 } para no restar los vencimientos (origen:
    // "vencimiento", puntos negativo) de "otorgados" — un mes con vencimientos
    // no tiene que mostrar menos puntos otorgados de los que realmente se
    // dieron.
    prisma.movimientoPuntos.aggregate({
      where: { negocioId, createdAt: { gte: inicioMes, lt: inicioMesSiguiente }, puntos: { gt: 0 } },
      _sum: { puntos: true },
    }),

    // Clientes distintos con al menos una compra real este mes (no cuentan
    // regalos de cumpleaños ni bonos de referidos).
    prisma.movimientoPuntos.groupBy({
      by: ['clienteId'],
      where: { negocioId, createdAt: { gte: inicioMes, lt: inicioMesSiguiente }, puntos: { gt: 0 }, origen: { in: ORIGENES_COMPRA } },
    }),
  ])

  return NextResponse.json({
    clientesActivos,
    puntosOtorgadosEsteMes: movimientos._sum.puntos || 0,
    canjesEsteMes,
    clientesConCompraEsteMes: clientesConCompra.length,
  })
}
