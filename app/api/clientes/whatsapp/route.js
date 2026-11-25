import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// "Mensajes por WhatsApp" (panel del negocio): las clientas del negocio con
// lo justo para armar su mensaje (nombre, celular, puntos). El panel arma el
// texto y el link de WhatsApp (lib/mensajeWhatsapp.js); desde acá no se
// manda nada. Solo el negocio dueño o el admin, siempre de ese negocio.
export async function GET(request) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (rol !== 'negocio' && rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const negocioId = new URL(request.url).searchParams.get('negocioId')
  if (!negocioId) return NextResponse.json({ error: 'negocioId es obligatorio' }, { status: 400 })
  if (rol === 'negocio' && negocioId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const clientes = await prisma.cliente.findMany({
    where: { negocioId },
    orderBy: [{ nombre: 'asc' }, { createdAt: 'asc' }],
    take: 5000,
    select: { id: true, nombre: true, telefono: true, puntos: true },
  })
  return NextResponse.json({ clientes })
}
