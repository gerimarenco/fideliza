import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { premioGeneraCupon, generarCuponDeCanje } from '@/lib/cuponCanje'

// Reintenta el cupón de Tiendanube de un canje cuyo cupón falló al canjear
// (Tiendanube caído, token sin permisos, etc.). Los puntos ya se habían
// descontado en ese momento: esto no descuenta nada de nuevo, solo intenta
// generar el cupón que faltó. Solo negocio (sus propios canjes) o admin.
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user.role !== 'negocio' && session.user.role !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { canjeId } = await request.json()
  if (!canjeId) {
    return NextResponse.json({ error: 'canjeId es obligatorio' }, { status: 400 })
  }

  const canje = await prisma.canje.findUnique({ where: { id: canjeId }, include: { premio: true } })
  if (!canje) {
    return NextResponse.json({ error: 'Canje no encontrado' }, { status: 404 })
  }
  if (session.user.role === 'negocio' && canje.premio.negocioId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (canje.tiendanubeCuponCodigo) {
    return NextResponse.json({ error: 'Este canje ya tiene su cupón' }, { status: 409 })
  }
  if (!premioGeneraCupon(canje.premio)) {
    return NextResponse.json({ error: 'Este premio no genera cupón de Tiendanube' }, { status: 400 })
  }

  const { cuponCodigo, cuponError } = await generarCuponDeCanje(canje.premio, canje.id)
  await prisma.canje.update({
    where: { id: canje.id },
    data: { tiendanubeCuponCodigo: cuponCodigo ?? null, tiendanubeCuponError: cuponError ?? null },
  })

  if (cuponError) {
    return NextResponse.json({ error: cuponError }, { status: 502 })
  }
  return NextResponse.json({ tiendanubeCuponCodigo: cuponCodigo })
}
