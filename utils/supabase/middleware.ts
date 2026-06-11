import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This will refresh the session if expired - critical for server-side auth checks.
  const { data: { user } } = await supabase.auth.getUser()

  // Ensure user profile exists in profiles table (to prevent foreign key violations like expenses_user_id_fkey)
  if (user) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile && !profileError) {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ''
        const avatarUrl = user.user_metadata?.avatar_url || ''
        
        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email || '',
          full_name: fullName,
          avatar_url: avatarUrl,
          role: 'User'
        })
      }
    } catch (err) {
      console.error('[Middleware] Profile auto-creation error:', err)
    }
  }

  return { supabaseResponse, user }
}

