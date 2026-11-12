// Somente leitura de metadados REST com a conta admin existente; sem RPCs.
import {createClient} from '@supabase/supabase-js'
import {mkdirSync,writeFileSync} from 'node:fs'
import {validateBase,requireValue} from '../tests/helpers/homolog-config.mjs'
async function main(){
 const {url,key}=validateBase(process.env),email=requireValue(process.env,'HOMOLOG_ADMIN_EMAIL')
 requireValue(process.env,'HOMOLOG_ADMIN_PASSWORD')
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
 const login=await client.auth.signInWithPassword({email,password:process.env.HOMOLOG_ADMIN_PASSWORD})
 if(login.error||!login.data?.session)throw new Error('Não foi possível autenticar para a inspeção; valores omitidos.')
 const verified=await client.auth.getUser()
 if(verified.error||verified.data.user?.id!==login.data.user.id)throw new Error('Identidade não confirmada.')
 const profile=await client.from('perfis').select('role').eq('id',login.data.user.id).maybeSingle()
 if(profile.error||profile.data?.role!=='admin')throw new Error('Perfil administrativo não confirmado.')
 const response=await fetch(url+'/rest/v1/',{headers:{apikey:key,Authorization:'Bearer '+login.data.session.access_token,Accept:'application/openapi+json'},signal:AbortSignal.timeout(15000)})
 mkdirSync('backups',{recursive:true})
 if(!response.ok){console.log(JSON.stringify({openapiStatus:response.status,resultado:'Metadados REST não disponíveis por este canal. Não usar chave administrativa para contornar. Executar diagnóstico 014 somente leitura no SQL Editor.'}))}
 else {
 const data=await response.json()
 const path='backups/openapi-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'
 writeFileSync(path,JSON.stringify(data,null,2),{flag:'wx'})
 const columns=Object.keys(data.definitions?.contatos_busca_ativa?.properties||{})
 const rpcNames=Object.keys(data.paths||{}).filter(p=>/contato|busca_ativa|cadastrar_atendimento/.test(p))
 console.log(JSON.stringify({openapiStatus:200,arquivo:path,colunasContatos:columns,recursosRest:rpcNames,limite:'Não inclui corpos, RLS ou constraints completas; não basta para definir migração incremental.'},null,2))
 }
 const expectedColumns=['id','paciente_id','unidade_id','esquema_id','responsavel_id','responsavel_nome','canal','resultado','observacoes','realizado_em','proximo_acompanhamento','contexto','chave_idempotencia','criado_em']
 const head=await client.from('contatos_busca_ativa').select(expectedColumns.join(','),{head:true})
 const available=r=>r.status>=200&&r.status<300&&!r.error
 const contract={origem:'HEAD autenticado; não é diagnóstico de catálogo',tabela:'contatos_busca_ativa',colunasSolicitadas:expectedColumns,consultaConjuntaDisponivel:available(head),status:head.status,codigo:head.error?.code||null,escritaHomologada:false,ddlExecutado:false}
 if(!available(head)){
  const countHead=await client.from('contatos_busca_ativa').select('id,paciente_id,contexto',{head:true,count:'exact'})
  const emptyGet=await client.from('contatos_busca_ativa').select(expectedColumns.join(',')).limit(0)
  contract.contraprovas={HEAD_com_contagem:{status:countHead.status,erro:Boolean(countHead.error),sucesso:available(countHead)},GET_sem_linhas:{status:emptyGet.status,erro:Boolean(emptyGet.error),codigo:emptyGet.error?.code||null,sucesso:available(emptyGet)}}
 }
 const path='backups/contrato-rest-contatos-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'
 writeFileSync(path,JSON.stringify(contract,null,2),{flag:'wx'})
 console.log(JSON.stringify({arquivo:path,...contract},null,2))
}
main().catch(()=>{console.error('Inspeção não concluída. Nenhuma credencial ou resposta bruta foi exibida.');process.exitCode=1})
