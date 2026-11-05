import { NextResponse } from 'next/server'
import { negocioDeSesion, tokenDeConexion } from '@/lib/googleSheetsServidor'
import { configGoogle } from '@/lib/googleSheets'

// Token de acceso de corta duración para abrir el selector de hojas de
// Google (Picker) en el navegador del negocio. Solo con permiso drive.file
// (no da acceso al resto de su Drive) y solo para su propia conexión.
export async function GET() {
  const { negocioId, error } = await negocioDeSesion()
  if (error) return error
  const { pickerApiKey, pickerAppId } = configGoogle()
  if (!pickerApiKey || !pickerAppId) return NextResponse.json({ error: 'El selector de hojas de Google no está configurado.' }, { status: 503 })
  const { token, error: errorToken } = await tokenDeConexion(negocioId)
  if (errorToken) return errorToken
  return NextResponse.json({ accessToken: token, apiKey: pickerApiKey, appId: pickerAppId }, { headers: { 'Cache-Control': 'no-store' } })
}
