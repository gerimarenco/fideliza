import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { leerCookieEstado } from '@/lib/tiendanubeOAuthState'
import { intercambiarCodigoPorToken, asegurarWebhookOrderPaid } from '@/lib/tiendanube'

// Segundo paso del OAuth2: esta es la URL fija que hay que registrar como
// "Redirect URL" en el Partner Portal de Tiendanube (ver docs/ para el
// valor exacto a usar). Tiendanube redirige acá con `code` en la query
// string una vez que la clienta acepta los permisos en su propia tienda.
const MENSAJES = {
  conectado: { titulo: '✅ Tiendanube conectado', texto: 'La conexión se hizo correctamente. Ya vas a sumar puntos en cada compra online.' },
  'conectado-sin-webhook': { titulo: '⚠️ Conectado, pero revisar', texto: 'La tienda quedó conectada, pero no se pudo confirmar el aviso automático de "pedido pagado" — puede que las compras online todavía no sumen puntos. Avisale a soporte.' },
  'ya-conectada': { titulo: '⚠️ Esa tienda ya está conectada', texto: 'Esta cuenta de Tiendanube ya está conectada a otro negocio de Retornar.' },
  error: { titulo: '❌ No se pudo conectar', texto: 'Algo falló al conectar con Tiendanube. Volvé a Ajustes → Integraciones y probá de nuevo.' },
}

// Devuelve directamente una página de confirmación en vez de redirigir a
// `/` y depender de un toast ahí: si por lo que sea la sesión no llega
// viva a esa siguiente carga (se vio pasar una vez, todavía sin poder
// reproducirlo de punta a punta en este entorno), la clienta de todos
// modos ve confirmado el resultado antes de que la mande de vuelta —
// nunca un simple "no pasó nada" en blanco. El auto-redirect después de
// unos segundos es solo para volver a Retornar; si ahí la sesión sigue
// viva aparece además el toast de siempre (ver app/page.js).
function paginaResultado(request, resultado) {
  const { titulo, texto } = MENSAJES[resultado] || MENSAJES.error
  const destino = new URL(`/?tiendanube=${resultado}`, request.url).toString()
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="3;url=${destino}" />
  <title>Retornar</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .caja { background: #fff; border-radius: 16px; padding: 32px; max-width: 360px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    a { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #6366f1; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="caja">
    <h2>${titulo}</h2>
    <p>${texto}</p>
    <a href="${destino}">Volver a Retornar</a>
  </div>
</body>
</html>`

  const response = new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  response.cookies.delete('tiendanube_oauth')
  return response
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const negocioId = leerCookieEstado(request.cookies.get('tiendanube_oauth')?.value)

  if (!code || !negocioId) {
    return paginaResultado(request, 'error')
  }

  try {
    const { access_token, user_id } = await intercambiarCodigoPorToken(code)
    await prisma.negocio.update({
      where: { id: negocioId },
      data: { tiendanubeStoreId: String(user_id), tiendanubeAccessToken: access_token },
    })

    // Conectar la tienda no le avisa solo a Tiendanube que tiene que
    // mandar el webhook de "pedido pagado" — es una suscripción aparte,
    // que se crea acá mismo para que no quede como un paso manual más del
    // que dependa silenciosamente que las compras online sumen puntos. Si
    // esto falla, la conexión en sí ya quedó guardada arriba: no tiene
    // sentido perderla por un problema en este paso secundario, pero sí
    // hay que decirlo distinto (no "conectado" a secas) para no esconder
    // que las compras todavía no van a sumar puntos.
    try {
      const negocioTemporal = { tiendanubeStoreId: String(user_id), tiendanubeAccessToken: access_token }
      const urlWebhook = new URL('/api/webhooks/tiendanube', request.url).toString()
      await asegurarWebhookOrderPaid(negocioTemporal, urlWebhook)
    } catch (error) {
      console.error('No se pudo registrar el webhook order/paid para el negocio', negocioId, error)
      return paginaResultado(request, 'conectado-sin-webhook')
    }

    return paginaResultado(request, 'conectado')
  } catch (error) {
    // Otro negocio ya conectado a esta misma tienda de Tiendanube
    // (tiendanubeStoreId es único) — pasa si dos negocios comparten cuenta
    // de Tiendanube por error, no es un caso esperado en el uso normal.
    if (error.code === 'P2002') {
      return paginaResultado(request, 'ya-conectada')
    }
    console.error('Error al conectar Tiendanube vía OAuth para el negocio', negocioId, error)
    return paginaResultado(request, 'error')
  }
}
