import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Historial de puntos para el propio cliente logueado (pantalla "Mis
// movimientos" del panel del cliente, ver app/page.js) -- nunca el de otro
// cliente, el id sale siempre de la sesión.
//
// No hay una sola tabla con todo el historial: los créditos y vencimientos
// quedan en MovimientoPuntos (ver ese modelo), pero un canje no genera un
// MovimientoPuntos propio, queda solo en Canje (con el premio elegido). Acá
// se junta lo dos y se ordena por fecha en JS -- el volumen por cliente es
// chico (no hay paginación real de la base, ver clientesSelectPara/
// calcularStatsClientes para el mismo criterio del lado del negocio).
const ORIGEN_A_DESCRIPCION = {
  manual: 'Compra',
  mercadopago: 'Compra',
  tiendanube: 'Compra online',
  dragonfish: 'Compra',
  cumpleanos: 'Regalo de cumpleaños',
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize')) || 20))

  const [movimientos, canjes] = await Promise.all([
    prisma.movimientoPuntos.findMany({
      where: { clienteId: session.user.id },
      select: { id: true, puntos: true, origen: true, createdAt: true },
    }),
    prisma.canje.findMany({
      where: { clienteId: session.user.id },
      select: { id: true, createdAt: true, premio: { select: { nombre: true, puntos: true, emoji: true } } },
    }),
  ])

  const items = [
    ...movimientos.map((m) => ({
      id: `mov-${m.id}`,
      fecha: m.createdAt,
      puntos: m.puntos,
      tipo: m.origen === 'vencimiento' ? 'vencimiento' : 'credito',
      descripcion: m.origen === 'vencimiento' ? 'Vencimiento de puntos' : (ORIGEN_A_DESCRIPCION[m.origen] || 'Puntos acreditados'),
      emoji: m.origen === 'vencimiento' ? '⏳' : (m.origen === 'cumpleanos' ? '🎂' : '🛍️'),
    })),
    ...canjes.map((c) => ({
      id: `canje-${c.id}`,
      fecha: c.createdAt,
      puntos: -c.premio.puntos,
      tipo: 'canje',
      descripcion: `Canjeaste "${c.premio.nombre}"`,
      emoji: c.premio.emoji || '🎁',
    })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  const total = items.length
  const paginados = items.slice((page - 1) * pageSize, page * pageSize)

  return NextResponse.json({ items: paginados, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 })
}
