import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { leerCookieEstado } from '@/lib/tiendanubeOAuthState'
import { intercambiarCodigoPorToken } from '@/lib/tiendanube'

// Segundo paso del OAuth2: esta es la URL fija que hay que registrar como
// "Redirect URL" en el Partner Portal de Tiendanube (ver docs/ para el
// valor exacto a usar). Tiendanube redirige acá con `code` en la query
// string una vez que la clienta acepta los permisos en su propia tienda.
//
// El destino final se arma con `request.url` como base (no
// NEXT_PUBLIC_BASE_URL) para que funcione igual en cualquier host desde el
// que se haya disparado el flujo, sin depender de que esa variable esté
// bien configurada.
function volverAlPanel(request, resultado) {
  const response = NextResponse.redirect(new URL(`/?tiendanube=${resultado}`, request.url))
  response.cookies.delete('tiendanube_oauth')
  return response
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const negocioId = leerCookieEstado(request.cookies.get('tiendanube_oauth')?.value)

  if (!code || !negocioId) {
    return volverAlPanel(request, 'error')
  }

  try {
    const { access_token, user_id } = await intercambiarCodigoPorToken(code)
    await prisma.negocio.update({
      where: { id: negocioId },
      data: { tiendanubeStoreId: String(user_id), tiendanubeAccessToken: access_token },
    })
    return volverAlPanel(request, 'conectado')
  } catch (error) {
    // Otro negocio ya conectado a esta misma tienda de Tiendanube
    // (tiendanubeStoreId es único) — pasa si dos negocios comparten cuenta
    // de Tiendanube por error, no es un caso esperado en el uso normal.
    if (error.code === 'P2002') {
      return volverAlPanel(request, 'ya-conectada')
    }
    console.error('Error al conectar Tiendanube vía OAuth para el negocio', negocioId, error)
    return volverAlPanel(request, 'error')
  }
}
