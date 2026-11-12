// Gera arquivo local revisável a partir do JSON do SQL 008. Não conecta ao banco.
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const functions = ['va_cadastrar_atendimento_v2','va_atualizar_paciente_v1','va_registrar_aplicacao_v1']
const tables = ['unidades_saude','perfis','pacientes','esquemas_vacinais','vacinas','lotes_vacinas','aplicacoes_vacinais','historico_pacientes','notificacoes']
const targets = new Set(['PUBLIC','anon','authenticated'])
const qi = value => `"${String(value).replaceAll('"','""')}"`
const qs = value => `'${String(value).replaceAll("'","''")}'`
const role = value => value === 'PUBLIC' ? 'PUBLIC' : qi(value)
const privileges = new Set(['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','EXECUTE','MAINTAIN'])

export function gerarRollback(input, { incluirLegado = false } = {}) {
  const snapshot = Array.isArray(input) ? input[0]?.backup : input.backup || input
  if (snapshot?.versao !== 1) throw new Error('Snapshot 008 versão 1 obrigatório')
  const selected = [...functions, ...(incluirLegado ? ['va_cadastrar_atendimento'] : [])].map(name => {
    const matches = snapshot.funcoes?.filter(f=>f.proname===name) || []
    if (matches.length !== 1) throw new Error(`Função ausente ou overload não revisado: ${name}`)
    const f=matches[0]
    if (!f.assinatura?.startsWith(`public.${name}(`) || !f.definicao?.startsWith(`CREATE OR REPLACE FUNCTION public.${name}(`)) throw new Error('Identidade de função incompatível')
    return f
  })
  const relations = tables.map(name => {
    const table=snapshot.tabelas?.find(t=>t.identidade===`public.${name}`)
    if (!table) throw new Error(`Tabela ausente: ${name}`)
    return table
  })
  const owners=new Set([...selected,...relations].map(o=>o.proprietario))
  if (owners.size!==1 || targets.has([...owners][0])) throw new Error('Proprietários distintos ou papel de API proprietário exigem revisão manual')
  const owner=[...owners][0]
  const sql=[
    '-- ROLLBACK DE CÓDIGO/ACL, NÃO DE DADOS. GERADO LOCALMENTE: REVISAR ANTES DE APROVAR.',
    '-- Restaurar funções antigas também restaura as falhas conhecidas. Preferir correção adiante.',
    '-- Congelar mudanças concorrentes de código/grants; não usar após mudanças independentes.',
    'BEGIN;', "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '60s';",
    `DO $owner$ BEGIN IF current_user <> ${qs(owner)} THEN RAISE EXCEPTION 'Executar como proprietário original, sem service_role'; END IF; END; $owner$;`,
  ]
  const grant = (g,object,column) => {
    if (!targets.has(g.grantee)) return
    // Cadeias de concessão precisam ser restauradas na ordem/identidade correta.
    // Não produzir um rollback aparentemente completo se isso não puder ser feito.
    if (g.grantor!==owner || g.grantable) throw new Error('Grantor não proprietário ou WITH GRANT OPTION exige rollback manual da cadeia de grants')
    if (!privileges.has(g.privilege)) throw new Error('Privilégio desconhecido no snapshot')
    sql.push(`GRANT ${g.privilege}${column ? ` (${qi(column)})` : ''} ON ${object} TO ${role(g.grantee)};`)
  }
  for (const f of selected) {
    sql.push(`DO $owner$ BEGIN IF pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid=${qs(f.assinatura)}::regprocedure)) IS DISTINCT FROM ${qs(owner)} THEN RAISE EXCEPTION 'Proprietário divergiu'; END IF; END; $owner$;`)
    sql.push(f.definicao.trim().replace(/;?$/, ';'))
    sql.push(`REVOKE ALL ON FUNCTION ${f.assinatura} FROM PUBLIC,anon,authenticated;`)
    for (const g of f.grants || []) grant(g,`FUNCTION ${f.assinatura}`)
  }
  for (const t of relations) {
    sql.push(`DO $owner$ BEGIN IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid=${qs(t.identidade)}::regclass)) IS DISTINCT FROM ${qs(owner)} THEN RAISE EXCEPTION 'Proprietário de tabela divergiu'; END IF; END; $owner$;`)
    sql.push(`REVOKE ALL ON TABLE ${t.identidade} FROM PUBLIC,anon,authenticated;`)
    sql.push(`DO $cols$ DECLARE c record; BEGIN FOR c IN SELECT attname FROM pg_attribute WHERE attrelid=${qs(t.identidade)}::regclass AND attnum>0 AND NOT attisdropped LOOP EXECUTE format('REVOKE SELECT (%I),INSERT (%I),UPDATE (%I),REFERENCES (%I) ON TABLE ${t.identidade} FROM PUBLIC,anon,authenticated',c.attname,c.attname,c.attname,c.attname); END LOOP; END; $cols$;`)
    for (const g of t.grants || []) grant(g,`TABLE ${t.identidade}`)
    for (const g of t.column_grants || []) grant(g,`TABLE ${t.identidade}`,g.column)
  }
  sql.push("NOTIFY pgrst,'reload schema';",'COMMIT;')
  return sql.join('\n')+'\n'
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const [source,destination,option]=process.argv.slice(2)
    if (!source||!destination) throw new Error('Uso: node scripts/gerar-rollback-sql.mjs backups/antes.json backups/rollback.sql')
    if(option && option!=='--incluir-legado') throw new Error('Opção desconhecida')
    const sql=gerarRollback(JSON.parse(readFileSync(source,'utf8').replace(/^\uFEFF/,'')),{incluirLegado:option==='--incluir-legado'})
    writeFileSync(destination,sql,{encoding:'utf8',flag:'wx'})
    console.log('Rollback local gerado. Nenhuma conexão ou execução SQL realizada.')
  } catch(error) { console.error(error instanceof SyntaxError?'JSON inválido ou truncado. Nenhum trecho do conteúdo foi impresso.':error.message); process.exitCode=1 }
}
