import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cuentaProtegida, eliminableDesdePanel, impactoEliminacion, eliminarCuenta } from '@/lib/eliminarCuenta'

// Borrar desde el panel una cuenta SIN nombre propio (nombre vacío o un
// email: cargada a mano con el mail como nombre, o creada sola por Dragon
// Fish en septiembre de 2026). Las cuentas con nombre propio no se pueden
// borrar desde acá, ni las protegidas (CUENTAS_PROTEGIDAS, por ejemplo
// genaromarenco110@gmail.com). Solo el negocio dueño de la cuenta o el admin.
//
// GET: qué se perdería (para mostrarlo antes de confirmar).
// DELETE: la borra con sus movimientos, canjes y pedidos de contraseña
// (lib/eliminarCuenta.js). No toca ninguna otra cuenta ni saldo.

const MENSAJE_CON_NOMBRE = 'Desde el panel solo se pueden eliminar las cuentas sin nombre (cargadas con el email como nombre).'
const MENSAJE_PROTEGIDA = 'Esta cuenta está protegida y no se puede eliminar.'
const motivoNoEliminable = (c) => (cuentaProtegida(c) ? MENSAJE_PROTEGIDA : MENSAJE_CON_NOMBRE)

async function cuentaAutorizada(request, params) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'cliente') return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  const { id } = await params
  const cliente = await prisma.cliente.findUnique({ where: { id }, select: { id: true, nombre: true, email: true, negocioId: true } })
  // Un negocio no puede ver ni borrar cuentas de otro: responde igual que si no existiera.
  if (!cliente || (session.user.role === 'negocio' && cliente.negocioId !== session.user.id)) {
    return { error: NextResponse.json({ error: 'No encontrado' }, { status: 404 }) }
  }
  if (!eliminableDesdePanel(cliente)) return { error: NextResponse.json({ error: motivoNoEliminable(cliente) }, { status: 400 }) }
  return { cliente }
}

export async function GET(request, { params }) {
  const { cliente, error } = await cuentaAutorizada(request, params)
  if (error) return error
  return NextResponse.json(await impactoEliminacion(prisma, cliente.id))
}

export async function DELETE(request, { params }) {
  const { cliente, error } = await cuentaAutorizada(request, params)
  if (error) return error
  const impacto = await impactoEliminacion(prisma, cliente.id)
  const borrada = await prisma.$transaction(async (tx) => {
    // Se vuelve a comprobar dentro de la transacción, por si le pusieron
    // nombre mientras tanto.
    const actual = await tx.cliente.findUnique({ where: { id: cliente.id }, select: { nombre: true, email: true } })
    if (!actual || !eliminableDesdePanel(actual)) return false
    await eliminarCuenta(tx, cliente.id)
    return true
  })
  if (!borrada) return NextResponse.json({ error: MENSAJE_CON_NOMBRE }, { status: 409 })
  return NextResponse.json({ eliminada: true, cuponesVivos: impacto.cuponesVivos })
}
