'use server'

import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {adminContext,authAdmin,emailAuth,writeAllowed,configured} from '@/lib/management-server'
import {validateProvision,assertManageTarget,accountState,type ProvisionInput} from '@/lib/management-policy'

type Operation={id:string;autor_id:string;tipo:string;email:string;nome:string;funcao:string|null;unidade_id:string|null;paciente_id:string|null;usuario_id:string|null;fingerprint:string;estado:string}
type TeamRow={id:string;nome:string;role:string;unidade_id:string|null;email:string;funcao:string;status:string}
const message=(e:unknown)=>e instanceof Error?e.message:'Operação não confirmada. Consulte o estado antes de repetir.'
export async function listarGestao(filters:{busca?:string;unidade?:string;status?:string;pagina?:number}={}){
 try{
  const c=await adminContext(),[p,u,o]=await Promise.all([c.session.from('perfis').select('id,nome,role,unidade_id').order('nome').limit(100),c.session.from('unidades_saude').select('id,nome,cidade,telefone').order('nome').limit(100),c.session.from('va_gestao_operacoes').select('id,tipo,email,nome,funcao,unidade_id,usuario_id,estado').order('criado_em',{ascending:false}).limit(100)])
  if(p.error||u.error)throw new Error('Não foi possível consultar equipe/unidades.')
  const listed=c.schemaReady?await c.session.rpc('va_gestao_listar_equipe',{p_busca:filters.busca||null,p_unidade:filters.unidade||null,p_status:filters.status||null,p_pagina:filters.pagina||1}):null
  if(listed?.error)throw new Error('Não foi possível consultar a equipe com esses filtros.')
  const rows:TeamRow[]=listed?.data?.rows||(p.data||[]).map(x=>({...x,email:'',funcao:'',status:'não verificado'}))
  return {ok:true as const,rows,total:Number(listed?.data?.total??rows.length),units:u.data||[],operations:o.error?[]:o.data||[],ready:c.schemaReady&&configured()&&process.env.VACINACAO_GESTAO_ESCRITA==='autorizada',unitReady:c.schemaReady&&process.env.VACINACAO_GESTAO_ESCRITA==='autorizada',schemaReady:c.schemaReady,actor:c.actor,emailEnabled:process.env.VACINACAO_EMAIL_AUTORIZADO==='sim',error:''}
 }catch(e){return {ok:false as const,error:message(e)}}
}
export async function provisionarConta(input:ProvisionInput){
 let operationId:string|null=null
 try{
  const c=await adminContext();writeAllowed(c.schemaReady)
  if(process.env.VACINACAO_PROVISIONAMENTO_REVISADO!=='sim')throw new Error('Provisionamento bloqueado até revisão de triggers, Auth Hooks e notificações pelo responsável.')
  const x=validateProvision(input),a=authAdmin(),fingerprint=createHash('sha256').update(JSON.stringify(x)).digest('hex')
  if(x.tipo==='paciente'){
   const p=await c.session.from('pacientes').select('user_id').eq('id',x.paciente_id).single()
   if(p.error)throw new Error('Ficha indisponível.')
   if(p.data.user_id){const old=await c.session.from('va_gestao_operacoes').select('usuario_id,email').eq('paciente_id',x.paciente_id).maybeSingle();if(old.error||old.data?.usuario_id!==p.data.user_id||old.data?.email!==x.email)throw new Error('Ficha já vinculada. Use a recuperação da conta existente.')}
  }else{
   const unit=await c.session.from('unidades_saude').select('id').eq('id',x.unidade_id).single();if(unit.error)throw new Error('Unidade inválida.')
  }
  let find=await a.from('va_gestao_operacoes').select('*').eq('email',x.email).maybeSingle()
  if(find.error)throw new Error('Registro de provisionamento indisponível. Conferir migração 028.')
  if(!find.data){
   const inserted=await a.from('va_gestao_operacoes').insert({id:randomUUID(),autor_id:c.actor,tipo:x.tipo,email:x.email,nome:x.nome,funcao:x.tipo==='equipe'?x.funcao:null,unidade_id:x.tipo==='equipe'?x.unidade_id:null,paciente_id:x.tipo==='paciente'?x.paciente_id:null,fingerprint}).select('*').single()
   if(inserted.error){find=await a.from('va_gestao_operacoes').select('*').eq('email',x.email).maybeSingle()}else find={...find,data:inserted.data}
  }
  const op=find.data as Operation|null
  if(!op||op.autor_id!==c.actor||op.fingerprint!==fingerprint)throw new Error('Há uma operação anterior com dados diferentes. Não será sobrescrita; revisar com o responsável original.')
  operationId=op.id
  if(op.estado==='concluido')return {ok:true,message:'Provisionamento já concluído. Consulte o estado de acesso.'}
  let uid=op.usuario_id
  if(!uid){const recover=await c.session.rpc('va_gestao_auth_uuid',{p_operacao:op.id});if(recover.error)throw new Error('Não foi possível conferir operação pendente.');uid=recover.data}
  if(!uid){
   const created=await a.auth.admin.createUser({email:x.email,password:randomBytes(36).toString('base64url'),email_confirm:true,ban_duration:'876000h',app_metadata:{va_operation_id:op.id},user_metadata:{full_name:x.nome}})
   if(created.error||!created.data.user){
    const recovery=await c.session.rpc('va_gestao_auth_uuid',{p_operacao:op.id});uid=recovery.data
    if(!uid)throw new Error('Conta não criada/confirmada. E-mail pode já existir ou Auth estar indisponível. Não alteramos contas existentes; consulte a operação antes de repetir.')
   }else uid=created.data.user.id
  }
  const owned=await a.auth.admin.getUserById(uid!)
  if(owned.error||owned.data.user?.app_metadata.va_operation_id!==op.id||owned.data.user.email?.toLowerCase()!==op.email.toLowerCase())throw new Error('Identidade da operação divergente; interrompido.')
  const quarantine=await a.auth.admin.updateUserById(uid!,{ban_duration:'876000h'})
  if(quarantine.error)throw new Error('Não foi possível confirmar quarentena da conta nova; operação suspensa.')
  const saved=await a.from('va_gestao_operacoes').update({usuario_id:uid,estado:'auth_criado'}).eq('id',op.id)
  if(saved.error)throw new Error('Conta criada; estado pendente recuperável pela operação. Não criar outra conta.')
  if(x.tipo==='equipe'){
   const finish=await c.session.rpc('va_gestao_finalizar_equipe',{p_operacao:op.id,p_usuario:uid});if(finish.error)throw new Error('Conta criada, perfil ainda pendente. Repetir a mesma operação para retomar, sem apagar histórico.')
  }else{
   const finish=await c.session.rpc('va_vincular_conta_paciente_v1',{p_paciente_id:x.paciente_id,p_usuario_id:uid,p_email_confirmado:x.email,p_motivo:'Ativação assistida: identidade e titularidade conferidas pelo administrador',p_identidade_conferida:true})
   if(finish.error)throw new Error('Conta criada, vínculo pendente. Retomar com o mesmo e-mail/UUID da operação; atendimento clínico preservado.')
   const complete=await a.from('va_gestao_operacoes').update({estado:'concluido'}).eq('id',op.id);if(complete.error)throw new Error('Vínculo concluído; atualização do estado pendente para revisão.')
  }
  const released=await a.auth.admin.updateUserById(uid!,{ban_duration:'none'})
  if(released.error)return {ok:false,message:'Banco concluiu o provisionamento, mas Auth continua em quarentena. Consulte o estado e autorize a liberação pela ficha/equipe; não crie outra conta.'}
  return {ok:true,message:'Conta provisionada sem envio e sem exibir senha. Acesso pendente da definição assistida de senha ou recuperação autorizada. Não foi atribuída senha conhecida ao usuário.'}
 }catch(e){
  // Não excluir usuários ou perfis: estados e app_metadata permitem recuperação.
  if(operationId){try{await authAdmin().from('va_gestao_operacoes').update({estado:'falha'}).eq('id',operationId).neq('estado','concluido')}catch{/* Não revelar erro de credencial. */}}
  return {ok:false,message:message(e)}
 }
}
export async function alterarAcesso(target:string,blocked:boolean,confirmed:boolean){
 try{
  const c=await adminContext();writeAllowed(c.schemaReady);if(confirmed!==true||typeof blocked!=='boolean')throw new Error('Confirme a alteração de acesso.')
  const p=await c.session.from('perfis').select('role').eq('id',target).maybeSingle();if(p.error)throw new Error('Conta não verificada.')
  const patient=await c.session.from('pacientes').select('id').eq('user_id',target).maybeSingle()
  if(patient.error)throw new Error('Vínculo não verificado.')
  assertManageTarget(c.actor,target,p.data?.role||null,Boolean(patient.data))
  const pending=await c.session.from('va_gestao_operacoes').select('estado').eq('usuario_id',target).neq('estado','concluido').limit(1)
  if(pending.error||(!blocked&&pending.data?.length))throw new Error('Concluir/revisar o provisionamento pendente antes de liberar acesso.')
  const a=authAdmin(),user=await a.auth.admin.getUserById(target);if(user.error)throw new Error('Conta Auth não verificada.')
  // Na liberação, Auth primeiro: DB permanece bloqueado se o provedor falhar.
  if(!blocked){const r=await a.auth.admin.updateUserById(target,{ban_duration:'none'});if(r.error)throw new Error('Auth não confirmou liberação; bloqueio do banco preservado.')}
  const sql=await c.session.rpc('va_gestao_bloquear',{p_usuario:target,p_bloqueado:blocked});if(sql.error)throw new Error('Banco não confirmou alteração de acesso.')
  if(blocked){const r=await a.auth.admin.updateUserById(target,{ban_duration:'876000h'});if(r.error)return {ok:false,message:'Banco bloqueou leituras/RPCs protegidas; bloqueio de novo login no Auth precisa ser conferido. Não exclua a conta.'}}
  return {ok:true,message:blocked?'Acesso bloqueado; histórico preservado.':'Acesso liberado; papel e unidade preservados.'}
 }catch(e){return {ok:false,message:message(e)}}
}
export async function salvarUnidade(id:string|null,nome:string,cidade:string,telefone:string){try{const c=await adminContext();writeAllowed(c.schemaReady);const r=await c.session.rpc('va_salvar_unidade_admin_v1',{p_id:id,p_nome:nome,p_cidade:cidade,p_telefone:telefone});if(r.error)throw new Error('Unidade não confirmada. Confira os dados e permissões.');return {ok:true,message:'Unidade salva; vínculos preservados.'}}catch(e){return {ok:false,message:message(e)}}}
export async function estadoPortal(patientId:string){
 try{
  const c=await adminContext(),p=await c.session.from('pacientes').select('user_id').eq('id',patientId).single();if(p.error)throw new Error('Ficha indisponível.')
  const op=c.schemaReady?await c.session.from('va_gestao_operacoes').select('estado').eq('paciente_id',patientId).maybeSingle():null
  if(op?.error)throw new Error('Estado do provisionamento indisponível.')
  const capabilities={ready:c.schemaReady&&configured()&&process.env.VACINACAO_GESTAO_ESCRITA==='autorizada',emailEnabled:process.env.VACINACAO_EMAIL_AUTORIZADO==='sim'&&process.env.VACINACAO_EMAIL_TEMPLATE_CONFIRMADO==='sim'}
  if(!p.data.user_id)return {ok:true,status:op?.data?'pendente':'não ativado',message:op?.data?'Provisionamento pendente; retomar com os mesmos dados.':'Nenhuma conta vinculada.',uid:null,...capabilities}
  if(!configured()||!c.schemaReady)return {ok:true,status:'não verificado',message:'Vínculo existente; consulta de acesso depende de configuração segura no servidor e gestão aprovada.',uid:p.data.user_id,...capabilities}
  const a=authAdmin(),user=await a.auth.admin.getUserById(p.data.user_id),b=c.schemaReady?await c.session.from('va_acessos_bloqueados').select('bloqueado').eq('usuario_id',p.data.user_id).maybeSingle():null
  if(user.error||b?.error)throw new Error('Estado de acesso não confirmado.')
  return {ok:true,status:accountState(user.data.user?.banned_until,user.data.user?.last_sign_in_at,b?.data?.bloqueado),message:'Estado derivado de login Auth e bloqueio institucional; não comprova entrega de mensagem.',uid:p.data.user_id,...capabilities}
 }catch(e){return {ok:false,status:'não verificado',message:message(e),uid:null,ready:false,emailEnabled:false}}
}
export async function recuperarAcesso(target:string,confirmed:boolean){
 try{
  const c=await adminContext();writeAllowed(c.schemaReady)
  if(confirmed!==true||process.env.VACINACAO_EMAIL_AUTORIZADO!=='sim'||process.env.VACINACAO_EMAIL_TEMPLATE_CONFIRMADO!=='sim')throw new Error('Envio desabilitado. Confirmar SMTP, template de token, URL de retorno e autorização explícita do responsável.')
  const p=await c.session.from('perfis').select('role').eq('id',target).maybeSingle()
  const patient=await c.session.from('pacientes').select('id').eq('user_id',target).maybeSingle()
  if(p.error||patient.error||(!patient.data&&p.data?.role!=='ubs'))throw new Error('Conta não gerenciada.')
  assertManageTarget(c.actor,target,p.data?.role||null,Boolean(patient.data))
  const a=authAdmin(),u=await a.auth.admin.getUserById(target)
  const blocked=await c.session.from('va_acessos_bloqueados').select('bloqueado').eq('usuario_id',target).maybeSingle()
  if(blocked.error||blocked.data?.bloqueado||u.data.user?.banned_until&&new Date(u.data.user.banned_until).getTime()>Date.now())throw new Error('Conta bloqueada; recuperação não libera acesso automaticamente.')
  if(u.error||!u.data.user?.email||u.data.user.email.endsWith('.invalid')||u.data.user.email.endsWith('@paciente.vacinacao.app'))throw new Error('Conta sem canal de e-mail real confirmado; usar procedimento assistido.')
  const origin=process.env.VACINACAO_ORIGIN;if(!origin||!/^https:\/\//.test(origin))throw new Error('URL segura de retorno não configurada.')
  const r=await emailAuth().auth.resetPasswordForEmail(u.data.user.email,{redirectTo:origin+'/definir-senha'})
  if(r.error)throw new Error('Solicitação de recuperação não confirmada. Não significa e-mail entregue.')
  return {ok:true,message:'Solicitação aceita pelo provedor. Não comprova entrega; confira o canal com o titular.'}
 }catch(e){return {ok:false,message:message(e)}}
}
