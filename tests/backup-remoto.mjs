// Validação LOCAL do snapshot capturado; nenhuma conexão Supabase.
import {readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'
import {gerarRollback} from '../scripts/gerar-rollback-sql.mjs'
const input=JSON.parse(readFileSync(process.argv[2]||'backups/antes-006-r2.json','utf8').replace(/^\uFEFF/,''))
const s=Array.isArray(input)?input[0].backup:input.backup||input
assert.equal(s.funcoes.length,8);assert.equal(s.tabelas.length,9);assert.equal(s.politicas.length,26);assert.equal(s.triggers.length,2)
const {PGlite}=await import(pathToFileURL(join(tmpdir(),'vacinacao-sql-review-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite()
const names=['va_cadastrar_atendimento_v2','va_atualizar_paciente_v1','va_registrar_aplicacao_v1','va_cadastrar_atendimento']
try{
 await db.exec(readFileSync(new URL('./fixtures/sql-review.sql',import.meta.url),'utf8'))
 await db.exec(s.funcoes.find(f=>f.proname==='va_cadastrar_atendimento').definicao+';')
 await db.exec(readFileSync(new URL('../sql/006_proposta_correcao_rpcs_fase2.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../sql/012_legado_cadastro_auditado.sql',import.meta.url),'utf8'))
 await db.exec(gerarRollback(input,{incluirLegado:true}))
 for(const f of s.funcoes.filter(f=>names.includes(f.proname))){
  const hash=(await db.query('SELECT md5(pg_get_functiondef($1::regprocedure)) AS hash',[f.assinatura])).rows[0].hash
  assert.equal(hash,f.fingerprint,`Definição não restaurada: ${f.proname}`)
  const grants=(await db.query("SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=$1::regprocedure",[f.assinatura])).rows
  for(const g of f.grants.filter(g=>['PUBLIC','anon','authenticated'].includes(g.grantee)))assert.ok(grants.some(a=>a.grantee===g.grantee&&a.privilege===g.privilege&&a.grantable===g.grantable))
 }
 for(const t of s.tabelas){
  const grants=(await db.query("SELECT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type AS privilege,a.is_grantable AS grantable FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=$1::regclass",[t.identidade])).rows
  const expected=t.grants.filter(g=>['PUBLIC','anon','authenticated'].includes(g.grantee))
  const actual=grants.filter(g=>['PUBLIC','anon','authenticated'].includes(g.grantee))
  assert.deepEqual(actual.map(g=>JSON.stringify(g)).sort(),expected.map(g=>JSON.stringify({grantee:g.grantee,privilege:g.privilege,grantable:g.grantable})).sort(),t.identidade)
 }
 console.log('PASS snapshot remoto: 8 funções, 9 tabelas, 26 políticas, 2 triggers; rollback 006+012 válido no PostgreSQL local, 4 fingerprints restaurados e ACLs alvo conferidas nas 9 tabelas. Sem execução remota.')
}finally{await db.close()}
