
import { connection } from 'next/server'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageLoading from '@/components/ui/PageLoading'
import { createClient } from '@/lib/supabase/server'
import {
  Users,
  Search,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Phone,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Syringe,
  UserRound,
  ShieldCheck,
  Pencil,
  ClipboardList,
  XCircle,
} from 'lucide-react'

type Dose = {
  numero_dose: number
  data_prevista: string
  data_aplicacao: string | null
  status: string
  conferencia_documental_pendente: boolean | null
}

type Paciente = {
  id: string
  nome: string
  cpf: string
  whatsapp: string | null
  data_acidente: string
  esquemas_vacinais: Dose[] | null
}

const PAGE_SIZE = 20

function getToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

function formatDate(date?: string | null) {
  if (!date) return '—'

  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function maskCpf(cpf?: string | null) {
  if (!cpf) return 'Não informado'

  const numbers = cpf.replace(/\D/g, '')

  if (numbers.length !== 11) return 'CPF cadastrado'

  return `***.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-**`
}

function getPatientStatus(doses: Dose[], today: string) {
  if (!doses.length) {
    return {
      label: 'Sem esquema',
      type: 'neutral',
    }
  }

  const atrasadas = doses.some(
    dose =>
      dose.status === 'atrasada' ||
      (
        dose.status === 'pendente' &&
        dose.data_prevista < today
      )
  )

  if (atrasadas) {
    return {
      label: 'Atrasado',
      type: 'danger',
    }
  }

  if (doses.some(dose => dose.conferencia_documental_pendente === true)) {
    return { label: 'Conferência pendente', type: 'review' }
  }

  const todasAplicadas = doses.every(
    dose => dose.status === 'aplicada'
  )

  if (todasAplicadas) {
    return {
      label: 'Concluído',
      type: 'success',
    }
  }

  return {
    label: 'Em acompanhamento',
    type: 'info',
  }
}

function getNextDose(doses: Dose[]) {
  return doses
    .filter(
      dose =>
        dose.status === 'pendente' ||
        dose.status === 'atrasada'
    )
    .sort((a, b) =>
      a.data_prevista.localeCompare(b.data_prevista)
    )[0] || null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    danger: 'bg-red-50 text-red-700 border-red-100',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    info: 'bg-blue-50 text-blue-700 border-blue-100',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    review: 'bg-amber-50 text-amber-800 border-amber-200',
  }

  const icons: Record<string, typeof CheckCircle2> = {
    danger: AlertTriangle,
    success: CheckCircle2,
    info: Clock3,
    neutral: XCircle,
    review: AlertTriangle,
  }

  const labels: Record<string, string> = {
    danger: 'Atrasado',
    success: 'Concluído',
    info: 'Em acompanhamento',
    neutral: 'Sem esquema',
    review: 'Conferência pendente',
  }

  const Icon = icons[status] || Clock3

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles[status] || styles.neutral}`}>
      <Icon size={12} />
      {labels[status] || 'Não identificado'}
    </span>
  )
}

function EmptyState({
  search,
}: {
  search: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">

      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Users size={27} strokeWidth={1.6} />
      </div>

      <h3 className="text-sm font-bold text-slate-800">
        {search
          ? 'Nenhum paciente encontrado'
          : 'Nenhum paciente cadastrado'}
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
        {search
          ? 'Tente pesquisar utilizando outro nome ou CPF.'
          : 'Os pacientes cadastrados nesta unidade aparecerão aqui.'}
      </p>

      {!search && (
        <Link
          href="/admin/cadastro"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          <UserPlus size={15} />
          Cadastrar paciente
        </Link>
      )}

    </div>
  )
}

async function PacientesConteudo({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    page?: string
  }>
}) {
  await connection()

  const params = await searchParams

  const busca = (params.q || '').trim().slice(0, 80)

  const paginaSolicitada = Number(params.page || 1)

  const pagina = Number.isFinite(paginaSolicitada)
    ? Math.max(1, Math.floor(paginaSolicitada))
    : 1

  const supabase = await createClient()

  // Usuário autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser()

    if (!user) redirect('/login-ubs')

  // Unidade vinculada ao usuário
  const { data: perfil, error: perfilError } = await supabase
    .from('perfis')
    .select('role, unidade_id')
    .eq('id', user.id)
    .single()

  if (perfilError || !perfil || !['admin', 'ubs'].includes(perfil.role) || (perfil.role === 'ubs' && !perfil.unidade_id)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="font-semibold text-amber-900">
          Acesso não autorizado ou unidade não identificada
        </h2>
        <p className="mt-1 text-sm text-amber-800">
          É necessário possuir perfil administrativo ou estar vinculado a uma UBS.
        </p>
      </div>
    )
  }

  // Consulta paginada e restrita à unidade
  let query = supabase
    .from('pacientes')
    .select(`
      id,
      nome,
      cpf,
      whatsapp,
      data_acidente,
      esquemas_vacinais (
        numero_dose,
        data_prevista,
        data_aplicacao,
        status,
        conferencia_documental_pendente
      )
    `, { count: 'exact' })
    .order('nome', { ascending: true })

  if (perfil.role === 'ubs') {
    query = query.eq('unidade_id', perfil.unidade_id!)
  }

  // Busca por nome ou CPF
  const termoSeguro = busca.replace(/[^\p{L}\p{N}\s]/gu, '').trim().replace(/[,%()]/g, '')

  if (termoSeguro) {
    query = query.or(
      `nome.ilike.%${termoSeguro}%,cpf.ilike.%${termoSeguro.replace(/\s/g, '')}%`
    )
  }

  const inicio = (pagina - 1) * PAGE_SIZE
  const fim = inicio + PAGE_SIZE - 1

  const { data, error, count } = await query.range(inicio, fim)

  if (error) {
    console.error('Erro ao carregar pacientes:', error)

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-red-600" size={22} />
          <div>
            <h2 className="font-semibold text-red-900">
              Não foi possível carregar os pacientes
            </h2>
            <p className="mt-1 text-sm text-red-700">
              Verifique sua conexão e as permissões do Supabase.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const pacientes = (data || []) as Paciente[]

  const total = count || 0
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hoje = getToday()

  // Indicadores calculados apenas sobre os registros da página atual.
  const atrasados = pacientes.filter(paciente =>
    getPatientStatus(
      paciente.esquemas_vacinais || [],
      hoje
    ).type === 'danger'
  ).length

  const concluidos = pacientes.filter(paciente =>
    getPatientStatus(
      paciente.esquemas_vacinais || [],
      hoje
    ).type === 'success'
  ).length

  const primeiroRegistro = pacientes.length > 0 ? inicio + 1 : 0
  const ultimoRegistro = Math.min(inicio + pacientes.length, total)

  const gerarLink = (novaPagina: number) => {
    const queryParams = new URLSearchParams()

    if (busca) queryParams.set('q', busca)
    queryParams.set('page', String(novaPagina))

    return `/admin/pacientes?${queryParams.toString()}`
  }

  return (
    <div className="space-y-7">

      {/* CABEÇALHO */}

      <header className="va-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Gestão de pacientes
            </span>
          </div>

          <h1 className="text-[25px] font-bold tracking-tight text-slate-800 sm:text-[29px]">
            Pacientes & Faltosos
          </h1>

          <p className="mt-1 text-[13px] text-slate-500">
            Gerencie os cadastros e acompanhe os protocolos de imunização.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
        <Link href="/admin/busca-ativa" className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-3 text-xs font-semibold text-sky-900 hover:bg-sky-50"><Phone size={16} /> Abrir busca ativa</Link>
        <Link
          href="/admin/cadastro"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800"
        >
          <UserPlus size={16} />
          Novo paciente
        </Link>
        </div>

      </header>

      <section aria-label="Resumo da consulta" className="va-panel grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0"><div className="px-5 py-4"><p className="text-xs text-slate-600">Pacientes na consulta</p><p className="mt-1 text-2xl font-bold tabular-nums">{total.toLocaleString('pt-BR')}</p></div><div className="px-5 py-4"><p className="text-xs text-slate-600">Com atraso · página atual</p><p className="mt-1 text-2xl font-bold tabular-nums text-rose-800">{atrasados}</p></div><div className="px-5 py-4"><p className="text-xs text-slate-600">Concluídos · página atual</p><p className="mt-1 text-2xl font-bold tabular-nums">{concluidos}</p></div></section>

      {/* LISTAGEM */}

      <section className="va-panel overflow-hidden">

        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6">

          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Lista de pacientes
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              {perfil.role === 'admin' ? 'Consulte os pacientes de todas as unidades.' : 'Consulte os pacientes vinculados à sua unidade.'}
            </p>
          </div>

          <form
            action="/admin/pacientes"
            method="GET"
            className="flex flex-col gap-2 sm:flex-row"
          >

            <div className="relative flex-1">

              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                name="q"
                type="search"
                aria-label="Pesquisar pacientes por nome ou CPF"
                defaultValue={busca}
                placeholder="Pesquisar por nome ou CPF..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
              />

            </div>

            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <Search size={15} />
              Pesquisar
            </button>

            {busca && (
              <Link
                href="/admin/pacientes"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Limpar
              </Link>
            )}

          </form>

        </div>

        {/* TABELA */}

        {pacientes.length === 0 ? (

          <EmptyState search={busca} />

        ) : (

          <>

            <div className="va-table-scroll" role="region" aria-label="Lista de pacientes; deslize ou use as setas para consultar as colunas" tabIndex={0}>

              <table className="w-full min-w-[850px] text-left">
                <caption className="sr-only">Pacientes da página atual, cronograma, situação e ações de atendimento.</caption>

                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-4">Paciente</th>
                    <th className="px-5 py-4">CPF</th>
                    <th className="px-5 py-4">Protocolo</th>
                    <th className="px-5 py-4">Próxima dose</th>
                    <th className="px-5 py-4">Situação</th>
                    <th className="px-5 py-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {pacientes.map(paciente => {

                    const doses = paciente.esquemas_vacinais || []
                    const status = getPatientStatus(doses, hoje)
                    const proximaDose = getNextDose(doses)

                    const telefone = (paciente.whatsapp || '').replace(/\D/g, '')

                    return (
                      <tr
                        key={paciente.id}
                        className={status.type === 'danger' ? 'va-priority-row transition-colors' : 'transition-colors hover:bg-slate-50/70'}
                      >

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                              <UserRound size={17} />
                            </div>

                            <div className="min-w-0">
                              <p className="max-w-[230px] break-words text-sm font-semibold text-slate-800">
                                {paciente.nome}
                              </p>
                              <p className="mt-1 text-[10px] text-slate-400">
                                Cadastro #{paciente.id.slice(0, 8)}
                              </p>
                            </div>

                          </div>

                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500">
                          {maskCpf(paciente.cpf)}
                        </td>

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                            <Syringe size={14} className="text-emerald-600" />
                            {doses.filter(d => d.status === 'aplicada' && d.conferencia_documental_pendente !== true).length}
                            <span className="text-slate-400">
                              / {doses.length} doses
                            </span>
                          </div>

                        </td>

                        <td className="px-5 py-4">

                          {proximaDose ? (
                            <div>
                              <p className="text-xs font-semibold text-slate-700">
                                {proximaDose.numero_dose}ª dose
                              </p>
                              <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                                <CalendarDays size={12} />
                                {formatDate(proximaDose.data_prevista)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Nenhuma pendente
                            </span>
                          )}

                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge status={status.type} />
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/pacientes/${paciente.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"><ClipboardList size={13}/> Abrir ficha</Link>
                          <details className="relative text-left"><summary className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Mais ações</summary><div className="mt-2 flex flex-wrap gap-2">
                          <Link href={`/admin/pacientes/${paciente.id}/editar`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={13}/> Editar</Link>
                          {telefone ? (
                            <Link
                              href={`/admin/pacientes/${paciente.id}#busca-ativa`}
                              aria-label={`Contato de ${paciente.nome}`}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                            >
                              <Phone size={13} />
                              Contato
                            </Link>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              Não informado
                            </span>
                          )}
                          </div></details>
                          </div>
                        </td>

                      </tr>
                    )
                  })}

                </tbody>

              </table>

            </div>

            {/* PAGINAÇÃO */}

            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-[11px] text-slate-500">
                Exibindo <strong className="text-slate-700">{primeiroRegistro}–{ultimoRegistro}</strong> de <strong className="text-slate-700">{total}</strong> pacientes
              </p>

              <div className="flex items-center gap-2">

                <Link
                  href={gerarLink(Math.max(1, pagina - 1))}
                  aria-disabled={pagina <= 1}
                  className={`flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-medium transition-colors ${
                    pagina <= 1
                      ? 'pointer-events-none border-slate-100 text-slate-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ChevronLeft size={15} />
                  Anterior
                </Link>

                <span className="px-2 text-[11px] text-slate-500">
                  Página {pagina} de {totalPaginas}
                </span>

                <Link
                  href={gerarLink(Math.min(totalPaginas, pagina + 1))}
                  aria-disabled={pagina >= totalPaginas}
                  className={`flex h-9 items-center gap-1 rounded-lg border px-3 text-xs font-medium transition-colors ${
                    pagina >= totalPaginas
                      ? 'pointer-events-none border-slate-100 text-slate-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Próxima
                  <ChevronRight size={15} />
                </Link>

              </div>

            </div>

          </>

        )}

      </section>

      {/* RODAPÉ */}

      <div className="flex items-center justify-center gap-2 pb-2 text-[10px] text-slate-400">
        <ShieldCheck size={13} />
        {perfil.role === 'admin' ? 'Consulta administrativa de todas as unidades.' : 'Consulta restrita aos pacientes da sua unidade.'}
      </div>

    </div>
  )
}


export default function PacientesPage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  return (
    <Suspense fallback={<PageLoading label="Carregando pacientes…" />}>
      <PacientesConteudo searchParams={searchParams} />
    </Suspense>
  )
}
