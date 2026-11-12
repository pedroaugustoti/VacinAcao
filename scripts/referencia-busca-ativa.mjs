// Referência do SQL 011 criada somente em PostgreSQL local descartável.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(join(tmpdir(),'vacinacao-sql-review-tools/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite(),file=p=>readFileSync(new URL(p,import.meta.url),'utf8')
try{
 await db.exec(file('../tests/fixtures/sql-review.sql'))
 for(const p of ['006_proposta_correcao_rpcs_fase2.sql','012_legado_cadastro_auditado.sql','011_busca_ativa_incremental.sql'])await db.exec(file('../sql/'+p))
 const result=await db.exec(file('../sql/014_diagnostico_busca_ativa_somente_leitura.sql'))
 const diagnostic=result.flatMap(r=>r.rows).find(r=>r.diagnostico_busca_ativa)?.diagnostico_busca_ativa
 if(!diagnostic?.tabela)throw new Error('Diagnóstico local incompleto')
 mkdirSync('backups',{recursive:true})
 const path=process.argv[2]||'backups/referencia-011-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'
 writeFileSync(path,JSON.stringify(diagnostic,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify({arquivo:path,colunas:diagnostic.colunas.length,constraints:diagnostic.constraints.length,indices:diagnostic.indices.length,triggers:diagnostic.triggers.length,politicas:diagnostic.politicas.length,origem:'PostgreSQL local; não representa o Supabase remoto.'},null,2))
}finally{await db.close()}
