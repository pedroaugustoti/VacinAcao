import { Suspense } from 'react'
import { connection } from 'next/server'
import NotificacoesResumo from './notificacoes-resumo'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from './admin-sidebar'
import { Building2 } from 'lucide-react'

async function ConteudoAutenticado({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login-ubs')
  }

  const { data: perfil } = await supabase
    .from('perfis')
    .select('nome, role, unidade_id, unidades_saude(nome)')
    .eq('id', user.id)
    .single()

  if (!perfil || !['admin', 'ubs'].includes(perfil.role)) {
    redirect('/')
  }

  const unidadeObj = Array.isArray(perfil.unidades_saude)
    ? perfil.unidades_saude[0]
    : perfil.unidades_saude

  const nomeUnidade =
    unidadeObj?.nome ||
    (perfil.role === 'admin' ? 'Gestão Central da Prefeitura' : 'UBS Não Vinculada')

  return (
    <div className="va-shell min-h-screen bg-[#F2F6F4] text-slate-800">
      <a href="#conteudo-principal" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-4 focus:text-emerald-900">Pular para o conteúdo</a>
      <AdminSidebar isAdmin={perfil.role==='admin'} />
      <div className="va-workspace min-h-screen min-w-0 md:ml-[268px] flex flex-col">
        <div className="va-topbar sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200/70 bg-white/75 px-5 py-3 backdrop-blur-md sm:px-8">
          <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <Building2 size={19} className="shrink-0 text-sky-800" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800" title={nomeUnidade}>{nomeUnidade}</p>
              <p className="mt-1 truncate text-xs text-slate-600">{perfil.role === 'admin' ? 'Gestão administrativa' : 'Equipe da unidade'} · {perfil.nome}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-800">Demonstração</span>
            <Suspense
              fallback={
                <span className="text-xs text-slate-400">
                  Carregando notificações...
                </span>
              }
            >
              <NotificacoesResumo usuarioId={user.id} />
            </Suspense>
          </div>
        </div>

        <main id="conteudo-principal" tabIndex={-1} className="va-main flex-1 min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>

        <footer className="border-t border-slate-200/60 px-6 py-4 text-center">
          <p className="text-[11px] font-medium text-slate-400">
            VacinAção UBS • Sistema Integrado de Vigilância e Imunização Municipal
          </p>
        </footer>
      </div>
    </div>
  )
}

export default function UbsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F2F6F4] text-sm font-medium text-emerald-800">
          Carregando ambiente clínico da UBS...
        </div>
      }
    >
      <ConteudoAutenticado>{children}</ConteudoAutenticado>
    </Suspense>
  )
}
