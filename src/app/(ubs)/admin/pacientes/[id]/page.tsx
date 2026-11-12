import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PageLoading from '@/components/ui/PageLoading'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, AlertTriangle, ClipboardList, Pencil, Syringe, ShieldCheck } from 'lucide-react'
import FormAplicacao from './form-aplicacao'
import ContatoPaciente from '@/components/busca-ativa/ContatoPaciente'
import PortalAccess from '@/components/pwa/PortalAccess'
import WorkspaceTabs from '@/components/ui/WorkspaceTabs'

type Dose = { id: string; numero_dose: number; data_prevista: string; data_aplicacao: string | null; status: string; conferencia_documental_pendente: boolean | null }
type Vacina = { id: string; nome: string; si_pni: string; ativo: boolean }
type Lote = { id: string; vacina_id: string; numero_lote: string; fabricante: string; validade: string }
type Aplicacao = { id: string; esquema_id: string | null; aplicada_em: string; status: string; vacina_id: string; lote_id: string; profissional_id: string; via_administracao: string | null; local_aplicacao: string | null; motivo_cancelamento: string | null }
const formata = (data: string | null | undefined) => data ? data.split('-').reverse().join('/') : 'Não informada'

async function Conteudo({ id }: { id: string }) {
  await connection()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login-ubs')
  const { data: perfil, error: perfilErro } = await supabase.from('perfis').select('role, unidade_id').eq('id', user.id).single()
  if (perfilErro || !perfil || !['admin','ubs'].includes(perfil.role) || (perfil.role==='ubs' && !perfil.unidade_id)) redirect('/')
  const { data: paciente, error: pacienteErro } = await supabase.from('pacientes')
    .select('id,nome,cpf,whatsapp,data_nascimento,data_acidente,unidade_id')
    .eq('id', id).maybeSingle()
  if (pacienteErro) return <p role="alert">Erro ao buscar o paciente. Verifique a permissão da conta.</p>
  if (!paciente || (perfil.role === 'ubs' && paciente.unidade_id !== perfil.unidade_id)) notFound()

  const [resDoses, resVacinas, resLotes, resAplicacoes, resSaldo] = await Promise.all([
    supabase.from('esquemas_vacinais').select('id,numero_dose,data_prevista,data_aplicacao,status,conferencia_documental_pendente').eq('paciente_id',id).order('numero_dose'),
    supabase.from('vacinas').select('id,nome,si_pni,ativo').eq('ativo',true).order('nome'),
    supabase.from('lotes_vacinas').select('id,vacina_id,numero_lote,fabricante,validade').eq('unidade_id', paciente.unidade_id).order('validade'),
    supabase.from('aplicacoes_vacinais').select('id,esquema_id,aplicada_em,status,vacina_id,lote_id,profissional_id,via_administracao,local_aplicacao,motivo_cancelamento').eq('paciente_id',id).order('aplicada_em', {ascending:false}),
    supabase.from('va_estoque_saldos').select('lote_id,saldo').eq('unidade_id',paciente.unidade_id),
  ])
  if (resDoses.error || resVacinas.error || resLotes.error || resAplicacoes.error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">Não foi possível consultar todo o prontuário. Confira sua conexão e atualize a página. Se o problema continuar, solicite à administração a verificação do acesso.</div>
  const doses = (resDoses.data || []) as Dose[]
  const vacinas = (resVacinas.data || []) as Vacina[]
  const lotes = (resLotes.data || []) as Lote[]
  const aplicacoes = (resAplicacoes.data || []) as Aplicacao[]
  const validas = new Set(aplicacoes.filter(a=>a.status==='valida').map(a=>a.esquema_id))
  const pendentes = doses.filter(d=>!validas.has(d.id) && d.conferencia_documental_pendente !== true && ['pendente','atrasada'].includes(d.status))
  const legados = doses.filter(d=>d.conferencia_documental_pendente === true)
  return <div className="space-y-6">
    <Link href="/admin/pacientes" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><ArrowLeft size={15}/> Pacientes & Faltosos</Link>
    <header className="va-panel flex flex-wrap items-start justify-between gap-5 p-5 sm:p-7">
      <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Ficha do paciente</p><h1 className="mt-1 text-2xl font-bold text-slate-900">{paciente.nome}</h1><p className="mt-1 text-xs text-slate-500">Nascimento: {formata(paciente.data_nascimento)} · Acidente: {formata(paciente.data_acidente)}</p></div>
      <Link className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold" href={`/admin/pacientes/${id}/editar`}><Pencil size={15}/> Editar cadastro</Link>
    </header>
    <WorkspaceTabs label="Seções da ficha" items={[
      {id:'visao-geral',label:'Visão geral',content:<section className="va-panel p-5 sm:p-7"><h2 className="text-lg font-semibold">Atendimento e acompanhamento</h2><dl className="mt-5 grid gap-5 sm:grid-cols-3"><div><dt className="text-xs text-slate-500">Nascimento</dt><dd className="mt-1 text-sm font-semibold">{formata(paciente.data_nascimento)}</dd></div><div><dt className="text-xs text-slate-500">Acidente / exposição</dt><dd className="mt-1 text-sm font-semibold">{formata(paciente.data_acidente)}</dd></div><div><dt className="text-xs text-slate-500">Próxima dose elegível</dt><dd className="mt-1 text-sm font-semibold">{pendentes[0]?pendentes[0].numero_dose+'ª dose · '+formata(pendentes[0].data_prevista):'Nenhuma dose elegível para registro'}</dd></div></dl><div className="mt-6 flex flex-wrap gap-3"><a href="#vacinacao" className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Registrar aplicação</a><a href="#acesso-portal" className="rounded-xl border px-4 py-3 text-sm font-semibold text-sky-900">Acesso ao portal (opcional)</a></div><p className="mt-5 text-sm text-slate-600">Datas prescritas e registros permanecem nas seções específicas. A ativação de conta não condiciona o atendimento.</p></section>},
      {id:'vacinacao',label:'Vacinação',aliases:['calendario-doses','registro-aplicacao'],content:<div className="space-y-6">    {legados.length>0 && <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="shrink-0" size={18}/> {legados.length} dose(s) histórica(s) aplicada(s), com conferência documental pendente. Esses registros não serão sobrescritos pelo formulário.</div>}
    <section id="calendario-doses" className="va-panel va-section-anchor overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 p-5"><ClipboardList size={18} className="text-emerald-700"/><h2 className="font-semibold">Calendário de doses</h2></div>
      {doses.length === 0 ? <div className="va-empty m-5 text-sm">Nenhuma dose cadastrada no cronograma deste paciente.</div> : <div className="va-table-scroll" tabIndex={0} role="region" aria-label="Calendário de doses; deslize ou use as setas para consultar a tabela"><table className="w-full min-w-[630px] text-left text-sm"><caption className="sr-only">Datas previstas, datas registradas e situação documental das doses.</caption><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th scope="col" className="p-4">Dose</th><th scope="col" className="p-4">Prevista</th><th scope="col" className="p-4">Aplicada</th><th scope="col" className="p-4">Situação</th></tr></thead><tbody className="divide-y divide-slate-100">{doses.map(d=><tr key={d.id}><td className="p-4 font-semibold">{d.numero_dose}ª dose</td><td className="p-4">{formata(d.data_prevista)}</td><td className="p-4">{formata(d.data_aplicacao)}</td><td className="p-4">{d.conferencia_documental_pendente ? <span className="text-amber-700">Conferência documental pendente</span> : validas.has(d.id) ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">Aplicação documentada</span> : <span className="text-slate-600">{d.status==='aplicada'?'Aplicada sem confirmação documental':d.status}</span>}</td></tr>)}</tbody></table></div>}
    </section>
    <section id="registro-aplicacao" className="va-panel va-section-anchor p-5 sm:p-7">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><Syringe size={19} className="text-emerald-700"/> Registrar aplicação</h2>
      <p className="mb-5 text-sm text-slate-500">Selecione uma dose pendente. Não confirma aplicação sem identificação de vacina, lote e profissional.</p>
      <FormAplicacao pacienteId={id} doses={pendentes} vacinas={vacinas} lotes={lotes.map(l=>({...l,saldo:resSaldo.error?null:(resSaldo.data||[]).find(s=>s.lote_id===l.id)?.saldo??0}))} estoqueDisponivel={!resSaldo.error} />
    </section></div>},
      {id:'historico',label:'Histórico',content:    <section className="va-panel p-5 sm:p-7"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/> Histórico de aplicações</h2>
      {aplicacoes.length===0 ? <p className="va-empty mt-4 text-sm">Nenhuma aplicação documentada neste paciente. Os registros aparecerão aqui após a confirmação na ficha.</p> : <div className="mt-4 space-y-3">{aplicacoes.map(a=><div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{new Date(a.aplicada_em).toLocaleString('pt-BR',{timeZone:'America/Recife'})}</span><span className={a.status==='valida'?'text-emerald-700':'text-red-700'}>{a.status==='valida'?'Válida':'Cancelada'}</span></div><p className="mt-1 text-xs text-slate-600">Vacina: {vacinas.find(v=>v.id===a.vacina_id)?.nome || 'Identificador '+a.vacina_id.slice(0,8)} · Lote: {lotes.find(l=>l.id===a.lote_id)?.numero_lote || a.lote_id.slice(0,8)}</p>{a.motivo_cancelamento && <p className="mt-1 text-xs text-red-700">Motivo do cancelamento: {a.motivo_cancelamento}</p>}</div>)}</div>}
    </section>},
      {id:'busca-ativa',label:'Busca ativa',content:    <Suspense fallback={<div role="status" className="animate-pulse rounded-2xl bg-slate-100 p-8 text-sm text-slate-500">Carregando histórico de contatos…</div>}><ContatoPaciente pacienteId={id} whatsapp={paciente.whatsapp} doses={doses}/></Suspense>},
      {id:'acesso-portal',label:'Acesso ao portal',content:perfil.role==='admin'?<PortalAccess pacienteId={id} nome={paciente.nome}/>:<section className="va-panel p-6"><h2 className="font-semibold">Ativação assistida</h2><p className="mt-3 text-sm text-slate-600">Encaminhe a conferência de identidade ao administrador para ativar a conta individual. O paciente não recebe papel profissional. O atendimento clínico pode continuar normalmente.</p></section>},
    ]}/>
  </div>
}
export default async function FichaPaciente({params}:{params:Promise<{id:string}>}) {
  const {id}=await params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()
  return <Suspense fallback={<PageLoading label="Carregando ficha do paciente…" />}><Conteudo id={id}/></Suspense>
}
