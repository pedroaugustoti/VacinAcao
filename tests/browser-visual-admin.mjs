// Revisão visual: login da conta administrativa existente + navegação somente leitura.
// Não envia formulários clínicos, não cria fixtures, não salva sessão/credenciais.
import assert from 'node:assert/strict'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {mkdirSync,writeFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {validateBase,requireValue} from './helpers/homolog-config.mjs'
const {url}=validateBase(process.env)
const email=requireValue(process.env,'HOMOLOG_ADMIN_EMAIL'),password=requireValue(process.env,'HOMOLOG_ADMIN_PASSWORD')
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3100',root=join(tmpdir(),'vacinacao-ui-review-tools')
process.env.PLAYWRIGHT_BROWSERS_PATH=join(root,'browsers')
const {chromium}=await import(pathToFileURL(join(root,'node_modules/playwright/index.mjs')).href)
const browser=await chromium.launch({headless:true}),report=[]
let stage='abrir login'
mkdirSync('backups/preview-visual',{recursive:true})
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
 await context.route('**/*',route=>{
  const request=route.request(),target=new URL(request.url())
  if(target.origin===base)return route.continue()
  if(target.origin===url&&(['GET','HEAD','OPTIONS'].includes(request.method())||target.pathname==='/auth/v1/token'))return route.continue()
  return route.abort()
 })
 const page=await context.newPage(),errors=[]
 page.on('pageerror',()=>errors.push('Erro JavaScript'))
 await page.goto(base+'/login-ubs')
 await page.locator('input[type="email"]').fill(email)
 await page.locator('input[type="password"]').fill(password)
 stage='autenticar conta administrativa existente'
 await page.getByRole('button',{name:'Entrar no Sistema',exact:true}).click()
 await page.waitForURL(base+'/admin',{timeout:45000})
 await page.locator('#conteudo-principal h1').waitFor({timeout:45000})
 let detail
 for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport)
  for(const [slug,path] of [['dashboard','/admin'],['pacientes','/admin/pacientes'],['cadastro','/admin/cadastro'],['estoque','/admin/estoque'],['equipe','/admin/equipe'],['unidades','/admin/unidades'],['busca-ativa','/admin/busca-ativa']]){
   stage=`inspecionar ${slug} ${size}`
   await page.goto(base+path,{waitUntil:'networkidle'})
   await page.locator('main h1').waitFor({timeout:45000})
   if(slug==='estoque')await page.getByRole('heading',{name:'Catálogo de vacinas',exact:true}).waitFor()
   if(slug==='estoque'){
    await page.getByRole('tab',{name:'Lotes',exact:true}).click()
    assert.ok(await page.getByRole('heading',{name:'Lotes e saldo DEMO',exact:true}).isVisible())
    await page.getByRole('tab',{name:'Lotes',exact:true}).press('ArrowRight')
    assert.equal(await page.getByRole('tab',{name:'Movimentações',exact:true}).getAttribute('aria-selected'),'true')
    await page.getByRole('tab',{name:'Vacinas',exact:true}).click()
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${slug} sem overflow ${size}`)
   assert.equal(await page.locator('main h1').count(),1,`${slug} título principal`)
   assert.ok(!/maximum-scale\s*=\s*1(?:[,\s]|$)|user-scalable\s*=\s*no/i.test(await page.locator('meta[name="viewport"]').getAttribute('content')||''),'Zoom do navegador permitido')
   if(slug==='busca-ativa'&&await page.getByRole('button',{name:'Consultar novamente',exact:true}).count()){
    await page.getByRole('button',{name:'Consultar novamente',exact:true}).click()
    await page.getByRole('button',{name:'Consultar novamente',exact:true}).waitFor()
    report.push({tela:'nova consulta de busca ativa',viewport:size,resultado:'botão retorna ao estado disponível; permissão continua pendente'})
   }
   await page.screenshot({path:`backups/preview-visual/${size}-${slug}.png`,fullPage:true})
   if(slug==='pacientes')detail=await page.locator('main a[href^="/admin/pacientes/"]').first().getAttribute('href').catch(()=>null)
   if(slug==='busca-ativa')report.push({tela:slug,viewport:size,layout:'aprovado',estado:await page.getByRole('heading',{name:'Fila de busca ativa indisponível'}).count()?'indisponibilidade apresentada; fluxo pendente':'fila apresentada; nenhuma escrita testada'})
   else report.push({tela:slug,viewport:size,layout:'aprovado'})
  }
  if(detail&&/^\/admin\/pacientes\/[0-9a-f-]+$/.test(detail)){
   await page.goto(base+detail,{waitUntil:'networkidle'})
   await page.locator('main h1').waitFor({timeout:45000})
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`ficha sem overflow ${size}`)
   assert.ok(await page.getByRole('tablist',{name:'Seções da ficha'}).count())
   await page.getByRole('tab',{name:'Vacinação',exact:true}).click()
   assert.ok(await page.getByRole('heading',{name:'Registrar aplicação',exact:true}).isVisible())
   await page.getByRole('tab',{name:'Acesso ao portal',exact:true}).click()
   assert.ok(await page.getByRole('heading',{name:'Acesso ao portal',exact:true}).isVisible())
   await page.getByRole('tab',{name:'Visão geral',exact:true}).click()
   await page.screenshot({path:`backups/preview-visual/${size}-ficha.png`,fullPage:true})
   report.push({tela:'ficha de registro existente',viewport:size,layout:'aprovado'})
  }else report.push({tela:'ficha de registro existente',viewport:size,layout:'pendente: nenhum registro disponível'})
  if(size==='mobile'){
   await page.getByRole('button',{name:'Abrir menu',exact:true}).click()
   await page.getByRole('dialog').waitFor()
   await page.keyboard.press('Escape')
   assert.equal(await page.getByRole('dialog').count(),0,'Menu fecha por Escape')
   report.push({tela:'menu mobile',teclado:'abertura e Escape aprovados'})
  }
 }
 assert.equal(errors.length,0,'Navegação administrativa sem erros JavaScript')
 report.push({tela:'PWA com paciente autenticado',layout:'pendente: conta DEMO paciente não confirmada'})
 writeFileSync('backups/preview-visual/relatorio.json',JSON.stringify({somenteLeitura:true,resultados:report,escritaHomologada:false},null,2)+'\n')
 console.log(JSON.stringify({resultados:report,errosJavaScript:errors.length,escritasClinicas:0,credenciaisExibidas:false},null,2))
 await context.close()
}catch(error){
 console.error(JSON.stringify({resultado:'interrompido',etapa:stage,tipo:error.name,causa:String(error.message).includes('strict mode')?'seletor ambíguo':String(error.message).includes('Timeout')?'tempo esgotado':String(error.message).includes('ERR_')?'rede':'outro erro de automação',detalhe:error.name==='AssertionError'?error.message:'Falha de navegação ou autenticação; detalhes sensíveis omitidos.',escritasClinicas:0}))
 process.exitCode=1
}finally{await browser.close()}
