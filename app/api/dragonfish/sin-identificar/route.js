import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarEmailPuntosAcreditados } from '@/lib/email'
import { calcularPuntosPorCompra } from '@/lib/puntos'
import { acreditarVenta, cuentaPosterior, fichaGenerica } from '@/lib/dragonfishIdentificacion'
import { fechaDeVenta, fechaVerificada, inicioDeVentas, anteriorAlInicio } from '@/lib/dragonfishFecha'
import { fechaCorta } from '@/lib/csv'

// "Ventas del local sin identificar" (Integraciones → Dragon Fish): las
// ventas que el agente procesó pero no pudo reconocer (sin_cliente /
// sin_datos / ambigua: sus datos señalan a más de una cuenta), para que el
// negocio:
//   - las vuelva a revisar (después de completar fichas o de actualizar el
//     agente): vuelven a la fila y el agente las procesa con las reglas
//     actuales (una venta anterior a la cuenta sigue sin sumar);
//   - asigne una a mano a una clienta, con un clic (suma una sola vez, con la
//     misma clave que el agente) y, si quiere, vincule esa ficha de Dragon
//     Fish a la clienta: desde ahí todas sus compras suman solas, y se suman
//     también las otras ventas sin identificar de esa ficha;
//   - desvincule una ficha vinculada por error.
// Solo el negocio dueño o el admin; siempre las de ese negocio.
//
// Fechas: se usa la de la venta en Dragon Fish (fecha/hora, ver
// lib/dragonfishFecha.js), no cuándo llegó el aviso. Y si el negocio tiene un
// día desde el que suman las ventas del local (Peperina: 05/11/2026), las
// anteriores, y las que no tienen una fecha de Dragon Fish verificable, no
// aparecen, no vuelven a revisarse y no se pueden asignar. Como
// el aviso no llega antes de la venta, `createdAt >= X - 1 día` sirve para
// filtrar de entrada en la base sin dejar afuera ninguna venta de fecha >= X
// (el día de margen cubre un reloj adelantado en la PC del local); el filtro
// fino, por la fecha de la venta, se hace después.
const RESULTADOS = ['sin_cliente', 'sin_datos', 'ambigua']
// "Volver a revisar" también vuelve a la fila las "cuenta_posterior": una
// hora mal leída (Dragon Fish manda la hora en formato de 12 h, ver
// lib/dragonfishFecha.js) pudo dejar como anterior al registro una compra
// que fue después. El agente las recalcula; las que de verdad son anteriores
// siguen sin sumar, y ninguna suma dos veces (misma clave de siempre). No se
// listan ni se asignan a mano (la asignación rechaza la cuenta posterior).
const REVISABLES = [...RESULTADOS, 'cuenta_posterior']
const DIAS_LISTA = 90
const DIA_MS = 86400000
const conMargen = (fecha) => new Date(fecha.getTime() - DIA_MS)
// El mismo criterio para la lista y "Volver a revisar": dentro de la ventana
// (por la fecha de la venta) y, si el negocio tiene día de inicio, con fecha
// de Dragon Fish verificable de ese día o posterior. Asignar a mano y las
// otras ventas de una ficha vinculada usan el mismo anteriorAlInicio.
const entraEnRecuperacion = (negocio, f, desde) => fechaDeVenta(f) >= desde && !anteriorAlInicio(negocio, f)

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

// Hace `dias` días o, si es más reciente, el día de inicio del negocio.
function pisoDeFechas(inicio, dias) {
  const hace = new Date(Date.now() - dias * DIA_MS)
  return inicio && inicio > hace ? inicio : hace
}

const palabras = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-zñ]+/).filter((p) => p.length >= 3)

