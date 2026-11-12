// Teste LOCAL com identidades sintéticas; não cria contas Auth reais nem envia mensagens.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(join(tmpdir(),'vacinacao-sql-review-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),file=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const admin='20000000-0000-0000-0000-000000000003',ubs='20000000-0000-0000-0000-000000000001',patient='20000000-0000-0000-0000-000000000005',p='30000000-0000-0000-0000-000000000002',other='30000000-0000-0000-0000-000000000001'
let passed=0
async function as(user,action){await db.exec('BEGIN;SET LOCAL ROLE authenticated');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);await action();passed++}finally{await db.exec('ROLLBACK')}}
async function denied(action,code){await db.exec('SAVEPOINT neg');let e;try{await action()}catch(x){e=x}await db.exec('ROLLBACK TO neg;RELEASE neg');assert.ok(e);assert.equal(e.code,code)}
const link=(id=patient,email='demo-paciente@exemplo.invalid',pid=p)=>db.query("SELECT public.va_vincular_conta_paciente_v1($1,$2,$3,'DEMO conferência institucional presencial',true) id",[pid,id,email])
try{
 await db.exec(file('./fixtures/sql-review.sql'));await db.exec(file('../sql/006_proposta_correcao_rpcs_fase2.sql'))
 await db.exec("ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('"+patient+"','demo-paciente@exemplo.invalid',now()),('"+admin+"','demo-admin@exemplo.invalid',now()); INSERT INTO public.pacientes(id,unidade_id,nome,cpf,whatsapp,data_acidente) VALUES('"+p+"','10000000-0000-0000-0000-000000000001','DEMO paciente novo','00000000091','00000000000','2000-01-01'); INSERT INTO public.esquemas_vacinais(paciente_id,numero_dose,data_prevista) VALUES('"+p+"',1,'2000-01-02')")
 await db.exec(file('../sql/025_vinculo_paciente_auditado.sql'))
 await as(admin,async()=>{assert.equal((await link()).rows[0].id,p);await link();assert.equal((await db.query("SELECT count(*)::int n FROM public.historico_pacientes WHERE acao='VINCULO_CONTA_PACIENTE'")).rows[0].n,1)})
 await as(ubs,async()=>{await denied(()=>link(),'42501')})
 await as(patient,async()=>{await denied(()=>link(),'42501');await denied(()=>db.query('UPDATE public.pacientes SET user_id=$1 WHERE id=$2',[patient,p]),'42501');await denied(()=>db.query("INSERT INTO public.perfis(id,nome,role)VALUES($1,'DEMO','admin')",[patient]),'42501')})
 await as(admin,async()=>{await denied(()=>link(admin,'demo-admin@exemplo.invalid'),'22023');await denied(()=>link(patient,'outro@exemplo.invalid'),'22023');await denied(()=>db.query("SELECT public.va_vincular_conta_paciente_v1($1,$2,'demo-paciente@exemplo.invalid','DEMO motivo de teste',false)",[p,patient]),'22023')})
 await as(admin,async()=>{await link();await denied(()=>link(patient,'demo-paciente@exemplo.invalid',other),'23505')})
 await as(admin,async()=>{await db.exec("RESET ROLE; UPDATE auth.users SET email_confirmed_at=NULL WHERE id='"+patient+"'; SET LOCAL ROLE authenticated");await denied(()=>link(),'22023')})
 await as(admin,async()=>{await db.exec("RESET ROLE; CREATE FUNCTION public.fail_link_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Falha sintética'; END$$; CREATE TRIGGER fail_link_audit BEFORE INSERT ON public.historico_pacientes FOR EACH ROW EXECUTE FUNCTION public.fail_link_audit(); SET LOCAL ROLE authenticated");await denied(()=>link(),'P0001');assert.equal((await db.query('SELECT user_id FROM public.pacientes WHERE id=$1',[p])).rows[0].user_id,null)})
 // Vínculo persiste SOMENTE no banco local para testar chamadas diretas como paciente.
 await db.exec('BEGIN;SET LOCAL ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[admin]);await link();await db.exec('COMMIT')
 await as(patient,async()=>{assert.deepEqual((await db.query('SELECT id FROM public.pacientes')).rows.map(r=>r.id),[p]);assert.equal((await db.query('SELECT id FROM public.esquemas_vacinais')).rows.length,1);assert.equal((await db.query('SELECT id FROM public.pacientes WHERE id=$1',[other])).rows.length,0);assert.equal((await db.query('SELECT id FROM public.esquemas_vacinais WHERE paciente_id=$1',[other])).rows.length,0);assert.equal((await db.query('SELECT id FROM public.historico_pacientes')).rows.length,0);assert.equal((await db.query('SELECT id FROM public.perfis')).rows.length,0);assert.deepEqual((await db.query('SELECT id FROM public.unidades_saude')).rows.map(r=>r.id),['10000000-0000-0000-0000-000000000001'])})
 console.log(`${passed} cenários de vínculo/RLS locais aprovados. Login real, triggers Auth remotos e API remota com paciente continuam pendentes.`)
}finally{await db.close()}
