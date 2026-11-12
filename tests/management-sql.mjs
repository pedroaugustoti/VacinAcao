// SOMENTE LOCAL. Inclui papel service_role de fixture para conferir grants, sem chave/Auth Admin real.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(join(tmpdir(),'vacinacao-sql-review-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),file=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const admin='20000000-0000-0000-0000-000000000003',ubs='20000000-0000-0000-0000-000000000001',patient='20000000-0000-0000-0000-000000000004',unit='10000000-0000-0000-0000-000000000001',op='80000000-0000-0000-0000-000000000001',user='20000000-0000-0000-0000-000000000005'
let passed=0
async function identity(id){await db.exec('SET LOCAL ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id])}
async function as(id,fn){await db.exec('BEGIN');try{await identity(id);await fn();passed++}finally{await db.exec('ROLLBACK')}}
async function denied(fn,code='42501'){await db.exec('SAVEPOINT neg');let error;try{await fn()}catch(e){error=e}await db.exec('ROLLBACK TO neg;RELEASE neg');assert.ok(error);assert.equal(error.code,code,error.message)}
try{
 await db.exec(file('./fixtures/sql-review.sql'))
 await db.exec("CREATE ROLE service_role NOLOGIN; ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz; ALTER TABLE auth.users ADD COLUMN raw_app_meta_data jsonb DEFAULT '{}'; ALTER TABLE auth.users ADD COLUMN banned_until timestamptz; ALTER TABLE auth.users ADD COLUMN last_sign_in_at timestamptz; ALTER TABLE public.unidades_saude ADD COLUMN cidade text; ALTER TABLE public.unidades_saude ADD COLUMN telefone text")
 await db.exec('CREATE POLICY management_fixture_admin_units ON public.unidades_saude FOR SELECT TO authenticated USING(public.va_is_admin())')
 await db.query("INSERT INTO auth.users(id,email)VALUES($1,'demo-ubs@exemplo.invalid')",[ubs])
 for(const n of ['006_proposta_correcao_rpcs_fase2.sql','012_legado_cadastro_auditado.sql','011_busca_ativa_incremental.sql','019_estoque_demonstracao_incremental.sql','025_vinculo_paciente_auditado.sql','028_gestao_usuarios_incremental.sql'])await db.exec(file('../sql/'+n))
 assert.equal((await db.query('SELECT count(*)::int n FROM public.va_gestao_definicoes')).rows[0].n,10)
 await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_app_meta_data)VALUES($1,'demo-enfermeira@exemplo.invalid',now(),jsonb_build_object('va_operation_id',$2::text))",[user,op])
 await db.query("INSERT INTO public.va_gestao_operacoes(id,autor_id,tipo,email,nome,funcao,unidade_id,fingerprint)VALUES($1,$2,'equipe','demo-enfermeira@exemplo.invalid','DEMO Enfermeira','Enfermeira',$3,'fixture')",[op,admin,unit])
 await as(admin,async()=>{assert.equal((await db.query('SELECT public.va_gestao_auth_uuid($1) id',[op])).rows[0].id,user);await db.query('SELECT public.va_gestao_finalizar_equipe($1,$2)',[op,user]);await db.query('SELECT public.va_gestao_finalizar_equipe($1,$2)',[op,user]);const p=(await db.query('SELECT role,unidade_id,funcao FROM public.perfis WHERE id=$1',[user])).rows[0];assert.equal(p.role,'ubs');assert.equal(p.unidade_id,unit);assert.equal(p.funcao,'Enfermeira');assert.equal((await db.query("SELECT count(*)::int n FROM public.va_gestao_eventos WHERE acao='PROFISSIONAL_PROVISIONADO'")).rows[0].n,1)})
 for(const id of [ubs,patient])await as(id,async()=>{await denied(()=>db.query('SELECT public.va_gestao_finalizar_equipe($1,$2)',[op,user]));await denied(()=>db.query('SELECT public.va_gestao_auth_uuid($1)',[op]));await denied(()=>db.query("SELECT public.va_salvar_unidade_admin_v1(NULL,'DEMO unidade',NULL,NULL)"));await denied(()=>db.query('SELECT public.va_gestao_bloquear($1,true)',[admin]))})
 await as(admin,async()=>{const r=(await db.query("SELECT public.va_gestao_listar_equipe('demo-ubs@exemplo.invalid',$1,'pendente',1) data",[unit])).rows[0].data;assert.equal(r.total,1);assert.equal(r.rows[0].id,ubs);assert.equal((await db.query("SELECT public.va_gestao_listar_equipe(NULL,NULL,NULL,999) data")).rows[0].data.rows.length,0)})
 await as(admin,async()=>{await denied(()=>db.query('SELECT public.va_gestao_bloquear($1,true)',[admin]));const id=(await db.query("SELECT public.va_salvar_unidade_admin_v1(NULL,'DEMO unidade','DEMO','00000000000') id")).rows[0].id;await db.query("SELECT public.va_salvar_unidade_admin_v1($1,'DEMO editada','DEMO','00000000000')",[id]);assert.equal((await db.query('SELECT nome FROM public.unidades_saude WHERE id=$1',[id])).rows[0].nome,'DEMO editada')})
 await as(admin,async()=>{await db.query('SELECT public.va_gestao_bloquear($1,true)',[ubs]);await identity(ubs);assert.equal((await db.query('SELECT id FROM public.pacientes')).rows.length,0);await denied(()=>db.query("SELECT public.va_listar_busca_ativa_v1(NULL,20,0)"));await denied(()=>db.query("SELECT public.va_cadastrar_atendimento_v2($1,'DEMO','00000000099','00000000000','2000-01-01',NULL,ARRAY['2001-01-01'::date])",[unit]));await identity(admin);await db.query('SELECT public.va_gestao_bloquear($1,false)',[ubs]);await identity(ubs);assert.equal((await db.query('SELECT id FROM public.pacientes')).rows.length,1)})
 await as(admin,async()=>{await db.query('SELECT public.va_gestao_bloquear($1,true)',[patient]);await identity(patient);assert.equal((await db.query('SELECT id FROM public.pacientes')).rows.length,0);await identity(admin);assert.equal((await db.query('SELECT id FROM public.pacientes')).rows.length,1)})
 await as(patient,async()=>{await denied(()=>db.query('UPDATE public.va_gestao_operacoes SET estado=\'concluido\''));await denied(()=>db.query("INSERT INTO public.perfis(id,nome,role)VALUES($1,'DEMO','admin')",[user]))})
 const backup=await db.exec(file('../sql/030_backup_gestao_somente_leitura.sql'))
 assert.ok(backup.some(x=>x.rows?.[0]?.backup_gestao?.funcoes?.length>10),'Backup de metadados executável')
 await db.exec(file('../sql/029_contencao_gestao_sem_excluir.sql'))
 assert.equal((await db.query('SELECT count(*)::int n FROM public.va_gestao_definicoes')).rows[0].n,10)
 await as(admin,async()=>{await denied(()=>db.query("SELECT public.va_salvar_unidade_admin_v1(NULL,'DEMO suspensa',NULL,NULL)"));await denied(()=>db.query('SELECT * FROM public.va_gestao_definicoes'));assert.ok((await db.query('SELECT public.va_gestao_listar_equipe(NULL,NULL,NULL,1) data')).rows[0].data.total>0)})
 console.log(`${passed} cenários locais de gestão aprovados: autorização, retomada, UBS fixa, auditoria, unidades, bloqueio RLS/RPC e liberação. Auth Admin real e e-mails não executados.`)
}catch(e){console.error('Falha SQL local:',e.message,e.code||'');process.exitCode=1}finally{await db.close()}
