import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Marcar (o desmarcar) que una empleada ya contactó a la clienta por la
// alerta de canje (lib/alertaCanje.js). Solo el negocio dueño o el admin.
// { contactada: true } guarda cuándo y con cuántos puntos estaba; false lo
// borra (por si se marcó por error). No toca puntos ni nada más.
export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (rol !== 'negocio' && rol !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  if (typeof body.contactada !== 'boolean') return NextResponse.json({ error: 'contactada tiene que ser verdadero o falso' }, { status: 400 })

  const cliente = await prisma.cliente.findUnique({ where: { id }, select: { id: true, negocioId: true, puntos: true } })
  // Una cuenta de otro negocio responde igual que si no existiera.
  if (!cliente || (rol === 'negocio' && cliente.negocioId !== session.user.id)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
  const actualizado = await prisma.cliente.update({
    where: { id },
    data: body.contactada
      ? { alertaContactadaEn: new Date(), alertaContactadaPuntos: cliente.puntos }
      : { alertaContactadaEn: null, alertaContactadaPuntos: null },
    select: { alertaContactadaEn: true, alertaContactadaPuntos: true },
  })
  return NextResponse.json(actualizado)
}
