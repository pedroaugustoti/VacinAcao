import { Suspense } from 'react'
import { connection } from 'next/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Syringe, ArrowRight, ShieldCheck } from 'lucide-react'
async function Conteudo() {
 await connection()
 const supabase=await createClient()
 const {data:{user}}=await supabase.auth.getUser()
 if(!user)redirect('/login-ubs')
 const {data:perfil}=await supabase.from('perfis').select('role,unidade_id').eq('id',user.id).single()
 if(!perfil||!['admin','ubs'].includes(perfil.role)||(perfil.role==='ubs'&&!perfil.unidade_id))redirect('/')
 let query=supabase.from('pacientes').select('id,nome,data_nascimento').order('nome').limit(100)
 if(perfil.role==='ubs') query=query.eq('unidade_id',perfil.unidade_id!)
 const {data,error}=await query
 if(error)return <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">Não foi possível consultar os pacientes autorizados.</p>
 return <div className="space-y-6"><header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Imunização</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Aplicações vacinais</h1><p className="mt-2 text-sm text-slate-500">Selecione um paciente para abrir sua ficha e registrar uma dose documentada.</p></header>
 <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5 font-semibold">Pacientes disponíveis</div>
 {!data?.length?<p className="p-6 text-sm text-slate-500">Nenhum paciente encontrado para sua unidade.</p>:<div className="divide-y divide-slate-100">{data.map(p=><Link href={`/admin/pacientes/${p.id}`} key={p.id} className="flex items-center justify-between gap-3 px-5 py-4 text-sm transition-colors hover:bg-emerald-50"><span className="font-semibold text-slate-800">{p.nome}</span><span className="inline-flex items-center gap-2 text-emerald-700"><Syringe size={15}/> Abrir ficha <ArrowRight size={15}/></span></Link>)}</div>}
 </section><p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15}/> Acesso condicionado às permissões da conta. Exibindo até 100 pacientes; utilize Pacientes & Faltosos para busca e paginação.</p></div>
}
export default function AplicacoesPage(){return <Suspense fallback={<p className="rounded-xl bg-white p-7 text-sm text-slate-500">Carregando pacientes...</p>}><Conteudo/></Suspense>}
