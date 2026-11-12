'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { exigirUuidRetornado, type RpcArgs } from '@/lib/rpc-contracts'
import { createClient } from '@/lib/supabase/client'
import { calcularDatas, validarDatas, MAX_DOSES } from '@/lib/cronograma'
import {
  UserPlus,
  ShieldAlert,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

const digits = (value: string) => value.replace(/\D/g, '')

const formatCpfMask = (v: string) => {
  const d = digits(v).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

const formatPhoneMask = (v: string) => {
  const d = digits(v).slice(0, 11)
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

export default function CadastroPaciente() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [dataAcidente, setDataAcidente] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [intervalosTexto, setIntervalosTexto] = useState('')
  const [datas, setDatas] = useState<string[]>([''])
  const [cronogramaConfirmado, setCronogramaConfirmado] = useState(false)
  const [unidade, setUnidade] = useState('')
  const [loading, setLoading] = useState(false)
  const [orientarPortal,setOrientarPortal]=useState(false)
  const [mensagem, setMensagem] = useState<{
    erro: boolean
    texto: string
  } | null>(null)

  // Sugestão operacional definida pelo profissional, sem prescrição automática.
  const sugerirProtocoloPadrao = () => {
    try {
      setDatas(calcularDatas(datas[0], intervalosTexto))
      setCronogramaConfirmado(false)
      setMensagem(null)
    } catch (erro) {
      setMensagem({ erro: true, texto: erro instanceof Error ? erro.message : 'Cronograma inválido.' })
    }
  }

  async function handleCadastro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setMensagem(null)

    if (
      !nome.trim() ||
      digits(cpf).length !== 11 ||
      digits(whatsapp).length < 10 ||
      !dataAcidente ||
      datas.some((d) => !d) ||
      !cronogramaConfirmado
    ) {
      setMensagem({
        erro: true,
        texto:
          'Preencha os dados e todas as datas previstas e confirme a validação profissional do cronograma.',
      })
      return
    }

    const hoje = new Date().toISOString().slice(0, 10)
    if (dataNascimento > hoje) {
      setMensagem({
        erro: true,
        texto: 'A data de nascimento não pode estar no futuro.',
      })
      return
    }

    if (!validarDatas(datas)) {
      setMensagem({
        erro: true,
        texto:
          'As datas do esquema vacinal devem estar em ordem estritamente cronológica.',
      })
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError || !auth.user)
        throw new Error('Sessão expirada. Entre novamente.')

      const { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('role,unidade_id')
        .eq('id', auth.user.id)
        .single()

      if (perfilError || !perfil || !['ubs', 'admin'].includes(perfil.role)) {
        throw new Error('Seu perfil não possui permissão para cadastrar pacientes.')
      }

      const unidadeId =
        perfil.role === 'ubs'
          ? perfil.unidade_id
          : unidade.trim() || perfil.unidade_id

      if (!unidadeId) {
        throw new Error(
          'Informe o UUID da unidade de atendimento ou vincule uma unidade ao seu perfil no Supabase.'
        )
      }

      const { data: retorno, error } = await supabase.rpc('va_cadastrar_atendimento_v2', {
        p_unidade_id: unidadeId,
        p_nome: nome.trim(),
        p_cpf: digits(cpf),
        p_whatsapp: digits(whatsapp),
        p_data_acidente: dataAcidente,
        p_data_nascimento: dataNascimento || null,
        p_datas_previstas: datas,
      } satisfies RpcArgs<'va_cadastrar_atendimento_v2'>)

      if (error) {
        if (
          error.code === '42883' ||
          error.code === 'PGRST202'
        ) {
          throw new Error(
            'O contrato de cadastro não está disponível para esta sessão. Solicite a verificação da assinatura, permissões e cache da API no Supabase.'
          )
        }
        if (error.code === '23505') {
          throw new Error('Este CPF já possui cadastro ativo no sistema.')
        }
        throw new Error(
          'Não foi possível salvar o atendimento. Verifique os dados e as permissões.'
        )
      }

      const pacienteId = exigirUuidRetornado(retorno)
      setMensagem({
        erro: false,
        texto:
          `Paciente e cronograma de ${datas.length} dose(s) registrados com sucesso!`,
      })
      setNome('')
      setCpf('')
      setWhatsapp('')
      setDataAcidente('')
      setDataNascimento('')
      setDatas([''])
      setCronogramaConfirmado(false)
      setIntervalosTexto('')
      router.push(`/admin/pacientes/${pacienteId}${orientarPortal?'#acesso-portal':''}`)
      router.refresh()
    } catch (error) {
      setMensagem({
        erro: true,
        texto: error instanceof Error ? error.message : 'Erro inesperado.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="va-page-header">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
            Admissão Clínica
          </span>
        </div>
        <h1 className="flex items-center gap-2.5 text-[26px] font-bold tracking-tight text-slate-800">
          <UserPlus className="text-emerald-700" size={26} />
          Novo Atendimento Antirrábico
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Cadastro do paciente e programação das doses conforme prescrição profissional.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950 shadow-2xs">
        <ShieldAlert className="mt-0.5 shrink-0 text-amber-700" size={18} />
        <p>
          As datas devem ser validadas por profissional de saúde habilitado. O
          cadastro inicial <strong>gera as doses prescritas como pendentes</strong>; a
          confirmação de aplicação com lote e SI-PNI é feita na ficha do paciente.
        </p>
      </div>

      <form
        onSubmit={handleCadastro}
        className="va-panel space-y-6 p-5 sm:p-8"
      >
        {mensagem && (
          <div
            role={mensagem.erro ? 'alert' : 'status'}
            className={`flex items-center gap-2.5 rounded-xl border p-4 text-xs font-semibold ${
              mensagem.erro
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {mensagem.erro ? (
              <AlertCircle size={17} className="shrink-0 text-red-600" />
            ) : (
              <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
            )}
            <span>{mensagem.texto}</span>
          </div>
        )}

        <section aria-labelledby="titulo-identificacao" className="va-form-section">
        <h2 id="titulo-identificacao" className="mb-5 flex items-center gap-3 text-sm font-bold text-slate-800"><span className="va-step" aria-hidden="true">01</span> Identificação e atendimento</h2>
        <p className="mb-5 text-sm text-slate-600">Preencha os dados do cadastro. Os campos com * são obrigatórios.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 sm:col-span-2">
            Nome Completo do Paciente *
            <input
              required
              maxLength={200}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Maria Oliveira dos Santos"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>

          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            CPF *
            <input
              required
              inputMode="numeric"
              maxLength={14}
              value={cpf}
              onChange={(e) => setCpf(formatCpfMask(e.target.value))}
              placeholder="000.000.000-00"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>

          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            WhatsApp (Com DDD) *
            <input
              required
              inputMode="tel"
              maxLength={15}
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatPhoneMask(e.target.value))}
              placeholder="(81) 99999-9999"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>

          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Data de Nascimento (se conhecida)
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>

          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Data do Acidente / Exposição *
            <input
              required
              type="date"
              value={dataAcidente}
              onChange={(e) => setDataAcidente(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-sm font-normal text-slate-800 outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>
        </div>

        </section>

        <fieldset aria-labelledby="titulo-cronograma" className="va-form-section space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="titulo-cronograma" className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="va-step" aria-hidden="true">02</span>
                <Calendar size={17} className="text-emerald-700" />
                Cronograma prescrito pelo profissional
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Informe a 1ª dose e os intervalos do protocolo aplicável, ou adicione e ajuste as datas manualmente.
              </p>
            </div>

            <button
              type="button"
              onClick={sugerirProtocoloPadrao}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer"
            >
              <Sparkles size={14} />
              Calcular datas informadas
            </button>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Dias a partir da primeira dose (opcional)
            <input value={intervalosTexto} onChange={e => { setIntervalosTexto(e.target.value); setCronogramaConfirmado(false) }} placeholder="Ex.: 0, 3, 7, 14 — conforme prescrição" className="mt-1 w-full rounded-lg border border-slate-200 p-3 font-normal" />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            {datas.map((d, i) => {
              const diasLabel = d && datas[0] ? Math.round((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${datas[0]}T12:00:00Z`)) / 86400000) : null
              return (
                <label
                  key={i}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3 text-xs font-bold text-slate-700"
                >
                  <span className="flex items-center justify-between">
                    <span>{i + 1}ª Dose</span>
                    <span className="rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                      {diasLabel === null ? 'Data a definir' : `Dia ${diasLabel}`}
                    </span>
                  </span>
                  <input
                    required
                    type="date"
                    value={d}
                    onChange={(e) => {
                      setCronogramaConfirmado(false)
                      setDatas((prev) =>
                        prev.map((item, j) => (i === j ? e.target.value : item))
                      )
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-800 outline-none focus:border-emerald-600"
                  />
                </label>
              )
            })}
          </div>
          <div className="flex gap-3 text-xs font-semibold text-emerald-800">
            <button type="button" disabled={datas.length >= MAX_DOSES} onClick={() => { setDatas([...datas, '']); setCronogramaConfirmado(false) }} className="rounded-lg border border-emerald-200 px-3 py-2 disabled:opacity-50">Adicionar dose</button>
            <button type="button" disabled={datas.length <= 1} onClick={() => { setDatas(datas.slice(0, -1)); setCronogramaConfirmado(false) }} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50">Remover última dose</button>
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" required checked={cronogramaConfirmado} onChange={e => setCronogramaConfirmado(e.target.checked)} />
            Confirmo que a quantidade de doses e as datas foram validadas por profissional de saúde habilitado, conforme a prescrição e o protocolo aplicável.
          </label>
        </fieldset>

        <label className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950"><input type="checkbox" checked={orientarPortal} onChange={e=>setOrientarPortal(e.target.checked)}/> Orientar ativação do portal após salvar (opcional). O atendimento será registrado independentemente da criação de conta; a etapa de acesso exige conferência administrativa separada.</label>
        <details className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-slate-600">
            Opções avançadas de Administrador Geral
          </summary>
          <label className="mt-3 block text-xs font-medium text-slate-700">
            UUID da Unidade de Saúde (apenas caso seu perfil Admin não tenha unidade fixa)
            <input
              value={unidade}
              onChange={(e) => setUnidade(e.target.value)}
              placeholder="Deixe em branco para usar a unidade do seu perfil"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
            />
          </label>
        </details>

        <button
          disabled={loading}
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 py-3.5 px-5 text-sm font-semibold text-white shadow-md shadow-emerald-700/15 transition-all hover:from-emerald-800 hover:to-teal-800 disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              <span>Registrando atendimento...</span>
            </>
          ) : (
            <>
              <UserPlus size={17} />
              <span>Cadastrar Paciente e Gerar Esquema Vacinal</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
