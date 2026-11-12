'use client'
import Link from 'next/link'
import {AlertTriangle,RefreshCw} from 'lucide-react'
export default function AdminError({retry}:{retry:()=>void}){
 return <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm"><AlertTriangle size={28} className="text-red-600"/><h1 className="mt-4 text-xl font-semibold text-slate-900">Não foi possível carregar esta página</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">Confira a conexão e tente novamente. Se o erro ocorreu durante um registro, consulte a ficha e o histórico antes de repetir a operação.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={retry} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white"><RefreshCw size={16}/> Tentar novamente</button><Link href="/admin" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold">Voltar ao painel</Link></div></div>
}
