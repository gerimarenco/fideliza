import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { enviarEmailRecuperacionPassword } from '@/lib/email'

// 1 hora: suficiente para que alguien revise su mail sin apuro, corto
// como para que un link viejo encontrado después no sirva de nada.
const EXPIRACION_MS = 60 * 60 * 1000

function hashearToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

// Sin sesión a propósito: esto es lo que usa alguien que no puede entrar a
// su cuenta porque se olvidó la contraseña, no tendría sentido pedirle que
// esté logueado. El admin no tiene cuenta acá (ver lib/auth.js), así que
// no hace falta contemplarlo.
export async function POST(request) {
  const { email } = await request.json()

  if (!email) {
    return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })
  }

  // Mismo criterio que authorize() en lib/auth.js: buscar negocio y
  // cliente al mismo tiempo, no uno detrás del otro.
  const [negocio, cliente] = await Promise.all([
    prisma.negocio.findFirst({ where: { email } }),
    prisma.cliente.findFirst({ where: { email }, select: { id: true, negocioId: true, negocio: { select: { nombre: true } } } }),
  ])

  const cuenta = negocio
    ? { tipo: 'negocio', id: negocio.id, nombreNegocio: negocio.nombre, negocioId: negocio.id }
    : cliente
    ? { tipo: 'cliente', id: cliente.id, nombreNegocio: cliente.negocio.nombre, negocioId: cliente.negocioId }
    : null

  // La respuesta es siempre la misma, exista o no la cuenta -- si
  // contestara distinto según el caso, cualquiera podría usar este
  // formulario para averiguar qué emails están registrados en Retornar.
  if (cuenta) {
    const token = randomBytes(32).toString('hex')
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashearToken(token),
        tipo: cuenta.tipo,
        usuarioId: cuenta.id,
        expiraEn: new Date(Date.now() + EXPIRACION_MS),
      },
    })

    const base = process.env.NEXT_PUBLIC_BASE_URL || ''
    await enviarEmailRecuperacionPassword({
      email,
      tipo: cuenta.tipo,
      negocioNombre: cuenta.nombreNegocio,
      negocioId: cuenta.negocioId,
      resetUrl: `${base}/restablecer-contrasena?token=${token}`,
    })
  }

  return NextResponse.json({ ok: true })
}
