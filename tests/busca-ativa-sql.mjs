// Somente PostgreSQL local descartável. Não lê .env e não envia mensagens.
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(join(tmpdir(),'vacinacao-sql-review-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),file=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const a='20000000-0000-0000-0000-000000000001',b='20000000-0000-0000-0000-000000000002',admin='20000000-0000-0000-0000-000000000003',patient='20000000-0000-0000-0000-000000000004',p='30000000-0000-0000-0000-000000000001',dose='40000000-0000-0000-0000-000000000001'
let passed=0
async function run(label,user,action){await db.exec('BEGIN; SET LOCAL ROLE authenticated');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);await action();passed++;console.log('PASS BUSCA ATIVA SQL:',label)}finally{await db.exec('ROLLBACK')}}
async function denied(action,code='42501'){await db.exec('SAVEPOINT neg');let error;try{await action()}catch(e){error=e}await db.exec('ROLLBACK TO neg; RELEASE neg');assert.ok(error,'Esperava rejeição');assert.equal(error.code,code,error.message)}
const queue=()=>db.query('SELECT * FROM public.va_listar_busca_ativa_v1(NULL,20,0)')
const contact=(key='70000000-0000-0000-0000-000000000001',result='retorno_agendado',next='2003-01-02',schema=dose)=>db.query("SELECT public.va_registrar_contato_v1($1,$2,'telefone',$3,'SIMULAÇÃO LOCAL','2003-01-01T15:00:00Z',$4,$5) AS id",[p,schema,result,next,key])
try{
 await db.exec(file('./fixtures/sql-review.sql'))
 await db.exec(file('../sql/006_proposta_correcao_rpcs_fase2.sql'))
 await db.exec(file('../sql/011_busca_ativa_incremental.sql'))
 await db.exec(file('../sql/012_legado_cadastro_auditado.sql'))
 await run('agrupa duas doses por paciente e seleciona a mais antiga',a,async()=>{
   // Outra dose criada apenas como fixture local pelo dono antes de voltar ao papel.
   await db.exec('RESET ROLE')
   await db.query("INSERT INTO public.esquemas_vacinais(paciente_id,numero_dose,data_prevista)VALUES($1,2,'2002-02-01')",[p])
   await db.exec('SET LOCAL ROLE authenticated')
   const rows=(await queue()).rows;assert.equal(rows.length,1);assert.equal(rows[0].esquema_id,dose);assert.equal(Number(rows[0].doses_atrasadas),2);assert.equal(Number(rows[0].total_pacientes),1)
 })
 await run('contato persiste, identifica demonstração/responsável e é idempotente',a,async()=>{
   const first=(await contact()).rows[0].id;assert.equal((await contact()).rows[0].id,first)
   const history=(await db.query('SELECT * FROM public.contatos_busca_ativa WHERE id=$1',[first])).rows[0]
   assert.equal(history.contexto,'demonstracao');assert.equal(history.responsavel_id,a)
   assert.equal((await db.query("SELECT count(*)::int AS n FROM public.historico_pacientes WHERE acao='CONTATO_BUSCA_ATIVA'")).rows[0].n,1)
   assert.equal((await queue()).rows[0].ultimo_resultado,'retorno_agendado')
   await denied(()=>contact(undefined,'orientado'), '22023')
 })
 await run('UBS B não lê fila de A nem registra contato de A',b,async()=>{assert.equal((await queue()).rows.length,0);await denied(()=>contact());assert.equal((await db.query('SELECT id FROM public.contatos_busca_ativa')).rows.length,0)})
 await run('paciente não lê notas internas nem registra/consulta fila profissional',patient,async()=>{await denied(()=>queue());await denied(()=>contact());assert.equal((await db.query('SELECT id FROM public.contatos_busca_ativa')).rows.length,0)})
 await run('admin acessa fila e registra contato conforme escopo central',admin,async()=>{assert.equal((await queue()).rows.length,1);await contact()})
 await run('valida resultado/retorno e impede alteração direta do histórico',a,async()=>{
   await denied(()=>contact(undefined,'retorno_agendado',null),'22023')
   await denied(()=>contact(undefined,'inexistente'),'22023')
   await contact()
   await denied(()=>db.query('UPDATE public.contatos_busca_ativa SET observacoes=$1',['alteração']))
   await denied(()=>db.query('DELETE FROM public.contatos_busca_ativa'))
   await db.exec('RESET ROLE')
   await denied(()=>db.query('UPDATE public.contatos_busca_ativa SET observacoes=$1',['alteração pelo dono']))
   await db.exec('SET LOCAL ROLE authenticated')
 })
 await run('falha na auditoria reverte o contato inteiro',a,async()=>{
   await db.exec("RESET ROLE; CREATE FUNCTION public.local_contact_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Falha sintética'; END $$; CREATE TRIGGER local_contact_audit_fail BEFORE INSERT ON public.historico_pacientes FOR EACH ROW EXECUTE FUNCTION public.local_contact_audit_fail(); SET LOCAL ROLE authenticated")
   await denied(()=>contact(),'P0001')
   assert.equal((await db.query('SELECT id FROM public.contatos_busca_ativa')).rows.length,0)
 })
 await run('legado encaminha ao cadastro auditado com cronograma configurável',a,async()=>{
   const id=(await db.query("SELECT public.va_cadastrar_atendimento('DEMO LEGADO','00000000008','00000000000','2001-01-01',ARRAY['2002-01-01'::date,'2002-01-04'::date]) AS id")).rows[0].id
   assert.equal((await db.query('SELECT count(*)::int AS n FROM public.esquemas_vacinais WHERE paciente_id=$1',[id])).rows[0].n,2)
   assert.equal((await db.query("SELECT count(*)::int AS n FROM public.historico_pacientes WHERE paciente_id=$1 AND acao='CADASTRO_INICIAL'",[id])).rows[0].n,1)
 })
 await db.exec('BEGIN; SET LOCAL ROLE authenticated')
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[a])
 const saved=(await contact()).rows[0].id
 await db.exec('COMMIT')
 await db.exec(file('../sql/013_desativar_busca_ativa_sem_excluir_dados.sql'))
 assert.equal((await db.query('SELECT id FROM public.contatos_busca_ativa WHERE id=$1',[saved])).rows.length,1)
 await run('reversão 013 preserva contatos e bloqueia disponibilidade',a,async()=>{await denied(()=>queue());await denied(()=>contact());await denied(()=>db.query('SELECT id FROM public.contatos_busca_ativa'))})
 // Estado equivalente às permissões recebidas no diagnóstico 014.
 await db.exec('BEGIN')
 await db.exec("ALTER FUNCTION public.va_cadastrar_atendimento_v2(uuid,text,text,text,date,date,date[]) SET search_path TO public")
 await denied(()=>db.exec(file('../sql/015_habilitar_busca_ativa_existente.sql')),'P0001')
 await db.exec('ROLLBACK')
 passed++;console.log('PASS BUSCA ATIVA SQL: 015 aborta se pré-requisito clínico divergir')
 await db.exec('BEGIN; CREATE ROLE local_contact_shared NOLOGIN; GRANT local_contact_shared TO authenticated; GRANT UPDATE(observacoes) ON public.contatos_busca_ativa TO local_contact_shared')
 await denied(()=>db.exec(file('../sql/015_habilitar_busca_ativa_existente.sql')),'P0001')
 await db.exec('ROLLBACK')
 assert.equal((await db.query("SELECT has_table_privilege('authenticated','public.contatos_busca_ativa','SELECT') AS allowed")).rows[0].allowed,false)
 passed++;console.log('PASS BUSCA ATIVA SQL: 015 aborta e reverte grants se houver escrita herdada por coluna')
 await db.exec(file('../sql/015_habilitar_busca_ativa_existente.sql'))
 await db.exec(file('../sql/015_habilitar_busca_ativa_existente.sql'))
 const post=(await db.exec(file('../sql/017_verificar_permissoes_pos_migracao.sql'))).flatMap(x=>x.rows)
 assert.equal(post.length,17);assert.ok(post.every(x=>x.aprovado===true))
 passed++;console.log('PASS BUSCA ATIVA SQL: 017 produz 17 verificações de privilégios aprovadas')
 await run('015 repetível habilita fila/leitura/registro preservando contato existente',a,async()=>{
  assert.equal((await db.query('SELECT id FROM public.contatos_busca_ativa WHERE id=$1',[saved])).rows.length,1)
  assert.equal((await queue()).rows.length,1)
  assert.equal((await contact()).rows[0].id,saved)
  await denied(()=>db.query('DELETE FROM public.contatos_busca_ativa'))
 })
 await run('015 mantém isolamento UBS B e paciente',b,async()=>{assert.equal((await queue()).rows.length,0);await denied(()=>contact())})
 await run('015 mantém rejeição de paciente nas RPCs profissionais',patient,async()=>{await denied(()=>queue());await denied(()=>contact())})
 await db.exec(file('../sql/016_reverter_permissoes_015.sql'))
 assert.equal((await db.query('SELECT id FROM public.contatos_busca_ativa WHERE id=$1',[saved])).rows.length,1)
 await run('016 restaura indisponibilidade sem excluir registros',a,async()=>{await denied(()=>queue());await denied(()=>contact());await denied(()=>db.query('SELECT id FROM public.contatos_busca_ativa'))})
 console.log(`${passed} cenários busca ativa/legado aprovados LOCALMENTE. Sem execução remota.`)
}finally{await db.close()}
