import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isRotaAdmin = pathname.startsWith('/admin')
  const isRotaLoginUbs = pathname === '/login-ubs'
  const isRotaLoginPwa = pathname === '/login'

  const redirectWithCookies = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url))
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    return response
  }

  if (isRotaAdmin && !user) {
    return redirectWithCookies('/login-ubs')
  }

  // 2. Se JÁ ESTIVER LOGADO e tentar acessar o login da UBS, manda direto pro Painel Admin
  if ((isRotaLoginUbs || isRotaLoginPwa) && user) {
    const { data: perfil, error } = await supabase.from('perfis').select('role').eq('id', user.id).maybeSingle()
    if (!error) return redirectWithCookies(perfil && ['admin', 'ubs'].includes(perfil.role) ? '/admin' : '/')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
