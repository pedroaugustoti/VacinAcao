import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Nova flag exigida pelo Next.js 16.4+ para rotas que usam cookies/sessão
export const instant = false 

export default async function UbsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: perfil, error: perfilError } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil || (perfil.role !== 'ubs' && perfil.role !== 'admin')) {
    redirect('/')
  }

  // 5. Se passou na verificação, renderiza o Layout do Painel da UBS
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Exemplo de Sidebar Lateral que aparecerá em todas as rotas /admin */}
      <aside className="w-64 bg-white shadow-md hidden md:flex flex-col">
        <div className="p-4 border-b font-bold text-blue-700 text-lg">
          VacinAção UBS
        </div>
        <nav className="p-4 flex flex-col gap-2 text-sm text-gray-700">
          <a href="/admin" className="p-2 hover:bg-blue-50 rounded">Dashboard</a>
          <a href="/admin/pacientes" className="p-2 hover:bg-blue-50 rounded">Pacientes & Faltosos</a>
          <a href="/admin/cadastro" className="p-2 hover:bg-blue-50 rounded">Novo Atendimento</a>
        </nav>
      </aside>

      {/* Área principal onde o conteúdo das páginas vai carregar */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}