export async function GET(request) {
  const { negocio, error } = await autorizar(request)
  if (error) return error
  const inicio = inicioDeVentas(negocio)
  const desde = pisoDeFechas(inicio, DIAS_LISTA)
  const facturas = (await prisma.facturaPendiente.findMany({
    where: { negocioId: negocio.id, procesado: true, resultado: { in: RESULTADOS }, createdAt: { gte: conMargen(desde) } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { codigo: true, fecha: true, hora: true, createdAt: true, monto: true, nombreFicha: true, codigoFicha: true, resultado: true, candidatas: true },
  })).filter((f) => entraEnRecuperacion(negocio, f, desde))
  // Sugerencias por nombre (solo para ayudar a elegir; nunca se acredita sola
  // por nombre): cuentas cuyo nombre tiene todas las palabras de la ficha y
  // que ya existían cuando se hizo la compra.
  const clientes = facturas.some((f) => f.nombreFicha || f.candidatas.length)
    ? await prisma.cliente.findMany({ where: { negocioId: negocio.id }, select: { id: true, nombre: true, createdAt: true } })
    : []
  const indice = clientes.map((c) => ({ id: c.id, createdAt: c.createdAt, palabras: palabras(c.nombre) }))
  const ventas = facturas.map((f) => {
    const fecha = fechaDeVenta(f)
    const buscadas = palabras(f.nombreFicha)
    // Primero las cuentas a las que señalan sus datos (venta ambigua), después
    // las parecidas por nombre; solo cuentas que ya existían en la compra.
    const porDatos = indice.filter((c) => f.candidatas.includes(c.id) && c.createdAt <= fecha).map((c) => c.id)
    const porNombre = buscadas.length
      ? indice.filter((c) => c.createdAt <= fecha && buscadas.every((p) => c.palabras.includes(p))).map((c) => c.id)
      : []
    const sugerencias = [...new Set([...porDatos, ...porNombre])].slice(0, 8)
    return { codigo: f.codigo, fecha, monto: f.monto, puntos: f.monto != null ? calcularPuntosPorCompra(f.monto, negocio.puntosXPeso) : null, nombreFicha: f.nombreFicha, motivo: f.resultado, sugerencias, vinculable: !fichaGenerica(f.nombreFicha, f.codigoFicha) }
  })
  // Ventas que el agente dejó "sin_fecha" (sin fecha de Dragon Fish
  // verificable, solo en un negocio con día de inicio): no suman ni se pueden
  // asignar; se informa cuántas hay para revisarlas.
  const sinFecha = inicio
    ? await prisma.facturaPendiente.count({ where: { negocioId: negocio.id, procesado: true, resultado: 'sin_fecha', createdAt: { gte: conMargen(new Date(Date.now() - DIAS_LISTA * DIA_MS)) } } })
    : 0
  const vinculadas = await prisma.fichaDragonfish.findMany({ where: { negocioId: negocio.id }, orderBy: { createdAt: 'desc' }, take: 300, select: { codigo: true, nombreFicha: true, clienteId: true, createdAt: true } })
  return NextResponse.json({ ventas, vinculadas, dias: DIAS_LISTA, desde: inicio, sinFecha })
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const { negocio, error } = await autorizar(request, body.negocioId)
  if (error) return error

  if (body.accion === 'revisar') {
    const dias = Math.min(Math.max(parseInt(body.dias) || 60, 1), 180)
    // Las de los últimos `dias` días por la fecha de la venta y, si el
    // negocio tiene un día de inicio, solo desde ese día.
    const desde = pisoDeFechas(inicioDeVentas(negocio), dias)
    const donde = { negocioId: negocio.id, procesado: true, resultado: { in: REVISABLES } }
    const posibles = await prisma.facturaPendiente.findMany({ where: { ...donde, createdAt: { gte: conMargen(desde) } }, select: { id: true, fecha: true, hora: true, createdAt: true } })
    const ids = posibles.filter((f) => entraEnRecuperacion(negocio, f, desde)).map((f) => f.id)
    const { count } = ids.length
      ? await prisma.facturaPendiente.updateMany({ where: { ...donde, id: { in: ids } }, data: { procesado: false, resultado: null, intentos: 0, clienteId: null, identificadaPor: null } })
      : { count: 0 }
    return NextResponse.json({ ok: true, enRevision: count, desde })
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
    if (anteriorAlInicio(negocio, factura)) {
      const fecha = fechaVerificada(factura)
      const motivo = fecha ? `Esa venta es del ${fechaCorta(fecha)}` : 'Esa venta no tiene una fecha de Dragon Fish que se pueda verificar'
      return NextResponse.json({ error: `${motivo}: las ventas del local suman desde el ${fechaCorta(inicioDeVentas(negocio))}.` }, { status: 409 })
    }
    if (cuentaPosterior(cliente, factura)) {
      return NextResponse.json({ error: 'Esa clienta se registró después de esta compra: por la regla del club, no suma.' }, { status: 409 })
    }
    // Vincular la ficha (antes de acreditar, para rechazar sin sumar nada si
    // ya es de otra clienta).
    const vincular = body.vincular === true && !fichaGenerica(factura.nombreFicha, factura.codigoFicha)
    if (vincular) {
      const previo = await prisma.fichaDragonfish.findUnique({ where: { negocioId_codigo: { negocioId: negocio.id, codigo: factura.codigoFicha } } })
      if (previo && previo.clienteId !== cliente.id) {
        return NextResponse.json({ error: 'Esa ficha de Dragon Fish ya está vinculada a otra clienta. Desvinculala primero si fue un error.' }, { status: 409 })
      }
    }
    const r = await acreditarVenta(prisma, negocio, factura, cliente, factura.monto, { resultado: 'acreditado_manual', por: 'manual' })
    let otras = 0
    let puntosOtras = 0
    if (vincular && r.estado === 'acreditado_manual') {
      await prisma.fichaDragonfish.upsert({
        where: { negocioId_codigo: { negocioId: negocio.id, codigo: factura.codigoFicha } },
        create: { negocioId: negocio.id, codigo: factura.codigoFicha, clienteId: cliente.id, nombreFicha: factura.nombreFicha },
        update: {},
      })
      // Las otras ventas sin identificar de esa ficha, desde que existe la
      // cuenta (y desde el día de inicio del negocio, si tiene).
      const pendientes = (await prisma.facturaPendiente.findMany({
        where: { negocioId: negocio.id, codigoFicha: factura.codigoFicha, procesado: true, resultado: { in: RESULTADOS }, monto: { not: null }, createdAt: { gte: conMargen(cliente.createdAt) } },
      })).filter((otra) => !cuentaPosterior(cliente, otra) && !anteriorAlInicio(negocio, otra))
      for (const otra of pendientes) {
        const ro = await acreditarVenta(prisma, negocio, otra, cliente, otra.monto, { resultado: 'acreditado', por: 'ficha' })
        if (ro.estado === 'acreditado') { otras++; puntosOtras += ro.puntos }
      }
    }
    if (r.estado === 'acreditado_manual') {
      const totales = otras ? (await prisma.cliente.findUnique({ where: { id: cliente.id }, select: { puntos: true } })).puntos : r.puntosTotales
      await enviarEmailPuntosAcreditados({ email: r.cliente.email, puntosAcreditados: r.puntos + puntosOtras, puntosTotales: totales, negocioNombre: negocio.nombre, negocioId: negocio.id }).catch(() => {})
      if (r.referido) await enviarEmailPuntosAcreditados({ email: r.referido.invitadorEmail, motivo: 'referido', puntosAcreditados: r.referido.puntos, puntosTotales: r.referido.invitadorPuntosTotales, negocioNombre: negocio.nombre, negocioId: negocio.id }).catch(() => {})
    }
    return NextResponse.json({ ok: r.estado === 'acreditado_manual', resultado: r.estado, puntos: r.puntos, vinculada: vincular && r.estado === 'acreditado_manual', otras, puntosOtras })
  }

  if (body.accion === 'desvincular') {
    const { count } = await prisma.fichaDragonfish.deleteMany({ where: { negocioId: negocio.id, codigo: String(body.codigoFicha ?? '') } })
    return count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Esa ficha no estaba vinculada.' }, { status: 404 })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}
