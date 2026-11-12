import {Suspense} from 'react'
import {connection} from 'next/server'
import {redirect} from 'next/navigation'
import Link from 'next/link'
import {PhoneCall,Clock3,ArrowRight,Search,AlertTriangle,CheckCircle2,History} from 'lucide-react'
import {createClient} from '@/lib/supabase/server'
import {estadoRetorno,hojeBrasil,resultadosContato,type FilaBuscaAtiva} from '@/lib/busca-ativa'
import WhatsAppManual from '@/components/busca-ativa/WhatsAppManual'
import PageLoading from '@/components/ui/PageLoading'
import RefreshReadButton from '@/components/ui/RefreshReadButton'
type Params=Promise<{q?:string;pagina?:string}>
const date=(value:string)=>value.split('-').reverse().join('/')
const pageHref=(page:number,q:string)=>`/admin/busca-ativa?${new URLSearchParams({pagina:String(page),q})}`
async function Conteudo({searchParams}:{searchParams:Params}) {
 await connection()
 const params=await searchParams,q=(params.q||'').trim().slice(0,100),pagina=Math.min(100000,Math.max(1,Number(params.pagina)||1))|0
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)redirect('/login-ubs')
 const {data:perfil}=await supabase.from('perfis').select('role,unidade_id').eq('id',user.id).maybeSingle()
 if(!perfil||!['admin','ubs'].includes(perfil.role)||(perfil.role==='ubs'&&!perfil.unidade_id))redirect('/')
 const {data,error}=await supabase.rpc('va_listar_busca_ativa_v1',{p_busca:q||null,p_limite:20,p_offset:(pagina-1)*20})
 if(error)return <div role="alert" className="va-panel mx-auto max-w-2xl p-6 sm:p-8"><span className="inline-flex rounded-2xl bg-amber-50 p-3 text-amber-800"><AlertTriangle size={26} aria-hidden="true" /></span><h1 className="mt-5 text-xl font-semibold text-slate-900">Fila de busca ativa indisponível</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Não foi possível consultar a fila. Tente novamente em alguns instantes. Se o problema continuar, solicite à administração a verificação do acesso. Os indicadores serão exibidos quando a consulta estiver disponível.</p><div className="mt-6 flex flex-wrap gap-3"><RefreshReadButton /><Link href="/admin/pacientes" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-sky-900">Abrir pacientes <ArrowRight size={16}/></Link></div></div>
 const fila=(data||[]) as FilaBuscaAtiva[]
 if(!fila.length&&pagina>1)redirect(pageHref(1,q))
 const total=Number(fila[0]?.total_pacientes||0),hoje=hojeBrasil()
 const semContato=fila.filter(p=>!p.ultimo_contato).length
 const retornos=fila.filter(p=>['vencido','hoje'].includes(estadoRetorno(p.proximo_acompanhamento,hoje))).length
 return <div className="space-y-6">
  <header className="va-page-header flex flex-wrap items-end justify-between gap-4"><div><p className="va-eyebrow">Acompanhamento da equipe</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Busca ativa</h1><p className="mt-2 text-sm text-slate-600">Uma fila por paciente, começando pela dose mais antiga em atraso.</p></div><Link href="/admin/pacientes" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-sky-900 hover:bg-sky-50">Todos os pacientes</Link></header>
  <div className="grid gap-4 sm:grid-cols-3">{[
   {title:'Pacientes com atraso',value:total,caption:q?'Total correspondente à busca':'Total no seu escopo de acesso',icon:AlertTriangle},
   {title:'Sem tentativa registrada',value:semContato,caption:'Pacientes nesta página',icon:PhoneCall},
   {title:'Retornos de hoje ou vencidos',value:retornos,caption:'Pacientes nesta página',icon:Clock3},
  ].map((m,index)=><div key={m.title} data-tone={index===0?'red':undefined} className="va-metric p-5"><span className="inline-flex rounded-xl bg-sky-50 p-2.5 text-sky-800"><m.icon size={20}/></span><p className="mt-4 text-sm font-medium text-slate-600">{m.title}</p><p className="va-metric-value mt-2 text-slate-900">{m.value}</p><p className="mt-2 text-xs text-slate-600">{m.caption}</p></div>)}</div>
  <section className="va-panel overflow-hidden">
   <form className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-5" action="/admin/busca-ativa"><label className="min-w-0 flex-1 text-xs font-semibold text-slate-700">Buscar paciente por nome<div className="relative mt-1.5"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input name="q" maxLength={100} defaultValue={q} placeholder="Nome do paciente" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm font-normal"/></div></label><button className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">Buscar</button>{q&&<Link href="/admin/busca-ativa" className="px-2 py-3 text-xs font-semibold text-slate-600">Limpar</Link>}</form>
   {!fila.length?<div className="px-6 py-14 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={32}/><h2 className="mt-3 font-semibold text-slate-800">{pagina>1?'Não há registros nesta página':q?'Nenhum paciente encontrado':'Nenhum atraso elegível para busca ativa'}</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{pagina>1?'Volte à primeira página para consultar a fila atualizada.':'As doses aguardando conferência documental são tratadas na ficha. Não há inclusão automática de contatos.'}</p>{pagina>1&&<Link href={pageHref(1,q)} className="mt-4 inline-block text-sm font-semibold text-emerald-700">Primeira página</Link>}</div>:
   <div className="divide-y divide-slate-100">{fila.map(p=>{
    const retorno=estadoRetorno(p.proximo_acompanhamento,hoje),atencao=retorno==='vencido'||retorno==='hoje'
    return <article key={p.paciente_id} data-followup={atencao?'due':undefined} className="va-queue-item grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
     <div><Link href={`/admin/pacientes/${p.paciente_id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{p.nome}</Link><p className="mt-2 text-xs text-slate-500">{p.numero_dose}ª dose · prevista em {date(p.data_prevista)}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">{p.dias_atraso} dia(s) de atraso</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{p.doses_atrasadas} dose(s) em atraso</span></div></div>
     <div className="text-xs text-slate-600"><p className="flex items-center gap-1.5 font-semibold text-slate-700"><History size={14}/> Última tentativa</p><p className="mt-2">{p.ultimo_contato?`${new Date(p.ultimo_contato).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · ${p.ultimo_resultado?resultadosContato[p.ultimo_resultado]:''}`:'Nenhuma tentativa registrada'}</p>{p.responsavel_nome&&<p className="mt-1">Por {p.responsavel_nome}</p>}<p className={`mt-3 ${atencao?'font-semibold text-amber-800':'text-slate-500'}`}>{p.proximo_acompanhamento?`${retorno==='vencido'?'Retorno vencido':retorno==='hoje'?'Retorno hoje':'Próximo retorno'}: ${date(p.proximo_acompanhamento)}`:'Sem retorno agendado'}</p></div>
     <div className="space-y-3"><Link href={`/admin/pacientes/${p.paciente_id}#busca-ativa`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white">Registrar / histórico <ArrowRight size={14}/></Link><WhatsAppManual numero={p.whatsapp}/></div>
    </article>
   })}</div>}
   {fila.length>0&&<nav aria-label="Paginação da busca ativa" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-5 text-xs"><span className="text-slate-500">Página {pagina} · {total} paciente(s) na busca</span><div className="flex gap-3">{pagina>1&&<Link href={pageHref(pagina-1,q)} className="rounded-lg border px-3 py-2 font-semibold">Anterior</Link>}{pagina*20<total&&<Link href={pageHref(pagina+1,q)} className="rounded-lg border px-3 py-2 font-semibold">Próxima</Link>}</div></nav>}
  </section>
  <p className="text-xs leading-relaxed text-slate-500">Ambiente de demonstração. Alertas derivam dos atrasos e próximos acompanhamentos persistidos. WhatsApp e SMS são manuais; nenhum envio é automático.</p>
 </div>
}
export default function BuscaAtivaPage({searchParams}:{searchParams:Params}) {return <Suspense fallback={<PageLoading label="Carregando fila de busca ativa…" />}><Conteudo searchParams={searchParams}/></Suspense>}
