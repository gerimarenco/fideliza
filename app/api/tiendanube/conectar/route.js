import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { crearCookieEstado } from '@/lib/tiendanubeOAuthState'

// Primer paso del OAuth2 de Tiendanube: mandar al negocio a la pantalla de
// autorización de su propia tienda. La URL de autorización solo lleva el
// client_id en el path — Tiendanube no documenta un `state` propio, así que
// para saber a qué Negocio corresponde este intento se guarda el negocioId
// en una cookie firmada de corta duración (ver lib/tiendanubeOAuthState),
// que el callback (app/api/tiendanube/callback) lee cuando Tiendanube
// redirige de vuelta.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'negocio') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!process.env.TIENDANUBE_APP_ID) {
    return NextResponse.json({ error: 'Tiendanube todavía no está configurado en el servidor (falta TIENDANUBE_APP_ID)' }, { status: 501 })
  }

  const response = NextResponse.redirect(`https://www.tiendanube.com/apps/${process.env.TIENDANUBE_APP_ID}/authorize`)
  response.cookies.set('tiendanube_oauth', crearCookieEstado(session.user.id), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
