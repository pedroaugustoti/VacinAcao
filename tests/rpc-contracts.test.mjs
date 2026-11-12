import test from 'node:test'
import assert from 'node:assert/strict'
import { exigirUuidRetornado } from '../src/lib/rpc-contracts.ts'

test('aceita o UUID escalar retornado por PostgREST sem alterar seu valor', () => {
  const id = 'a52ca43d-c7ad-4922-8086-fd8c4181209a'
  assert.equal(exigirUuidRetornado(id), id)
  assert.equal(exigirUuidRetornado(id.toUpperCase()), id.toUpperCase())
})
test('não confirma sucesso com retorno nulo, lista, objeto ou URL inesperada', () => {
  for (const value of [null, undefined, '', 123, [], { id: 'a52ca43d-c7ad-4922-8086-fd8c4181209a' }, 'javascript:alert(1)', 'a52ca43d-c7ad-4922-8086-fd8c4181209a/editar']) {
    assert.throws(() => exigirUuidRetornado(value), /operação pode ter sido gravada.*antes de tentar novamente/)
  }
})
