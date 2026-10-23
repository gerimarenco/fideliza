import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { enviarEmailRecuperacionPassword } from '@/lib/email'
import { filtroEmail, normalizarEmail } from '@/lib/identidad'
import { puedeEnviarReset } from '@/lib/limiteReset'
import { urlBase } from '@/lib/urlBase'

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
  const { email: emailIngresado } = await request.json()
  const email = normalizarEmail(emailIngresado)

  if (!email) {
    return NextResponse.json({ error: 'El email es obligatorio' }, { status: 400 })
  }

  // Mismo criterio que authorize() en lib/auth.js: buscar negocio y
  // cliente al mismo tiempo, sin distinguir mayúsculas.
  const [negocio, cliente] = await Promise.all([
    prisma.negocio.findFirst({ where: { email: filtroEmail(email) } }),
    prisma.cliente.findFirst({ where: { email: filtroEmail(email) }, select: { id: true, email: true, negocioId: true, negocio: { select: { nombre: true } } } }),
  ])

  const cuenta = negocio
    ? { tipo: 'negocio', id: negocio.id, email: negocio.email, nombreNegocio: negocio.nombre, negocioId: negocio.id }
    : cliente
    ? { tipo: 'cliente', id: cliente.id, email: cliente.email, nombreNegocio: cliente.negocio.nombre, negocioId: cliente.negocioId }
    : null

  // La respuesta es siempre la misma, exista o no la cuenta, y se haya
  // mandado o no el mail por el límite de abajo -- si contestara distinto
  // según el caso, cualquiera podría usar este formulario para averiguar
  // qué emails están registrados en Retornar.
  if (cuenta) {
    const recientes = await prisma.passwordResetToken.findMany({
      where: { usuarioId: cuenta.id, tipo: cuenta.tipo, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
      select: { createdAt: true },
    })

    if (puedeEnviarReset(recientes.map((r) => r.createdAt))) {
      const token = randomBytes(32).toString('hex')
      await prisma.passwordResetToken.create({
        data: {
          tokenHash: hashearToken(token),
          tipo: cuenta.tipo,
          usuarioId: cuenta.id,
          expiraEn: new Date(Date.now() + EXPIRACION_MS),
        },
      })

      await enviarEmailRecuperacionPassword({
        email: cuenta.email,
        tipo: cuenta.tipo,
        negocioNombre: cuenta.nombreNegocio,
        negocioId: cuenta.negocioId,
        resetUrl: `${urlBase()}/restablecer-contrasena?token=${token}`,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
