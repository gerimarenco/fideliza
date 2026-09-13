import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generarCodigoReferido } from '@/lib/referidos'

// Código de invitación + cuántas amigas ya trajo, para la pantalla "Referí
// a una amiga" del propio cliente logueado (nunca de otro). El código se
// genera acá, la primera vez que alguien la abre, en vez de al crear la
// cuenta -- así no hace falta un backfill para las cuentas que ya existían
// antes de este campo.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let cliente = await prisma.cliente.findUnique({ where: { id: session.user.id } })
  if (!cliente) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  if (!cliente.codigoReferido) {
    // Reintenta si el código generado ya existiera (P2002) -- con el
    // alfabeto de 32 caracteres y 6 posiciones, la chance real es
    // prácticamente nula, pero es una sola vez por cuenta y no cuesta nada
    // cubrirla en vez de asumirla.
    for (let intento = 0; intento < 5; intento++) {
      try {
        cliente = await prisma.cliente.update({
          where: { id: cliente.id },
          data: { codigoReferido: generarCodigoReferido() },
        })
        break
      } catch (error) {
        if (error.code !== 'P2002' || intento === 4) throw error
      }
    }
  }

  const totalReferidos = await prisma.cliente.count({
    where: { referidoPorId: cliente.id, referidoRecompensado: true },
  })

  return NextResponse.json({ codigo: cliente.codigoReferido, totalReferidos })
}
