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
  const isPublicPage = isLoginPage || isRegistroPage || isClubPage
  
  if (!token && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}