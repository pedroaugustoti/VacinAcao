// Integração SQL exclusivamente local em PostgreSQL WASM descartável.
// Instalar PGlite fora do projeto e informar SQL_REVIEW_PGLITE_DIR se necessário.
// Não lê .env, não usa rede, Supabase, service_role ou contas reais.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gerarRollback } from '../scripts/gerar-rollback-sql.mjs'

const modulePath=join(process.env.SQL_REVIEW_PGLITE_DIR || join(tmpdir(),'vacinacao-sql-review-tools'),'node_modules/@electric-sql/pglite/dist/index.js')
const { PGlite }=await import(pathToFileURL(modulePath).href)
const db=new PGlite()
const file=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const migration=file('../sql/006_proposta_correcao_rpcs_fase2.sql')
const backupSql=file('../sql/008_backup_definicoes_grants_somente_leitura.sql')
const ids={a:'20000000-0000-0000-0000-000000000001',b:'20000000-0000-0000-0000-000000000002',admin:'20000000-0000-0000-0000-000000000003',patient:'20000000-0000-0000-0000-000000000004',unit:'10000000-0000-0000-0000-000000000001',unitB:'10000000-0000-0000-0000-000000000002',p:'30000000-0000-0000-0000-000000000001',dose:'40000000-0000-0000-0000-000000000001',v:'50000000-0000-0000-0000-000000000001',lot:'60000000-0000-0000-0000-000000000001'}
let count=0
const register=(overrides={})=> {
 const args={unit:ids.unit,name:'DEMO HOMOLOG LOCAL',cpf:'00000000001',phone:'00000000000',accident:'2001-01-01',birth:'2000-01-01',dates:['2002-01-01','2002-01-04','2002-01-08','2002-01-15'],...overrides}
 return db.query('SELECT public.va_cadastrar_atendimento_v2($1::uuid,$2::text,$3::text,$4::text,$5::date,$6::date,$7::date[]) AS id',Object.values(args))
}
const edit=(birth='2000-01-01',accident='2001-01-01')=>db.query("SELECT public.va_atualizar_paciente_v1($1::uuid,'DEMO HOMOLOG AJUSTE','00000000000','00000000000',$2::date,$3::date,'Revisão exclusivamente sintética')",[ids.p,birth,accident])
const apply=(overrides={})=>{
 const args={patient:ids.p,dose:ids.dose,vaccine:ids.v,lot:ids.lot,at:'2002-01-01T15:00:00Z',via:'DEMO',local:'DEMO',amount:1,unit:'mL',notes:'SIMULAÇÃO LOCAL',...overrides}
 return db.query('SELECT public.va_registrar_aplicacao_v1($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::timestamptz,$6::text,$7::text,$8::numeric,$9::text,$10::text) AS id',Object.values(args))
}
async function rejected(action,code) {
 await db.exec('SAVEPOINT rejected')
 let error
 try { await action() } catch(e) { error=e }
 await db.exec('ROLLBACK TO SAVEPOINT rejected; RELEASE SAVEPOINT rejected')
 assert.ok(error,`Esperava rejeição ${code}`)
 assert.equal(error.code,code,error.message)
}
async function scenario(label,user,fn,owner=false) {
 await db.exec('BEGIN')
 try {
   if (!owner) await db.exec('SET LOCAL ROLE authenticated')
   await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user || ''])
   await fn()
   count++; console.log(`PASS SQL LOCAL: ${label}`)
 } finally { await db.exec('ROLLBACK') }
}
async function snapshot() { return (await db.exec(backupSql)).flatMap(r=>r.rows).find(r=>r.backup)?.backup }
function permissions(s) {
 const norm=grants=>JSON.stringify([...grants].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))
 return {
   functions:s.funcoes.filter(f=>['va_cadastrar_atendimento_v2','va_atualizar_paciente_v1','va_registrar_aplicacao_v1'].includes(f.proname)).map(f=>({signature:f.assinatura,hash:f.fingerprint,grants:norm(f.grants)})).sort((a,b)=>a.signature.localeCompare(b.signature)),
   tables:s.tabelas.map(t=>({id:t.identidade,grants:norm(t.grants),columns:norm(t.column_grants)})).sort((a,b)=>a.id.localeCompare(b.id)),
 }
}
try {
 await db.exec(file('./fixtures/sql-review.sql'))
 console.log('PostgreSQL local:',(await db.query('SHOW server_version')).rows[0].server_version)
 const before=await snapshot()
 assert.ok(before?.funcoes?.length)
 await db.exec(migration)
 const afterMigration=await snapshot()
 for (const key of ['politicas','constraints','indices','triggers']) assert.deepEqual(afterMigration[key],before[key],`${key} devem ser preservados`)
 await db.exec(file('../sql/009_acl_dependencias_somente_leitura.sql'))
 await scenario('quatro datas e cronograma personalizado persistidos com auditoria',ids.a,async()=>{
   const result=await register({dates:['2002-01-01','2002-01-03','2002-01-09','2002-01-23']})
   const id=result.rows[0].id
   assert.match(id,/^[0-9a-f-]{36}$/)
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.esquemas_vacinais WHERE paciente_id=$1',[id])).rows[0].n,4)
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.historico_pacientes WHERE paciente_id=$1',[id])).rows[0].n,1)
 })
 await scenario('cinco datas aceitas; sexta e datas duplicadas rejeitadas',ids.a,async()=>{
   await register({dates:['2002-01-01','2002-01-02','2002-01-03','2002-01-04','2002-01-05']})
   await rejected(()=>register({cpf:'00000000002',dates:['2002-01-01','2002-01-02','2002-01-03','2002-01-04','2002-01-05','2002-01-06']}),'22023')
   await rejected(()=>register({cpf:'00000000002',dates:['2002-01-01','2002-01-01']}),'22023')
 })
 await scenario('datas futuras/invertidas rejeitadas; edição retrospectiva e nascimento desconhecido aceitos',ids.a,async()=>{
   await rejected(()=>register({accident:'9999-01-01'}),'22023')
   await rejected(()=>register({birth:'2002-01-01'}),'22023')
   await rejected(()=>register({accident:'infinity'}),'22023')
   await register({birth:null})
   await rejected(()=>edit('2002-01-01'),'22023')
   await rejected(()=>edit('2000-01-01','9999-01-01'),'22023')
   await edit(null)
   assert.equal((await db.query('SELECT data_nascimento FROM public.pacientes WHERE id=$1',[ids.p])).rows[0].data_nascimento,null)
 })
 await scenario('isolamento UBS B: sem leitura nem escrita em A',ids.b,async()=>{
   assert.equal((await db.query('SELECT id FROM public.pacientes WHERE id=$1',[ids.p])).rows.length,0)
   await rejected(()=>register(),'42501'); await rejected(()=>edit(),'42501'); await rejected(()=>apply(),'42501')
 })
 await scenario('paciente: lê próprio vínculo, não executa operações profissionais',ids.patient,async()=>{
   assert.equal((await db.query('SELECT id FROM public.pacientes WHERE id=$1',[ids.p])).rows.length,1)
   await rejected(()=>register(),'42501'); await rejected(()=>edit(),'42501'); await rejected(()=>apply(),'42501')
 })
 await scenario('admin: acesso central explícito em A e cadastro em B',ids.admin,async()=>{
   await edit()
   await register({unit:ids.unitB})
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.pacientes')).rows[0].n,2)
 })
 await scenario('aplicação histórica aceita lote válido na data, histórico e índice rejeitam duplicidade',ids.a,async()=>{
   const result=await apply(); const id=result.rows[0].id
   assert.equal((await db.query('SELECT status FROM public.esquemas_vacinais WHERE id=$1',[ids.dose])).rows[0].status,'aplicada')
   assert.equal((await db.query("SELECT count(*)::int AS n FROM public.historico_pacientes WHERE detalhes->>'aplicacao_id'=$1",[id])).rows[0].n,1)
   await rejected(()=>apply(),'23505')
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.aplicacoes_vacinais')).rows[0].n,1)
 })
 await scenario('atrasos derivados das datas diminuem após aplicação, sem reagendar doses',ids.a,async()=>{
   // Ajuste de fixture apenas no banco local e revertido ao final do cenário.
   await db.exec("UPDATE public.lotes_vacinas SET validade='2099-01-01'; SET LOCAL ROLE authenticated")
   const calendar=(await db.query("WITH d AS (SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date AS today) SELECT to_char(today-8,'YYYY-MM-DD') AS accident, ARRAY[to_char(today-7,'YYYY-MM-DD'),to_char(today-4,'YYYY-MM-DD'),to_char(today,'YYYY-MM-DD'),to_char(today+7,'YYYY-MM-DD')] AS dates FROM d")).rows[0]
   const id=(await register({accident:calendar.accident,dates:calendar.dates})).rows[0].id
   const overdue=async()=>Number((await db.query("SELECT count(*)::int AS n FROM public.esquemas_vacinais WHERE paciente_id=$1 AND (status='atrasada' OR (status='pendente' AND data_prevista<(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date))",[id])).rows[0].n)
   assert.equal(await overdue(),2)
   const dose=(await db.query('SELECT id FROM public.esquemas_vacinais WHERE paciente_id=$1 AND numero_dose=1',[id])).rows[0].id
   await apply({patient:id,dose,at:new Date(Date.now()-60000).toISOString()})
   assert.equal(await overdue(),1)
   const dates=(await db.query("SELECT to_char(data_prevista,'YYYY-MM-DD') AS day FROM public.esquemas_vacinais WHERE paciente_id=$1 ORDER BY numero_dose",[id])).rows.map(d=>d.day)
   assert.deepEqual(dates,calendar.dates)
 },true)
 await scenario('lote vencido na data, futuro e quantidade não finita rejeitados',ids.a,async()=>{
   await rejected(()=>apply({at:'2006-01-01T15:00:00Z'}),'22023')
   await rejected(()=>apply({at:'9999-01-01T15:00:00Z'}),'22023')
   await rejected(()=>apply({amount:'NaN'}),'22023')
 })
 await scenario('defesa de validade NULL/infinita e preservação da constraint NOT NULL',ids.a,async()=>{
   assert.equal((await db.query("SELECT attnotnull FROM pg_attribute WHERE attrelid='public.lotes_vacinas'::regclass AND attname='validade'")).rows[0].attnotnull,true)
   // Mutação de fixture dentro de transação local revertida, não na proposta.
   await db.exec('ALTER TABLE public.lotes_vacinas ALTER COLUMN validade DROP NOT NULL')
   for (const value of [null,'infinity','-infinity']) {
     await db.query('UPDATE public.lotes_vacinas SET validade=$1::date WHERE id=$2',[value,ids.lot])
     await rejected(()=>apply(),'22023')
   }
 },true)
 await scenario('triggers de proteção e FK composta continuam ativos',ids.a,async()=>{
   await apply()
   await rejected(()=>db.query('INSERT INTO public.aplicacoes_vacinais(paciente_id,esquema_id,vacina_id,lote_id,unidade_id,profissional_id,aplicada_em) SELECT paciente_id,esquema_id,vacina_id,lote_id,unidade_id,profissional_id,aplicada_em FROM public.aplicacoes_vacinais WHERE paciente_id=$1',[ids.p]),'23505')
   await db.exec("INSERT INTO public.vacinas(id,nome,si_pni) VALUES('50000000-0000-0000-0000-000000000002','DEMO 2','DEMO 2')")
   await rejected(()=>db.query('INSERT INTO public.aplicacoes_vacinais(paciente_id,vacina_id,lote_id,unidade_id,profissional_id,aplicada_em) VALUES($1,$2,$3,$4,$5,$6)',[ids.p,'50000000-0000-0000-0000-000000000002',ids.lot,ids.unit,ids.a,'2002-01-01T15:00:00Z']),'23503')
   await rejected(()=>db.query('DELETE FROM public.aplicacoes_vacinais WHERE paciente_id=$1',[ids.p]),'P0001')
   await rejected(()=>db.query('UPDATE public.aplicacoes_vacinais SET quantidade=2 WHERE paciente_id=$1',[ids.p]),'P0001')
   assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgrelid='public.aplicacoes_vacinais'::regclass AND NOT tgisinternal")).rows[0].n,2)
 },true)
 await scenario('falha induzida na auditoria reverte aplicação e acompanhamento',ids.a,async()=>{
   await db.exec("CREATE FUNCTION public.local_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Falha sintética de auditoria'; END $$; CREATE TRIGGER local_audit_fail BEFORE INSERT ON public.historico_pacientes FOR EACH ROW EXECUTE FUNCTION public.local_audit_fail()")
   await rejected(()=>apply(),'P0001')
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.aplicacoes_vacinais')).rows[0].n,0)
   assert.equal((await db.query('SELECT status FROM public.esquemas_vacinais WHERE id=$1',[ids.dose])).rows[0].status,'pendente')
 },true)
 await scenario('escrita direta, UPDATE por coluna e TRUNCATE efetivo recusados',ids.a,async()=>{
   await rejected(()=>db.query("UPDATE public.pacientes SET cpf='00000000009' WHERE id=$1",[ids.p]),'42501')
   const priv=(await db.query("SELECT has_any_column_privilege('authenticated','public.pacientes','UPDATE') AS u,has_table_privilege('anon','public.pacientes','TRUNCATE') AS t")).rows[0]
   assert.deepEqual(priv,{u:false,t:false})
 })
 const transactional=file('../sql/010_ensaio_transacional_homologacao.sql')
   .replaceAll('UUID_UBS_A',ids.a).replaceAll('UUID_UBS_B',ids.b)
   .replaceAll('UUID_ADMIN_DEMO',ids.admin).replaceAll('UUID_AUTH_PACIENTE_DEMO',ids.patient)
   .replaceAll('UUID_UNIDADE_A',ids.unit).replaceAll('UUID_UNIDADE_B',ids.unitB)
   .replaceAll('UUID_VACINA_DEMO',ids.v).replaceAll('UUID_LOTE_DEMO_A',ids.lot)
   .replaceAll('CPF_SINTETICO_INEDITO','00000000003')
 await db.query("UPDATE public.lotes_vacinas SET validade='2099-01-01' WHERE id=$1",[ids.lot])
 await db.exec(transactional)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.pacientes')).rows[0].n,1)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.aplicacoes_vacinais')).rows[0].n,0)
 assert.equal((await db.query('SELECT count(*)::int AS n FROM public.historico_pacientes')).rows[0].n,0)
 await db.query("UPDATE public.lotes_vacinas SET validade='2005-01-01' WHERE id=$1",[ids.lot])
 count++;console.log('PASS SQL LOCAL: roteiro 010 com claims/SET ROLE reverte todas as linhas sintéticas')
 // Teste de restauração de definições e ACLs, sem linhas de dados no snapshot.
 const rollback=gerarRollback(before)
 await db.exec(rollback)
 assert.deepEqual(permissions(await snapshot()),permissions(before))
 count++;console.log('PASS SQL LOCAL: backup/geração/rollback restauram fingerprints e ACLs de tabela/coluna')
 // Testa falha fechada por privilégio herdado; restaura baseline explicitamente.
 await db.exec('CREATE ROLE local_shared NOLOGIN; GRANT local_shared TO authenticated; GRANT UPDATE(cpf) ON public.pacientes TO local_shared')
 const beforeInherited=await snapshot()
 let inheritedError
 try { await db.exec(migration) } catch(error) { inheritedError=error; await db.exec('ROLLBACK') }
 assert.ok(inheritedError?.message.includes('residual'),inheritedError?.message || 'Herança deveria abortar a migração')
 assert.deepEqual(permissions(await snapshot()),permissions(beforeInherited))
 count++;console.log('PASS SQL LOCAL: herança residual aborta e reverte todas as alterações da proposta')
 console.log(`${count} cenários SQL locais aprovados. Schema/políticas reduzidos; não é homologação Supabase nem teste de concorrência real.`)
} finally { await db.close() }
