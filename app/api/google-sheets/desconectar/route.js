import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { descifrar } from '@/lib/cifrado'
import { revocar } from '@/lib/googleSheets'

// Desconecta la cuenta de Google del negocio: revoca el permiso en Google y
// borra la conexión (y el token cifrado). La hoja queda en su Drive, sin
// cambios; Retornar deja de poder escribirla.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'negocio') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const conexion = await prisma.conexionGoogle.findUnique({ where: { negocioId: session.user.id } })
  if (!conexion) return NextResponse.json({ ok: true })
  const token = descifrar(conexion.refreshTokenCifrado)
  const revocado = token ? await revocar(token) : false
  await prisma.conexionGoogle.delete({ where: { negocioId: session.user.id } })
  return NextResponse.json({ ok: true, revocado })
}
