import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { hashPassword } from '@/lib/password'
import { hashEmailLogin } from '@/lib/limiteLogin'

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

  // Se reclama el link de forma atómica antes de cambiar nada: si llegan dos
  // pedidos con el mismo link a la vez (doble click, o alguien que lo
  // interceptó), solo uno pasa este UPDATE condicional.
  const { count } = await prisma.passwordResetToken.updateMany({
    where: { id: registro.id, usadoEn: null, expiraEn: { gt: new Date() } },
    data: { usadoEn: new Date() },
  })
  if (count === 0) {
    return NextResponse.json({ error: 'Este link no es válido o ya venció. Pedí uno nuevo desde "Olvidé mi contraseña".' }, { status: 400 })
  }

  let cuenta
  try {
    if (registro.tipo === 'negocio') {
      cuenta = await prisma.negocio.update({ where: { id: registro.usuarioId }, data: { password: passwordHasheada } })
    } else {
      cuenta = await prisma.cliente.update({ where: { id: registro.usuarioId }, data: { password: passwordHasheada } })
    }
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Esta cuenta ya no existe' }, { status: 404 })
    }
    throw error
  }

  // Los demás links que esa cuenta haya pedido y todavía no usó dejan de
  // servir: ya eligió una contraseña nueva.
  await prisma.passwordResetToken.updateMany({
    where: { usuarioId: registro.usuarioId, tipo: registro.tipo, usadoEn: null },
    data: { usadoEn: new Date() },
  })

  // Si estaba bloqueada por intentos fallidos (ver lib/limiteLogin.js),
  // recuperar la contraseña la desbloquea: es lo que le sugiere la pantalla
  // de login.
  try {
    await prisma.intentoLogin.deleteMany({ where: { emailHash: hashEmailLogin(cuenta.email) } })
  } catch (error) {
    console.error('No se pudieron limpiar los intentos de login', error.message)
  }

  return NextResponse.json({ ok: true })
}
