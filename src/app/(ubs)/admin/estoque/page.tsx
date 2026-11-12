'use client'

import {useEffect,useState,useCallback,type FormEvent} from 'react'
import {createClient} from '@/lib/supabase/client'
import WorkspaceTabs from '@/components/ui/WorkspaceTabs'
import {PackagePlus,RefreshCw,Pencil} from 'lucide-react'

type Vaccine={id:string;nome:string;si_pni:string;ativo:boolean}
type Lot={id:string;vacina_id:string;unidade_id:string;numero_lote:string;fabricante:string;validade:string}
type Balance={lote_id:string;saldo:number}
type Movement={id:string;lote_id:string;delta:number;motivo:string;criado_em:string}
type Unit={id:string;nome:string}
const input='mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm'
export default function EstoquePage(){
 const [vaccines,setVaccines]=useState<Vaccine[]>([]),[lots,setLots]=useState<Lot[]>([]),[balances,setBalances]=useState<Balance[]>([]),[movements,setMovements]=useState<Movement[]>([]),[units,setUnits]=useState<Unit[]>([])
 const [role,setRole]=useState(''),[unit,setUnit]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[ready,setReady]=useState(false),[editing,setEditing]=useState<Vaccine|null>(null)
 const [attempt,setAttempt]=useState<string|null>(null)
 const load=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const s=createClient(),{data:{user}}=await s.auth.getUser()
   if(!user)throw new Error('Sessão indisponível. Entre novamente no portal da equipe.')
   const {data:p,error:pe}=await s.from('perfis').select('role,unidade_id').eq('id',user.id).single()
   if(pe||!p||!['admin','ubs'].includes(p.role))throw new Error('Perfil profissional indisponível.')
   setRole(p.role);setUnit(p.unidade_id||'')
   const [v,l,b,m,u]=await Promise.all([s.from('vacinas').select('id,nome,si_pni,ativo').order('nome'),s.from('lotes_vacinas').select('id,vacina_id,unidade_id,numero_lote,fabricante,validade').order('validade'),s.from('va_estoque_saldos').select('lote_id,saldo'),s.from('va_estoque_movimentos').select('id,lote_id,delta,motivo,criado_em').order('criado_em',{ascending:false}).limit(50),s.from('unidades_saude').select('id,nome').order('nome')])
   if(v.error||l.error||u.error)throw new Error('Não foi possível consultar catálogo, lotes ou unidades. Confira o acesso e tente novamente.')
   setVaccines(v.data||[]);setLots(l.data||[]);setUnits(u.data||[]);setBalances(b.data||[]);setMovements(m.data||[]);setReady(!b.error&&!m.error)
  }catch(e){setReady(false);setError(e instanceof Error?e.message:'Consulta indisponível.')}finally{setLoading(false)}
 },[])
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[load])
 async function submit(e:FormEvent<HTMLFormElement>,kind:'vacina'|'lote'|'movimento'){
  e.preventDefault();if(busy)return;setBusy(true);setMessage('')
  const form=e.currentTarget,f=new FormData(form),s=createClient(),get=(n:string)=>String(f.get(n)||'').trim()
  try{
   let result
   if(kind==='vacina')result=await s.rpc('va_salvar_vacina_v1',{p_id:editing?.id||null,p_nome:get('nome'),p_si_pni:get('codigo'),p_ativo:f.get('ativo')==='on'})
   else if(kind==='lote')result=await s.rpc('va_cadastrar_lote_v1',{p_vacina_id:get('vacina'),p_unidade_id:role==='ubs'?unit:get('unidade'),p_numero:get('numero'),p_fabricante:get('fabricante'),p_validade:get('validade')})
   else{
    const delta=Number(get('quantidade'))*(get('tipo')==='saida'?-1:1)
    if(!Number.isSafeInteger(delta)||delta===0)throw new Error('Informe uma quantidade inteira positiva.')
    const key=attempt||crypto.randomUUID();setAttempt(key)
    result=await s.rpc('va_movimentar_estoque_v1',{p_lote_id:get('lote'),p_delta:delta,p_motivo:get('motivo'),p_chave:key})
   }
   if(result.error)throw new Error(result.error.code==='23505'?'Registro duplicado. Confira o catálogo ou lote existente.':result.error.code==='22023'?'Dados inválidos, validade vencida, saldo insuficiente ou chave reutilizada. Confira o histórico antes de repetir.':'Registro não confirmado. Confira permissões e a aprovação/aplicação do SQL 019 antes de repetir.')
   if(typeof result.data!=='string'||!/^[0-9a-f-]{36}$/i.test(result.data))throw new Error('Retorno inesperado. Confira a listagem antes de repetir.')
   form.reset();setEditing(null);setAttempt(null);setMessage('Registro confirmado pelo banco. Listagem atualizada abaixo.');await load()
  }catch(e){setMessage(e instanceof Error?e.message:'Falha de comunicação. Confira o histórico antes de repetir.')}finally{setBusy(false)}
 }
 return <div className="space-y-6">
  <header className="va-page-header flex flex-wrap items-end justify-between gap-4"><div><p className="va-eyebrow">Catálogo e suprimentos</p><h1 className="mt-2 text-3xl font-bold">Vacinas e estoque</h1><p className="mt-2 text-sm text-slate-600">Controle DEMO em unidades de aplicação, separado do volume clínico em mL.</p></div><button type="button" onClick={()=>void load()} disabled={loading||busy} className="flex items-center gap-2 rounded-xl border bg-white p-3 text-sm"><RefreshCw size={16}/> Atualizar</button></header>
  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">Demonstração com dados fictícios. Cada aplicação consome uma unidade de estoque. Este saldo não representa inventário real nem controle de frascos multidose.</div>
  {loading&&<p role="status" className="va-skeleton rounded-xl p-5">Consultando catálogo e estoque…</p>}
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
  {!loading&&!ready&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Módulo de estoque indisponível. Aguarda verificação do acesso e aplicação aprovada da proposta 019. Saldos não foram inferidos como zero.</p>}
  {message&&<p role="status" className="rounded-xl border border-sky-200 bg-white p-4 text-sm">{message}</p>}
  <WorkspaceTabs label="Seções do estoque" items={[
   {id:'vacinas',label:'Vacinas',content:<div className="space-y-6">{role==='admin'&&<section className="va-panel p-5"><h2 className="mb-4 flex gap-2 font-semibold"><PackagePlus size={20}/>{editing?'Editar vacina':'Cadastrar vacina'}</h2><form key={editing?.id||'novo'} onSubmit={e=>void submit(e,'vacina')} className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Nome *<input name="nome" required maxLength={200} defaultValue={editing?.nome} className={input}/></label><label className="text-sm">Código SI-PNI / código DEMO *<input name="codigo" required maxLength={80} defaultValue={editing?.si_pni} className={input}/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={editing?.ativo??true}/> Ativa para aplicação</label><div className="flex gap-3"><button disabled={busy||!ready} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Salvar vacina</button>{editing&&<button type="button" onClick={()=>setEditing(null)} className="rounded-xl border px-4">Cancelar edição</button>}</div></form></section>}<section className="va-panel p-5"><h2 className="font-semibold">Catálogo de vacinas</h2>{!vaccines.length?<p className="va-empty mt-4">Nenhuma vacina disponível no catálogo consultado.</p>:<ul className="mt-4 divide-y divide-slate-100">{vaccines.map(v=><li key={v.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="font-semibold">{v.nome}</p><p className="mt-1 text-sm text-slate-600">{v.si_pni} · {v.ativo?'Ativa':'Inativa'}</p></div>{role==='admin'&&<button type="button" onClick={()=>setEditing(v)} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><Pencil size={15}/> Editar / ativar</button>}</li>)}</ul>}</section></div>},
   {id:'lotes',label:'Lotes',content:<div className="space-y-6"><section className="va-panel p-5"><h2 className="mb-4 font-semibold">Cadastrar lote DEMO</h2><form onSubmit={e=>void submit(e,'lote')} className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Vacina ativa *<select name="vacina" required className={input}><option value="">Selecione</option>{vaccines.filter(v=>v.ativo).map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}</select></label><label className="text-sm">Unidade *<select name="unidade" required value={role==='ubs'?unit:undefined} disabled={role==='ubs'} className={input}><option value="">Selecione</option>{units.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}</select></label><label className="text-sm">Número do lote *<input name="numero" required maxLength={100} className={input}/></label><label className="text-sm">Fabricante *<input name="fabricante" required maxLength={200} className={input}/></label><label className="text-sm">Validade *<input name="validade" required type="date" className={input}/></label><button disabled={busy||!ready} className="self-end rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">Cadastrar lote</button></form></section><section className="va-panel overflow-hidden p-5"><h2 className="font-semibold">Lotes e saldo DEMO</h2><p className="mt-2 text-sm text-slate-600">Unidades de aplicação. A validade é conferida novamente no registro clínico.</p><div className="va-table-scroll mt-4" tabIndex={0} role="region" aria-label="Lotes e saldos"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr>{['Lote / vacina','Unidade','Fabricante','Validade','Saldo DEMO'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{lots.map(l=><tr key={l.id} className="border-b border-slate-100"><td className="p-3">{l.numero_lote}<p className="text-xs text-slate-600">{vaccines.find(v=>v.id===l.vacina_id)?.nome}</p></td><td className="p-3">{units.find(u=>u.id===l.unidade_id)?.nome||'Unidade vinculada'}</td><td className="p-3">{l.fabricante}</td><td className="p-3">{l.validade.split('-').reverse().join('/')}</td><td className="p-3 font-semibold">{ready?balances.find(b=>b.lote_id===l.id)?.saldo??'Sem entrada registrada':'Indisponível'}</td></tr>)}</tbody></table></div>{!lots.length&&<p className="va-empty mt-3">Nenhum lote disponível para seu perfil.</p>}</section></div>},
   {id:'movimentacoes',label:'Movimentações',content:<div className="space-y-6"><section className="va-panel p-5"><h2 className="mb-2 font-semibold">Registrar entrada ou saída manual DEMO</h2><p className="mb-4 text-sm text-slate-600">Aplicações têm baixa automática na mesma transação. Não registre uma segunda saída para a mesma aplicação. Cancelamento clínico não repõe estoque automaticamente.</p><form onSubmit={e=>void submit(e,'movimento')} onChange={()=>setAttempt(null)} className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Lote *<select name="lote" required className={input}><option value="">Selecione</option>{lots.map(l=><option key={l.id} value={l.id}>{l.numero_lote}</option>)}</select></label><label className="text-sm">Tipo *<select name="tipo" className={input}><option value="entrada">Entrada</option><option value="saida">Saída / perda</option></select></label><label className="text-sm">Unidades de aplicação *<input name="quantidade" type="number" required min={1} max={1000000} step={1} className={input}/></label><label className="text-sm">Motivo DEMO *<input name="motivo" required minLength={8} maxLength={500} className={input}/></label><button disabled={busy||!ready} className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">Registrar movimento</button></form></section><section className="va-panel p-5"><h2 className="font-semibold">Últimos 50 movimentos persistidos</h2>{!ready?<p className="mt-3 text-sm">Histórico indisponível.</p>:!movements.length?<p className="va-empty mt-3">Nenhuma movimentação DEMO registrada.</p>:<ol className="mt-3 divide-y divide-slate-100">{movements.map(m=><li key={m.id} className="py-3 text-sm"><strong>{m.delta>0?'+':''}{m.delta} unidade(s)</strong> · {lots.find(l=>l.id===m.lote_id)?.numero_lote}<p className="mt-1">{m.motivo}</p><time className="text-xs text-slate-600">{new Date(m.criado_em).toLocaleString('pt-BR')}</time></li>)}</ol>}</section></div>},
  ]}/>
 </div>
}
