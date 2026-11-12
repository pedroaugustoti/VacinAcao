// Compara arquivos de metadados atuais com PostgreSQL local. Sem conexão remota.
import {readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {normalizeSql} from './comparar-busca-ativa.mjs'
const read=p=>{try{return JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''))}catch{throw new Error('Snapshot ausente/vazio/JSON inválido: '+p+'; conteúdo não exibido.')}},unwrap=x=>Array.isArray(x)?x[0]:x
const remote=unwrap(read('backups/final-018.json')).diagnostico_estoque,access=unwrap(read('backups/final-024.json')).acesso_paciente
if(!remote?.funcoes||!remote?.triggers||!access?.rls)throw new Error('Snapshots finais incompletos')
const {PGlite}=await import(pathToFileURL(join(tmpdir(),'vacinacao-sql-review-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),file=p=>readFileSync(p,'utf8'),hash=s=>createHash('md5').update(s.replaceAll('\r\n','\n')).digest('hex')
try{
 await db.exec(file('tests/fixtures/sql-review.sql'))
 await db.exec('ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz')
 for(const n of ['006_proposta_correcao_rpcs_fase2.sql','012_legado_cadastro_auditado.sql','011_busca_ativa_incremental.sql','019_estoque_demonstracao_incremental.sql','025_vinculo_paciente_auditado.sql'])await db.exec(file('sql/'+n))
 const r=await db.exec(file('sql/018_diagnostico_estoque_somente_leitura.sql')),reference=r.flatMap(x=>x.rows).find(x=>x.diagnostico_estoque).diagnostico_estoque
 const names=['va_registrar_aplicacao_v1','va_cadastrar_atendimento_v2','va_atualizar_paciente_v1','va_movimentar_estoque_v1','va_consumir_estoque_aplicacao','va_estoque_imutavel','va_proteger_lote_estoque','va_salvar_vacina_v1','va_cadastrar_lote_v1','va_vincular_conta_paciente_v1']
 const functions=names.map(name=>{
  const exp=reference.funcoes.find(f=>f.assinatura.split('(')[0].replace('public.','')===name),actual=remote.funcoes.filter(f=>f.assinatura.split('(')[0].replace('public.','')===name)
  return {nome:name,status:!actual.length?'ausente':actual.length===1&&hash(actual[0].definicao)===hash(exp.definicao)?'compativel':'divergente',acl:actual[0]?.acl}
 })
 const tables=['va_estoque_saldos','va_estoque_movimentos'].map(t=>{
  const exp=reference.colunas.filter(c=>c.table_name===t),act=remote.colunas.filter(c=>c.table_name===t)
  const fields=['column_name','data_type','is_nullable','column_default']
  return {nome:t,status:!act.length?'ausente':act.length===exp.length&&exp.every(c=>act.some(a=>fields.every(k=>normalizeSql(a[k])===normalizeSql(c[k]))))?'compativel':'divergente'}
 })
 const triggerNames=['va_estoque_consumo','va_estoque_imutavel','va_lote_movimentado']
 const triggers=triggerNames.map(n=>{const e=reference.triggers.find(t=>t.definicao.includes('TRIGGER '+n+' '));return {nome:n,compativel:remote.triggers.some(t=>normalizeSql(t.definicao)===normalizeSql(e.definicao)&&t.habilitado==='O')}})
 const index=remote.indices.some(i=>i.indexname==='va_paciente_conta_unica'&&normalizeSql(i.indexdef)===normalizeSql(reference.indices.find(i=>i.indexname==='va_paciente_conta_unica').indexdef))
 const policy=remote.politicas.find(p=>p.policyname==='va_paciente_unidade_select'),expPolicy=reference.politicas.find(p=>p.policyname==='va_paciente_unidade_select')
 const stockConstraints=reference.constraints.filter(c=>/va_estoque_/.test(c.tabela)&&!c.definicao.startsWith('NOT NULL')).map(e=>({tabela:e.tabela,definicao:e.definicao,compativel:remote.constraints.some(a=>normalizeSql(a.tabela)===normalizeSql(e.tabela)&&normalizeSql(a.definicao)===normalizeSql(e.definicao))}))
 const stockPolicies=reference.politicas.filter(p=>/va_estoque_/.test(p.tablename)).map(e=>({nome:e.policyname,compativel:remote.politicas.some(a=>a.policyname===e.policyname&&a.tablename===e.tablename&&a.cmd===e.cmd&&a.permissive===e.permissive&&JSON.stringify(a.roles)===JSON.stringify(e.roles)&&normalizeSql(a.qual)===normalizeSql(e.qual)&&normalizeSql(a.with_check)===normalizeSql(e.with_check))}))
 const stockIndexes=reference.indices.filter(i=>/va_estoque_/.test(i.tablename)).map(e=>({nome:e.indexname,compativel:remote.indices.some(a=>normalizeSql(a.indexdef)===normalizeSql(e.indexdef))}))
 const extraStockPolicies=remote.politicas.filter(p=>/va_estoque_/.test(p.tablename)&&!reference.politicas.some(e=>e.tablename===p.tablename&&e.policyname===p.policyname)).map(p=>p.policyname)
 const profileWritePolicies=access.politicas.filter(p=>p.tablename==='perfis'&&['ALL','INSERT','UPDATE','DELETE'].includes(p.cmd)).map(p=>p.policyname)
 const report={capturadoEstoque:remote.capturado_em,capturadoAcesso:access.capturado_em,funcoes:functions,tabelas:tables,triggers,constraintsEstoque:stockConstraints,politicasEstoque:stockPolicies,indiceVinculoCompativel:index,policyVinculoCompativel:!!policy&&normalizeSql(policy.qual)===normalizeSql(expPolicy.qual)&&policy.cmd===expPolicy.cmd&&JSON.stringify(policy.roles)===JSON.stringify(expPolicy.roles),triggersAuthQuantidade:access.triggers_auth?.length||0,contasMultiplas:access.contas_com_multiplos_cadastros,vinculosProfissionais:access.vinculos_profissionais,limite:'Metadados/corpos/ACL explícita, não homologação de escrita ou prova de privilégios herdados. RLS ativo do estoque exige 023. Não reaplicar CREATE se qualquer objeto já existir.'}
 Object.assign(report,{indicesEstoque:stockIndexes,politicasEstoqueAdicionais:extraStockPolicies,politicasEscritaPerfis:profileWritePolicies,papeisApi:access.papeis_api,escritaEfetiva:access.escrita_efetiva})
 writeFileSync('backups/revisao-final.json',JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report,null,2))
}finally{await db.close()}
