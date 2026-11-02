import { normalizarEmail } from './identidad.js'

// Cuentas sin nombre propio: el nombre está vacío o es un email. Son las que
// se cargaron a mano con el mail como nombre, o las que creaba sola la
// integración con Dragon Fish entre el 9 y el 22 de septiembre de 2026 (sin
// nombre). Solo estas se pueden borrar desde el panel; las que tienen nombre
// propio, no.
export function sinNombrePropio(cliente) {
  const nombre = String(cliente?.nombre || '').trim()
  if (!nombre) return true
  if (normalizarEmail(nombre) === normalizarEmail(cliente?.email)) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nombre)
}

// Filtro de Prisma equivalente (aproximado: un nombre con forma de email se
// detecta por la arroba) para listar esas cuentas.
export const FILTRO_SIN_NOMBRE = { OR: [{ nombre: null }, { nombre: '' }, { nombre: { contains: '@' } }] }

// Qué se pierde si se borra la cuenta: para mostrarlo antes de confirmar.
export async function impactoEliminacion(db, clienteId) {
  const [cliente, movimientos, canjes, invitadas, cuponesVivos] = await Promise.all([
    db.cliente.findUnique({ where: { id: clienteId }, select: { puntos: true } }),
    db.movimientoPuntos.count({ where: { clienteId } }),
    db.canje.count({ where: { clienteId } }),
    db.cliente.count({ where: { referidoPorId: clienteId } }),
    db.canje.findMany({
      where: { clienteId, tiendanubeCuponCodigo: { not: null }, OR: [{ cuponEstado: null }, { cuponEstado: { not: 'utilizado' } }] },
      select: { tiendanubeCuponCodigo: true },
    }),
  ])
  return {
    puntos: cliente?.puntos ?? 0,
    movimientos,
    canjes,
    invitadas,
    cuponesVivos: cuponesVivos.map((c) => c.tiendanubeCuponCodigo),
  }
}

// Borra la cuenta y lo que cuelga de ella, dentro de la transacción que se
// le pasa: sus movimientos de puntos, sus canjes (la base no deja borrar la
// cuenta sin borrarlos) y sus pedidos de "olvidé mi contraseña". A las que
// invitó se les borra "quién la invitó"; sus puntos no cambian. Los cupones
// de Tiendanube de esos canjes siguen vivos en la tienda (desactivarlos a
// mano). No toca ninguna otra cuenta, saldo ni movimiento.
export async function eliminarCuenta(tx, clienteId) {
  await tx.cliente.updateMany({ where: { referidoPorId: clienteId }, data: { referidoPorId: null } })
  await tx.canje.deleteMany({ where: { clienteId } })
  await tx.movimientoPuntos.deleteMany({ where: { clienteId } })
  await tx.passwordResetToken.deleteMany({ where: { usuarioId: clienteId, tipo: 'cliente' } })
  await tx.cliente.delete({ where: { id: clienteId } })
}
