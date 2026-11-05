import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { premioDeAlerta, filtroAlertaPendiente } from '@/lib/alertaCanje'

// Resumen de la alerta de canje para el panel del negocio (Inicio y
// Clientes): qué premio la dispara y cuántas clientas la tienen pendiente.
// Solo el negocio dueño o el admin.
export async function GET(request) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (rol !== 'negocio' && rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const negocioId = new URL(request.url).searchParams.get('negocioId')
  if (!negocioId) return NextResponse.json({ error: 'negocioId es obligatorio' }, { status: 400 })
  if (rol === 'negocio' && negocioId !== session.user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const negocio = await prisma.negocio.findUnique({ where: { id: negocioId }, select: { id: true, alertaCanjePremioId: true } })
  if (!negocio) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  const premios = negocio.alertaCanjePremioId
    ? await prisma.premio.findMany({ where: { id: negocio.alertaCanjePremioId }, select: { id: true, nombre: true, puntos: true, activo: true, negocioId: true } })
    : []
  const premio = premioDeAlerta(negocio, premios)
  if (!premio) return NextResponse.json({ premio: null, pendientes: 0, configurada: !!negocio.alertaCanjePremioId })
  const pendientes = await prisma.cliente.count({ where: { negocioId, ...filtroAlertaPendiente(premio) } })
  return NextResponse.json({ premio: { id: premio.id, nombre: premio.nombre, puntos: premio.puntos }, pendientes, configurada: true })
}
