// Inspeção local: não imprime corpos SQL nem valores sensíveis.
import {readFileSync,writeFileSync,realpathSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {relative} from 'node:path'
import {spawnSync} from 'node:child_process'
const path=process.argv[2]||'backups/antes-006-r2.json'
try{
 const absolute=realpathSync(path),raw=readFileSync(absolute),text=raw.toString('utf8').replace(/^\uFEFF/,'')
 const parsed=JSON.parse(text),s=Array.isArray(parsed)?parsed[0]?.backup:parsed.backup||parsed
 const known=new Set(['versao','capturado_em','postgres','funcoes','tabelas','politicas','constraints','indices','triggers','papeis','membros','default_acls'])
 if(s?.versao!==1||Object.keys(s).some(k=>!known.has(k)))throw new Error('Envelope ou campos inesperados: revisar antes de considerar backup de metadados')
 const patterns={jwt:/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/,secretKey:/sb_secret_[A-Za-z0-9_-]{10,}/,privateKey:/BEGIN [A-Z ]*PRIVATE KEY/,credentialLiteral:/(?:password|senha|service_role_key|api_key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i}
 const found=Object.entries(patterns).filter(([,regex])=>regex.test(text)).map(([label])=>label)
 if(found.length)throw new Error(`Padrões sensíveis detectados (${found.join(', ')}). Nenhum valor foi impresso.`)
 const rel=relative(process.cwd(),absolute)
 const ignored=spawnSync('git',['check-ignore','--',rel],{encoding:'utf8'}).status===0
 const tracked=spawnSync('git',['ls-files','--error-unmatch','--',rel],{encoding:'utf8'}).status===0
 if(tracked||!ignored)throw new Error('Arquivo precisa estar ignorado e não rastreado pelo Git')
 const report={arquivo:rel,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex'),versao:s.versao,funcoes:s.funcoes?.length,tabelas:s.tabelas?.length,politicas:s.politicas?.length,triggers:s.triggers?.length,ignorado:true,rastreado:false,padroesSensiveisEncontrados:found,limite:'Varredura de padrões e estrutura; não é prova universal de ausência de segredos em código SQL.'}
 if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n',{flag:'wx'})
 console.log(JSON.stringify(report,null,2))
}catch(error){console.error(error instanceof SyntaxError?'JSON inválido ou truncado. Nenhum trecho do conteúdo foi impresso.':error.message);process.exitCode=1}
