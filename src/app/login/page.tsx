'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Stethoscope, Lock, Mail, AlertCircle, Loader2, ArrowRight } from 'lucide-react'

export default function LoginUbsPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('E-mail ou senha incorretos. Verifique suas credenciais.')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-100/50 px-4 selection:bg-emerald-600 selection:text-white">
      
      {/* Background Dinâmico com Luzes Orgânicas Líquidas (Modo Claro Apple) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Esfera de luz menta superior esquerda */}
        <div className="absolute -top-[15%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-emerald-300/40 via-teal-200/30 to-transparent blur-[100px]"></div>
        
        {/* Esfera de luz verde/azulada inferior direita */}
        <div className="absolute -bottom-[15%] -right-[10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-tl from-teal-300/30 via-emerald-200/20 to-transparent blur-[120px]"></div>

        {/* Grade sutil de fundo */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-60"></div>
      </div>

      {/* Card Principal - Liquid Glass Claro (Estilo macOS / Apple Health) */}
      <div className="relative z-10 w-full max-w-[420px] rounded-[32px] p-8 sm:p-10 backdrop-blur-2xl bg-white/75 border border-white/80 shadow-[0_20px_50px_rgba(16,185,129,0.08),0_10px_20px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,1)] transition-all duration-500">
        
        {/* Linha de reflexo de luz superior */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent"></div>

        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[22px] bg-gradient-to-b from-emerald-500/15 to-emerald-600/5 border border-emerald-500/20 text-emerald-700 shadow-[0_8px_20px_rgba(16,185,129,0.12)] mb-4 backdrop-blur-md">
            <Stethoscope size={28} strokeWidth={2} />
          </div>
          
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Vacin<span className="text-emerald-600 font-bold">Ação</span>
          </h1>
          
          <div className="inline-block mt-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 shadow-sm">
            <p className="text-[11px] font-semibold text-emerald-800 tracking-wider uppercase">
              Portal da Unidade Básica de Saúde
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200/80 p-3.5 rounded-2xl text-red-700 text-xs font-medium shadow-sm animate-shake">
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 pl-1">
              E-mail Institucional
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-emerald-600 transition-colors">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="enfermeira@ubs.gov.br"
                className="w-full pl-11 pr-4 py-3.5 bg-white/60 border border-gray-200/80 rounded-2xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white shadow-sm transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 pl-1">
              Senha de Acesso
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-emerald-600 transition-colors">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3.5 bg-white/60 border border-gray-200/80 rounded-2xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white shadow-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-3 py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] text-white font-medium text-sm rounded-2xl shadow-[0_10px_25px_rgba(16,185,129,0.25)] border border-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 group cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin text-white" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Rodapé do Card */}
        <div className="mt-8 text-center border-t border-gray-200/60 pt-5">
          <p className="text-[11px] text-gray-500 font-medium tracking-wide">
            Ambiente Seguro • Protocolo de Imunização Municipal
          </p>
        </div>

      </div>
    </main>
  )
}