import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword, verifyPassword } from '@/lib/password'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// El negocio cambia su propia contraseña (nunca la de otro): el id sale de
// la sesión, no del body.
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'negocio') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { passwordActual, passwordNueva } = await request.json()

  if (!passwordActual || !passwordNueva) {
    return NextResponse.json({ error: 'La contraseña actual y la nueva son obligatorias' }, { status: 400 })
  }

  if (passwordNueva.length < 6) {
    return NextResponse.json({ error: 'La nueva contraseña tiene que tener al menos 6 caracteres' }, { status: 400 })
  }

  const negocio = await prisma.negocio.findUnique({ where: { id: session.user.id } })
  const { valid } = await verifyPassword(passwordActual, negocio.password)
  if (!valid) {
    return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 401 })
  }

  await prisma.negocio.update({
    where: { id: session.user.id },
    data: { password: await hashPassword(passwordNueva) },
  })

  return NextResponse.json({ ok: true })
}
