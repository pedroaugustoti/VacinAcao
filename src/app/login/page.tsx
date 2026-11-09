
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
  Fingerprint
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
    <main className="liquid-page relative min-h-screen w-full flex items-center justify-center overflow-hidden px-4 py-10 selection:bg-emerald-500/30">

      {/* BACKGROUND LIQUID GLASS */}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">

        {/* Base */}

        <div className="absolute inset-0 bg-gradient-to-br from-[#f8fcfa] via-[#edf7f3] to-[#e5f3ef]" />

        {/* Luzes orgânicas */}

        <div className="liquid-orb orb-one absolute rounded-full" />
        <div className="liquid-orb orb-two absolute rounded-full" />
        <div className="liquid-orb orb-three absolute rounded-full" />

        {/* Reflexo central */}

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.7)_0%,transparent_65%)]" />

        {/* Grade arquitetônica */}

        <div className="absolute inset-0 opacity-[0.20] bg-[linear-gradient(rgba(16,100,70,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(16,100,70,0.045)_1px,transparent_1px)] bg-[size:65px_65px]" />

        {/* Vinheta */}

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(209,232,222,0.30)_100%)]" />

      </div>

      {/* CONTEÚDO */}

      <div className="relative z-10 w-full max-w-[430px]">

        {/* Indicador superior */}

        <div className="flex justify-center mb-7 login-appear">

          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/90 bg-white/45 backdrop-blur-xl shadow-[0_5px_20px_rgba(30,100,70,0.06)]">

            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>

            <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-emerald-800">
              Acesso Institucional
            </span>

          </div>

        </div>

        {/* CARD PRINCIPAL */}

        <section className="liquid-card relative overflow-hidden rounded-[34px] p-7 sm:p-10">

          {/* Camada de iluminação superior */}

          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-300/10 rounded-full blur-[80px] pointer-events-none" />

          <div className="absolute -bottom-24 -left-20 w-64 h-64 bg-teal-300/10 rounded-full blur-[80px] pointer-events-none" />

          {/* CABEÇALHO */}

          <div className="relative text-center mb-9 login-appear">

            {/* Ícone */}

            <div className="relative inline-flex mb-5">

              <div className="absolute inset-[-8px] rounded-[30px] bg-emerald-400/15 blur-xl" />

              <div className="relative flex items-center justify-center w-[76px] h-[76px] rounded-[25px] liquid-icon">

                <Stethoscope
                  size={33}
                  strokeWidth={1.7}
                  className="text-emerald-700"
                />

                <div className="absolute top-2 left-3 w-8 h-3 rounded-full bg-white/70 blur-md" />

              </div>

            </div>

            {/* Nome */}

            <h1 className="text-[30px] leading-tight font-semibold tracking-[-1.5px] text-slate-800">
              Vacin<span className="text-emerald-600 font-bold">Ação</span>
            </h1>

            <p className="mt-2 text-[13px] text-slate-500 font-medium tracking-wide">
              Portal da Unidade Básica de Saúde
            </p>

            <div className="flex justify-center mt-5">
              <div className="h-[3px] w-9 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
            </div>

          </div>

          {/* FORMULÁRIO */}

          <form onSubmit={handleLogin} className="relative space-y-5 login-form-appear">

            {/* Erro */}

            {error && (
              <div
                role="alert"
                className="flex items-center gap-3 p-4 rounded-2xl bg-red-50/80 border border-red-200/70 text-red-700 text-xs font-medium shadow-sm animate-shake"
              >
                <AlertCircle size={19} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* E-MAIL */}

            <div className="space-y-2">

              <label
                htmlFor="email"
                className="block pl-1 text-[10px] font-bold tracking-[0.14em] uppercase text-slate-600"
              >
                E-mail Institucional
              </label>

              <div className="liquid-input-group relative">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 transition-colors">
                  <Mail size={18} strokeWidth={1.8} />
                </div>

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@ubs.gov.br"
                  className="liquid-input w-full pl-12 pr-4 py-[15px] rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                />

              </div>

            </div>

            {/* SENHA */}

            <div className="space-y-2">

              <label
                htmlFor="password"
                className="block pl-1 text-[10px] font-bold tracking-[0.14em] uppercase text-slate-600"
              >
                Senha de Acesso
              </label>

              <div className="liquid-input-group relative">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 transition-colors">
                  <Lock size={18} strokeWidth={1.8} />
                </div>

                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="liquid-input w-full pl-12 pr-4 py-[15px] rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                />

              </div>

            </div>

            {/* BOTÃO */}

            <button
              type="submit"
              disabled={loading}
              className="liquid-button group relative overflow-hidden w-full flex items-center justify-center gap-3 py-[16px] px-5 mt-3 rounded-2xl text-white text-[13px] font-semibold tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
            >

              <span className="button-shine absolute inset-0 pointer-events-none" />

              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight
                    size={17}
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  />
                </>
              )}

            </button>

          </form>

          {/* RODAPÉ */}

          <div className="relative mt-9 pt-6 border-t border-white/70">

            <div className="flex items-center justify-center gap-2 mb-3">

              <ShieldCheck size={15} className="text-emerald-600" />

              <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-600">
                Ambiente Protegido
              </span>

            </div>

            <p className="text-center text-[10px] leading-relaxed text-slate-400 font-medium">
              Protocolo de Imunização Municipal
            </p>

          </div>

          {/* Reflexo inferior */}

          <div className="absolute bottom-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />

        </section>

        {/* RODAPÉ EXTERNO */}

        <div className="mt-7 text-center login-appear">

          <div className="inline-flex items-center justify-center gap-2 text-[10px] text-slate-400 font-medium tracking-wide">

            <Fingerprint size={13} className="text-emerald-600/70" />

            <span>Sistema de acesso institucional seguro</span>

          </div>

        </div>

      </div>

      {/* ESTILIZAÇÃO LIQUID GLASS */}

      <style jsx global>{`

        .liquid-page {
          isolation: isolate;
        }

        .liquid-orb {
          pointer-events: none;
          filter: blur(75px);
          will-change: transform;
        }

        .orb-one {
          width: 520px;
          height: 520px;
          top: -180px;
          left: -140px;
          background: radial-gradient(
            circle,
            rgba(52, 211, 153, 0.28) 0%,
            rgba(110, 231, 183, 0.12) 45%,
            transparent 72%
          );
          animation: liquidFloatOne 18s ease-in-out infinite alternate;
        }

        .orb-two {
          width: 570px;
          height: 570px;
          right: -170px;
          bottom: -220px;
          background: radial-gradient(
            circle,
            rgba(45, 212, 191, 0.25) 0%,
            rgba(94, 234, 212, 0.10) 48%,
            transparent 72%
          );
          animation: liquidFloatTwo 22s ease-in-out infinite alternate;
        }

        .orb-three {
          width: 340px;
          height: 340px;
          left: 45%;
          top: 38%;
          background: radial-gradient(
            circle,
            rgba(167, 243, 208, 0.30) 0%,
            transparent 70%
          );
          animation: liquidFloatThree 16s ease-in-out infinite alternate;
        }

        /* CARD DE VIDRO */

        .liquid-card {
          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,0.88) 0%,
              rgba(255,255,255,0.66) 45%,
              rgba(245,255,250,0.74) 100%
            );

          -webkit-backdrop-filter: blur(35px) saturate(180%);
          backdrop-filter: blur(35px) saturate(180%);

          border: 1px solid rgba(255,255,255,0.92);

          box-shadow:
            0 35px 90px rgba(28, 94, 68, 0.10),
            0 12px 35px rgba(30, 90, 70, 0.06),
            inset 0 1px 0 rgba(255,255,255,1),
            inset 0 -1px 0 rgba(255,255,255,0.45),
            inset 1px 0 0 rgba(255,255,255,0.50);

          animation: cardAppear 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ÍCONE */

        .liquid-icon {
          background:
            linear-gradient(
              145deg,
              rgba(255,255,255,0.98),
              rgba(218,250,234,0.78)
            );

          border: 1px solid rgba(255,255,255,0.95);

          box-shadow:
            0 12px 30px rgba(16, 185, 129, 0.13),
            inset 0 1px 2px rgba(255,255,255,1),
            inset 0 -1px 2px rgba(16,185,129,0.08);
        }

        /* INPUTS */

        .liquid-input {
          background: rgba(255,255,255,0.48);
          border: 1px solid rgba(148,163,184,0.22);

          box-shadow:
            inset 0 1px 3px rgba(15,23,42,0.025),
            0 2px 8px rgba(15,23,42,0.025);

          transition:
            background 0.3s ease,
            border-color 0.3s ease,
            box-shadow 0.3s ease,
            transform 0.3s ease;
        }

        .liquid-input-group:focus-within > div:first-child {
          color: #059669;
        }

        .liquid-input:focus {
          background: rgba(255,255,255,0.88);
          border-color: rgba(16,185,129,0.55);

          box-shadow:
            0 0 0 4px rgba(16,185,129,0.09),
            0 5px 18px rgba(16,185,129,0.06),
            inset 0 1px 2px rgba(255,255,255,1);

          transform: translateY(-1px);
        }

        /* BOTÃO */

        .liquid-button {
          background: linear-gradient(
            110deg,
            #059669 0%,
            #10a77b 48%,
            #0d9488 100%
          );

          border: 1px solid rgba(255,255,255,0.35);

          box-shadow:
            0 10px 25px rgba(5,150,105,0.22),
            0 4px 10px rgba(5,150,105,0.10),
            inset 0 1px 0 rgba(255,255,255,0.30),
            inset 0 -1px 0 rgba(0,0,0,0.08);

          transition:
            transform 0.3s ease,
            box-shadow 0.3s ease,
            filter 0.3s ease;
        }

        .liquid-button:hover:not(:disabled) {
          transform: translateY(-2px);

          filter: brightness(1.06);

          box-shadow:
            0 15px 32px rgba(5,150,105,0.28),
            0 5px 12px rgba(5,150,105,0.12),
            inset 0 1px 0 rgba(255,255,255,0.40);
        }

        .liquid-button:active:not(:disabled) {
          transform: scale(0.985);
        }

        .button-shine {
          background: linear-gradient(
            110deg,
            transparent 20%,
            rgba(255,255,255,0.20) 45%,
            transparent 70%
          );

          transform: translateX(-120%);
          transition: transform 0.8s ease;
        }

        .liquid-button:hover .button-shine {
          transform: translateX(120%);
        }

        /* ENTRADA */

        .login-appear {
          animation: contentAppear 0.8s ease both;
        }

        .login-form-appear {
          animation: contentAppear 1s ease 0.15s both;
        }

        @keyframes cardAppear {
          from {
            opacity: 0;
            transform: translateY(25px) scale(0.97);
            filter: blur(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes contentAppear {
          from {
            opacity: 0;
            transform: translateY(12px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes liquidFloatOne {
          from {
            transform: translate(0, 0) scale(1);
          }

          to {
            transform: translate(80px, 60px) scale(1.15);
          }
        }

        @keyframes liquidFloatTwo {
          from {
            transform: translate(0, 0) scale(1);
          }

          to {
            transform: translate(-90px, -65px) scale(1.12);
          }
        }

        @keyframes liquidFloatThree {
          from {
            transform: translate(-30px, 20px);
          }

          to {
            transform: translate(40px, -50px);
          }
        }

        /* ACESSIBILIDADE */

        @media (prefers-reduced-motion: reduce) {
          .liquid-orb,
          .liquid-card,
          .login-appear,
          .login-form-appear {
            animation: none !important;
          }

          .liquid-button,
          .liquid-input,
          .button-shine {
            transition: none !important;
          }
        }

        /* MOBILE */

        @media (max-width: 480px) {
          .liquid-card {
            border-radius: 28px;
          }

          .orb-one {
            width: 320px;
            height: 320px;
          }

          .orb-two {
            width: 350px;
            height: 350px;
          }
        }

      `}</style>

    </main>
  )
}
