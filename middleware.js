import { NextResponse } from 'next/server'

export function middleware(request) {
  const token = request.cookies.get('next-auth.session-token') || 
                request.cookies.get('__Secure-next-auth.session-token')
  
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isRegistroPage = request.nextUrl.pathname.startsWith('/registro')
  // Mini-landing pública de cada negocio (ver app/club/[negocio]) — pensada
  // para linkear desde afuera (ej. el menú de la tienda online), un paso
  // intermedio antes del formulario de /registro en vez de mandar directo
  // ahí a quien todavía no sabe qué es "Club X".
  const isClubPage = request.nextUrl.pathname.startsWith('/club')
  // "Olvidé mi contraseña": las dos pantallas del flujo (pedir el link y
  // elegir la contraseña nueva) las usa justamente quien no puede loguearse
  // todavía -- sin esto, el middleware las mandaría derecho a /login antes
  // de que lleguen a verlas.
  const isPasswordResetPage = request.nextUrl.pathname.startsWith('/olvide-password') || request.nextUrl.pathname.startsWith('/restablecer-contrasena')
  const isPublicPage = isLoginPage || isRegistroPage || isClubPage || isPasswordResetPage
  
  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

// Los archivos de public/ (rutas con extensión: /widget.js, /images/...,
// /email/...) quedan fuera: los piden la tienda online, el cliente de correo
// o una visita al club, que no tienen sesión, y recibían un redirect a /login
// en vez del archivo (el widget de la tienda no cargaba). Las páginas de la
// app no llevan puntos en la ruta (los slugs son [a-z0-9-]), así que siguen
// protegidas igual que antes.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
}