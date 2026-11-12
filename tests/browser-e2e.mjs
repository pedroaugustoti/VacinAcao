// Ensaio opt-in de UI com contas DEMO reais, somente no projeto de teste autorizado.
// Não provisiona usuários, não altera contas, não envia mensagens, não usa service_role.
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync} from 'node:fs'
import {parseEnv} from 'node:util'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const env=process.env,expected='https://nfwfogaklwbrabozqjan.supabase.co'
const required=name=>{assert.ok(env[name],`Configuração ausente: ${name}`);return env[name]}
async function main(){
 assert.equal(required('HOMOLOG_SUPABASE_URL'),expected)
 assert.equal(parseEnv(readFileSync('.env.local','utf8')).NEXT_PUBLIC_SUPABASE_URL,expected,'Aplicação local precisa apontar para o projeto de teste')
 assert.equal(required('HOMOLOG_REVISAO_APLICADA'),'fase2-006-r2')
 assert.equal(required('HOMOLOG_BUSCA_ATIVA_APLICADA'),'sim')
 assert.equal(required('HOMOLOG_UI_ESCRITA'),'sim','Ensaios criam registros sintéticos; revisar e habilitar conscientemente')
 assert.equal(required('HOMOLOG_ESTOQUE_APLICADO'),'sim','Conferir estoque e saldo DEMO antes do ensaio')
 for(const name of ['UBS_A','UBS_B','ADMIN','PACIENTE']){required(`HOMOLOG_${name}_EMAIL`);required(`HOMOLOG_${name}_PASSWORD`)}
 assert.match(required('HOMOLOG_CPF_SINTETICO'),/^\d{11}$/)
 required('HOMOLOG_VACINA_ID');required('HOMOLOG_LOTE_A_ID')
 const root=join(tmpdir(),'vacinacao-ui-review-tools');env.PLAYWRIGHT_BROWSERS_PATH=join(root,'browsers')
 const {chromium}=await import(pathToFileURL(join(root,'node_modules/playwright/index.mjs')).href)
 const browser=await chromium.launch({headless:true}),base='http://127.0.0.1:3100'
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]))
 const name=`DEMO HOMOLOG UI ${Date.now()}`,today=`${parts.year}-${parts.month}-${parts.day}`
 const day=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
 const nowLocal=new Date(Date.now()-60000-3*3600000).toISOString().slice(0,16)
 async function context(){const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.route('**/*',r=>[base,expected].includes(new URL(r.request().url()).origin)?r.continue():r.abort());return ctx}
 async function login(ctx,role){const page=await ctx.newPage();await page.goto(base+'/login-ubs');await page.locator('input[type="email"]').fill(env[`HOMOLOG_${role}_EMAIL`]);await page.locator('input[type="password"]').fill(env[`HOMOLOG_${role}_PASSWORD`]);await page.getByRole('button',{name:/Entrar/}).click();await page.waitForURL(base+'/admin');return page}
 try{
  const ctx=await context(),page=await login(ctx,'UBS_A')
  await page.goto(base+'/admin/cadastro')
  await page.getByLabel(/Nome Completo do Paciente/).fill(name)
  await page.getByLabel(/^CPF/).fill(env.HOMOLOG_CPF_SINTETICO)
  await page.getByLabel(/WhatsApp/).fill('00000000000')
  await page.getByLabel(/Data de Nascimento/).fill('2000-01-01')
  await page.getByLabel(/Data do Acidente/).fill(day(-8))
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Adicionar dose'}).click()
  for(const [i,value] of [-7,-4,0,7].entries())await page.locator('fieldset input[type="date"]').nth(i).fill(day(value))
  await page.getByLabel(/Confirmo que a quantidade de doses/).check()
  await page.getByRole('button',{name:'Cadastrar Paciente e Gerar Esquema Vacinal'}).click()
  await page.waitForURL(/\/admin\/pacientes\/[0-9a-f-]{36}$/)
  const patientId=new URL(page.url()).pathname.split('/').at(-1)
  await page.reload();await page.getByRole('heading',{name,exact:true}).waitFor()
  assert.equal(await page.locator('table tbody tr').count(),4)
  console.log('PASS UI cadastro, UUID, cronograma e reload; paciente sintético:',patientId)
  await page.goto(base+'/admin/busca-ativa?q='+encodeURIComponent(name))
  const row=page.locator('article').filter({has:page.getByRole('link',{name,exact:true})})
  await row.waitFor();assert.ok((await row.innerText()).includes('2 dose(s) em atraso'))
  await page.goto(`${base}/admin/pacientes/${patientId}`)
  await page.getByRole('tab',{name:'Vacinação',exact:true}).click()
  const form=page.locator('#registro-aplicacao')
  await form.getByLabel(/^Dose/).selectOption({index:1})
  const appliedDose=await form.getByLabel(/^Dose/).inputValue()
  await form.getByLabel(/^Vacina/).selectOption(env.HOMOLOG_VACINA_ID)
  await form.getByLabel(/^Lote/).selectOption(env.HOMOLOG_LOTE_A_ID)
  await form.getByLabel(/^Data da aplicação/).fill(today)
  await form.getByLabel(/^Horário/).fill(nowLocal.slice(11))
  await form.getByLabel(/^Via de/).fill('DEMO')
  await form.getByLabel(/^Local da/).fill('DEMO')
  await form.getByLabel(/^Quantidade/).fill('1')
  await form.getByLabel(/^Observações/).fill('SIMULAÇÃO E2E. Nenhuma vacina realmente aplicada.')
  await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Confirmar aplicação'}).click()
  await form.getByRole('status').filter({hasText:'Aplicação registrada'}).waitFor()
  await page.reload();await page.getByText('Aplicação documentada',{exact:true}).waitFor()
  assert.equal(await page.locator(`#registro-aplicacao select option[value="${appliedDose}"]`).count(),0)
  await page.getByRole('tab',{name:'Busca ativa',exact:true}).click()
  const contacts=page.locator('#busca-ativa form')
  await contacts.getByLabel('Resultado',{exact:true}).selectOption('retorno_agendado')
  await contacts.getByLabel(/^Data e horário/).fill(nowLocal)
  await contacts.getByLabel(/^Próximo acompanhamento/).fill(day(1))
  await contacts.getByLabel('Observações',{exact:true}).fill('SIMULAÇÃO UI — sem envio ou contato real')
  await contacts.getByRole('checkbox').check();await contacts.getByRole('button',{name:'Registrar tentativa de demonstração'}).click()
  await contacts.getByRole('status').filter({hasText:'Tentativa de demonstração registrada'}).waitFor()
  await page.reload();await page.getByText('SIMULAÇÃO UI — sem envio ou contato real',{exact:true}).waitFor()
  await page.goto(base+'/admin/busca-ativa?q='+encodeURIComponent(name));await page.getByRole('link',{name,exact:true}).waitFor()
  assert.ok((await page.locator('article').innerText()).includes('1 dose(s) em atraso'))
  mkdirSync('backups/preview',{recursive:true});await page.screenshot({path:'backups/preview/e2e-fila.png',fullPage:true})
  await ctx.close()
  const other=await context(),bPage=await login(other,'UBS_B');await bPage.goto(`${base}/admin/pacientes/${patientId}`);await bPage.getByRole('heading',{name:'404',exact:true}).waitFor();await other.close()
  const central=await context(),adminPage=await login(central,'ADMIN');await adminPage.goto(`${base}/admin/pacientes/${patientId}`);await adminPage.getByRole('heading',{name,exact:true}).waitFor();await central.close()
  const patient=await context(),pwa=await patient.newPage();await pwa.goto(base+'/login');await pwa.getByLabel(/CPF ou e-mail/).fill(env.HOMOLOG_PACIENTE_EMAIL);await pwa.locator('input[type="password"]').fill(env.HOMOLOG_PACIENTE_PASSWORD);await pwa.getByRole('button',{name:'Acessar carteira'}).click();await pwa.waitForURL(base+'/doses');await pwa.reload();await pwa.getByRole('heading',{name:'Histórico de Doses'}).waitFor();assert.equal(await pwa.getByRole('navigation',{name:'Navegação do paciente'}).count(),1);await patient.close()
  console.log('PASS UI: cadastro/reload, fila/atrasos, aplicação sem repetição na seleção, contato/reload, isolamento UBS B, admin e login PWA. Duplicidade concorrente e teste HTTP completo de RLS exigem ensaio separado. Dados sintéticos preservados.')
 }finally{await browser.close()}
}
main().catch(error=>{console.error('BLOQUEADO/FALHOU:',error.message);process.exitCode=1})
