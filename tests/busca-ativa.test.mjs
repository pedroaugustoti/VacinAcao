import test from 'node:test'
import assert from 'node:assert/strict'
import {linkWhatsApp,estadoRetorno} from '../src/lib/busca-ativa.ts'
test('WhatsApp normaliza DDI sem duplicar e não expõe informação clínica na mensagem',()=>{
 const a=linkWhatsApp('(81) 91234-5678'), b=linkWhatsApp('5581912345678')
 assert.equal(a,b)
 assert.equal(new URL(a).hostname,'wa.me')
 assert.ok(!decodeURIComponent(a).includes('antirrábica'))
 for(const v of [null,'','00000000000','123','javascript:alert(1)'])assert.equal(linkWhatsApp(v),null)
})
test('retorno distingue atrasado, hoje, futuro e ausência de agendamento',()=>{
 assert.equal(estadoRetorno('2026-11-11','2026-11-12'),'vencido')
 assert.equal(estadoRetorno('2026-11-12','2026-11-12'),'hoje')
 assert.equal(estadoRetorno('2026-11-13','2026-11-12'),'agendado')
 assert.equal(estadoRetorno(null,'2026-11-12'),'sem_retorno')
})
