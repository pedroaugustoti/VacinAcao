'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Syringe,
  PhoneCall,
  Stethoscope,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  HeartPulse,
  LogOut,
  Loader2,
  PackagePlus,
  Building2,
} from 'lucide-react'

const navigation: { title: string; items: { label: string; href: string; icon: typeof Users; exact?: boolean }[] }[] = [
  {
    title: 'PRINCIPAL',
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    title: 'ATENDIMENTO CLÍNICO',
    items: [
      {
        label: 'Pacientes e atrasos',
        href: '/admin/pacientes',
        icon: Users,
      },
      {
        label: 'Busca ativa',
        href: '/admin/busca-ativa',
        icon: PhoneCall,
      },
      {
        label: 'Aplicar Vacinas',
        href: '/admin/aplicacoes',
        icon: Syringe,
      },
      {
        label: 'Novo Atendimento',
        href: '/admin/cadastro',
        icon: UserPlus,
      },
      {label:'Vacinas e estoque',href:'/admin/estoque',icon:PackagePlus},
    ],
  },
]

export default function AdminSidebar({isAdmin=false}:{isAdmin?:boolean}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuDialog = useRef<HTMLDialogElement>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const dialog=menuDialog.current
    if (mobileOpen && dialog && !dialog.open) dialog.showModal()
    const media=window.matchMedia('(min-width: 768px)')
    const onResize=(event:MediaQueryListEvent)=>{if(event.matches)setMobileOpen(false)}
    media.addEventListener('change',onResize)
    return ()=>{media.removeEventListener('change',onResize);if(dialog?.open)dialog.close()}
  },[mobileOpen])

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const closeMobile = () => setMobileOpen(false)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login-ubs')
  }

  const renderSidebarContent = (mobile = false) => (
    <div className="va-sidebar-inner flex h-full flex-col bg-white/85 backdrop-blur-xl border-r border-slate-200/80">
      {/* MARCA */}
      <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-5">
        <div className="va-sidebar-brand flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm">
          <Stethoscope size={21} strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-bold tracking-tight text-slate-800">
            Vacin<span className="text-emerald-700">Ação</span>
          </h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            Cuidado que acompanha
          </p>
        </div>
        {mobile && (
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Fechar menu"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* IDENTIFICAÇÃO */}
      <div className="px-4 pt-5 pb-2">
        <div className="va-sidebar-context rounded-2xl px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-xs border border-emerald-100">
              <HeartPulse size={17} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Portal da equipe
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-emerald-800">
                Acompanhamento vacinal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO */}
      <nav
        aria-label="Navegação principal"
        className="flex-1 space-y-6 overflow-y-auto px-3 py-4"
      >
        {navigation.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.13em] text-slate-500">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href, item.exact)
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    aria-current={active ? 'page' : undefined}
                    className={`
                      group relative flex items-center gap-3
                      rounded-xl px-3.5 py-3
                      text-[13px] font-medium
                      transition-all duration-150
                      ${
                        active
                          ? 'bg-emerald-50/90 text-emerald-900 font-semibold shadow-2xs border border-emerald-200/60'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    {active && (
                      <span className="absolute left-0 top-2.5 bottom-2.5 w-[3.5px] rounded-r-full bg-emerald-600" />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={active ? 2.1 : 1.7}
                      className={
                        active
                          ? 'text-emerald-700'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }
                    />
                    <span className="flex-1">{item.label}</span>
                    {active && (
                      <ChevronRight size={15} className="text-emerald-600/70" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
        {isAdmin&&<details open={pathname.startsWith('/admin/equipe')||pathname.startsWith('/admin/unidades')} className="rounded-xl border border-slate-200 p-2"><summary className="cursor-pointer rounded-lg px-3 py-3 text-xs font-semibold text-slate-600">Administração</summary><div className="mt-1 space-y-1"><Link href="/admin/equipe" onClick={closeMobile} aria-current={pathname.startsWith('/admin/equipe')?'page':undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm"><Users size={18}/>Equipe e acessos</Link><Link href="/admin/unidades" onClick={closeMobile} aria-current={pathname.startsWith('/admin/unidades')?'page':undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm"><Building2 size={18}/>Unidades</Link></div></details>}
      </nav>

      {/* RODAPÉ DA SIDEBAR + LOGOUT */}
      <div className="border-t border-slate-100 p-4 space-y-3">
        <div className="va-sidebar-footer flex items-center gap-3 rounded-xl px-3 py-3 border border-slate-200/60">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100/70 text-emerald-700">
            <ShieldCheck size={17} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-slate-700 truncate">
              Ambiente de demonstração
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Dados fictícios · desenvolvimento</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200/70 bg-red-50/60 px-3 py-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100/70 disabled:opacity-60 cursor-pointer"
        >
          {loggingOut ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Encerrando...</span>
            </>
          ) : (
            <>
              <LogOut size={15} />
              <span>Sair do Sistema</span>
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* SIDEBAR DESKTOP */}
      <aside className="va-sidebar fixed inset-y-0 left-0 z-40 hidden w-[268px] md:block">
        {renderSidebarContent()}
      </aside>

      {/* CABEÇALHO MOBILE */}
      <header className="va-mobile-header sticky top-0 z-30 flex h-[64px] items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/50">
            <Stethoscope size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              Vacin<span className="text-emerald-700">Ação</span>
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Portal UBS
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Menu size={21} />
        </button>
      </header>

      {/* MENU MOBILE */}
      {mobileOpen && (
        <dialog ref={menuDialog} aria-label="Menu de navegação UBS" onCancel={closeMobile} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-slate-950/35 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={closeMobile}
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-xs"
          />
          <aside className="va-sidebar relative z-10 h-full w-[min(290px,85vw)] shadow-2xl">
            {renderSidebarContent(true)}
          </aside>
        </dialog>
      )}
    </>
  )
}
