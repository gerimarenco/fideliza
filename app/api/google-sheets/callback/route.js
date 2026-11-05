import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { negocioDeSesion, COOKIE_NONCE } from '@/lib/googleSheetsServidor'
import { verificarEstado } from '@/lib/estadoOAuth'
import { canjearCodigo } from '@/lib/googleSheets'
import { cifrar } from '@/lib/cifrado'
import { urlBase } from '@/lib/urlBase'

// Paso 2 del OAuth: Google vuelve con un código. Se acepta solo si el
// `state` es válido, es del negocio que tiene la sesión abierta y coincide
// con la cookie de este navegador. El token de actualización se guarda
// cifrado. Siempre vuelve al panel (Exportar clientes) con el resultado.
const volver = (resultado) => NextResponse.redirect(`${urlBase()}/?seccion=exportar&google=${resultado}`)

export async function GET(request) {
  const { negocioId, error } = await negocioDeSesion()
  if (error) return volver('sin-sesion')
  const { searchParams } = new URL(request.url)
  const nonce = request.cookies.get(COOKIE_NONCE)?.value
  const respuesta = (resultado) => {
    const r = volver(resultado)
    r.cookies.set(COOKIE_NONCE, '', { path: '/api/google-sheets/callback', maxAge: 0 })
    return r
  }
  if (verificarEstado(searchParams.get('state'), nonce) !== negocioId) return respuesta('rechazado')
  if (searchParams.get('error')) return respuesta('cancelado')
  const code = searchParams.get('code')
  if (!code) return respuesta('rechazado')

  let tokens
  try {
    tokens = await canjearCodigo(code)
  } catch (e) {
    console.error('Google: no se pudo completar la conexión', negocioId, e.message)
    return respuesta(e.codigo === 'SIN_PERMISO' ? 'sin-permiso' : 'error')
  }
  const anterior = await prisma.conexionGoogle.findUnique({ where: { negocioId }, select: { email: true } })
  // Otra cuenta de Google: la hoja elegida antes puede no ser accesible.
  const otraCuenta = anterior && anterior.email !== tokens.email
  await prisma.conexionGoogle.upsert({
    where: { negocioId },
    create: { negocioId, email: tokens.email, refreshTokenCifrado: cifrar(tokens.refreshToken) },
    update: { email: tokens.email, refreshTokenCifrado: cifrar(tokens.refreshToken), conectadaEn: new Date(), ...(otraCuenta ? { hojaId: null, hojaNombre: null } : {}) },
  })
  // El token de acceso de esta vuelta no se guarda: vence solo en una hora.
  return respuesta('conectado')
}
