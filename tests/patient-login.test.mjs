import test from 'node:test'
import assert from 'node:assert/strict'
import {identificadorPaciente} from '../src/lib/patient-login.ts'
test('e-mail normalizado e CPF somente como alias provisionado',()=>{
 assert.equal(identificadorPaciente(' DEMO@exemplo.invalid '),'demo@exemplo.invalid')
 assert.equal(identificadorPaciente('000.000.000-00'),'00000000000@paciente.vacinacao.app')
})
test('identificadores inválidos não viram alias por extração permissiva de dígitos',()=>{
 for(const value of ['','123','abc00000000000','x@','sem conta','123456789012'])assert.equal(identificadorPaciente(value),null)
})
