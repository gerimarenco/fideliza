import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buscarProductos } from '@/lib/tiendanube'
import { resumenProducto } from '@/lib/disponibilidad'

// Buscador de productos de la tienda del negocio, para elegir el producto de
// un premio y sus alternativas. Solo el negocio (su tienda) o el admin. Solo
// lee: GET /products?q= de Tiendanube.
export async function GET(request) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (rol !== 'negocio' && rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const negocioId = searchParams.get('negocioId')
  const texto = (searchParams.get('q') || '').trim()
  if (rol === 'negocio' && negocioId !== session.user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (texto.length < 2) return NextResponse.json({ error: 'Escribí al menos 2 letras.' }, { status: 400 })

  const negocio = await prisma.negocio.findUnique({ where: { id: negocioId || '' }, select: { tiendanubeStoreId: true, tiendanubeAccessToken: true } })
  if (!negocio?.tiendanubeStoreId || !negocio?.tiendanubeAccessToken) return NextResponse.json({ error: 'Conectá Tiendanube para buscar productos.' }, { status: 400 })
  try {
    const productos = await buscarProductos(negocio, texto)
    return NextResponse.json({
      items: productos.filter((p) => Array.isArray(p?.variants)).map((p) => {
        const r = resumenProducto(p)
        return { id: r.id, nombre: r.nombre, imagen: r.imagen, publicado: r.publicado, variantes: r.variantes.map(({ id, nombre, precio, estado }) => ({ id, nombre, precio, estado })) }
      }),
    })
  } catch (error) {
    console.error('No se pudo buscar productos en Tiendanube', error.message)
    return NextResponse.json({ error: 'No se pudo consultar Tiendanube. Probá de nuevo en unos minutos.' }, { status: 503 })
  }
}
