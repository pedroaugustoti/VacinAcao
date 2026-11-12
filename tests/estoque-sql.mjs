// PostgreSQL local descartável, sem conexão ou contas remotas.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(join(tmpdir(),'vacinacao-sql-review-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),file=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const a='20000000-0000-0000-0000-000000000001',b='20000000-0000-0000-0000-000000000002',admin='20000000-0000-0000-0000-000000000003',patient='20000000-0000-0000-0000-000000000004',p='30000000-0000-0000-0000-000000000001',dose='40000000-0000-0000-0000-000000000001'
let lot,vaccine,passed=0
async function as(user,action){await db.exec('BEGIN; SET LOCAL ROLE authenticated');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);await action();passed++}finally{await db.exec('ROLLBACK')}}
async function denied(action,code){await db.exec('SAVEPOINT neg');let e;try{await action()}catch(x){e=x}await db.exec('ROLLBACK TO neg; RELEASE neg');assert.ok(e,'Esperava rejeição');if(code)assert.equal(e.code,code)}
const move=(delta,key='70000000-0000-0000-0000-000000000001')=>db.query("SELECT public.va_movimentar_estoque_v1($1,$2,'Movimento DEMO local',$3) id",[lot,delta,key])
const apply=()=>db.query("SELECT public.va_registrar_aplicacao_v1($1,$2,$3,$4,'2003-01-01T15:00:00Z','IM','DEMO',0.5,'mL','DEMO')",[p,dose,vaccine,lot])
try{
 await db.exec(file('./fixtures/sql-review.sql'));await db.exec(file('../sql/006_proposta_correcao_rpcs_fase2.sql'));await db.exec(file('../sql/019_estoque_demonstracao_incremental.sql'))
 await db.exec('CREATE POLICY estoque_test_catalog ON public.vacinas FOR SELECT TO authenticated USING(true); CREATE POLICY estoque_test_lots ON public.lotes_vacinas FOR ALL TO authenticated USING(public.va_is_admin() OR unidade_id=public.va_my_unidade())')
 lot=(await db.query('SELECT id FROM public.lotes_vacinas LIMIT 1')).rows[0].id;vaccine=(await db.query('SELECT vacina_id FROM public.lotes_vacinas LIMIT 1')).rows[0].vacina_id
 // Estoque de ensaio precisa validade atual para entradas; aplicação histórica é permitida.
 await db.query("UPDATE public.lotes_vacinas SET validade='2099-01-01' WHERE id=$1",[lot])
 await as(a,async()=>{await denied(()=>apply(),'22023');assert.equal((await db.query('SELECT id FROM public.aplicacoes_vacinais')).rows.length,0)})
 await as(a,async()=>{const x=(await move(2)).rows[0].id;assert.equal((await move(2)).rows[0].id,x);await denied(()=>move(3),'22023');assert.equal((await db.query('SELECT saldo FROM public.va_estoque_saldos')).rows[0].saldo,2);await apply();assert.equal((await db.query('SELECT saldo FROM public.va_estoque_saldos')).rows[0].saldo,1);await denied(()=>apply(),'23505');assert.equal((await db.query('SELECT saldo FROM public.va_estoque_saldos')).rows[0].saldo,1)})
 await as(a,async()=>{await move(1);await denied(()=>move(-2,'70000000-0000-0000-0000-000000000002'),'22023');await denied(()=>db.query('UPDATE public.va_estoque_saldos SET saldo=999'),'42501');await denied(()=>db.query('DELETE FROM public.va_estoque_movimentos'),'42501')})
 await as(b,async()=>{await denied(()=>move(1),'42501');assert.equal((await db.query('SELECT * FROM public.va_estoque_saldos')).rows.length,0)})
 await as(patient,async()=>{await denied(()=>move(1),'42501');await denied(()=>db.query("SELECT public.va_salvar_vacina_v1(NULL,'DEMO','DEMO',true)"),'42501')})
 await as(a,async()=>{await denied(()=>db.query("SELECT public.va_salvar_vacina_v1(NULL,'DEMO','DEMO',true)"),'42501')})
 await as(admin,async()=>{const v=(await db.query("SELECT public.va_salvar_vacina_v1(NULL,'DEMO local','DEMO-LOCAL',true) id")).rows[0].id;await db.query("SELECT public.va_salvar_vacina_v1($1,'DEMO editada','DEMO-LOCAL',false)",[v]);assert.equal((await db.query('SELECT ativo FROM public.vacinas WHERE id=$1',[v])).rows[0].ativo,false)})
 await as(a,async()=>{const args=[vaccine,'10000000-0000-0000-0000-000000000001','DEMO-NOVO','DEMO fabricante','2099-01-01'];const q=()=>db.query('SELECT public.va_cadastrar_lote_v1($1,$2,$3,$4,$5)',args);await q();await denied(q,'23505');args[1]='10000000-0000-0000-0000-000000000002';await denied(q,'42501')})
 await as(a,async()=>{await move(2);await db.exec("RESET ROLE; CREATE FUNCTION public.audit_fail_stock() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Falha sintética'; END $$; CREATE TRIGGER audit_fail_stock BEFORE INSERT ON public.historico_pacientes FOR EACH ROW EXECUTE FUNCTION public.audit_fail_stock(); SET LOCAL ROLE authenticated");await denied(()=>apply(),'P0001');assert.equal((await db.query('SELECT saldo FROM public.va_estoque_saldos')).rows[0].saldo,2);assert.equal((await db.query('SELECT id FROM public.aplicacoes_vacinais')).rows.length,0)})
 await as(a,async()=>{await move(1);await denied(()=>db.query("UPDATE public.lotes_vacinas SET numero_lote='alterado' WHERE id=$1",[lot]));await denied(()=>db.query("SELECT public.va_cadastrar_lote_v1($1,'10000000-0000-0000-0000-000000000001','X','DEMO','2000-01-01')",[vaccine]),'22023')})
 const check=(await db.exec(file('../sql/023_verificacao_estoque_somente_leitura.sql'))).flatMap(r=>r.rows)
 assert.ok(check.filter(r=>Object.hasOwn(r,'rls_ativo')).every(r=>r.rls_ativo&&r.sem_escrita_direta))
 assert.ok(check.filter(r=>Object.hasOwn(r,'execute_correto')).every(r=>r.execute_correto))
 assert.ok(check.some(r=>r.tgname==='va_estoque_consumo'&&r.tgenabled==='O'))
 console.log(`${passed} cenários de estoque locais e verificador 023 aprovados: saldo/idempotência, consumo, duplicidade, escopo, catálogo, rollback de auditoria, imutabilidade e validade. Concorrência remota pendente.`)
}finally{await db.close()}
