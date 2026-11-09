import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function UbsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1. Inicializa o Supabase no lado do servidor
  const supabase = await createClient()

  // 2. Pega o usuário logado da sessão atual
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    // Se por algum motivo chegou aqui sem sessão, manda pro login
    redirect('/login')
  }

  // 3. Consulta a tabela 'perfis' para descobrir o nível de acesso (role)
  // O .single() garante que retorne apenas 1 objeto, não um array
  const { data: perfil, error: perfilError } = await supabase
    .from('perfis')
    .select('role')
    .eq('id', user.id)
    .single()

  // 4. A Trava de Segurança
  // Se não achar perfil (pacientes não têm registro nessa tabela) ou se a role não for autorizada
  if (perfilError || !perfil || (perfil.role !== 'ubs' && perfil.role !== 'admin')) {
    // Redireciona o paciente de volta para a interface do celular (PWA)
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