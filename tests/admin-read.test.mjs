import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {validateBase,accountReadiness,expectedUrl} from './helpers/homolog-config.mjs'
import {runAdminRead,adminQueries} from './helpers/admin-read.mjs'
const credentials=()=>({email:'admin@demo.invalid',password:randomUUID()})
function mockClient({role='admin',authError=null,tableError=null,headStatus=200}={}){
 const reads=[]
 const user={id:'20000000-0000-0000-0000-000000000003',email:'admin@demo.invalid'}
 return {reads,auth:{signInWithPassword:async()=>({data:authError?{}:{user},error:authError}),getUser:async()=>({data:{user},error:null})},
  from(table){let head=false;const query={select(columns,options){head=options?.head===true;reads.push({table,head,columns});return query},eq(){return query},async maybeSingle(){return {data:{role,unidade_id:null},error:null}},then(resolve,reject){return Promise.resolve({data:head?null:[],status:table===tableError?403:headStatus,count:0,error:table===tableError?{code:'42501'}:null}).then(resolve,reject)}};return query},
  rpc(){throw new Error('RPC proibida no modo parcial')},insert(){throw new Error('Escrita proibida')},update(){throw new Error('Escrita proibida')},delete(){throw new Error('Escrita proibida')},
 }
}
test('configuração parcial não exige contas de UBS/paciente e não autentica disponibilidade local',()=>{
 const env={HOMOLOG_SUPABASE_URL:expectedUrl,HOMOLOG_SUPABASE_ANON_KEY:'sb_publishable_'+randomUUID().replaceAll('-',''),HOMOLOG_ADMIN_EMAIL:'admin@demo.invalid',HOMOLOG_ADMIN_PASSWORD:randomUUID()}
 assert.equal(validateBase(env).url,expectedUrl)
 const ready=accountReadiness(env)
 assert.equal(ready.find(r=>r.conta==='UBS_A').senhaConfigurada,false)
 assert.ok(ready.every(r=>r.autenticacao==='não testada'))
})
test('recusa destino diferente e chave administrativa sem revelar o valor',()=>{
 const env={HOMOLOG_SUPABASE_URL:expectedUrl,HOMOLOG_SUPABASE_ANON_KEY:['header',Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url'),'invalid'].join('.')}
 assert.throws(()=>validateBase(env),/Somente chave pública/)
 assert.throws(()=>validateBase({...env,HOMOLOG_SUPABASE_URL:'https://outro.invalid'}),/Destino diferente/)
})
test('modo admin realiza apenas perfil e HEAD; mantém isolamento/escritas pendentes',async()=>{
 const client=mockClient(),report=await runAdminRead(client,credentials())
 assert.equal(report.operacoesDeEscritaClinica,0);assert.equal(report.rpcsExecutadas,0)
 assert.equal(client.reads.filter(r=>r.head).length,adminQueries.length+1)
 assert.equal(client.reads.filter(r=>!r.head).length,1)
 assert.equal(report.testes.find(t=>t.nome==='Isolamento UBS A/UBS B').status,'pendente')
 assert.equal(report.testes.find(t=>t.nome==='Acesso e vínculo do paciente').status,'pendente')
 assert.equal(report.testes.filter(t=>t.status==='aprovado').length,13)
 assert.equal(JSON.stringify(report).includes('admin@demo.invalid'),false)
})
test('falha de login ou papel errado interrompe antes das consultas clínicas',async()=>{
 const auth=mockClient({authError:{code:'invalid_credentials'}})
 const first=await runAdminRead(auth,credentials());assert.equal(auth.reads.length,0);assert.ok(first.testes.some(t=>t.status==='falhou'))
 const patient=mockClient({role:null}),second=await runAdminRead(patient,credentials())
 assert.equal(patient.reads.length,1);assert.ok(second.testes.some(t=>t.codigo==='role_nao_admin'))
})
test('consulta recusada é falha, não aprovação silenciosa',async()=>{
 const report=await runAdminRead(mockClient({tableError:'pacientes'}),credentials())
 assert.equal(report.testes.find(t=>t.nome.startsWith('SELECT HEAD pacientes')).status,'falhou')
})
test('HEAD sem corpo de erro exige HTTP 2xx para ser aprovado',async()=>{
 const report=await runAdminRead(mockClient({headStatus:403}),credentials())
 assert.equal(report.testes.find(t=>t.nome.startsWith('SELECT HEAD pacientes')).status,'falhou')
 assert.equal(report.testes.find(t=>t.nome==='SELECT HEAD contatos_busca_ativa').status,'pendente')
})
