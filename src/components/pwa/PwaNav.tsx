'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {Home,Syringe,User} from 'lucide-react'
const items=[{href:'/',label:'Início',icon:Home},{href:'/doses',label:'Doses',icon:Syringe},{href:'/perfil',label:'Perfil',icon:User}]
export default function PwaNav(){
 const path=usePathname()
 if(path==='/login')return null
 return <nav aria-label="Navegação do paciente" className="va-patient-nav fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-md justify-around border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(15,23,42,.04)] backdrop-blur-md">{items.map(item=>{
  const active=path===item.href,Icon=item.icon
  return <Link key={item.href} href={item.href} aria-current={active?'page':undefined} className={`flex min-h-11 min-w-16 flex-col items-center gap-1 rounded-xl px-4 py-1 text-[11px] font-semibold transition-colors ${active?'bg-blue-50 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><Icon size={21} strokeWidth={active?2.5:1.8}/>{item.label}</Link>
 })}</nav>
}
