import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { configGoogle, urlHoja } from '@/lib/googleSheets'

// Estado de "Exportar clientes → Google Sheets" del negocio de la sesión:
// si la integración está configurada en el servidor, si su cuenta está
// conectada, qué hoja usa y la última exportación. Nunca devuelve tokens.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'negocio') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const config = configGoogle()
  const c = await prisma.conexionGoogle.findUnique({
    where: { negocioId: session.user.id },
    select: { email: true, conectadaEn: true, hojaId: true, hojaNombre: true, ultimaExportacionEn: true, ultimaExportacionInfo: true },
  })
  return NextResponse.json({
    configurada: config.configurada,
    selectorHojas: config.configurada && Boolean(config.pickerApiKey && config.pickerAppId),
    conexion: c
      ? {
          email: c.email,
          conectadaEn: c.conectadaEn,
          hoja: c.hojaId ? { id: c.hojaId, nombre: c.hojaNombre, url: urlHoja(c.hojaId) } : null,
          ultimaExportacionEn: c.ultimaExportacionEn,
          ultimaExportacionInfo: c.ultimaExportacionInfo,
        }
      : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
