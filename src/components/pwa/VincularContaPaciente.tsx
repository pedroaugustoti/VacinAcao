'use client'

import {useState,type FormEvent} from 'react'
import {useRouter} from 'next/navigation'
import {createClient} from '@/lib/supabase/client'

export default function VincularContaPaciente({pacienteId}:{pacienteId:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const router=useRouter()
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setMessage('')
  const form=new FormData(e.currentTarget),user=String(form.get('usuario')||'').trim()
  try{
   if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user))throw new Error('Informe o UUID da conta conferida no painel administrativo.')
   const s=createClient(),{data,error}=await s.rpc('va_vincular_conta_paciente_v1',{p_paciente_id:pacienteId,p_usuario_id:user,p_email_confirmado:String(form.get('email')||'').trim(),p_motivo:String(form.get('motivo')||'').trim(),p_identidade_conferida:form.get('confirmado')==='on'})
   if(error||data!==pacienteId)throw new Error('Vínculo não confirmado. Verifique a aprovação do recurso, a identidade, a conta sem perfil profissional e os vínculos existentes. Nenhum vínculo será substituído automaticamente.')
   const check=await s.from('pacientes').select('user_id').eq('id',pacienteId).single()
   if(check.error||check.data?.user_id!==user)throw new Error('Não foi possível conferir o vínculo. Atualize a ficha antes de repetir.')
   setMessage('Conta vinculada e conferida. O paciente pode entrar com a senha definida no provisionamento.');router.refresh()
  }catch(e){setMessage(e instanceof Error?e.message:'Falha de comunicação. Confira o vínculo antes de repetir.')}finally{setBusy(false)}
 }
 const input='mt-1 w-full rounded-xl border p-3 text-sm'
 return <details className="va-panel p-5"><summary className="font-semibold text-sky-900">Ativar acesso individual do paciente · administrador</summary><p className="mt-4 text-sm leading-relaxed text-slate-600">Primeiro confira a identidade pelo procedimento da instituição e provisione uma conta individual no painel de Authentication, mediante autorização. Este formulário apenas vincula a conta existente; não cria usuário, senha ou perfil profissional. CPF isolado não comprova titularidade.</p><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">UUID da conta conferida *<input name="usuario" required className={input} autoComplete="off" /></label><label className="text-sm">E-mail/alias exato da conta *<input name="email" required type="email" className={input} autoComplete="off" /></label><label className="text-sm sm:col-span-2">Justificativa da conferência institucional *<textarea name="motivo" required minLength={20} maxLength={500} rows={2} className={input} placeholder="Registre a conferência sem copiar documentos ou senhas." /></label><label className="flex items-start gap-2 text-sm sm:col-span-2"><input name="confirmado" type="checkbox" required /> Conferi a identidade e a titularidade da conta por procedimento institucional. Não usei somente o CPF.</label><button disabled={busy} className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?'Conferindo vínculo…':'Vincular conta conferida'}</button><p role="status" className="text-sm text-slate-700">{message}</p></form></details>
}
