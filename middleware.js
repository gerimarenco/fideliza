import { NextResponse } from 'next/server'

export function middleware(request) {
  const token = request.cookies.get('next-auth.session-token') || 
                request.cookies.get('__Secure-next-auth.session-token')
  
  const isLoginPage = request.nextUrl.pathname === '/login'
  const isRegistroPage = request.nextUrl.pathname.startsWith('/registro')
  const isPublicPage = isLoginPage || isRegistroPage
  
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