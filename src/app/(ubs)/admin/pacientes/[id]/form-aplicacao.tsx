'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { exigirUuidRetornado, type RpcArgs } from '@/lib/rpc-contracts'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
type Dose = { id:string; numero_dose:number; data_prevista:string }
type Vacina = { id:string; nome:string; si_pni:string }
type Lote = { id:string; vacina_id:string; numero_lote:string; fabricante:string; validade:string; saldo:number|null }
export default function FormAplicacao({pacienteId,doses,vacinas,lotes,estoqueDisponivel}:{pacienteId:string;doses:Dose[];vacinas:Vacina[];lotes:Lote[];estoqueDisponivel:boolean}) {
 const router=useRouter()
 const [esquema,setEsquema]=useState('');const[vacina,setVacina]=useState('');const[lote,setLote]=useState('')
 const [data,setData]=useState('');const[hora,setHora]=useState('');const[via,setVia]=useState('');const[local,setLocal]=useState('')
 const [quantidade,setQuantidade]=useState('');const[medida,setMedida]=useState('mL');const[obs,setObs]=useState('')
 const [confirmado,setConfirmado]=useState(false);const[loading,setLoading]=useState(false);const[msg,setMsg]=useState('')
 const disponiveis=useMemo(()=>lotes.filter(l=>l.vacina_id===vacina),[lotes,vacina]);const hoje=(()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const d=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${d.year}-${d.month}-${d.day}`})()
 const podeEnviar=estoqueDisponivel && doses.length>0 && vacinas.length>0 && lotes.some(l=>(l.saldo??0)>0)
 async function salvar(e:FormEvent<HTMLFormElement>){e.preventDefault();setMsg('');if(loading)return
   if(!doses.some(d=>d.id===esquema)||!vacinas.some(v=>v.id===vacina)||!lote||!data||!hora||!via.trim()||!local.trim()||!Number.isFinite(Number(quantidade))||Number(quantidade)<=0||!medida.trim()||!confirmado){setMsg('Preencha todos os campos obrigatórios e confirme os dados.');return}
   const loteAtual=disponiveis.find(l=>l.id===lote);if(!estoqueDisponivel||!loteAtual||loteAtual.validade<data||(loteAtual.saldo??0)<1){setMsg('Lote inválido, vencido na data ou sem saldo disponível. Atualize a ficha.');return}
   const aplicadaEm=new Date(`${data}T${hora}:00-03:00`);if(Number.isNaN(aplicadaEm.getTime())||aplicadaEm.getTime()>Date.now()){setMsg('Informe data e horário válidos que não estejam no futuro.');return}
   setLoading(true)
   try {const supabase=createClient();const {data:retorno,error}=await supabase.rpc('va_registrar_aplicacao_v1',{p_paciente_id:pacienteId,p_esquema_id:esquema,p_vacina_id:vacina,p_lote_id:lote,p_aplicada_em:aplicadaEm.toISOString(),p_via:via.trim(),p_local:local.trim(),p_quantidade:Number(quantidade),p_unidade_medida:medida.trim(),p_observacoes:obs.trim()||null} satisfies RpcArgs<'va_registrar_aplicacao_v1'>);
     if(error){setMsg((error.code==='42883'||error.code==='PGRST202')?'Contrato de aplicação indisponível para esta sessão. Solicite a verificação da assinatura, permissões e cache da API no Supabase.':error.code==='23505'?'Conflito de registro. Atualize a ficha e confira se a dose já possui aplicação.':'Não foi possível registrar. Confira lote, permissões e dados.');return}
     const aplicacaoId=exigirUuidRetornado(retorno)
     const {data:registro,error:erroLeitura}=await supabase.from('aplicacoes_vacinais').select('id,esquema_id').eq('id',aplicacaoId).eq('paciente_id',pacienteId).maybeSingle()
     if(erroLeitura||!registro||registro.esquema_id!==esquema){setConfirmado(false);router.refresh();throw new Error('O banco retornou um identificador, mas não foi possível conferir a aplicação na leitura. Atualize a ficha e confira o histórico antes de repetir.')}
     setMsg(`Aplicação registrada. Identificador: ${aplicacaoId}. Confira o histórico atualizado.`);setConfirmado(false);setEsquema('');router.refresh()
   }catch(error){setConfirmado(false);setMsg(error instanceof Error?error.message:'Falha na comunicação. Confira o histórico antes de repetir a operação.')}finally{setLoading(false)}
 }
 return <form onSubmit={salvar} className="space-y-4"><p role="status" aria-live="polite" className="text-sm font-medium text-slate-700">{msg}</p>
 <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">Estoque DEMO: esta aplicação consome uma unidade de aplicação, independentemente do volume em mL. {!estoqueDisponivel?'Consulta de estoque indisponível; aguarda configuração aprovada.':'O banco verifica novamente o saldo ao confirmar.'} <a href="/admin/estoque" className="font-semibold underline">Abrir vacinas e estoque</a></p>
 {!podeEnviar&&<div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={18} className="shrink-0"/> Não há {doses.length===0?'doses pendentes disponíveis':vacinas.length===0?'vacinas ativas cadastradas':'lotes cadastrados para a UBS'}. O registro fica indisponível até a configuração do catálogo.</div>}
 <div className="grid gap-4 sm:grid-cols-2">
  <label className="text-xs font-semibold text-slate-700">Dose *<select required value={esquema} onChange={e=>setEsquema(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="">Selecione a dose</option>{doses.map(d=><option value={d.id} key={d.id}>{d.numero_dose}ª dose · prevista {d.data_prevista.split('-').reverse().join('/')}</option>)}</select></label>
  <label className="text-xs font-semibold text-slate-700">Vacina *<select required value={vacina} onChange={e=>{setVacina(e.target.value);setLote('')}} className="mt-1 w-full rounded-lg border p-3"><option value="">Selecione a vacina</option>{vacinas.map(v=><option key={v.id} value={v.id}>{v.nome} (SI-PNI: {v.si_pni})</option>)}</select></label>
  <label className="text-xs font-semibold text-slate-700">Lote *<select required value={lote} onChange={e=>setLote(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="">Selecione o lote</option>{disponiveis.map(l=><option disabled={!estoqueDisponivel||(l.saldo??0)<1} value={l.id} key={l.id}>{l.numero_lote} · validade {l.validade.split('-').reverse().join('/')} · saldo DEMO: {l.saldo??'indisponível'}</option>)}</select></label>
  <label className="text-xs font-semibold text-slate-700">Data da aplicação *<input required type="date" max={hoje} value={data} onChange={e=>setData(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
  <label className="text-xs font-semibold text-slate-700">Horário *<input required type="time" value={hora} onChange={e=>setHora(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
  <label className="text-xs font-semibold text-slate-700">Via de administração *<input required maxLength={80} value={via} onChange={e=>setVia(e.target.value)} placeholder="Conforme registro do profissional" className="mt-1 w-full rounded-lg border p-3"/></label>
  <label className="text-xs font-semibold text-slate-700">Local da aplicação *<input required maxLength={80} value={local} onChange={e=>setLocal(e.target.value)} placeholder="Ex.: braço esquerdo" className="mt-1 w-full rounded-lg border p-3"/></label>
  <label className="text-xs font-semibold text-slate-700">Quantidade *<input required type="number" min="0.001" step="0.001" value={quantidade} onChange={e=>setQuantidade(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
  <label className="text-xs font-semibold text-slate-700">Unidade *<input required maxLength={16} value={medida} onChange={e=>setMedida(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
 </div><label className="block text-xs font-semibold text-slate-700">Observações<textarea value={obs} onChange={e=>setObs(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-lg border p-3"/></label>
 <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)} className="mt-1"/> Confirmo os dados desta aplicação simulada no ambiente de demonstração.</label>
 <button disabled={!podeEnviar||loading||!confirmado} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" type="submit"><CheckCircle2 size={16}/>{loading?'Registrando...':'Confirmar aplicação'}</button>
 <p className="text-xs text-slate-600">Após o registro, a ativação do portal é opcional e independente. <a href="#acesso-portal" className="font-semibold text-sky-900 underline">Orientar acesso individual</a></p>
 </form>
}
