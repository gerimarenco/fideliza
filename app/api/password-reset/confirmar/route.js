import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { hashPassword } from '@/lib/password'

function hashearToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

// Sin sesión, igual que /api/password-reset/solicitar: quien llega acá
// viene de un link de mail, no está logueado (si lo estuviera, no
// necesitaría este flujo). La identidad la da el token, no una sesión.
export async function POST(request) {
  const { token, passwordNueva } = await request.json()

  if (!token || !passwordNueva) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }
  if (passwordNueva.length < 6) {
    return NextResponse.json({ error: 'La nueva contraseña tiene que tener al menos 6 caracteres' }, { status: 400 })
  }

  const registro = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashearToken(token) } })

  // Un solo mensaje para "no existe", "ya se usó" y "venció": distinguirlos
  // no le sirve a quien está del otro lado (en los tres casos tiene que
  // pedir un link nuevo), y total el token ya viajó solo por mail al dueño
  // de la cuenta, no hay nada que proteger contra enumeración acá.
  if (!registro || registro.usadoEn || registro.expiraEn < new Date()) {
    return NextResponse.json({ error: 'Este link no es válido o ya venció. Pedí uno nuevo desde "Olvidé mi contraseña".' }, { status: 400 })
  }

  const passwordHasheada = await hashPassword(passwordNueva)

  try {
    if (registro.tipo === 'negocio') {
      await prisma.negocio.update({ where: { id: registro.usuarioId }, data: { password: passwordHasheada } })
    } else {
      await prisma.cliente.update({ where: { id: registro.usuarioId }, data: { password: passwordHasheada } })
    }
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Esta cuenta ya no existe' }, { status: 404 })
    }
    throw error
  }

  // Se marca usado recién después de actualizar la contraseña con éxito: si
  // algo fallara antes, el link sigue sirviendo para reintentar.
  await prisma.passwordResetToken.update({ where: { id: registro.id }, data: { usadoEn: new Date() } })

  return NextResponse.json({ ok: true })
}
