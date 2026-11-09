"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  // Mudamos de 'email' para 'identificador' pois pode ser Email ou CPF
  const [identificador, setIdentificador] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErro(null)

    let emailParaLogin = identificador.trim()

    // 1. Descobre se é um CPF (não tem '@')
    if (!emailParaLogin.includes('@')) {
      const cpfLimpo = emailParaLogin.replace(/\D/g, '')
      
      if (cpfLimpo.length !== 11) {
        setErro("Digite um CPF válido (11 números) ou seu E-mail da UBS.")
        setLoading(false)
        return
      }
      
      // Monta o e-mail fantasma que foi criado no Primeiro Acesso
      emailParaLogin = `${cpfLimpo}@paciente.vacinacao.app`
    }

    // 2. Tenta fazer o login com as credenciais
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailParaLogin,
      password,
    })

    if (authError) {
      setErro("Credenciais incorretas. Verifique seu acesso.")
      setLoading(false)
      return
    }

    if (authData.user) {
      // 3. Busca na tabela 'perfis' para ver se o usuário logado é da UBS
      const { data: perfil } = await supabase
        .from('perfis')
        .select('role')
        .eq('id', authData.user.id)
        .single()

      // 4. Força o Next.js a atualizar a sessão do servidor
      router.refresh()

      // 5. Faz o roteamento inteligente
      if (perfil && (perfil.role === 'ubs' || perfil.role === 'admin')) {
        router.push('/admin') // Vai para o Dashboard da UBS
      } else {
        router.push('/')      // Vai para a Carteira do Paciente (PWA)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-700">VacinAção</h1>
          <p className="text-gray-500 mt-2">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CPF ou E-mail
            </label>
            <input
              type="text" // Mudamos para text para aceitar o CPF
              required
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Digite seu CPF ou E-mail"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {erro && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 flex justify-center items-center"
          >
            {loading ? (
              <span className="animate-pulse">Autenticando...</span>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {/* Link para pacientes que estão acessando pela primeira vez */}
        <div className="mt-6 text-center text-sm text-gray-500 border-t pt-6">
          É paciente e ainda não tem senha?{' '}
          <Link href="/registro" className="text-blue-600 font-medium hover:underline block mt-1">
            Criar meu Primeiro Acesso
          </Link>
        </div>
      </div>
    </div>
  )
}