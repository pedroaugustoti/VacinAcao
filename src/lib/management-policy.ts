export type ManagementKind='equipe'|'paciente'
export type ProvisionInput={tipo:ManagementKind;nome:string;email:string;funcao:string;unidade_id:string;paciente_id:string;confirmado:boolean}
export function validateProvision(x:ProvisionInput){
 if(x.confirmado!==true||!['equipe','paciente'].includes(x.tipo)||x.nome.trim().length<3||x.nome.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email.trim())||x.email.length>254||x.funcao.length>100)throw new Error('Confira nome, e-mail e autorização institucional.')
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if(x.tipo==='equipe'&&(!uuid.test(x.unidade_id)||!x.funcao.trim()))throw new Error('Selecione unidade e função do profissional.')
 if(x.tipo==='paciente'&&!uuid.test(x.paciente_id))throw new Error('Ficha inválida.')
 return {tipo:x.tipo,nome:x.nome.trim(),email:x.email.trim().toLowerCase(),funcao:x.funcao.trim(),unidade_id:x.unidade_id.toLowerCase(),paciente_id:x.paciente_id.toLowerCase(),confirmado:true}
}
export function assertManageTarget(actor:string,target:string,role:string|null,patientLinked=false){
 if(actor===target||role==='admin')throw new Error('Não é permitido alterar o próprio acesso ou o de administrador.')
 if(role!=='ubs'&&!patientLinked)throw new Error('Conta não gerenciada.')
}
export function accountState(banned:string|undefined,lastSignIn:string|undefined,blocked=false){return blocked||(banned&&new Date(banned).getTime()>Date.now())?'bloqueado':lastSignIn?'ativo':'pendente'}
