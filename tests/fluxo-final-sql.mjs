// Compatibilidade LOCAL 006/011/012/019/025; nenhuma conexão ou conta remota.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(join(tmpdir(),'vacinacao-sql-review-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),file=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const admin='20000000-0000-0000-0000-000000000003',ubs='20000000-0000-0000-0000-000000000001',patient='20000000-0000-0000-0000-000000000005',unit='10000000-0000-0000-0000-000000000001'
const identity=async id=>{await db.exec('SET LOCAL ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id])}
try{
 await db.exec(file('./fixtures/sql-review.sql'))
 for(const name of ['006_proposta_correcao_rpcs_fase2.sql','012_legado_cadastro_auditado.sql','011_busca_ativa_incremental.sql','019_estoque_demonstracao_incremental.sql'])await db.exec(file('../sql/'+name))
 await db.exec("ALTER TABLE auth.users ADD COLUMN email_confirmed_at timestamptz; INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('"+patient+"','demo-final@vacinacao.invalid',now())")
 await db.exec(file('../sql/025_vinculo_paciente_auditado.sql'))
 await db.exec('BEGIN');await identity(admin)
 const vaccine=(await db.query("SELECT public.va_salvar_vacina_v1(NULL,'DEMO final','DEMO-FINAL',true) id")).rows[0].id
 const lot=(await db.query("SELECT public.va_cadastrar_lote_v1($1,$2,'DEMO-FINAL','Fabricante DEMO','2099-01-01') id",[vaccine,unit])).rows[0].id
 await db.query("SELECT public.va_movimentar_estoque_v1($1,2,'Entrada sintética final','70000000-0000-0000-0000-000000000001')",[lot])
 const p=(await db.query("SELECT public.va_cadastrar_atendimento_v2($1,'DEMO FINAL','00000000093','00000000000','2001-01-01',NULL,ARRAY['2002-01-01'::date,'2002-02-01'::date]) id",[unit])).rows[0].id
 await db.query("SELECT public.va_vincular_conta_paciente_v1($1,$2,'demo-final@vacinacao.invalid','Conferência institucional sintética final',true)",[p,patient])
 await identity(patient)
 assert.deepEqual((await db.query('SELECT id FROM public.pacientes')).rows.map(r=>r.id),[p])
 const before=(await db.query('SELECT id,data_prevista FROM public.esquemas_vacinais ORDER BY numero_dose')).rows
 assert.equal(before.length,2)
 await identity(ubs)
 const app=(await db.query("SELECT public.va_registrar_aplicacao_v1($1,$2,$3,$4,'2003-01-01T15:00:00Z','IM','DEMO',0.5,'mL','DEMO') id",[p,before[0].id,vaccine,lot])).rows[0].id
 assert.equal((await db.query('SELECT saldo FROM public.va_estoque_saldos WHERE lote_id=$1',[lot])).rows[0].saldo,1)
 assert.equal((await db.query('SELECT delta FROM public.va_estoque_movimentos WHERE aplicacao_id=$1',[app])).rows[0].delta,-1)
 const queue=(await db.query("SELECT * FROM public.va_listar_busca_ativa_v1('DEMO FINAL',20,0)")).rows
 assert.equal(queue.length,1);assert.equal(queue[0].esquema_id,before[1].id)
 const args=[p,before[1].id,'70000000-0000-0000-0000-000000000002']
 const contact=()=>db.query("SELECT public.va_registrar_contato_v1($1,$2,'telefone','sem_resposta','SIMULAÇÃO SEM CONTATO REAL','2003-01-01T15:00:00Z',NULL,$3) id",args)
 assert.equal((await contact()).rows[0].id,(await contact()).rows[0].id)
 await identity(patient)
 const after=(await db.query('SELECT id,data_prevista,status FROM public.esquemas_vacinais ORDER BY numero_dose')).rows
 assert.deepEqual(after.map(d=>({id:d.id,data_prevista:d.data_prevista})),before)
 assert.equal(after[0].status,'aplicada');assert.equal(after[1].status,'pendente')
 assert.equal((await db.query('SELECT id FROM public.aplicacoes_vacinais')).rows[0].id,app)
 assert.equal((await db.query('SELECT id FROM public.contatos_busca_ativa')).rows.length,0)
 assert.equal((await db.query('SELECT lote_id FROM public.va_estoque_saldos')).rows.length,0)
 assert.equal((await db.query('SELECT id FROM public.unidades_saude')).rows.length,1)
 await db.exec('ROLLBACK')
 console.log('PASS LOCAL integrado: catálogo/entrada -> cadastro/cronograma -> vínculo -> aplicação/baixa -> atraso/contato -> leitura do paciente atualizada; prescrição preservada. Não comprova persistência ou login remoto.')
}finally{await db.close()}
