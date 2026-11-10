import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarEmailPuntosAcreditados } from '@/lib/email'
import { calcularPuntosPorCompra } from '@/lib/puntos'
import { acreditarVenta, cuentaPosterior } from '@/lib/dragonfishIdentificacion'

// "Ventas del local sin identificar" (Integraciones → Dragon Fish): las
// ventas que el agente procesó pero no pudo reconocer (sin_cliente /
// sin_datos), para que el negocio:
//   - las vuelva a revisar (después de completar fichas o de actualizar el
//     agente): vuelven a la fila y el agente las procesa con las reglas
//     actuales (una venta anterior a la cuenta sigue sin sumar);
//   - asigne una a mano a una clienta, con un clic (suma una sola vez, con la
//     misma clave que el agente).
// Solo el negocio dueño o el admin; siempre las de ese negocio.
const RESULTADOS = ['sin_cliente', 'sin_datos']
const DIAS_LISTA = 90

async function autorizar(request, negocioIdBody) {
  const session = await getServerSession(authOptions)
  const rol = session?.user?.role
  if (rol !== 'negocio' && rol !== 'admin') return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  const negocioId = negocioIdBody || new URL(request.url).searchParams.get('negocioId')
  if (!negocioId) return { error: NextResponse.json({ error: 'negocioId es obligatorio' }, { status: 400 }) }
  if (rol === 'negocio' && negocioId !== session.user.id) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  const negocio = await prisma.negocio.findUnique({ where: { id: negocioId } })
  if (!negocio) return { error: NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 }) }
  return { negocio }
}

const palabras = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-zñ]+/).filter((p) => p.length >= 3)

export async function GET(request) {
  const { negocio, error } = await autorizar(request)
  if (error) return error
  const desde = new Date(Date.now() - DIAS_LISTA * 86400000)
  const facturas = await prisma.facturaPendiente.findMany({
    where: { negocioId: negocio.id, procesado: true, resultado: { in: RESULTADOS }, createdAt: { gte: desde } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { codigo: true, fecha: true, hora: true, createdAt: true, monto: true, nombreFicha: true, resultado: true },
  })
  // Sugerencias por nombre (solo para ayudar a elegir; nunca se acredita sola
  // por nombre): cuentas cuyo nombre tiene todas las palabras de la ficha y
  // que ya existían cuando se hizo la compra.
  const clientes = facturas.some((f) => f.nombreFicha)
    ? await prisma.cliente.findMany({ where: { negocioId: negocio.id }, select: { id: true, nombre: true, createdAt: true } })
    : []
  const indice = clientes.map((c) => ({ id: c.id, createdAt: c.createdAt, palabras: palabras(c.nombre) }))
  const ventas = facturas.map((f) => {
    const buscadas = palabras(f.nombreFicha)
    const sugerencias = buscadas.length
      ? indice.filter((c) => c.createdAt <= f.createdAt && buscadas.every((p) => c.palabras.includes(p))).slice(0, 5).map((c) => c.id)
      : []
    return { codigo: f.codigo, fecha: f.createdAt, monto: f.monto, puntos: f.monto != null ? calcularPuntosPorCompra(f.monto, negocio.puntosXPeso) : null, nombreFicha: f.nombreFicha, motivo: f.resultado, sugerencias }
  })
  return NextResponse.json({ ventas, dias: DIAS_LISTA })
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const { negocio, error } = await autorizar(request, body.negocioId)
  if (error) return error

  if (body.accion === 'revisar') {
    const dias = Math.min(Math.max(parseInt(body.dias) || 60, 1), 180)
    const { count } = await prisma.facturaPendiente.updateMany({
      where: { negocioId: negocio.id, procesado: true, resultado: { in: RESULTADOS }, createdAt: { gte: new Date(Date.now() - dias * 86400000) } },
      data: { procesado: false, resultado: null, intentos: 0 },
    })
    return NextResponse.json({ ok: true, enRevision: count })
  }

  if (body.accion === 'asignar') {
    const factura = typeof body.codigo === 'string'
      ? await prisma.facturaPendiente.findUnique({ where: { negocioId_codigo: { negocioId: negocio.id, codigo: body.codigo } } })
      : null
    if (!factura || !factura.procesado || !RESULTADOS.includes(factura.resultado)) {
      return NextResponse.json({ error: 'Esa venta ya no está entre las sin identificar.' }, { status: 409 })
    }
    if (factura.monto == null) {
      return NextResponse.json({ error: 'Esa venta no tiene el monto guardado: tocá «Volver a revisar» para que el agente lo traiga.' }, { status: 400 })
    }
    const cliente = typeof body.clienteId === 'string'
      ? await prisma.cliente.findFirst({ where: { id: body.clienteId, negocioId: negocio.id } })
      : null
    if (!cliente) return NextResponse.json({ error: 'Clienta no encontrada' }, { status: 404 })
    if (cuentaPosterior(cliente, factura)) {
      return NextResponse.json({ error: 'Esa clienta se registró después de esta compra: por la regla del club, no suma.' }, { status: 409 })
    }
    const r = await acreditarVenta(prisma, negocio, factura, cliente, factura.monto, { resultado: 'acreditado_manual', por: 'manual' })
    if (r.estado === 'acreditado_manual') {
      await enviarEmailPuntosAcreditados({ email: r.cliente.email, puntosAcreditados: r.puntos, puntosTotales: r.puntosTotales, negocioNombre: negocio.nombre, negocioId: negocio.id }).catch(() => {})
      if (r.referido) await enviarEmailPuntosAcreditados({ email: r.referido.invitadorEmail, motivo: 'referido', puntosAcreditados: r.referido.puntos, puntosTotales: r.referido.invitadorPuntosTotales, negocioNombre: negocio.nombre, negocioId: negocio.id }).catch(() => {})
    }
    return NextResponse.json({ ok: r.estado === 'acreditado_manual', resultado: r.estado, puntos: r.puntos })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
