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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/50 to-cyan-50 p-4 relative overflow-hidden">
      
      {/* Elementos decorativos de fundo estilo Liquid Glass/Soft Glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-300/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Card Principal com Efeito Liquid Glass refinado */}
      <div className="w-full max-w-md bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/80 overflow-hidden p-8 sm:p-10 relative z-10 transition-all">
        
        {/* Cabeçalho com Verde Suave Hospitalar */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20 mb-4 ring-4 ring-emerald-50">
            <Stethoscope size={30} strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Vacin<span className="text-emerald-600">Ação</span>
          </h1>
          <div className="inline-block mt-1 px-3 py-0.5 rounded-full bg-emerald-100/70 border border-emerald-200/50">
            <p className="text-xs font-semibold text-emerald-800 tracking-wide uppercase">
              Portal da Unidade Básica de Saúde
            </p>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="flex items-center gap-3 bg-red-50/90 border border-red-200 p-3.5 rounded-2xl text-red-700 text-xs font-medium animate-shake">
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 pl-1">
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
                className="w-full pl-11 pr-4 py-3.5 bg-white/80 border border-gray-200/80 rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white shadow-sm transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 pl-1">
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
                className="w-full pl-11 pr-4 py-3.5 bg-white/80 border border-gray-200/80 rounded-2xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 focus:bg-white shadow-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-medium text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 group"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
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

        {/* Rodapé Limpo */}
        <div className="mt-8 text-center border-t border-gray-100/80 pt-5">
          <p className="text-[11px] text-gray-400 font-medium tracking-wide">
            Ambiente Seguro • Protocolo de Imunização Municipal
          </p>
        </div>

      </div>
    </div>
  )
}