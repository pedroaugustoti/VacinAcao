import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const raw=readFileSync('backups/diagnostico-018.json','utf8'),parsed=JSON.parse(raw.replace(/^\uFEFF/,'')),d=(Array.isArray(parsed)?parsed[0]:parsed).diagnostico_estoque
if(!d?.colunas||!d?.funcoes)throw new Error('Diagnóstico incompleto')
const report={capturado_em:d.capturado_em,tabelas:d.tabelas_publicas,modeloEstoqueIdentificado:d.tabelas_publicas.filter(t=>/estoque|saldo|moviment/i.test(t)),sha256:createHash('sha256').update(raw).digest('hex'),funcoes:d.funcoes.map(f=>({assinatura:f.assinatura,hashNormalizado:createHash('md5').update(f.definicao.replaceAll('\r\n','\n')).digest('hex')})),segredosPadraoDetectados:/sb_secret_|BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{15,}\./.test(raw)}
writeFileSync('backups/comparacao-018.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
console.log(JSON.stringify({aclBusca:d.funcoes.filter(f=>/va_listar_busca|va_registrar_contato/.test(f.assinatura)).map(f=>({assinatura:f.assinatura,acl:f.acl})),permissoesClinicas:d.grants.filter(g=>['pacientes','esquemas_vacinais','aplicacoes_vacinais','historico_pacientes'].includes(g.table_name)&&g.grantee==='authenticated').map(g=>({tabela:g.table_name,privilegio:g.privilege_type}))},null,2))
