"use client"
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RpcArgs } from '@/lib/rpc-contracts'
import { useRouter } from 'next/navigation'

type Paciente = { id:string; nome:string; cpf:string; whatsapp:string; data_nascimento:string|null; data_acidente:string }
const digits=(v:string)=>v.replace(/\D/g,'')
export default function FormEditarPaciente({paciente}: {paciente:Paciente}) {
  const [nome,setNome]=useState(paciente.nome)
  const [cpf,setCpf]=useState(paciente.cpf)
  const [whatsapp,setWhatsapp]=useState(paciente.whatsapp)
  const [nascimento,setNascimento]=useState(paciente.data_nascimento||'')
  const [acidente,setAcidente]=useState(paciente.data_acidente)
  const [motivo,setMotivo]=useState('')
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const router=useRouter()
  async function salvar(e:FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if(saving)return
    setMessage('')
    if(!nome.trim()||digits(cpf).length!==11||digits(whatsapp).length<10||!acidente||motivo.trim().length<8){
      setMessage('Verifique os campos e descreva o motivo da correção (mínimo de 8 caracteres).');return
    }
    setSaving(true)
    try {
      const supabase=createClient()
      const {error}=await supabase.rpc('va_atualizar_paciente_v1',{
        p_paciente_id: paciente.id,
        p_nome:nome.trim(), p_cpf:digits(cpf),p_whatsapp:digits(whatsapp),
        p_data_nascimento:nascimento||null,p_data_acidente:acidente,p_motivo:motivo.trim()
      } satisfies RpcArgs<'va_atualizar_paciente_v1'>)
      if(error) throw new Error((error.code==='42883'||error.code==='PGRST202')?'Contrato de edição indisponível para esta sessão. Solicite a verificação da assinatura, permissões e cache da API no Supabase.':error.code==='23505'?'CPF já cadastrado.':'Não foi possível salvar. Verifique a autorização e os dados.')
      setMessage('Atualização confirmada pelo banco. Confira os dados atualizados.')
      setMotivo('')
      router.refresh()
    } catch(error) {setMessage(error instanceof Error?error.message:'Erro inesperado.')} finally {setSaving(false)}
  }
  return <form onSubmit={salvar} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <p role="status" aria-live="polite" className="text-sm text-slate-600">{message}</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">Nome completo<input required maxLength={200} className="mt-1 w-full rounded-lg border p-3" value={nome} onChange={e=>setNome(e.target.value)}/></label>
      <label className="text-sm font-medium text-slate-700">CPF<input required inputMode="numeric" className="mt-1 w-full rounded-lg border p-3" value={cpf} onChange={e=>setCpf(e.target.value)}/></label>
      <label className="text-sm font-medium text-slate-700">WhatsApp<input required inputMode="tel" className="mt-1 w-full rounded-lg border p-3" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)}/></label>
      <label className="text-sm font-medium text-slate-700">Nascimento<input type="date" className="mt-1 w-full rounded-lg border p-3" value={nascimento} onChange={e=>setNascimento(e.target.value)}/></label>
      <label className="text-sm font-medium text-slate-700">Data do acidente<input required type="date" className="mt-1 w-full rounded-lg border p-3" value={acidente} onChange={e=>setAcidente(e.target.value)}/></label>
    </div>
    <label className="block text-sm font-medium text-slate-700">Motivo da correção (obrigatório)<textarea required minLength={8} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border p-3" value={motivo} onChange={e=>setMotivo(e.target.value)} placeholder="Ex.: correção de telefone informado incorretamente"/></label>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Esta tela altera apenas dados cadastrais. O registro de doses e aplicações exige um fluxo próprio e auditado.</div>
    <button type="submit" disabled={saving} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving?'Salvando...':'Salvar correções'}</button>
  </form>
}
