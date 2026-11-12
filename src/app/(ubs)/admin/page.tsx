
import { createClient } from '@/lib/supabase/server'
import { connection } from 'next/server'
import { Suspense } from 'react'
import Link from 'next/link'
import PageLoading from '@/components/ui/PageLoading'
import {
  Users,
  AlertTriangle,
  Syringe,
  CalendarClock,
  CalendarDays,
  ArrowUpRight,
  ArrowRight,
  Phone,
  UserPlus,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Info,
} from 'lucide-react'

type Dose = {
  numero_dose: number
  data_prevista: string
  data_aplicacao: string | null
  status: string
  conferencia_documental_pendente: boolean | null
}

type Patient = {
  id: string
  nome: string
  whatsapp: string | null
  esquemas_vacinais: Dose[] | null
}

function getToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))

  return `${values.year}-${values.month}-${values.day}`
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function formatDate(date: string) {
  if (!date) return '—'

  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  color,
  href,
}: {
  title: string
  value: number
  description: string
  icon: typeof Users
  color: 'green' | 'red' | 'blue' | 'amber'
  href?: string
}) {
  const colors = {
    green: {
      icon: 'bg-emerald-50 text-emerald-700',
      indicator: 'bg-emerald-500',
    },
    red: {
      icon: 'bg-red-50 text-red-600',
      indicator: 'bg-red-500',
    },
    blue: {
      icon: 'bg-blue-50 text-blue-700',
      indicator: 'bg-blue-500',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-700',
      indicator: 'bg-amber-500',
    },
  }

  const content = (
    <div data-tone={color} className="va-metric relative h-full p-4 transition-shadow duration-200 hover:shadow-md sm:p-6">

      <div className="flex items-start justify-between gap-3">

        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[color].icon}`}>
          <Icon size={21} strokeWidth={1.8} />
        </div>

        {href && (
          <ArrowUpRight size={17} className="text-slate-300" />
        )}

      </div>

      <div className="mt-5">

        <p className="min-h-10 text-[13px] font-medium text-slate-600">
          {title}
        </p>

        <h3 className="va-metric-value mt-2 text-slate-800">
          {value.toLocaleString('pt-BR')}
        </h3>

        <p className="mt-1 text-[11px] text-slate-400">
          {description}
        </p>

      </div>

      <div className={`absolute bottom-0 left-5 right-5 h-[2px] rounded-full opacity-40 ${colors[color].indicator}`} />

    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    )
  }

  return content
}

async function DashboardConteudo() {
  await connection()

  const supabase = await createClient()

  // 1. Identifica o usuário autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 2. Identifica a unidade vinculada ao usuário
  const { data: perfil, error: perfilError } = await supabase
    .from('perfis')
    .select('unidade_id, role')
    .eq('id', user.id)
    .single()

  // Não apresenta dados de outra unidade se o perfil estiver incompleto
  if (perfilError || !perfil || !['admin', 'ubs'].includes(perfil.role) || (perfil.role === 'ubs' && !perfil.unidade_id)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-3">
          <Info className="text-amber-700" size={22} />
          <div>
            <h2 className="font-semibold text-amber-900">
              Unidade de saúde não identificada
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Seu perfil ainda não possui uma unidade vinculada.
              Solicite ao administrador a atualização do cadastro.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. Busca o total exato de pacientes da unidade
  let countQuery = supabase
    .from('pacientes')
    .select('id', { count: 'exact', head: true })
  if (perfil.role === 'ubs') countQuery = countQuery.eq('unidade_id', perfil.unidade_id!)
  const { count: totalPacientes, error: countError } = await countQuery

  // 4. Busca pacientes e seus esquemas vacinais
  const pacientes: Patient[] = []
  let error = false
  // A API limita o número de linhas por resposta: percorre todas as páginas.
  do {
    let patientsQuery = supabase
      .from('pacientes')
      .select(`
        id,
        nome,
        whatsapp,
        esquemas_vacinais (
          numero_dose,
          data_prevista,
          data_aplicacao,
          status,
          conferencia_documental_pendente
        )
      `)
      .order('id', { ascending: true })
    if (perfil.role === 'ubs') patientsQuery = patientsQuery.eq('unidade_id', perfil.unidade_id!)
    const { data, error: pageError } = await patientsQuery.range(pacientes.length, pacientes.length + 199)
    if (pageError || !data?.length) {
      error = Boolean(pageError) || pacientes.length !== (totalPacientes ?? 0)
      break
    }
    pacientes.push(...data as Patient[])
  } while (pacientes.length < (totalPacientes ?? 0))
  if (pacientes.length !== totalPacientes) error = true

  // Apenas registros válidos em aplicacoes_vacinais são aplicações documentadas.
  let applicationsQuery = supabase.from('aplicacoes_vacinais')
    .select('id', { count: 'exact', head: true }).eq('status', 'valida')
  if (perfil.role === 'ubs') applicationsQuery = applicationsQuery.eq('unidade_id', perfil.unidade_id!)
  const { count: aplicacoesDocumentadas, error: aplicacoesError } = await applicationsQuery

  const hoje = getToday()
  const limiteProximasDoses = addDays(hoje, 7)

  // 5. Organiza todas as doses
  const todasDoses = pacientes.flatMap(paciente =>
    (paciente.esquemas_vacinais || []).map(dose => ({
      ...dose,
      pacienteId: paciente.id,
      pacienteNome: paciente.nome,
      whatsapp: paciente.whatsapp,
    }))
  )

  // 6. Calcula indicadores
  const conferenciasPendentes = todasDoses.filter(
    dose => dose.conferencia_documental_pendente === true
  )

  const dosesAtrasadas = todasDoses.filter(
    dose =>
      dose.status === 'atrasada' ||
      (dose.status === 'pendente' && dose.data_prevista < hoje)
  )

  const proximasDoses = todasDoses.filter(
    dose =>
      dose.status === 'pendente' &&
      dose.data_prevista >= hoje &&
      dose.data_prevista <= limiteProximasDoses
  )

  // Pacientes únicos com pelo menos uma dose atrasada
  const pacientesAtrasados = new Set(
    dosesAtrasadas.map(dose => dose.pacienteId)
  )

  // Ordena atrasos pelos mais antigos
  const listaAtrasos = [...dosesAtrasadas]
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))
    .slice(0, 10)

  const nomeUsuario =
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Profissional'

  const dataAtual = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'America/Recife',
  }).format(new Date())

  // Erros de consulta não devem ser apresentados como indicadores zerados
  if (countError || error || aplicacoesError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-red-600" size={22} />
          <div>
            <h2 className="font-semibold text-red-900">
              Não foi possível carregar o Dashboard
            </h2>
            <p className="mt-1 text-sm text-red-700">
              Verifique sua conexão e as permissões de acesso aos dados.
              Tente atualizar a página.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">

      {/* CABEÇALHO */}

      <header className="va-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Painel administrativo
            </span>
          </div>

          <h1 className="text-[25px] font-bold tracking-tight text-slate-800 sm:text-[29px]">
            Central de acompanhamento
          </h1>

          <p className="mt-1 text-[13px] text-slate-500">
            {perfil.role === 'admin' ? 'Acompanhe os indicadores de todas as unidades.' : 'Acompanhe os indicadores de imunização da sua unidade.'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays size={16} className="text-emerald-700" />
          <span className="capitalize">{dataAtual}</span>
        </div>

      </header>

      {/* BOAS-VINDAS */}

      <section className="va-welcome relative overflow-hidden rounded-2xl p-5 sm:p-7">

        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

          <div>
            <p className="text-xs font-medium text-emerald-800/70">
              Bem-vindo(a) de volta
            </p>

            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-800">
              Olá, {nomeUsuario}
            </h2>

            <p className="mt-1 max-w-lg text-xs leading-relaxed text-slate-600">
              Aqui está o resumo dos pacientes e dos acompanhamentos
              do protocolo antirrábico.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
          <Link href="/admin/busca-ativa" className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-3 text-xs font-semibold text-sky-900 hover:bg-sky-50">
            <Phone size={16} /> Busca ativa
          </Link>
          <Link
            href="/admin/cadastro"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            <UserPlus size={16} />
            Novo atendimento
            <ArrowRight size={15} />
          </Link>
          </div>

        </div>

        <Activity
          size={100}
          strokeWidth={0.7}
          className="absolute -right-3 -bottom-7 text-emerald-800/[0.06]"
        />

      </section>

      {/* INDICADORES */}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Indicadores de atendimento
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Resumo atualizado dos registros disponíveis
            </p>
          </div>

          <ShieldCheck size={18} className="text-emerald-600" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">

          <MetricCard
            title="Total de pacientes"
            value={totalPacientes || 0}
            description={perfil.role === 'admin' ? 'Pacientes de todas as unidades' : 'Pacientes cadastrados na unidade'}
            icon={Users}
            color="green"
            href="/admin/pacientes"
          />

          <MetricCard
            title="Aplicações documentadas"
            value={aplicacoesDocumentadas || 0}
            description="Aplicações válidas registradas"
            icon={Syringe}
            color="blue"
          />

          <MetricCard
            title="Pacientes atrasados"
            value={pacientesAtrasados.size}
            description={`${dosesAtrasadas.length} doses em atraso`}
            icon={AlertTriangle}
            color="red"
            href="/admin/pacientes"
          />

          <MetricCard
            title="Próximas doses"
            value={proximasDoses.length}
            description="Doses previstas para os próximos 7 dias"
            icon={CalendarClock}
            color="amber"
          />

        </div>
        {conferenciasPendentes.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <Info size={17} className="mt-0.5 shrink-0" />
            <span><strong>{conferenciasPendentes.length} dose(s)</strong> com status histórico “aplicada” aguardam conferência documental. Elas não entram no indicador de aplicações documentadas.</span>
          </div>
        )}
      </section>

      {/* BUSCA ATIVA */}

      <section className="va-panel overflow-hidden">

        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle size={19} />
            </div>

            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Busca ativa de pacientes
              </h2>

              <p className="mt-0.5 text-[11px] text-slate-400">
                Abra a ficha para preparar o contato e registrar manualmente o resultado.
              </p>
              <Link href="/admin/busca-ativa" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">Abrir fila agrupada e histórico <ArrowRight size={13}/></Link>
            </div>

          </div>

          <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-semibold ${
            dosesAtrasadas.length > 0
              ? 'bg-red-50 text-red-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}>
            {dosesAtrasadas.length > 0
              ? `${dosesAtrasadas.length} doses precisam de atenção`
              : 'Nenhum atraso identificado'}
          </span>

        </div>

        {listaAtrasos.length === 0 ? (

          <div className="flex flex-col items-center justify-center px-5 py-12 text-center">

            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={25} strokeWidth={1.7} />
            </div>

            <h3 className="text-sm font-semibold text-slate-700">
              Tudo em dia!
            </h3>

            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">
              {perfil.role === 'admin' ? 'Não existem doses atrasadas registradas para os pacientes das unidades consultadas.' : 'Não existem doses atrasadas registradas para os pacientes desta unidade.'}
            </p>

          </div>

        ) : (

          <div className="va-table-scroll" tabIndex={0} role="region" aria-label="Doses em atraso; deslize ou use as setas para consultar a tabela">

            <table className="w-full min-w-[650px] text-left">
              <caption className="sr-only">Até dez doses em atraso, começando pela data prevista mais antiga.</caption>

              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">Paciente</th>
                  <th className="px-6 py-4">Dose</th>
                  <th className="px-6 py-4">Data prevista</th>
                  <th className="px-6 py-4">Situação</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {listaAtrasos.map((dose, index) => {

                  return (
                    <tr
                      key={`${dose.pacienteId}-${dose.numero_dose}-${index}`}
                      className="va-priority-row transition-colors"
                    >

                      <td className="px-6 py-4">
                        <p className="text-xs font-semibold text-slate-800">
                          {dose.pacienteNome}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-lg bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">
                          {dose.numero_dose}ª dose
                        </span>
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(dose.data_prevista)}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-red-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          Atrasada
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                          <Link
                            href={`/admin/pacientes/${dose.pacienteId}#busca-ativa`}
                            aria-label={`Entrar em contato com ${dose.pacienteNome}`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-800"
                          >
                            <Phone size={13} />
                            Contato / histórico
                          </Link>
                      </td>

                    </tr>
                  )
                })}

              </tbody>

            </table>

            {dosesAtrasadas.length > 10 && (
              <div className="border-t border-slate-100 px-6 py-3">
                <p className="text-[11px] text-slate-500">
                  Exibindo os 10 atrasos mais antigos de {dosesAtrasadas.length} registros.
                </p>
              </div>
            )}

          </div>

        )}

      </section>

      <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600"><CalendarDays size={15}/> Período das próximas doses: {formatDate(hoje)} a {formatDate(limiteProximasDoses)}.</p>

      {/* RODAPÉ */}

      <div className="flex items-center justify-center gap-2 pb-2 text-[10px] text-slate-400">
        <ShieldCheck size={13} />
        {perfil.role === 'admin' ? 'Dados de todas as unidades, conforme autorização administrativa.' : 'Dados referentes à unidade vinculada ao seu perfil.'}
      </div>

    </div>
  )
}


export default function AdminDashboard() {
  return (
    <Suspense fallback={<PageLoading label="Carregando indicadores do painel…" />}>
      <DashboardConteudo />
    </Suspense>
  )
}
