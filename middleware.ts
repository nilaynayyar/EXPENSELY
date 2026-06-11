import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Routes that require authentication
  const protectedPrefixes = ['/dashboard', '/expenses', '/analytics', '/groups', '/budgets', '/settings', '/scanner', '/ocr-results']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  // Routes only for unauthenticated users
  const authOnlyRoutes = ['/login']
  const isAuthOnly = authOnlyRoutes.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    const redirectResponse = NextResponse.redirect(loginUrl)
    // Preserve cookies set by updateSession
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  if (isAuthOnly && user) {
    const dashboardUrl = new URL('/dashboard', request.url)
    const redirectResponse = NextResponse.redirect(dashboardUrl)
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
