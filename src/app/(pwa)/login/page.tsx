"use client"

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { identificadorPaciente } from '@/lib/patient-login'
import { Activity, AlertCircle, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'

export default function LoginPacientePage() {
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  async function entrar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setErro('')
    const email = identificadorPaciente(identificador)
    if (!email) {
      setErro('Informe um CPF com 11 números ou seu e-mail.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error || !data.user) {
        setErro('Não foi possível entrar. Verifique suas credenciais ou procure sua UBS.')
        return
      }
      const { data: perfil } = await supabase.from('perfis').select('role').eq('id', data.user.id).maybeSingle()
      router.replace(perfil?.role === 'ubs' || perfil?.role === 'admin' ? '/admin' : '/doses')
      router.refresh()
    } catch {
      setErro('Não foi possível conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-blue-50 p-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-teal-900/5 sm:p-9">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Activity size={27}/></span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vacin<span className="text-teal-600">Ação</span></h1>
          <p className="mt-2 text-sm text-slate-600">Entre com o e-mail ativado pela UBS e sua senha pessoal. Use CPF somente se a equipe tiver configurado esse identificador para sua conta.</p>
        </div>
        <form onSubmit={entrar} className="space-y-5">
          <div>
            <label htmlFor="identificador" className="mb-1.5 block text-sm font-semibold text-slate-700">CPF ou e-mail</label>
            <input id="identificador" autoComplete="username" required value={identificador} onChange={e => setIdentificador(e.target.value)} placeholder="CPF ou e-mail cadastrado" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"/>
          </div>
          <div>
            <label htmlFor="senha" className="mb-1.5 block text-sm font-semibold text-slate-700">Senha</label>
            <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} placeholder="Sua senha de acesso" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"/>
          </div>
          {erro && <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={18} className="shrink-0"/>{erro}</div>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
            {loading ? <Loader2 size={18} className="animate-spin"/> : <ArrowRight size={18}/>} {loading ? 'Entrando...' : 'Acessar carteira'}
          </button>
        </form>
        <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
          Primeiro acesso ou esqueceu a senha? <Link href="/registro" className="font-semibold text-teal-700 underline">Orientações de acesso</Link>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-600">CPF e data de nascimento não são senhas. Se você ainda não tem acesso, a UBS precisa conferir sua identidade e vincular a conta ao cadastro.</p>
        <p className="mt-5 text-center text-xs"><Link href="/login-ubs" className="font-semibold text-sky-900 underline">Sou profissional da equipe</Link></p>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={14}/> Seus dados são protegidos por autenticação.</p>
      </section>
    </main>
  )
}
