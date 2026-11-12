import test from 'node:test'
import assert from 'node:assert/strict'
import {validateProvision,assertManageTarget,accountState} from '../src/lib/management-policy.ts'
const input={tipo:'equipe',nome:'DEMO Enfermeira',email:' DEMO@EXEMPLO.INVALID ',funcao:'Enfermeira',unidade_id:'10000000-0000-0000-0000-000000000001',paciente_id:'',confirmado:true}
test('inclusão profissional exige unidade/função e não recebe papel controlado pelo formulário',()=>{
 assert.equal(validateProvision(input).email,'demo@exemplo.invalid')
 assert.equal(Object.hasOwn(validateProvision({...input,role:'admin'}),'role'),false)
 for(const altered of [{confirmado:false},{unidade_id:''},{funcao:''},{email:'invalido'},{tipo:'admin'}])assert.throws(()=>validateProvision({...input,...altered}))
})
test('acesso não pode mudar o próprio administrador ou outro admin',()=>{
 assert.throws(()=>assertManageTarget('a','a','ubs'));assert.throws(()=>assertManageTarget('a','b','admin'));assert.doesNotThrow(()=>assertManageTarget('a','b','ubs'))
 assert.throws(()=>assertManageTarget('a','b',null));assert.doesNotThrow(()=>assertManageTarget('a','b',null,true))
})
test('estado não infere acesso ativo de mera confirmação ou existência da conta',()=>{
 assert.equal(accountState(undefined,undefined),'pendente');assert.equal(accountState(undefined,'2026-01-01'),'ativo');assert.equal(accountState(undefined,'2026-01-01',true),'bloqueado');assert.equal(accountState('2099-01-01',undefined),'bloqueado')
})
