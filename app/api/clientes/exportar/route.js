import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calcularStatsClientes } from '@/lib/clienteStats'
import { celdaCsv, fechaCorta } from '@/lib/csv'

// Exporta el mismo listado de "Mis clientes" (con los mismos filtros de
// búsqueda/nivel si se pasan) a un CSV para que el negocio pueda usarlo
// fuera de Retornar -- ej. una campaña de WhatsApp o mail masivo. Usa ";"
// como separador (no ",") porque es lo que Excel en español espera abrir
// directo con los acentos bien, sin pasar por un asistente de importación.
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

  const busqueda = searchParams.get('q')?.trim()
  const nivelFiltro = searchParams.get('nivel')?.trim().toLowerCase()

  const where = { negocioId }
  if (busqueda) {
    where.OR = [
      { nombre: { contains: busqueda, mode: 'insensitive' } },
      { email: { contains: busqueda, mode: 'insensitive' } },
      { telefono: { contains: busqueda, mode: 'insensitive' } },
    ]
  }

  const clientes = await prisma.cliente.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: { id: true, nombre: true, telefono: true, email: true, puntos: true, createdAt: true, fechaNacimiento: true },
  })

  // El nivel no vive en la base (se calcula de los puntos ganados de por
  // vida, ver lib/clienteStats.js) -- mismo cálculo que ya usa la lista en
  // pantalla, acá sobre TODOS los clientes que matchean el filtro en vez
  // de solo la página actual.
  const stats = await calcularStatsClientes(prisma, clientes)
  const clientesFiltrados = nivelFiltro
    ? clientes.filter((c) => stats[c.id]?.nivel?.nombre.toLowerCase() === nivelFiltro)
    : clientes

  const encabezados = ['Nombre', 'Email', 'Teléfono', 'Fecha de nacimiento', 'Puntos actuales', 'Nivel', 'Compras registradas', 'Cliente desde', 'Última actividad']
  const filas = clientesFiltrados.map((c) => {
    const s = stats[c.id] || {}
    return [
      celdaCsv(c.nombre || ''),
      celdaCsv(c.email),
      celdaCsv(c.telefono || ''),
      // En UTC a propósito: fechaNacimiento se guarda como medianoche UTC
      // (mismo criterio que lib/cumpleanos.js), leerla en hora argentina la
      // correría un día para atrás.
      celdaCsv(fechaCorta(c.fechaNacimiento, { utc: true })),
      celdaCsv(c.puntos),
      celdaCsv(s.nivel?.nombre || ''),
      celdaCsv(s.comprasRegistradas ?? 0),
      celdaCsv(fechaCorta(c.createdAt)),
      celdaCsv(fechaCorta(s.ultimaActividad)),
    ].join(';')
  })

  // BOM al principio: sin esto, Excel abre el archivo interpretando los
  // acentos/ñ como otro charset (quedan como símbolos raros) en vez de
  // UTF-8.
  const csv = '﻿' + [encabezados.join(';'), ...filas].join('\n')

  const negocio = await prisma.negocio.findUnique({ where: { id: negocioId }, select: { slug: true } })
  const nombreArchivo = `clientes-${negocio?.slug || negocioId}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  })
}
