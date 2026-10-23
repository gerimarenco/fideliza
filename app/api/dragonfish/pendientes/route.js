import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { autenticarAgente } from '@/lib/dragonfishAgente'

const LOTE = 20

// El agente local pregunta periódicamente (polling) qué facturas quedaron
// pendientes de resolver contra la API de Dragon Fish.
export async function GET(request) {
  const negocio = await autenticarAgente(request)
  if (!negocio) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Cada consulta cuenta como "el agente está vivo" (ver lib/estadoAgente.js).
  // Se guarda como mucho una vez por minuto: el agente consulta cada 30s y no
  // hace falta escribir en la base en cada vuelta.
  const ahora = new Date()
  await prisma.negocio.updateMany({
    where: {
      id: negocio.id,
      OR: [{ dragonfishUltimoContacto: null }, { dragonfishUltimoContacto: { lt: new Date(ahora.getTime() - 60 * 1000) } }],
    },
    data: { dragonfishUltimoContacto: ahora },
  })

  // De menos a más intentos: si el agente no logra resolver alguna (Dragon
  // Fish no la encuentra, o falla siempre por algún motivo), queda detrás de
  // las nuevas en vez de ocupar para siempre los primeros lugares del lote.
  const pendientes = await prisma.facturaPendiente.findMany({
    where: { negocioId: negocio.id, procesado: false },
    orderBy: [{ intentos: 'asc' }, { createdAt: 'asc' }],
    take: LOTE,
    select: { id: true, codigo: true, entidad: true, fecha: true, hora: true },
  })

  if (pendientes.length > 0) {
    await prisma.facturaPendiente.updateMany({
      where: { id: { in: pendientes.map((p) => p.id) }, procesado: false },
      data: { intentos: { increment: 1 } },
    })
  }

  return NextResponse.json({ pendientes })
}
