import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const URL_HTTP_VALIDA = /^https?:\/\/.+/

// Campos opcionales de integración con Tiendanube (Grupo 7), compartidos
// entre alta y edición de premio porque la validación es idéntica en los
// dos casos. tiendanubeProductoId/Url habilitan "ver producto" + cupón por
// el precio del producto al canjear; tiendanubeDescuentoPorcentaje es la
// alternativa para un premio de % de descuento en toda la tienda (ver
// app/api/canjes y lib/tiendanube.js). Nunca se piden juntos ni son
// obligatorios: un premio sin ninguno de los dos sigue funcionando como
// siempre (se entrega en persona, sin cupón).
function datosTiendanube(body) {
  const data = {}

  if (body.tiendanubeProductoId !== undefined) {
    data.tiendanubeProductoId = String(body.tiendanubeProductoId).trim() || null
  }

  if (body.tiendanubeProductoUrl !== undefined) {
    const url = String(body.tiendanubeProductoUrl).trim()
    if (url && (url.length > 500 || !URL_HTTP_VALIDA.test(url))) {
      return { error: 'La URL del producto tiene que ser una URL válida (http:// o https://)' }
    }
    data.tiendanubeProductoUrl = url || null
  }

  if (body.tiendanubeDescuentoPorcentaje !== undefined) {
    if (body.tiendanubeDescuentoPorcentaje === null || body.tiendanubeDescuentoPorcentaje === '') {
      data.tiendanubeDescuentoPorcentaje = null
    } else {
      const porcentaje = parseInt(body.tiendanubeDescuentoPorcentaje)
      if (!Number.isInteger(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
        return { error: 'El descuento tiene que ser un número entero entre 1 y 100 (o vacío para desactivarlo)' }
      }
      data.tiendanubeDescuentoPorcentaje = porcentaje
    }
  }

  return { data }
}

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
        tiendanubeProductoId: true, tiendanubeProductoUrl: true, tiendanubeDescuentoPorcentaje: true,
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

  const puntos = parseInt(body.puntos)
  if (!Number.isInteger(puntos) || puntos <= 0) {
    return NextResponse.json({ error: 'Puntos tiene que ser un número entero mayor a 0' }, { status: 400 })
  }

  const { data: datosTn, error: errorTn } = datosTiendanube(body)
  if (errorTn) {
    return NextResponse.json({ error: errorTn }, { status: 400 })
  }

  const premio = await prisma.premio.create({
    data: {
      nombre: body.nombre,
      puntos,
      emoji: body.emoji,
      negocioId: body.negocioId,
      ...datosTn,
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
  if (body.puntos !== undefined) {
    const puntos = parseInt(body.puntos)
    if (!Number.isInteger(puntos) || puntos <= 0) {
      return NextResponse.json({ error: 'Puntos tiene que ser un número entero mayor a 0' }, { status: 400 })
    }
    data.puntos = puntos
  }
  if (body.emoji !== undefined) data.emoji = body.emoji
  if (body.activo !== undefined) data.activo = !!body.activo

  const { data: datosTn, error: errorTn } = datosTiendanube(body)
  if (errorTn) {
    return NextResponse.json({ error: errorTn }, { status: 400 })
  }
  Object.assign(data, datosTn)

  const actualizado = await prisma.premio.update({
    where: { id: body.id },
    data,
  })
  return NextResponse.json(actualizado)
}
