'use client'
import {useRef,useState,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {CheckCircle2,Loader2} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {canaisContato,resultadosContato} from '@/lib/busca-ativa'
import {exigirUuidRetornado,type RpcArgs} from '@/lib/rpc-contracts'
type Dose={id:string;numero_dose:number;data_prevista:string}
export default function FormContato({pacienteId,doses}:{pacienteId:string;doses:Dose[]}) {
 const router=useRouter(),attempt=useRef<{key:string;payload:string}|null>(null)
 const [canal,setCanal]=useState('telefone'),[resultado,setResultado]=useState('sem_resposta'),[esquema,setEsquema]=useState(''),[observacoes,setObservacoes]=useState(''),[realizado,setRealizado]=useState(''),[proximo,setProximo]=useState('')
 const [confirmado,setConfirmado]=useState(false),[loading,setLoading]=useState(false),[mensagem,setMensagem]=useState(''),[sucesso,setSucesso]=useState(false)
 async function salvar(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(loading)return;setMensagem('');setSucesso(false)
  const date=new Date(`${realizado}:00-03:00`)
  if(!confirmado||!realizado||!Number.isFinite(date.getTime())||date.getTime()>Date.now()||(proximo&&proximo<realizado.slice(0,10))||(resultado==='retorno_agendado'&&!proximo)){
   setMensagem('Confira data, horário, próximo acompanhamento e confirmação de demonstração. Não registre uma tentativa futura.');return
  }
  const payload={p_paciente_id:pacienteId,p_esquema_id:esquema||null,p_canal:canal,p_resultado:resultado,p_observacoes:observacoes.trim()||null,p_realizado_em:date.toISOString(),p_proximo_acompanhamento:proximo||null}
  const serialized=JSON.stringify(payload)
  if(attempt.current&&attempt.current.payload!==serialized){setMensagem('Confira o histórico antes de alterar uma tentativa sem confirmação. Use “Nova tentativa” para iniciar outro registro.');return}
  attempt.current??={key:crypto.randomUUID(),payload:serialized}
  setLoading(true)
  try{
   const supabase=createClient()
   const {data,error}=await supabase.rpc('va_registrar_contato_v1',{...payload,p_chave_idempotencia:attempt.current.key} satisfies RpcArgs<'va_registrar_contato_v1'>)
   if(error)throw new Error(error.code==='PGRST202'?'Registro ainda não habilitado no banco. Confira a implantação da busca ativa.':error.code==='42501'?'Sua conta não está autorizada a registrar contato deste paciente.':'Não foi possível confirmar o registro. Confira o histórico antes de repetir.')
   const id=exigirUuidRetornado(data)
   const result=await supabase.from('contatos_busca_ativa').select('id').eq('id',id).eq('paciente_id',pacienteId).maybeSingle()
   if(result.error||!result.data)throw new Error('O banco respondeu, mas a leitura do contato não foi confirmada. Atualize o histórico antes de repetir.')
   setSucesso(true);setMensagem('Tentativa de demonstração registrada no histórico. Nenhuma mensagem foi enviada pelo sistema.')
   attempt.current=null;setObservacoes('');setRealizado('');setProximo('');setConfirmado(false);router.refresh()
  }catch(error){setMensagem(error instanceof Error?error.message:'Falha de comunicação; confira o histórico antes de repetir.')}finally{setLoading(false)}
 }
 const input='mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal text-slate-800'
 return <form onSubmit={salvar} className="space-y-4">
  <div aria-live="polite" role="status" className={sucesso?'rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800':'text-sm text-red-700'}>{mensagem}</div>
  <div className="grid gap-4 sm:grid-cols-2">
   <label className="text-xs font-semibold text-slate-700">Canal<select value={canal} onChange={e=>setCanal(e.target.value)} className={input}>{Object.entries(canaisContato).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label className="text-xs font-semibold text-slate-700">Resultado<select value={resultado} onChange={e=>setResultado(e.target.value)} className={input}>{Object.entries(resultadosContato).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label className="text-xs font-semibold text-slate-700">Data e horário da tentativa *<input type="datetime-local" required value={realizado} onChange={e=>setRealizado(e.target.value)} className={input}/></label>
   <label className="text-xs font-semibold text-slate-700">Próximo acompanhamento{resultado==='retorno_agendado'?' *':''}<input type="date" required={resultado==='retorno_agendado'} min={realizado.slice(0,10)||undefined} value={proximo} onChange={e=>setProximo(e.target.value)} className={input}/></label>
   <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Dose relacionada (opcional)<select value={esquema} onChange={e=>setEsquema(e.target.value)} className={input}><option value="">Acompanhamento geral do paciente</option>{doses.map(d=><option key={d.id} value={d.id}>{d.numero_dose}ª dose · {d.data_prevista.split('-').reverse().join('/')}</option>)}</select></label>
  </div>
  <label className="block text-xs font-semibold text-slate-700">Observações<textarea maxLength={1000} rows={3} value={observacoes} onChange={e=>setObservacoes(e.target.value)} placeholder="Registre o resultado da tentativa. Não inclua credenciais ou dados desnecessários." className={input}/></label>
  <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" required checked={confirmado} onChange={e=>setConfirmado(e.target.checked)} className="mt-1"/> Confirmo que esta é uma tentativa simulada no ambiente de demonstração. Abrir um link não comprova envio ou contato realizado.</label>
  <div className="flex flex-wrap gap-3"><button type="submit" disabled={loading||!confirmado} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{loading?<Loader2 size={16} className="animate-spin"/>:<CheckCircle2 size={16}/>} {loading?'Registrando…':'Registrar tentativa de demonstração'}</button>
   <button type="button" disabled={loading} onClick={()=>{attempt.current=null;setMensagem('Nova tentativa iniciada. Confira o histórico antes de registrar novamente.');setConfirmado(false)}} className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600">Nova tentativa</button></div>
 </form>
}
