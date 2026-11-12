import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {hojeBrasil} from '@/lib/busca-ativa'

export default async function ListaDoses() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const access=await supabase.rpc('va_acesso_habilitado')
  if(!access.error&&access.data===false)return <p role="alert" className="va-empty">Acesso temporariamente bloqueado. Procure sua unidade; os registros são preservados.</p>

  const { data: paciente, error: pacienteError } = await supabase
    .from('pacientes').select('id').eq('user_id', user.id).maybeSingle()
  if (pacienteError) return <p role="alert" className="text-red-700">Não foi possível consultar seu cadastro.</p>
  if (!paciente) return <p className="text-slate-600">Seu cadastro ainda não foi vinculado à sua conta. Procure a UBS responsável.</p>

  const { data: doses, error } = await supabase.from('esquemas_vacinais')
    .select('id, numero_dose, data_prevista, data_aplicacao, status, conferencia_documental_pendente')
    .eq('paciente_id', paciente.id).order('numero_dose', { ascending: true })
  if (error) return <p role="alert" className="text-red-700">Não foi possível carregar as doses.</p>
  if (!doses?.length) return <div className="va-empty text-center"><p className="font-semibold text-slate-800">Nenhuma dose cadastrada</p><p className="mt-2 text-sm">Quando a UBS registrar seu cronograma, as datas aparecerão aqui.</p></div>

  const history=await supabase.from('aplicacoes_vacinais').select('id,aplicada_em,status,esquema_id').eq('paciente_id',paciente.id).order('aplicada_em',{ascending:false}).limit(50)
  return <div className="space-y-6"><ol aria-label="Linha do tempo das doses" className="space-y-3">{doses.map(dose => {
    const legado = dose.status === 'aplicada' && dose.conferencia_documental_pendente === true
    const atrasada = dose.status==='atrasada' || (dose.status==='pendente' && dose.data_prevista<hojeBrasil())
    const rotulo = legado ? 'Aplicada — conferência documental pendente' : dose.status === 'aplicada' ? 'Aplicação registrada no esquema' : atrasada ? 'Atrasada' : 'Pendente'
    return <li key={dose.id} data-tone={dose.status === 'aplicada' ? 'recorded' : atrasada ? 'overdue' : 'pending'} className="va-dose-card va-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">{dose.numero_dose}ª dose</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${legado ? 'bg-amber-100 text-amber-900' : dose.status === 'aplicada' ? 'bg-teal-100 text-teal-800' : atrasada ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{rotulo}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">Data prevista: {dose.data_prevista?.split('-').reverse().join('/') || 'Não informada'}</p>
      {dose.data_aplicacao && <p className="mt-1 text-sm text-slate-600">Data registrada: {dose.data_aplicacao.split('-').reverse().join('/')}</p>}
      {legado && <p className="mt-3 text-xs text-amber-800">Registro anterior à conferência documental. Consulte sua UBS para validar as informações.</p>}
    </li>
  })}</ol><section className="va-panel p-5"><h2 className="font-bold text-slate-900">Histórico de aplicações documentadas</h2>{history.error?<p role="status" className="mt-3 text-sm text-amber-900">Não foi possível consultar as aplicações. O calendário acima não substitui a conferência pela UBS.</p>:!history.data?.length?<p className="mt-3 text-sm text-slate-600">Nenhuma aplicação documentada disponível. Registros antigos do esquema podem aguardar conferência pela equipe.</p>:<ol className="mt-4 space-y-3">{history.data.map(a=><li key={a.id} className="rounded-xl border border-slate-200 p-3 text-sm"><time dateTime={a.aplicada_em}>{new Date(a.aplicada_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</time><p className="mt-1 font-semibold text-slate-700">{a.status==='valida'?'Aplicação válida registrada':'Registro cancelado'}</p></li>)}<li className="text-xs text-slate-500">Exibindo até as 50 aplicações mais recentes.</li></ol>}</section></div>
}
