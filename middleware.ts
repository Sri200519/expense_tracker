import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public paths
  if (path === '/login' || path.startsWith('/api/auth') || path.startsWith('/_next') || path === '/favicon.ico') {
    return NextResponse.next()
  }

  // Check for auth cookie
  // const sessionCookie = request.cookies.get('auth_session')

  // if (process.env.NODE_ENV !== 'development' && (!sessionCookie || sessionCookie.value !== 'authenticated')) {
  //   // Redirect to login if no valid session
  //   return NextResponse.redirect(new URL('/login', request.url))
  // }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
