
'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Stethoscope,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'

export default function LoginUbsPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (loading) return

    setLoading(true)
    setError('')

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError('E-mail ou senha incorretos. Verifique suas credenciais.')
        setLoading(false)
        return
      }

      router.push('/admin')
      router.refresh()
    } catch {
      setError('Não foi possível conectar ao sistema. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <main className="ubs-login relative min-h-screen w-full flex items-center justify-center overflow-hidden px-4 py-10">

      {/* BACKGROUND INSTITUCIONAL */}

      <div className="absolute inset-0 pointer-events-none">

        <div className="absolute inset-0 bg-gradient-to-br from-[#e7f1eb] via-[#edf3ef] to-[#dcebe4]" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_15%,rgba(69,155,115,0.17),transparent_45%),radial-gradient(ellipse_at_90%_85%,rgba(46,139,120,0.16),transparent_42%)]" />

        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)]" />

      </div>

      {/* CONTEÚDO */}

      <div className="relative z-10 w-full max-w-[410px]">

        {/* IDENTIFICAÇÃO */}

        <div className="flex justify-center mb-6">

          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/45 border border-white/70">

            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />

            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-900/75">
              Acesso Institucional
            </span>

          </div>

        </div>

        {/* CARD */}

        <section className="ubs-glass-card relative rounded-[27px] p-7 sm:p-9">

          {/* REFLEXO SUPERIOR */}

          <div className="absolute top-0 left-[12%] right-[12%] h-px bg-white/90" />

          {/* CABEÇALHO */}

          <header className="text-center mb-8">

            <div className="inline-flex items-center justify-center w-[66px] h-[66px] rounded-[21px] bg-emerald-600/[0.09] border border-emerald-700/[0.10] mb-4">

              <Stethoscope
                size={29}
                strokeWidth={1.65}
                className="text-emerald-700/80"
              />

            </div>

            <h1 className="text-[29px] font-semibold tracking-[-1.3px] text-slate-800">
              Vacin<span className="text-emerald-700">Ação</span>
            </h1>

            <p className="text-[12px] text-slate-500 mt-2 font-medium">
              Portal da Unidade Básica de Saúde
            </p>

            <div className="w-8 h-[3px] rounded-full bg-emerald-600/70 mx-auto mt-5" />

          </header>

          {/* FORMULÁRIO */}

          <form onSubmit={handleLogin} className="space-y-5">

            {error && (
              <div
                role="alert"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50/80 border border-red-200/80 text-red-700 text-xs"
              >
                <AlertCircle size={17} className="shrink-0 opacity-80" />
                <span>{error}</span>
              </div>
            )}

            {/* E-MAIL */}

            <div className="space-y-2">

              <label
                htmlFor="email"
                className="block pl-1 text-[10px] font-bold tracking-[0.12em] uppercase text-slate-600"
              >
                E-mail Institucional
              </label>

              <div className="relative">

                <Mail
                  size={17}
                  strokeWidth={1.7}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none"
                />

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@ubs.gov.br"
                  className="ubs-input w-full pl-11 pr-4 py-[14px] rounded-[13px] text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                />

              </div>

            </div>

            {/* SENHA */}

            <div className="space-y-2">

              <label
                htmlFor="password"
                className="block pl-1 text-[10px] font-bold tracking-[0.12em] uppercase text-slate-600"
              >
                Senha de Acesso
              </label>

              <div className="relative">

                <Lock
                  size={17}
                  strokeWidth={1.7}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400/80 pointer-events-none"
                />

                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="ubs-input w-full pl-11 pr-4 py-[14px] rounded-[13px] text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                />

              </div>

            </div>

            {/* BOTÃO */}

            <button
              type="submit"
              disabled={loading}
              className="ubs-button group w-full flex items-center justify-center gap-2.5 py-[14px] px-4 mt-2 rounded-[13px] text-white text-[13px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >

              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight
                    size={16}
                    strokeWidth={2}
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </>
              )}

            </button>

          </form>

          {/* RODAPÉ */}

          <footer className="mt-8 pt-5 border-t border-slate-200/70">

            <div className="flex items-center justify-center gap-2 mb-2">

              <ShieldCheck
                size={15}
                strokeWidth={1.8}
                className="text-emerald-700/75"
              />

              <span className="text-[10px] font-semibold tracking-[0.11em] uppercase text-slate-600">
                Ambiente Protegido
              </span>

            </div>

            <p className="text-center text-[10px] text-slate-400">
              Protocolo de Imunização Municipal
            </p>

          </footer>

        </section>

        {/* RODAPÉ EXTERNO */}

        <div className="mt-6 text-center">

          <p className="text-[10px] text-slate-500/80 font-medium tracking-wide">
            Sistema de acesso institucional seguro
          </p>

        </div>

      </div>

      {/* ESTILIZAÇÃO OTIMIZADA */}

      <style jsx global>{`

        .ubs-login {
          isolation: isolate;
        }

        /* VIDRO INSTITUCIONAL */

        .ubs-glass-card {
          background: rgba(255, 255, 255, 0.68);

          -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);

          border: 1px solid rgba(255, 255, 255, 0.82);

          box-shadow:
            0 20px 55px rgba(35, 82, 61, 0.10),
            0 4px 14px rgba(35, 82, 61, 0.04),
            inset 0 1px 0 rgba(255,255,255,0.85);

          animation: ubsEnter 0.45s ease-out both;
        }

        /* CAMPOS */

        .ubs-input {
          background: rgba(255,255,255,0.53);
          border: 1px solid rgba(148,163,184,0.28);

          box-shadow:
            inset 0 1px 2px rgba(15,23,42,0.025);

          transition:
            border-color 0.18s ease,
            background 0.18s ease,
            box-shadow 0.18s ease;
        }

        .ubs-input:hover {
          border-color: rgba(16,185,129,0.35);
        }

        .ubs-input:focus {
          background: rgba(255,255,255,0.92);
          border-color: rgba(5,150,105,0.65);

          box-shadow:
            0 0 0 3px rgba(16,185,129,0.10);
        }

        /* BOTÃO */

        .ubs-button {
          background: linear-gradient(
            110deg,
            #078b62,
            #079d78
          );

          border: 1px solid rgba(255,255,255,0.25);

          box-shadow:
            0 5px 14px rgba(5,150,105,0.18),
            inset 0 1px 0 rgba(255,255,255,0.18);

          transition:
            background 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease;
        }

        .ubs-button:hover:not(:disabled) {
          background: linear-gradient(
            110deg,
            #067b58,
            #078b6b
          );

          box-shadow:
            0 7px 18px rgba(5,150,105,0.23);

          transform: translateY(-1px);
        }

        .ubs-button:active:not(:disabled) {
          transform: translateY(0) scale(0.99);
        }

        /* ENTRADA */

        @keyframes ubsEnter {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ACESSIBILIDADE */

        @media (prefers-reduced-motion: reduce) {
          .ubs-glass-card {
            animation: none;
          }

          .ubs-input,
          .ubs-button,
          .ubs-button svg {
            transition: none !important;
          }
        }

        /* FALLBACK PARA NAVEGADORES SEM BLUR */

        @supports not (backdrop-filter: blur(14px)) {
          .ubs-glass-card {
            background: rgba(248,252,249,0.96);
          }
        }

        /* MOBILE */

        @media (max-width: 480px) {
          .ubs-glass-card {
            border-radius: 23px;
          }
        }

      `}</style>

    </main>
  )
}
