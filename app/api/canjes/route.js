import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { obtenerPrecioProducto, crearCuponProductoGratis, crearCuponPorcentaje } from '@/lib/tiendanube'

// Descuenta `cantidad` puntos de los lotes de MovimientoPuntos más viejos
// del cliente que todavía tengan saldo vivo (FIFO), para que el vencimiento
// a los 6 meses (ver netlify/functions/vencimiento-puntos.mjs) sepa cuánto
// de cada compra sigue sin usarse. No es la fuente de verdad del saldo total
// —eso sigue siendo Cliente.puntos, ya protegido contra condiciones de
// carrera arriba— así que si un cliente tiene puntos de antes de este
// campo existir (sin lotes registrados), esta consumición simplemente no
// encuentra nada para descontar y no pasa nada: esos puntos viejos quedan
// sin trackear y nunca vencen, no hay forma de reconstruir su fecha real.
async function consumirPuntosFifo(tx, clienteId, cantidad) {
  const lotes = await tx.movimientoPuntos.findMany({
    where: { clienteId, saldoRestante: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
  })

  let restante = cantidad
  for (const lote of lotes) {
    if (restante <= 0) break
    const consumido = Math.min(lote.saldoRestante, restante)
    await tx.movimientoPuntos.update({
      where: { id: lote.id },
      data: { saldoRestante: { decrement: consumido } },
    })
    restante -= consumido
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioId = searchParams.get('negocioId')

  if (!negocioId) {
    return NextResponse.json({ error: 'negocioId es obligatorio' }, { status: 400 })
  }

  if (session.user.role === 'negocio' && negocioId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize')) || 20))
  const where = { premio: { negocioId } }

  const [total, items] = await Promise.all([
    prisma.canje.count({ where }),
    prisma.canje.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        entregado: true,
        tiendanubeCuponCodigo: true,
        tiendanubeCuponError: true,
        cliente: { select: { id: true, nombre: true, email: true } },
        premio: { select: { id: true, nombre: true, puntos: true, emoji: true } },
      }
    })
  ])

  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { premioId } = body
  // Un cliente solo puede canjear para sí mismo, nunca en nombre de otro.
  const clienteId = session.user.role === 'cliente' ? session.user.id : body.clienteId

  if (!clienteId) {
    return NextResponse.json({ error: 'clienteId es obligatorio' }, { status: 400 })
  }

  const premio = await prisma.premio.findUnique({
    where: { id: premioId }
  })

  if (!premio || !premio.activo) {
    return NextResponse.json({ error: 'Este premio ya no está disponible' }, { status: 400 })
  }

  // Un negocio solo puede canjear premios propios para clientes propios —
  // antes alcanzaba con estar logueado como negocio y mandar cualquier
  // premioId/clienteId por fuera de la UI (que hoy no expone este camino,
  // pero el endpoint no lo impedía).
  if (session.user.role === 'negocio') {
    if (premio.negocioId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { negocioId: true } })
    if (!cliente || cliente.negocioId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  } else if (session.user.role !== 'admin' && session.user.role !== 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    // updateMany con el saldo en el WHERE: Postgres serializa los UPDATE
    // concurrentes sobre la misma fila, así que si dos canjes llegan al
    // mismo tiempo, el segundo recién evalúa "puntos >= premio.puntos"
    // después de que el primero ya haya confirmado su descuento. Sin esto
    // (leer puntos y decidir aparte, en un paso separado del UPDATE), dos
    // pedidos simultáneos podían pasar los dos la validación antes de que
    // cualquiera descontara, dejando al cliente con saldo negativo.
    const canje = await prisma.$transaction(async (tx) => {
      const { count } = await tx.cliente.updateMany({
        where: { id: clienteId, puntos: { gte: premio.puntos } },
        data: { puntos: { decrement: premio.puntos } }
      })

      if (count === 0) {
        throw new Error('PUNTOS_INSUFICIENTES')
      }

      await consumirPuntosFifo(tx, clienteId, premio.puntos)

      return tx.canje.create({ data: { clienteId, premioId } })
    })

    // El cupón de Tiendanube se genera después de confirmar el canje, nunca
    // adentro de la transacción de arriba: es una llamada HTTP externa, y si
    // fallara no tiene sentido revertir el descuento de puntos ya
    // confirmado (mismo criterio que enviarEmailPuntosAcreditados en los
    // webhooks: un problema en el paso externo no le cuesta el canje a la
    // clienta, solo se guarda para que el negocio lo resuelva a mano).
    let cuponCodigo, cuponError
    if (premio.tiendanubeProductoId || premio.tiendanubeDescuentoPorcentaje) {
      try {
        const negocio = await prisma.negocio.findUnique({
          where: { id: premio.negocioId },
          select: { tiendanubeStoreId: true, tiendanubeAccessToken: true },
        })

        if (!negocio?.tiendanubeStoreId || !negocio?.tiendanubeAccessToken) {
          cuponError = 'El negocio todavía no conectó Tiendanube'
        } else if (premio.tiendanubeProductoId) {
          const precio = await obtenerPrecioProducto(negocio, premio.tiendanubeProductoId)
          cuponCodigo = await crearCuponProductoGratis(negocio, canje.id, precio)
        } else {
          cuponCodigo = await crearCuponPorcentaje(negocio, canje.id, premio.tiendanubeDescuentoPorcentaje)
        }
      } catch (error) {
        console.error('Error al crear el cupón de Tiendanube para el canje', canje.id, error)
        cuponError = 'No se pudo generar el cupón automáticamente'
      }

      // Igual que arriba: si esto llegara a fallar (ej. un problema
      // transitorio de conexión justo acá), el canje ya está confirmado y
      // los puntos ya se descontaron — no hay que tirar un 500 por esto,
      // solo queda sin guardar el resultado del cupón para consulta
      // posterior (el código sigue siendo válido si se llegó a crear).
      try {
        await prisma.canje.update({
          where: { id: canje.id },
          data: { tiendanubeCuponCodigo: cuponCodigo, tiendanubeCuponError: cuponError },
        })
      } catch (error) {
        console.error('No se pudo guardar el resultado del cupón en el canje', canje.id, error)
      }
    }

    return NextResponse.json({ ...canje, tiendanubeCuponCodigo: cuponCodigo, tiendanubeCuponError: cuponError, tiendanubeProductoUrl: premio.tiendanubeProductoUrl })
  } catch (error) {
    if (error.message === 'PUNTOS_INSUFICIENTES') {
      return NextResponse.json({ error: 'Puntos insuficientes' }, { status: 400 })
    }
    throw error
  }
}
