// Piezas de servidor compartidas por app/api/google-sheets/*: quién pide
// (solo una sesión de negocio, y siempre su propio negocio: el id sale de la
// sesión, nunca del pedido) y el token de acceso de su conexión.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth.js'
import { prisma } from './db.js'
import { descifrar } from './cifrado.js'
import { configGoogle, accessToken } from './googleSheets.js'

export const COOKIE_NONCE = 'retornar_oauth_google'

// → { negocioId } o { error } (respuesta lista).
export async function negocioDeSesion() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'negocio' || !session.user.id) {
    return { error: NextResponse.json({ error: 'Solo la cuenta del negocio puede conectar Google Sheets.' }, { status: 403 }) }
  }
  if (!configGoogle().configurada) {
    return { error: NextResponse.json({ error: 'La integración con Google todavía no está configurada.' }, { status: 503 }) }
  }
  return { negocioId: session.user.id }
}

// Token de acceso de la conexión del negocio. Si Google ya no acepta el
// token guardado (el negocio quitó el acceso desde su cuenta), se borra la
// conexión y se pide volver a conectar.
export async function tokenDeConexion(negocioId) {
  const conexion = await prisma.conexionGoogle.findUnique({ where: { negocioId } })
  if (!conexion) return { error: NextResponse.json({ error: 'Conectá tu cuenta de Google primero.' }, { status: 400 }) }
  const refresh = descifrar(conexion.refreshTokenCifrado)
  if (!refresh) {
    await prisma.conexionGoogle.delete({ where: { negocioId } }).catch(() => {})
    return { error: NextResponse.json({ error: 'La conexión con Google se perdió. Volvé a conectar tu cuenta.' }, { status: 409 }) }
  }
  try {
    const { token } = await accessToken(refresh)
    return { conexion, token }
  } catch (error) {
    if (error.codigo === 'TOKEN_INVALIDO') {
      await prisma.conexionGoogle.delete({ where: { negocioId } }).catch(() => {})
      return { error: NextResponse.json({ error: 'Google ya no da acceso a esta cuenta. Volvé a conectarla.' }, { status: 409 }) }
    }
    console.error('Google: no se pudo renovar el token', negocioId, error.message)
    return { error: NextResponse.json({ error: 'No se pudo conectar con Google. Probá de nuevo en unos minutos.' }, { status: 503 }) }
  }
}
