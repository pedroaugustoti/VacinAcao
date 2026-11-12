// Integração opt-in com contas reais de demonstração, nunca service_role.
// --check: configuração básica; --read-admin: parcial sem RPC/escrita;
// --read: matriz completa de leitura; --write: RPCs sintéticas opt-in.
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { exigirUuidRetornado } from '../src/lib/rpc-contracts.ts'
import {validateBase,accountReadiness,requireValue} from './helpers/homolog-config.mjs'
import {runAdminRead} from './helpers/admin-read.mjs'

const env = process.env
const mode = process.argv[2] || '--check'
const expectedUrl = 'https://nfwfogaklwbrabozqjan.supabase.co'
function requireConfig(name) {
  assert.ok(env[name]?.trim(), `Configuração ausente: ${name}. Use .env.homolog.local; não envie segredos no chat.`)
  return env[name].trim()
}
function publicKeyOnly(key) {
  if (key.startsWith('sb_publishable_')) return
  let role
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role } catch { /* rejeita formato desconhecido */ }
  assert.equal(role, 'anon', 'Somente chave pública anon/publishable; chave administrativa é proibida.')
}
function ok(result, step) {
  assert.equal(result.error, null, `${step}: falhou (${result.error?.code || result.error?.status || 'sem código'}).`)
  return result.data
}
function denied(result, step) {
  assert.ok(result.error, `${step}: RPC permitiu operação proibida. Interrompido; não remover evidências.`)
  // Erros de contrato, catálogo ou duplicidade não comprovam autorização.
  assert.equal(result.error.code, '42501', `${step}: rejeição inconclusiva (${result.error.code}); revisar corpo da função antes de aceitar como teste de autorização.`)
  console.log(`PASS rejeição de autorização: ${step} [42501]`)
}
function noRows(result, step) {
  if (result.error) assert.equal(result.error.code, '42501', `${step}: erro inconclusivo (${result.error.code})`)
  else assert.equal(result.data?.length, 0, `${step}: dados indevidamente visíveis`)
  console.log(`PASS isolamento de leitura: ${step}`)
}
async function main() {
  assert.ok(['--check','--read-admin','--read','--write'].includes(mode), 'Modo inválido')
  const base=validateBase(env)
  if(mode==='--check'){
    console.log('PASS configuração básica local: URL do projeto autorizado e formato de chave pública. Conectividade e contas ainda não testadas.')
    console.log(JSON.stringify(accountReadiness(env),null,2))
    console.log('PENDENTE: isolamento e fluxo completo exigem contas/fixtures próprias; nenhuma conta ausente foi aprovada.')
    return
  }
  if(mode==='--read-admin'){
    const email=requireValue(env,'HOMOLOG_ADMIN_EMAIL')
    requireValue(env,'HOMOLOG_ADMIN_PASSWORD')
    const client=createClient(base.url,base.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})}})
    const report=await runAdminRead(client,{email,password:env.HOMOLOG_ADMIN_PASSWORD})
    console.log(JSON.stringify(report,null,2))
    if(report.testes.some(t=>t.status==='falhou'))process.exitCode=1
    console.log('FIM PARCIAL: sem RPC, migração ou escrita clínica. Testes pendentes não foram aprovados.')
    return
  }
  assert.equal(requireConfig('HOMOLOG_SUPABASE_URL').replace(/\/$/, ''), expectedUrl, 'Destino não é o projeto de teste confirmado.')
  const key = requireConfig('HOMOLOG_SUPABASE_ANON_KEY')
  publicKeyOnly(key)
  const names = ['ADMIN','UBS_A','UBS_B','PACIENTE']
  for (const name of names) { requireConfig(`HOMOLOG_${name}_EMAIL`); requireConfig(`HOMOLOG_${name}_PASSWORD`) }
  const fixture = exigirUuidRetornado(requireConfig('HOMOLOG_PACIENTE_ID'))
  if (mode === '--write') {
    assert.equal(env.HOMOLOG_ESTOQUE_APLICADO,'sim','Conferir 019 e saldo DEMO antes de qualquer escrita do ensaio.')
    assert.equal(env.HOMOLOG_SQL_REVISADO, 'sim', 'Inspecione os corpos SQL, triggers, RLS e grants antes das escritas.')
    assert.equal(env.HOMOLOG_REVISAO_APLICADA, 'fase2-006-r2', 'Corrigir e conferir a revisão fase2-006-r2 aprovada antes do ensaio de escrita.')
    exigirUuidRetornado(requireConfig('HOMOLOG_VACINA_ID'))
    exigirUuidRetornado(requireConfig('HOMOLOG_LOTE_A_ID'))
    assert.match(requireConfig('HOMOLOG_CPF_SINTETICO'), /^\d{11}$/, 'CPF sintético deve ter 11 dígitos, sem formatação.')
  }
  console.log('PASS configuração: projeto de teste e chave pública; nenhum segredo exibido')
  if (mode === '--check') return

  const makeClient = () => createClient(expectedUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const clients = {}, profiles = {}, users = {}
  for (const name of names) {
    const client = makeClient()
    const login = ok(await client.auth.signInWithPassword({ email: env[`HOMOLOG_${name}_EMAIL`], password: env[`HOMOLOG_${name}_PASSWORD`] }), `login ${name}`)
    const verified = ok(await client.auth.getUser(), `sessão ${name}`)
    assert.equal(verified.user.id, login.user.id)
    users[name] = verified.user
    profiles[name] = ok(await client.from('perfis').select('role,unidade_id').eq('id', login.user.id).maybeSingle(), `perfil ${name}`)
    if (name === 'PACIENTE') {
      // Schema confirmado: perfis.role aceita apenas admin/ubs. Paciente é
      // identificado por pacientes.user_id, nunca recebe papel profissional.
      assert.ok(!profiles[name] || profiles[name].role === null, 'Conta de paciente não pode ter papel profissional')
    } else {
      assert.equal(profiles[name]?.role, name === 'ADMIN' ? 'admin' : 'ubs', `papel ${name}`)
    }
    clients[name] = client
    console.log(`PASS autenticação e papel: ${name}`)
  }
  assert.ok(profiles.UBS_A.unidade_id && profiles.UBS_B.unidade_id)
  assert.notEqual(profiles.UBS_A.unidade_id, profiles.UBS_B.unidade_id, 'UBS A/B precisam ser de unidades distintas')
  const columns = 'id,user_id,unidade_id,nome,cpf,whatsapp,data_acidente,data_nascimento'
  const patient = ok(await clients.PACIENTE.from('pacientes').select(columns).eq('id',fixture).single(), 'vínculo sintético paciente')
  assert.equal(patient.user_id, users.PACIENTE.id)
  assert.equal(patient.unidade_id, profiles.UBS_A.unidade_id)
  assert.match(patient.nome, /^DEMO HOMOLOG /, 'Fixture deve ter nome DEMO HOMOLOG e conter somente dados sintéticos')
  for (const name of ['UBS_A','ADMIN']) {
    const visible = ok(await clients[name].from('pacientes').select('id').eq('id',fixture).single(), `leitura fixture ${name}`)
    assert.equal(visible.id, fixture)
    console.log(`PASS leitura autorizada: ${name}`)
  }
  const anon = makeClient()
  for (const [name, client] of [['UBS_B',clients.UBS_B],['ANON',anon]]) {
    noRows(await client.from('pacientes').select('id').eq('id',fixture), `${name} paciente de A`)
    for (const table of ['esquemas_vacinais','aplicacoes_vacinais']) noRows(await client.from(table).select('id').eq('paciente_id',fixture), `${name} ${table} de A`)
  }
  // IDs conhecidos de A; não varre cadastros reais ou outras tabelas sem filtro.
  const ownDoses = ok(await clients.PACIENTE.from('esquemas_vacinais').select('id').eq('paciente_id',fixture), 'doses do paciente')
  assert.ok(ownDoses.length > 0, 'Fixture precisa ter esquema para comprovar leitura')
  if (mode === '--read') { console.log('LEITURA CONCLUÍDA; escritas/RPCs não foram testadas'); return }

  const stockBefore=ok(await clients.UBS_A.from('va_estoque_saldos').select('saldo,unidade_id').eq('lote_id',env.HOMOLOG_LOTE_A_ID).single(),'saldo antes de qualquer escrita')
  assert.equal(stockBefore.unidade_id,profiles.UBS_A.unidade_id)
  assert.ok(Number.isInteger(stockBefore.saldo)&&stockBefore.saldo>=1,'Preparar entrada DEMO antes do ensaio.')

  const today = new Intl.DateTimeFormat('en-CA', { timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date())
  const addDay=days=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
  const buscaAtiva=env.HOMOLOG_BUSCA_ATIVA_APLICADA==='sim'
  const registration = { p_unidade_id:profiles.UBS_A.unidade_id, p_nome:`DEMO HOMOLOG ${Date.now()}`, p_cpf:env.HOMOLOG_CPF_SINTETICO, p_whatsapp:'00000000000', p_data_acidente:addDay(-8), p_data_nascimento:'2000-01-01', p_datas_previstas:[-7,-4,0,7].map(addDay) }
  denied(await clients.PACIENTE.rpc('va_cadastrar_atendimento_v2',registration), 'cadastro pelo paciente')
  denied(await clients.UBS_B.rpc('va_cadastrar_atendimento_v2',registration), 'cadastro UBS B em A')
  // Se já usado, não reutilizar CPF: falha segura e revisão manual, sem upsert/delete.
  const id = exigirUuidRetornado(ok(await clients.UBS_A.rpc('va_cadastrar_atendimento_v2',registration), 'cadastro sintético'))
  console.log(`PASS UUID cadastro; paciente sintético criado: ${id}`)
  const reloaded = ok(await clients.UBS_A.from('pacientes').select(columns).eq('id',id).single(), 'reconsulta após cadastro')
  assert.equal(reloaded.nome, registration.p_nome)
  assert.equal(reloaded.unidade_id, registration.p_unidade_id)
  const doses = ok(await clients.UBS_A.from('esquemas_vacinais').select('id,numero_dose,data_prevista,status,data_aplicacao').eq('paciente_id',id).order('numero_dose'), 'cronograma persistido')
  assert.equal(doses.length, registration.p_datas_previstas.length)
  assert.deepEqual(doses.map(d=>d.data_prevista), registration.p_datas_previstas)
  assert.ok(doses.every((d,i)=>d.status==='pendente' && d.data_aplicacao===null && d.numero_dose===i+1))
  if(buscaAtiva){const queue=ok(await clients.UBS_A.rpc('va_listar_busca_ativa_v1',{p_busca:registration.p_nome,p_limite:20,p_offset:0}),'fila inicial');assert.equal(queue.length,1);assert.equal(Number(queue[0].doses_atrasadas),2);assert.equal(queue[0].esquema_id,doses[0].id)}
  noRows(await clients.UBS_B.from('pacientes').select('id').eq('id',id), 'UBS B novo paciente A')
  noRows(await clients.PACIENTE.from('pacientes').select('id').eq('id',id), 'paciente outro vínculo')
  const edit = { p_paciente_id:id, p_nome:registration.p_nome, p_cpf:registration.p_cpf, p_whatsapp:registration.p_whatsapp, p_data_nascimento:registration.p_data_nascimento, p_data_acidente:registration.p_data_acidente, p_motivo:'Ensaio sintético de autorização; sem alteração de dados.' }
  denied(await clients.UBS_B.rpc('va_atualizar_paciente_v1',edit), 'edição UBS B em A')
  denied(await clients.PACIENTE.rpc('va_atualizar_paciente_v1',edit), 'edição pelo paciente')
  const editedName = `${registration.p_nome} AJUSTE DEMO`
  ok(await clients.UBS_A.rpc('va_atualizar_paciente_v1',{...edit,p_nome:editedName}), 'edição UBS A RETURNS void')
  assert.equal(ok(await clients.UBS_A.from('pacientes').select('nome').eq('id',id).single(), 'reconsulta edição UBS A').nome, editedName)
  ok(await clients.ADMIN.rpc('va_atualizar_paciente_v1',edit), 'edição admin RETURNS void')
  assert.equal(ok(await clients.ADMIN.from('pacientes').select('nome').eq('id',id).single(), 'reconsulta edição admin').nome, registration.p_nome)
  const history = ok(await clients.UBS_A.from('historico_pacientes').select('id,acao').eq('paciente_id',id), 'histórico cadastro/edição')
  assert.equal(history.filter(h=>h.acao==='CADASTRO_INICIAL').length,1)
  assert.equal(history.filter(h=>h.acao==='ATUALIZACAO_CADASTRAL').length,2)
  console.log('PASS edição UBS/admin com retorno void, reconsulta e histórico')
  const dose = doses[0]
  const args = { p_paciente_id:id, p_esquema_id:dose.id, p_vacina_id:env.HOMOLOG_VACINA_ID, p_lote_id:env.HOMOLOG_LOTE_A_ID, p_aplicada_em:new Date(Date.now()-60000).toISOString(), p_via:'DEMO — conforme roteiro sintético revisado', p_local:'DEMO', p_quantidade:1, p_unidade_medida:'mL', p_observacoes:'ENSAIO EM AMBIENTE DE TESTE. Não representa aplicação real.' }
  denied(await clients.UBS_B.rpc('va_registrar_aplicacao_v1',args), 'aplicação UBS B em A')
  denied(await clients.PACIENTE.rpc('va_registrar_aplicacao_v1',args), 'aplicação pelo paciente')
  const application = exigirUuidRetornado(ok(await clients.UBS_A.rpc('va_registrar_aplicacao_v1',args), 'aplicação sintética'))
  console.log(`PASS UUID aplicação: ${application}`)
  const reload = async () => {
    const stockAfter=ok(await clients.UBS_A.from('va_estoque_saldos').select('saldo').eq('lote_id',env.HOMOLOG_LOTE_A_ID).single(),'saldo após aplicação/duplicidade')
    assert.equal(stockAfter.saldo,stockBefore.saldo-1,'Aplicação deve consumir exatamente uma unidade, sem mudanças concorrentes no lote de ensaio')
    const movements=ok(await clients.UBS_A.from('va_estoque_movimentos').select('id,delta,lote_id').eq('aplicacao_id',application),'baixa vinculada à aplicação')
    assert.equal(movements.length,1);assert.equal(movements[0].delta,-1);assert.equal(movements[0].lote_id,env.HOMOLOG_LOTE_A_ID)
    const applied = ok(await clients.UBS_A.from('aplicacoes_vacinais').select('id,status,profissional_id,esquema_id').eq('paciente_id',id).eq('esquema_id',dose.id).eq('status','valida'), 'histórico persistido')
    assert.equal(applied.length,1)
    assert.equal(applied[0].id,application)
    assert.equal(applied[0].profissional_id,users.UBS_A.id)
    const schedule = ok(await clients.UBS_A.from('esquemas_vacinais').select('status,data_aplicacao').eq('id',dose.id).single(), 'acompanhamento persistido')
    assert.equal(schedule.status,'aplicada')
    assert.ok(schedule.data_aplicacao)
  }
  await reload()
  const applicationHistory = ok(await clients.UBS_A.from('historico_pacientes').select('id').eq('paciente_id',id).eq('acao','APLICACAO_VACINAL').contains('detalhes',{aplicacao_id:application}), 'auditoria da aplicação')
  assert.equal(applicationHistory.length,1)
  const duplicate = await clients.UBS_A.rpc('va_registrar_aplicacao_v1',args)
  assert.ok(duplicate.error, 'Duplicidade não rejeitada — interromper e inspecionar evidências')
  assert.ok(['23505','P0001','22023'].includes(duplicate.error.code), `Duplicidade inconclusiva: ${duplicate.error.code}`)
  await reload()
  console.log('PASS duplicidade sequencial rejeitada, histórico único e acompanhamento atualizado')
  if(buscaAtiva){
    const queue=ok(await clients.UBS_A.rpc('va_listar_busca_ativa_v1',{p_busca:registration.p_nome,p_limite:20,p_offset:0}),'fila após aplicação')
    assert.equal(queue.length,1);assert.equal(Number(queue[0].doses_atrasadas),1);assert.equal(queue[0].esquema_id,doses[1].id)
    const contato={p_paciente_id:id,p_esquema_id:doses[1].id,p_canal:'telefone',p_resultado:'retorno_agendado',p_observacoes:'SIMULAÇÃO DE DEMONSTRAÇÃO. Nenhum contato ou envio real.',p_realizado_em:new Date(Date.now()-60000).toISOString(),p_proximo_acompanhamento:addDay(1),p_chave_idempotencia:crypto.randomUUID()}
    denied(await clients.UBS_B.rpc('va_registrar_contato_v1',contato),'contato UBS B em A')
    denied(await clients.PACIENTE.rpc('va_registrar_contato_v1',contato),'contato pelo paciente')
    const contactId=exigirUuidRetornado(ok(await clients.UBS_A.rpc('va_registrar_contato_v1',contato),'contato simulado'))
    assert.equal(ok(await clients.UBS_A.rpc('va_registrar_contato_v1',contato),'reenvio idempotente'),contactId)
    const contacts=ok(await clients.UBS_A.from('contatos_busca_ativa').select('id,contexto,responsavel_id,resultado').eq('paciente_id',id),'histórico de contatos')
    assert.equal(contacts.length,1);assert.equal(contacts[0].contexto,'demonstracao');assert.equal(contacts[0].responsavel_id,users.UBS_A.id)
    noRows(await clients.UBS_B.from('contatos_busca_ativa').select('id').eq('paciente_id',id),'contatos A para UBS B')
    noRows(await clients.PACIENTE.from('contatos_busca_ativa').select('id').eq('paciente_id',id),'notas internas para paciente')
    console.log('PASS fila agrupada, redução do atraso, contato de demonstração idempotente e histórico por unidade')
  }else console.log('PENDENTE busca ativa: SQL 011 não declarado como aplicado. Contatos e fila não testados pelo runner.')
  console.log('ENSAIO API CONCLUÍDO. Não prova reload no navegador, concorrência ou todas as políticas. Dados sintéticos preservados, sem limpeza destrutiva.')
}
main().catch(error => { console.error(`BLOQUEADO/FALHOU: ${error.message}`); process.exitCode=1 })
