// Navegador local, sem login ou envio de formulários/mensagens.
import assert from 'node:assert/strict'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {mkdirSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const root=join(tmpdir(),'vacinacao-ui-review-tools')
process.env.PLAYWRIGHT_BROWSERS_PATH=join(root,'browsers')
const {chromium}=await import(pathToFileURL(join(root,'node_modules/playwright/index.mjs')).href)
const browser=await chromium.launch({headless:true}),base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3100'
mkdirSync('backups/preview',{recursive:true})
let passed=0
try{
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const page=await browser.newPage({viewport})
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  // Apenas conteúdo local é necessário; bloquear serviços externos no navegador.
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort())
  for(const path of ['/login','/login-ubs','/registro','/definir-senha']){
   await page.goto(base+path,{waitUntil:'networkidle'})
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)
   assert.equal(overflow,false,`${path} overflow ${name}`)
   assert.ok(await page.locator('h1').count(),`${path} título acessível`)
   await page.keyboard.press('Tab')
   assert.ok(await page.evaluate(()=>document.activeElement && !['BODY','HTML'].includes(document.activeElement.tagName)),`${path} navegação teclado`)
   if(path==='/login'||path==='/login-ubs'){
    assert.equal(await page.locator('input[type="password"]').count(),1)
    assert.ok(await page.locator('input[required]').count()>=2)
   }
   await page.screenshot({path:`backups/preview/${name}-${path.slice(1)}.png`,fullPage:true})
   passed++;console.log(`PASS NAVEGADOR: ${path} ${name}, layout/teclado, sem envio`)
  }
  await page.goto(base+'/admin/busca-ativa',{waitUntil:'networkidle'})
  assert.equal(new URL(page.url()).pathname,'/login-ubs')
  assert.deepEqual(errors,[],'Erros de JavaScript no navegador')
  passed++;console.log(`PASS NAVEGADOR: busca ativa anônima bloqueada ${name}`)
  await page.goto(base+'/auth/confirm?type=recovery&next=https%3A%2F%2Fexample.com',{waitUntil:'networkidle'})
  assert.equal(new URL(page.url()).origin,base);assert.equal(new URL(page.url()).pathname,'/registro')
  passed++;console.log(`PASS NAVEGADOR: callback sem token rejeitado, sem redirecionamento externo ${name}`)
  await page.close()
 }
 console.log(`${passed} verificações de navegador públicas aprovadas. Sessões autenticadas ainda não testadas.`)
}finally{await browser.close()}
