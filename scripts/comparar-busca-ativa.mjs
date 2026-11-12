// Comparação de metadados, sem conexão remota e sem executar DDL.
import {readFileSync,writeFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
export function unwrapDiagnostic(input){
 const outer=Array.isArray(input)?input[0]:input
 const s=outer?.diagnostico_busca_ativa||outer
 if(s?.origem!=='diagnostico_014'||s.versao!==1||!['colunas','funcoes','politicas','constraints','indices','triggers','privilegios_efetivos','membros','dependencias'].every(k=>Array.isArray(s[k])))throw new Error('Exige JSON completo do diagnóstico 014; HEAD/OpenAPI/snapshot 008 não substituem esse diagnóstico.')
 if(s.colunas.some(c=>!['nome','tipo','not_null','default','gerada','identidade','grants'].every(k=>Object.hasOwn(c,k))))throw new Error('Metadados de colunas incompletos; não inferir compatibilidade.')
 return s
}
// Preserva literais/identificadores entre aspas; normaliza apenas espaço externo.
export function normalizeSql(value){
 return String(value??'').split(/('(?:''|[^'])*'|"(?:""|[^"])*")/g).map((part,i)=>i%2?part:part.replace(/\bpublic\./g,'').replace(/\s+/g,' ')).join('').trim()
}
const indexDefinition=value=>normalizeSql(value).replace(/^CREATE (UNIQUE )?INDEX \S+ ON /i,'CREATE $1INDEX ON ')
const triggerDefinition=value=>normalizeSql(value).replace(/^CREATE (CONSTRAINT )?TRIGGER \S+ /i,'CREATE $1TRIGGER ')
const same=(a,b)=>normalizeSql(a)===normalizeSql(b)
export function compareMetadata(remoteInput,referenceInput){
 const r=unwrapDiagnostic(remoteInput),e=unwrapDiagnostic(referenceInput),items=[]
 const add=(recurso,status,detalhe)=>items.push({recurso,status,detalhe})
 if(!r.tabela){add('Tabela contatos_busca_ativa','ausente','Ausência no catálogo capturado por 014. Não inferida de HEAD.');return {origem:'comparacao_014_011',itens:items,prontoParaGerarIncremental:false}}
 add('Tabela contatos_busca_ativa','presente','Tabela encontrada no catálogo; registros não consultados.')
 add('RLS',r.tabela.rls_ativo?'compativel':'divergente',r.tabela.rls_ativo?'Ativo; adequação depende das políticas abaixo.':'Inativo: requer proposta de ativação e revisão de acesso.')
 for(const c of e.colunas){
  const actual=r.colunas.find(x=>x.nome===c.nome)
  if(!actual){add(`Coluna ${c.nome}`,'ausente','Adicionar coluna exigirá plano para linhas existentes; não inventar backfill.');continue}
  const differences=['tipo','not_null','default','gerada','identidade'].filter(k=>!same(actual[k],c[k]))
  add(`Coluna ${c.nome}`,differences.length?'divergente':'compativel',differences.length?`Diferem: ${differences.join(', ')}. Revisão sem alterar valores existentes.`:'Tipo, nulabilidade, default e geração compatíveis.')
 }
 for(const c of r.colunas.filter(c=>!e.colunas.some(x=>x.nome===c.nome)))add(`Coluna adicional ${c.nome}`,'adicional','Preservar; verificar se NOT NULL sem default impediria INSERT da RPC.')
 for(const [key,label,normalizer] of [['constraints','Constraint',normalizeSql],['indices','Índice',indexDefinition],['triggers','Trigger',triggerDefinition]]){
  const expected=(e[key]||[]).filter(x=>key!=='constraints'||x.tipo!=='n')
  const actual=(r[key]||[]).filter(x=>key!=='constraints'||x.tipo!=='n')
  for(const obj of expected){
   const equivalent=actual.find(x=>normalizer(x.definicao)===normalizer(obj.definicao))
   const named=actual.find(x=>x.nome===obj.nome)
   if(equivalent){
    const bad=(key==='constraints'&&equivalent.validada===false)||(key==='indices'&&(equivalent.valido===false||equivalent.pronto===false))||(key==='triggers'&&!['O','A'].includes(equivalent.habilitado))
    add(`${label} ${obj.nome}`,bad?'divergente':'compativel',bad?'Definição encontrada, mas objeto não validado/pronto/habilitado.':`Definição equivalente encontrada como ${equivalent.nome}. Não duplicar.`)
   }else add(`${label} ${obj.nome}`,named?'divergente':'ausente',named?'Mesmo nome com definição diferente: não substituir automaticamente.':'Não encontrada definição equivalente no catálogo.')
  }
  for(const obj of actual.filter(x=>!expected.some(y=>normalizer(x.definicao)===normalizer(y.definicao))))add(`${label} adicional ${obj.nome}`,'adicional','Preservar e revisar impacto/compatibilidade; não remover automaticamente.')
 }
 for(const p of e.politicas){
  const signature=x=>JSON.stringify({comando:x.comando,permissiva:x.permissiva,papeis:[...(x.papeis||[])].sort(),using:normalizeSql(x.using),check:normalizeSql(x.with_check)})
  const equivalent=r.politicas.find(x=>signature(x)===signature(p))
  add(`Política ${p.nome}`,equivalent?'compativel':r.politicas.some(x=>x.nome===p.nome)?'divergente':'ausente',equivalent?`Equivalente: ${equivalent.nome}.`:'Revisar USING/WITH CHECK e combinação permissiva/restritiva; não criar regra ampla.')
  for(const extra of r.politicas.filter(x=>signature(x)!==signature(p)))add(`Política adicional ${extra.nome}`,'adicional','Pode alterar acesso por OR/AND. Revisão obrigatória antes de conceder/restringir acesso.')
 }
 const names=['va_contatos_imutaveis','va_registrar_contato_v1','va_listar_busca_ativa_v1']
 for(const name of names){
  const expected=e.funcoes.find(x=>x.proname===name),actual=r.funcoes.filter(x=>x.proname===name)
  const exact=actual.find(x=>same(x.assinatura,expected.assinatura))
  const identical=exact&&(exact.fingerprint===expected.fingerprint||(typeof exact.definicao==='string'&&typeof expected.definicao==='string'&&exact.definicao.replace(/\r\n/g,'\n')===expected.definicao.replace(/\r\n/g,'\n')))
  add(`Função ${name}`,!actual.length?'ausente':!exact?'divergente':identical?'compativel':'divergente',!actual.length?'Não encontrada no catálogo completo 014.':!exact?'Overload/assinatura incompatível; não criar overload ambíguo.':identical?'Definição idêntica, admitindo somente normalização CRLF/LF.':'Corpo difere: examinar antes de qualquer CREATE OR REPLACE. Diferença textual não prova diferença semântica.')
  if(exact){
   const sensitive=exact.prosecdef!==expected.prosecdef||JSON.stringify(exact.proconfig)!==JSON.stringify(expected.proconfig)
   add(`Segurança da função ${name}`,sensitive?'divergente':'compativel','Comparação de SECURITY DEFINER e configuração; owner/grants ainda precisam ser revisados.')
   const acl=x=>JSON.stringify((x.grants||[]).filter(g=>['PUBLIC','anon','authenticated'].includes(g.grantee)).map(g=>({grantee:g.grantee,privilege:g.privilege,grantable:g.grantable})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))
   add(`Grants da função ${name}`,acl(exact)===acl(expected)?'compativel':'divergente','Grants explícitos dos papéis de API; considerar também herança.')
  }
 }
 for(const role of ['anon','authenticated']){
  const actual=(r.privilegios_efetivos||[]).find(x=>x.papel===role),expected=(e.privilegios_efetivos||[]).find(x=>x.papel===role)
  add(`Privilégios efetivos ${role}`,actual&&expected&&['select','insert','update','delete','truncate','trigger','references'].every(k=>actual[k]===expected[k])?'compativel':'divergente','SELECT/INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES efetivos, sem testar escrita.')
 }
 const blockers=items.filter(x=>['divergente','adicional'].includes(x.status)||x.recurso.startsWith('Coluna ')&&x.status==='ausente')
 return {origem:'comparacao_014_011',capturadoEm:r.capturado_em,itens:items,prontoParaGerarIncremental:blockers.length===0,limite:'Comparação de catálogo/texto, não homologação funcional ou prova de equivalência semântica. Objetos adicionais/divergentes bloqueiam geração automática.'}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const [remote,reference,out]=process.argv.slice(2)
  if(!remote||!reference||!out)throw new Error('Uso: node scripts/comparar-busca-ativa.mjs remoto-014.json referencia-011.json comparacao.json')
  const read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''))
  const report=compareMetadata(read(remote),read(reference))
  writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({arquivo:out,resumo:report.itens.reduce((acc,x)=>{acc[x.status]=(acc[x.status]||0)+1;return acc},{}),prontoParaGerarIncremental:report.prontoParaGerarIncremental,execucaoRemota:false},null,2))
 }catch(error){console.error(error instanceof SyntaxError?'JSON inválido; conteúdo não exibido.':error.message);process.exitCode=1}
}
