import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/password'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calcularStatsClientes, calcularNivel } from '@/lib/clienteStats'
import { filtroEmail } from '@/lib/identidad'
import { premioDeAlerta, estadoAlerta, filtroAlertaPendiente } from '@/lib/alertaCanje'
import { validarDatosCliente, dniYaRegistrado } from '@/lib/datosCliente'
import { MENSAJE_DNI_REPETIDO, MENSAJE_EMAIL_REPETIDO } from '@/lib/dni'
import { sinNombrePropio, eliminableDesdePanel, FILTRO_SIN_NOMBRE } from '@/lib/eliminarCuenta'
import { randomBytes } from 'crypto'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'cliente') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const negocioId = searchParams.get('negocioId')

  if (session.user.role === 'negocio' && negocioId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const page = Math.max(1, parseInt(searchParams.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize')) || 20))
  const busqueda = searchParams.get('q')?.trim()
  const nivelFiltro = searchParams.get('nivel')?.trim().toLowerCase()
  const soloSinNombre = searchParams.get('sinNombre') === '1'

  const where = negocioId ? { negocioId } : {}

  // Alerta de canje (lib/alertaCanje.js): el premio que eligió el negocio y
  // sus premios activos, para marcar a las clientas que ya pueden canjearlo.
  // ?alerta=1 lista solo las que tienen la alerta pendiente.
  let premioAlerta = null
  let premiosActivos = []
  if (negocioId) {
    const negocio = await prisma.negocio.findUnique({ where: { id: negocioId }, select: { id: true, alertaCanjePremioId: true } })
    premiosActivos = await prisma.premio.findMany({ where: { negocioId, activo: true }, select: { id: true, nombre: true, puntos: true, activo: true, negocioId: true } })
    premioAlerta = premioDeAlerta(negocio, premiosActivos)
  }
  if (searchParams.get('alerta') === '1') {
    if (!premioAlerta) return NextResponse.json({ items: [], page: 1, pageSize, total: 0, totalPages: 1 })
    Object.assign(where, filtroAlertaPendiente(premioAlerta))
  }

  // Buscador de la lista de Clientes (nombre, email o teléfono) -- un
  // negocio con muchos clientes ya no puede confiar solo en el paginado
  // para encontrar a alguien puntual.
  if (busqueda) {
    where.OR = [
      { nombre: { contains: busqueda, mode: 'insensitive' } },
      { email: { contains: busqueda, mode: 'insensitive' } },
      { telefono: { contains: busqueda, mode: 'insensitive' } },
    ]
  }
  // Cuentas sin nombre propio (vacío o un email): las cargadas con el mail
  // como nombre o creadas solas por Dragon Fish en septiembre de 2026; son
  // las únicas que se pueden borrar desde el panel (ver app/api/clientes/[id]).
  if (soloSinNombre) {
    where.AND = [FILTRO_SIN_NOMBRE]
  }

  // Filtro por nivel (Bronce/Plata/Oro/Diamante/VIP): el nivel no vive en
  // la base, se calcula a partir de los puntos GANADOS de por vida (ver
  // lib/clienteStats.js), así que hace falta un paso aparte antes de
  // paginar -- sumar los puntos de cada cliente que ya matchea el resto de
  // los filtros, calcularle el nivel, y quedarse solo con los que caen en
  // el elegido. Sin esto, filtrar por nivel solo dentro de la página
  // actual (después de paginar) daría resultados incompletos o vacíos
  // según en qué página esté cada cliente.
  if (nivelFiltro) {
    const candidatos = await prisma.cliente.findMany({ where, select: { id: true } })
    const candidatoIds = candidatos.map((c) => c.id)
    const agregados = candidatoIds.length
      ? await prisma.movimientoPuntos.groupBy({
          by: ['clienteId'],
          where: { clienteId: { in: candidatoIds }, puntos: { gt: 0 } },
          _sum: { puntos: true },
        })
      : []
    const puntosPorCliente = Object.fromEntries(agregados.map((a) => [a.clienteId, a._sum.puntos || 0]))
    where.id = {
      in: candidatoIds.filter((id) => calcularNivel(puntosPorCliente[id] || 0).nombre.toLowerCase() === nivelFiltro),
    }
  }

  const [total, items] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, nombre: true, telefono: true, email: true, puntos: true,
        negocioId: true, createdAt: true, alertaContactadaEn: true, alertaContactadaPuntos: true,
      }
    })
  ])

  const stats = await calcularStatsClientes(prisma, items)
  const itemsConStats = items.map((c) => ({ ...c, sinNombre: sinNombrePropio(c), eliminable: eliminableDesdePanel(c), stats: stats[c.id], alerta: estadoAlerta(c, premioAlerta, premiosActivos) }))

  return NextResponse.json({ items: itemsConStats, page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  const body = await request.json()

  const autorizado = session?.user?.role === 'admin' ||
    (session?.user?.role === 'negocio' && session.user.id === body.negocioId)

  if (!autorizado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (!body.negocioId) {
    return NextResponse.json({ error: 'negocioId es obligatorio' }, { status: 400 })
  }

  // Mismos datos y reglas que el registro público de la clienta
  // (lib/datosCliente.js): nombre y apellido, email, fecha de nacimiento,
  // DNI (solo números, uno por negocio), celular (país + código de área +
  // número) y género opcional. La carga manual no acredita la bonificación
  // de bienvenida (solo el registro de la clienta).
  const validacion = validarDatosCliente(body)
  if (validacion.error) {
    return NextResponse.json({ error: validacion.error }, { status: 400 })
  }
  const { nombre, email, fechaNacimiento, dni, telefono, sexo } = validacion.datos

  const negocio = await prisma.negocio.findUnique({ where: { id: body.negocioId }, select: { id: true } })
  if (!negocio) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // La restricción única de la base distingue mayúsculas: sin este chequeo
  // se podía crear "Ana@mail.com" aunque ya existiera "ana@mail.com". El
  // email es único en toda la base (con él se inicia sesión).
  const yaExiste = await prisma.cliente.findFirst({ where: { email: filtroEmail(email) }, select: { id: true } })
  if (yaExiste) {
    return NextResponse.json({ error: MENSAJE_EMAIL_REPETIDO }, { status: 409 })
  }

  // randomBytes en vez de Math.random(): no es un generador pensado para
  // secretos y su salida se puede predecir.
  const passwordGenerada = randomBytes(6).toString('base64url')
  const passwordHash = await hashPassword(passwordGenerada)

  let clienteCreado
  try {
    clienteCreado = await prisma.$transaction(async (tx) => {
      if (await dniYaRegistrado(tx, negocio.id, dni)) return null
      return tx.cliente.create({
        data: { nombre, email, fechaNacimiento, dni, telefono, sexo, password: passwordHash, negocioId: negocio.id, origen: 'panel' },
      })
    })
  } catch (error) {
    // Dos altas simultáneas: Cliente.email es único en toda la base y
    // (negocioId, dni) en el negocio.
    if (error.code === 'P2002') {
      const mensaje = String(error.meta?.target ?? '').includes('dni') ? MENSAJE_DNI_REPETIDO : MENSAJE_EMAIL_REPETIDO
      return NextResponse.json({ error: mensaje }, { status: 409 })
    }
    throw error
  }
  if (!clienteCreado) {
    return NextResponse.json({ error: MENSAJE_DNI_REPETIDO }, { status: 409 })
  }
  const { password, dni: _dni, ...cliente } = clienteCreado

  // passwordGenerada va en texto plano en la respuesta: el negocio la
  // necesita para pasársela al cliente. El hash (password) y el DNI se
  // descartan acá.
  return NextResponse.json({ ...cliente, passwordGenerada })
}
