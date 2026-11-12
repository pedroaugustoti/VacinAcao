import {createClient} from '@/lib/supabase/server'
import {canaisContato,resultadosContato,type Contato} from '@/lib/busca-ativa'
import {History,PhoneCall,FlaskConical} from 'lucide-react'
import WhatsAppManual from './WhatsAppManual'
import FormContato from './FormContato'
export default async function ContatoPaciente({pacienteId,whatsapp,doses}:{pacienteId:string;whatsapp:string|null;doses:{id:string;numero_dose:number;data_prevista:string}[]}){
 const supabase=await createClient()
 const {data,error,count}=await supabase.from('contatos_busca_ativa').select('id,paciente_id,esquema_id,responsavel_nome,canal,resultado,observacoes,realizado_em,proximo_acompanhamento,contexto',{count:'exact'}).eq('paciente_id',pacienteId).order('realizado_em',{ascending:false}).order('criado_em',{ascending:false}).order('id',{ascending:false}).limit(50)
 if(error)return <section id="busca-ativa" role="status" className="va-section-anchor rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Histórico de busca ativa indisponível</h2><p className="mt-2 text-sm leading-relaxed text-amber-900">Não foi possível consultar os contatos. Tente atualizar a página. Se o problema continuar, solicite à administração a verificação do acesso. O prontuário clínico permanece disponível acima.</p></section>
 const contatos=(data||[]) as Contato[]
 return <section id="busca-ativa" className="va-panel va-section-anchor space-y-6 p-5 sm:p-7">
  <header><h2 className="flex items-center gap-2 text-lg font-semibold"><PhoneCall size={20} className="text-emerald-700"/> Busca ativa e contatos</h2><p className="mt-1 text-sm text-slate-500">Registre cada tentativa e acompanhe os próximos retornos.</p></header>
  <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-sky-900"><FlaskConical size={17} className="shrink-0"/> Ambiente de desenvolvimento. Todos os registros desta seção são identificados como demonstração. O sistema não envia WhatsApp ou SMS.</div>
  <WhatsAppManual numero={whatsapp}/>
  <FormContato pacienteId={pacienteId} doses={doses}/>
  <div className="border-t border-slate-100 pt-5"><h3 className="flex items-center gap-2 font-semibold"><History size={17}/> Histórico de tentativas <span className="text-sm font-normal text-slate-500">({count??contatos.length})</span></h3>
   {!contatos.length?<p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Nenhuma tentativa registrada. Aberturas de links não aparecem como contatos.</p>:<ol className="mt-4 space-y-3">{contatos.map(c=><li key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-slate-800">{resultadosContato[c.resultado]} · {canaisContato[c.canal]}</span><time className="text-xs text-slate-500" dateTime={c.realizado_em}>{new Date(c.realizado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</time></div><p className="mt-1 text-xs text-slate-600">Responsável: {c.responsavel_nome} · Demonstração</p>{c.observacoes&&<p className="mt-2 whitespace-pre-wrap break-words text-slate-700">{c.observacoes}</p>}<p className="mt-2 text-xs text-emerald-800">{c.proximo_acompanhamento?`Próximo acompanhamento: ${c.proximo_acompanhamento.split('-').reverse().join('/')}`:'Sem próximo acompanhamento agendado'}</p></li>)}</ol>}
   {(count??0)>50&&<p className="mt-3 text-xs text-slate-500">Exibindo as 50 tentativas mais recentes de {count} registros.</p>}
  </div>
 </section>
}
