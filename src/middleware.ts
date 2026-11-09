import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Cria uma resposta inicial que o Supabase pode modificar para setar cookies
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Cria o cliente do Supabase para o Middleware
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

  // 3. Atualiza a sessão e pega o usuário logado
  // Isso é obrigatório para manter os Server Components sincronizados com a sessão
  const { data: { user } } = await supabase.auth.getUser()

  // 4. Lógica de Proteção de Rotas
  const isRotaAdmin = request.nextUrl.pathname.startsWith('/admin')
  const isRotaLogin = request.nextUrl.pathname.startsWith('/login')

  // Se tentar acessar o painel da UBS sem estar logado, manda pro login
  if (isRotaAdmin && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Se já estiver logado e tentar acessar a página de login, manda pra home
  if (isRotaLogin && user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

// 5. Define em quais rotas o middleware vai rodar (ignora arquivos estáticos e imagens)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}