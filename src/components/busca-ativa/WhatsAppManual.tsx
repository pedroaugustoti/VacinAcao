'use client'
import {useState} from 'react'
import {MessageCircle,ExternalLink} from 'lucide-react'
import {linkWhatsApp} from '@/lib/busca-ativa'
export default function WhatsAppManual({numero}:{numero:string|null}) {
 const [confirmado,setConfirmado]=useState(false)
 const link=linkWhatsApp(numero)
 if(!link)return <span className="text-xs text-slate-500">Sem número válido para WhatsApp</span>
 return <details className="max-w-sm rounded-xl border border-slate-200 bg-white p-3 text-xs">
  <summary className="flex cursor-pointer items-center gap-2 font-semibold text-emerald-800"><MessageCircle size={15}/> Preparar WhatsApp manual</summary>
  <p className="mt-3 leading-relaxed text-slate-600">Mensagem: Olá! Somos da sua unidade de saúde. Gostaríamos de conversar sobre seu acompanhamento. Entre em contato com a unidade para orientações.</p>
  <label className="mt-3 flex gap-2 leading-relaxed"><input type="checkbox" checked={confirmado} onChange={e=>setConfirmado(e.target.checked)}/> Conferi o número {numero}. Entendo que abrir a conversa não envia nem registra um contato.</label>
  {confirmado&&<a href={link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white">Abrir conversa <ExternalLink size={13}/></a>}
  <p className="mt-2 text-slate-500">Registre o resultado manualmente após a tentativa. Durante o ensaio, não envie mensagens.</p>
 </details>
}
