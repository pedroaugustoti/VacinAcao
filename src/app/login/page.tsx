'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShieldPlus, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-950 p-4">
      {/* Container Principal com Efeito Glassmorphism */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-emerald-100 p-8 sm:p-10">
        
        {/* Cabeçalho com Identidade Hospitalar / Verde Clínico */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/30 mb-4">
            <ShieldPlus size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Vacin<span className="text-emerald-600">Ação</span>
          </h1>
          <p className="text-sm font-medium text-emerald-800 mt-1">
            Portal Restrito • Unidade Básica de Saúde
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="flex items-center gap-3 bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg text-red-700 text-sm animate-shake">
              <AlertCircle size={20} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              E-mail Institucional
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="enfermeira@ubs.gov.br"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              Senha de Acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Autenticando credenciais...</span>
              </>
            ) : (
              <span>Acessar Painel da UBS</span>
            )}
          </button>
        </form>

        {/* Rodapé do Card */}
        <div className="mt-8 text-center border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400">
            Sistema Seguro Integrado ao Protocolo Antirrábico
          </p>
        </div>

      </div>
    </div>
  )
}