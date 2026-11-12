import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularDatas, validarDatas } from '../src/lib/cronograma.ts'

test('permite quatro e cinco datas sem impor um esquema', () => {
  assert.deepEqual(calcularDatas('2026-11-12', '0, 3, 7, 14'), ['2026-11-12', '2026-11-15', '2026-11-19', '2026-11-26'])
  assert.equal(calcularDatas('2026-11-12', '0,3,7,14,28').at(-1), '2026-12-10')
  assert.ok(validarDatas(['2026-11-12']))
})
test('recusa intervalos vazios, duplicados, decrescentes, fracionários e excessivos', () => {
  for (const texto of ['', '0,', '0,,3', '0,3,3', '0,7,3', '1,3', '0,-3', '0,3.5', '0,3651', '0,1,2,3,4,5', Array.from({length:21}, (_,i)=>i).join(',')]) {
    assert.throws(() => calcularDatas('2026-11-12', texto), undefined, texto)
  }
})
test('recusa datas inválidas e duplicadas; respeita ano bissexto e virada de ano', () => {
  for (const datas of [[], ['2026-02-29'], ['2026-13-01'], [''], ['2026-11-12', '2026-11-12'], ['2026-11-12', '2026-11-11']]) assert.equal(validarDatas(datas), false)
  assert.deepEqual(calcularDatas('2028-02-28', '0,1,2'), ['2028-02-28', '2028-02-29', '2028-03-01'])
  assert.deepEqual(calcularDatas('2026-12-31', '0,1'), ['2026-12-31', '2027-01-01'])
})
