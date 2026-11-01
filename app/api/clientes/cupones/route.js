import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { premioDelCanje } from '@/lib/guiaCupon'
import { estadoVisible } from '@/lib/estadoCupon'

// "Mis cupones" del panel de la clienta: todos los cupones de sus canjes,
// usados o no, con el premio tal como se canjeó (ver premioDelCanje) y el
// estado según Tiendanube (ver lib/estadoCupon.js). Solo los propios: el id
// sale de la sesión. Solo lee: no genera ni toca cupones.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const canjes = await prisma.canje.findMany({
    where: {
      clienteId: session.user.id,
      OR: [{ tiendanubeCuponCodigo: { not: null } }, { tiendanubeCuponError: { not: null } }],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      tiendanubeCuponCodigo: true,
      tiendanubeCuponError: true,
      cuponEstado: true,
      cuponVerificadoEn: true,
      cuponUsadoEn: true,
      premioNombre: true,
      puntosUsados: true,
      premioBeneficio: true,
      premio: { select: { nombre: true, puntos: true, emoji: true, tiendanubeProductoUrl: true, tiendanubeProductoId: true, tiendanubeDescuentoPorcentaje: true, tiendanubeDescuentoMonto: true, tiendanubeDescuentoMontoMinimo: true } },
    },
  })

  return NextResponse.json({
    items: canjes.map((c) => ({
      id: c.id,
      codigo: c.tiendanubeCuponCodigo,
      fecha: c.createdAt,
      premio: premioDelCanje(c),
      estado: estadoVisible(c),
      verificadoEn: c.cuponVerificadoEn,
      usadoEn: c.cuponUsadoEn,
    })),
  })
}
