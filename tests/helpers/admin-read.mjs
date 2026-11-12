// Não chama RPC, insert, update, delete, signUp, admin ou recuperação de senha.
// Apenas login da conta existente, getUser, perfil mínimo e SELECT HEAD.
export const adminQueries=[
 ['unidades_saude','id,nome'],
 ['perfis','id,role,unidade_id'],
 ['pacientes','id,unidade_id,data_nascimento,data_acidente'],
 ['esquemas_vacinais','id,paciente_id,numero_dose,data_prevista,data_aplicacao,status,conferencia_documental_pendente'],
 ['vacinas','id,nome,si_pni,ativo'],
 ['lotes_vacinas','id,unidade_id,vacina_id,numero_lote,fabricante,validade'],
 ['aplicacoes_vacinais','id,paciente_id,esquema_id,profissional_id,status,aplicada_em'],
 ['historico_pacientes','id,paciente_id,autor_id,acao'],
 ['notificacoes','id,usuario_id,lida'],
]
const safeCode=error=>/^[A-Za-z0-9_]{1,40}$/.test(String(error?.code||error?.status||''))?String(error.code||error.status):'erro_sem_codigo'
const httpOk=response=>response.status>=200&&response.status<300&&!response.error
const pendingNames=[
 'Isolamento UBS A/UBS B', 'Acesso e vínculo do paciente', 'Autorização de escrita por papel/unidade',
 'Cadastro e persistência após escrita', 'Aplicação e duplicidade', 'Histórico de contato e busca ativa ponta a ponta',
 'Login/reload de telas autenticadas no navegador (fora deste runner)', 'Verificação funcional das revisões SQL (HEAD não homologa migrações)',
]
export async function runAdminRead(client,{email,password}){
 const report={escopo:'leitura parcial com conta administrativa existente',testes:[],conteudoClinicoExibido:false,operacoesDeEscritaClinica:0,rpcsExecutadas:0}
 const result=(nome,status,extra={})=>report.testes.push({nome,status,...extra})
 for(const nome of pendingNames)result(nome,'pendente')
 const login=await client.auth.signInWithPassword({email:email.trim(),password})
 if(login.error||!login.data?.user){result('Autenticação administrativa','falhou',{codigo:safeCode(login.error)});return report}
 result('Autenticação administrativa','aprovado')
 const verified=await client.auth.getUser()
 if(verified.error||!verified.data?.user||verified.data.user.id!==login.data.user.id||verified.data.user.email?.toLowerCase()!==email.trim().toLowerCase()){
  result('Validação remota da identidade/sessão','falhou',{codigo:safeCode(verified.error)});return report
 }
 result('Validação remota da identidade/sessão','aprovado')
 const profile=await client.from('perfis').select('role,unidade_id').eq('id',verified.data.user.id).maybeSingle()
 if(profile.error||profile.data?.role!=='admin'){result('Perfil administrativo em public.perfis','falhou',{codigo:profile.error?safeCode(profile.error):'role_nao_admin'});return report}
 result('Perfil administrativo em public.perfis','aprovado')
 for(const [table,columns] of adminQueries){
  let query=client.from(table).select(columns,{head:true,count:'exact'})
  if(table==='notificacoes')query=query.eq('usuario_id',verified.data.user.id)
  const response=await query
  result(`SELECT HEAD ${table} (colunas e acesso)`,httpOk(response)?'aprovado':'falhou',!httpOk(response)?{codigo:safeCode(response.error||response),httpStatus:response.status}:{observacao:'Sem retornar linhas; não comprova completude dos dados ou isolamento entre unidades.'})
 }
 const contacts=await client.from('contatos_busca_ativa').select('id,paciente_id,contexto',{head:true,count:'exact'})
 if(!httpOk(contacts)){
  const code=safeCode(contacts.error||contacts)
  result('SELECT HEAD contatos_busca_ativa', ['PGRST205','42P01','42501','403','404'].includes(code)||[403,404].includes(contacts.status)?'pendente':'falhou',{codigo:code,httpStatus:contacts.status,observacao:'Contrato/acesso ainda indisponível para a sessão; não afirmar migração homologada.'})
 }else result('SELECT HEAD contatos_busca_ativa','aprovado',{observacao:'Apenas consulta de schema/acesso; fluxo de contato continua pendente.'})
 return report
}
