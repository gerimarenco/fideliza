import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { autenticarAgente } from '@/lib/dragonfishAgente'

// El agente local pregunta periódicamente (polling) qué facturas quedaron
// pendientes de resolver contra la API de Dragon Fish.
export async function GET(request) {
  const negocio = await autenticarAgente(request)
  if (!negocio) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const pendientes = await prisma.facturaPendiente.findMany({
    where: { negocioId: negocio.id, procesado: false },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, codigo: true, entidad: true, fecha: true, hora: true },
  })

  return NextResponse.json({ pendientes })
}
