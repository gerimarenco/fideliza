import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calcularStatsClientes, calcularNivel } from '@/lib/clienteStats'

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
  const busqueda = searchParams.get('q')?.trim()
  const nivelFiltro = searchParams.get('nivel')?.trim().toLowerCase()

  const where = negocioId ? { negocioId } : {}
  // Buscador de la lista de Clientes (nombre, email o teléfono) -- un
  // negocio con muchos clientes ya no puede confiar solo en el paginado
  // para encontrar a alguien puntual.
  if (busqueda) {
    where.OR = [
      { nombre: { contains: busqueda, mode: 'insensitive' } },
      { email: { contains: busqueda, mode: 'insensitive' } },
      { telefono: { contains: busqueda, mode: 'insensitive' } },
    ]
  }

  // Filtro por nivel (Bronce/Plata/Oro/Diamante/VIP): el nivel no vive en
  // la base, se calcula a partir de los puntos GANADOS de por vida (ver
  // lib/clienteStats.js), así que hace falta un paso aparte antes de
  // paginar -- sumar los puntos de cada cliente que ya matchea el resto de
  // los filtros, calcularle el nivel, y quedarse solo con los que caen en
  // el elegido. Sin esto, filtrar por nivel solo dentro de la página
  // actual (después de paginar) daría resultados incompletos o vacíos
  // según en qué página esté cada cliente.
  if (nivelFiltro) {
    const candidatos = await prisma.cliente.findMany({ where, select: { id: true } })
    const candidatoIds = candidatos.map((c) => c.id)
    const agregados = candidatoIds.length
      ? await prisma.movimientoPuntos.groupBy({
          by: ['clienteId'],
          where: { clienteId: { in: candidatoIds }, puntos: { gt: 0 } },
          _sum: { puntos: true },
        })
      : []
    const puntosPorCliente = Object.fromEntries(agregados.map((a) => [a.clienteId, a._sum.puntos || 0]))
    where.id = {
      in: candidatoIds.filter((id) => calcularNivel(puntosPorCliente[id] || 0).nombre.toLowerCase() === nivelFiltro),
    }
  }

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

  const stats = await calcularStatsClientes(prisma, items)
  const itemsConStats = items.map((c) => ({ ...c, stats: stats[c.id] }))

  return NextResponse.json({ items: itemsConStats, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 })
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

  let clienteCreado
  try {
    clienteCreado = await prisma.cliente.create({
      data: {
        nombre: body.nombre,
        telefono: body.telefono,
        email: body.email,
        password: await hashPassword(passwordGenerada),
        negocioId: body.negocioId,
      }
    })
  } catch (error) {
    // Cliente.email es único en toda la base (no por negocio): P2002 acá
    // significa que ya existe una cuenta con ese email, de este negocio o
    // de otro.
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 })
    }
    throw error
  }
  const { password, ...cliente } = clienteCreado

  // passwordGenerada va en texto plano en la respuesta: el negocio la
  // necesita para pasársela al cliente. El hash (password) se descarta acá,
  // en la base queda solo el hash.
  return NextResponse.json({ ...cliente, passwordGenerada })
}
