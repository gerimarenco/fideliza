import { NextResponse } from 'next/server'
import { negocioDeSesion, COOKIE_NONCE } from '@/lib/googleSheetsServidor'
import { nuevoEstado } from '@/lib/estadoOAuth'
import { urlAutorizacion } from '@/lib/googleSheets'

// Paso 1 del OAuth: manda al negocio a Google para que autorice (solo
// drive.file). El `state` firmado y una cookie con su nonce atan la vuelta a
// este negocio y a este navegador (ver lib/estadoOAuth.js).
export async function GET() {
  const { negocioId, error } = await negocioDeSesion()
  if (error) return error
  const { state, nonce } = nuevoEstado(negocioId)
  const res = NextResponse.redirect(urlAutorizacion(state))
  res.cookies.set(COOKIE_NONCE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/google-sheets/callback',
    maxAge: 600,
  })
  return res
}
