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
//
// Mismo criterio de autorización que PATCH /api/negocios: el admin puede
// conectar la Tiendanube de cualquier negocio (Ajustes → Integraciones se ve
// también desde el panel de admin, eligiendo el negocio desde ahí), y un
// negocio solo la suya propia — por eso el negocioId viaja en la query
// (?negocioId=...), no se asume igual a session.user.id como si solo
// pudiera conectarse a sí mismo.
export async function GET(request) {
  const session = await getServerSession(authOptions)
  const negocioId = new URL(request.url).searchParams.get('negocioId')

  const esAdmin = session?.user?.role === 'admin'
  const esElMismoNegocio = session?.user?.role === 'negocio' && session.user.id === negocioId

  if (!negocioId || (!esAdmin && !esElMismoNegocio)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (!process.env.TIENDANUBE_APP_ID) {
    return NextResponse.json({ error: 'Tiendanube todavía no está configurado en el servidor (falta TIENDANUBE_APP_ID)' }, { status: 501 })
  }

  const response = NextResponse.redirect(`https://www.tiendanube.com/apps/${process.env.TIENDANUBE_APP_ID}/authorize`)
  response.cookies.set('tiendanube_oauth', crearCookieEstado(negocioId), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
