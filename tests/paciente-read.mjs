// SOMENTE LEITURA. Conta DEMO já criada/vinculada manualmente; sem signup/admin/reset.
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {validateBase} from './helpers/homolog-config.mjs'
const env=process.env,required=['HOMOLOG_PACIENTE_EMAIL','HOMOLOG_PACIENTE_PASSWORD','HOMOLOG_PACIENTE_ID','HOMOLOG_OUTRO_PACIENTE_ID']
if(required.some(k=>!env[k]?.trim())){
 console.log(JSON.stringify({status:'pendente',motivo:'Configurar conta DEMO, vínculo próprio e UUID de outra fixture sintética em .env.homolog.local. Nenhum login realizado.',aprovados:0}))
}else{
 try{
  const {url,key}=validateBase(env),own=env.HOMOLOG_PACIENTE_ID,other=env.HOMOLOG_OUTRO_PACIENTE_ID
  assert.notEqual(own,other)
  const s=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const auth=await s.auth.signInWithPassword({email:env.HOMOLOG_PACIENTE_EMAIL.trim(),password:env.HOMOLOG_PACIENTE_PASSWORD})
  assert.ok(!auth.error&&auth.data.user)
  const verified=await s.auth.getUser();assert.ok(!verified.error&&verified.data.user?.id===auth.data.user.id)
  const profile=await s.from('perfis').select('role').eq('id',verified.data.user.id).maybeSingle()
  assert.ok(!profile.error&&!profile.data,'Paciente não deve possuir perfil profissional')
  const self=await s.from('pacientes').select('id,user_id,unidade_id,unidades_saude(nome)').eq('id',own).single()
  assert.ok(!self.error&&self.data?.user_id===verified.data.user.id)
  const unit=Array.isArray(self.data.unidades_saude)?self.data.unidades_saude[0]:self.data.unidades_saude
  assert.ok(unit?.nome,'A própria unidade deve ser legível para orientar retorno')
  const all=await s.from('pacientes').select('id');assert.ok(!all.error);assert.deepEqual(all.data.map(p=>p.id),[own])
  const doses=await s.from('esquemas_vacinais').select('id,paciente_id');assert.ok(!doses.error&&doses.data.length>0&&doses.data.every(d=>d.paciente_id===own))
  for(const [table,column] of [['pacientes','id'],['esquemas_vacinais','paciente_id'],['aplicacoes_vacinais','paciente_id'],['historico_pacientes','paciente_id'],['contatos_busca_ativa','paciente_id']]){
   const r=await s.from(table).select('id').eq(column,other)
   assert.ok(r.status===403||(!r.error&&Array.isArray(r.data)&&r.data.length===0),'Leitura de outra fixture deve ser rejeitada/vazia, não erro de schema')
  }
  for(const table of ['historico_pacientes','contatos_busca_ativa']){
   const r=await s.from(table).select('id').eq('paciente_id',own);assert.ok(r.status===403||(!r.error&&r.data?.length===0),'Notas internas não são leitura do paciente')
  }
  console.log(JSON.stringify({status:'aprovado',escopo:'Login, vínculo próprio, leitura direta de cadastro/doses e isolamento de outra fixture/notas internas',escritas:0,credenciaisExibidas:false}))
 }catch{
  console.error('Validação do paciente falhou. Conferir configuração, vínculo, RLS e fixtures; detalhes de sessão não exibidos.');process.exitCode=1
 }
}
