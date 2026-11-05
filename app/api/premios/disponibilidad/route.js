import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { estadoDePremio } from '@/lib/disponibilidad'

// Estado de stock del producto de cada premio activo de un negocio, para las
// etiquetas del panel ("Sin stock por el momento", "Disponibilidad sin
// confirmar"). { [premioId]: 'disponible' | 'sin_stock' | 'desconocido' }.
// Una clienta solo puede preguntar por su propio negocio. Solo lee Tiendanube.
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const negocioId = new URL(request.url).searchParams.get('negocioId')
  if (!negocioId) return NextResponse.json({ error: 'negocioId es obligatorio' }, { status: 400 })

  const rol = session.user.role
  if (rol === 'negocio' && session.user.id !== negocioId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (rol === 'cliente') {
    const cliente = await prisma.cliente.findUnique({ where: { id: session.user.id }, select: { negocioId: true } })
    if (cliente?.negocioId !== negocioId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  } else if (rol !== 'negocio' && rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const negocio = await prisma.negocio.findUnique({ where: { id: negocioId }, select: { tiendanubeStoreId: true, tiendanubeAccessToken: true } })
  const premios = await prisma.premio.findMany({
    where: { negocioId, activo: true, tiendanubeProductoId: { not: null } },
    select: { id: true, tiendanubeProductoId: true, tiendanubeVarianteId: true },
  })
  const estados = await Promise.all(premios.map((p) => estadoDePremio(p, negocio)))
  return NextResponse.json(Object.fromEntries(premios.map((p, i) => [p.id, estados[i]])), { headers: { 'Cache-Control': 'no-store' } })
}
