// Não imprime chaves. Verifica somente artefatos do navegador após build.
import {readdirSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
const files=[]
function walk(p){for(const f of readdirSync(p,{withFileTypes:true})){const path=join(p,f.name);if(f.isDirectory())walk(path);else if(/\.(js|map)$/.test(path))files.push(path)}}
walk('.next/static')
const values=['SUPABASE_SECRET_KEY','VACINACAO_GESTAO_ESCRITA',process.env.SUPABASE_SECRET_KEY].filter(Boolean)
const count=files.filter(p=>{const code=readFileSync(p,'utf8');return values.some(v=>code.includes(v))}).length
console.log(JSON.stringify({arquivosNavegadorVerificados:files.length,arquivosComIdentificadorOuSegredoPrivado:count,segredoExibido:false,limite:'Varredura de valores/nomes conhecidos; não é auditoria universal de segredos.'}))
if(count)process.exitCode=1
