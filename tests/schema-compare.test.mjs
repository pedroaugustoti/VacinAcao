import test from 'node:test'
import assert from 'node:assert/strict'
import {compareMetadata,normalizeSql} from '../scripts/comparar-busca-ativa.mjs'
const fixture=()=>({versao:1,origem:'diagnostico_014',tabela:{rls_ativo:true},colunas:[{nome:'id',tipo:'uuid',not_null:true,default:'gen_random_uuid()',gerada:'',identidade:'',grants:[]}],constraints:[{nome:'pk',tipo:'p',validada:true,definicao:'PRIMARY KEY (id)'}],indices:[{nome:'ix',valido:true,pronto:true,definicao:'CREATE INDEX ix ON public.contatos_busca_ativa USING btree (id)'}],triggers:[{nome:'tr',habilitado:'O',definicao:'CREATE TRIGGER tr BEFORE UPDATE ON public.contatos_busca_ativa FOR EACH ROW EXECUTE FUNCTION va_contatos_imutaveis()'}],politicas:[{nome:'leitura',comando:'SELECT',permissiva:'PERMISSIVE',papeis:['authenticated'],using:'true',with_check:null}],funcoes:['va_contatos_imutaveis','va_registrar_contato_v1','va_listar_busca_ativa_v1'].map(proname=>({proname,assinatura:`public.${proname}()`,fingerprint:'hash-de-teste',prosecdef:true,proconfig:['search_path=""'],grants:[]})),privilegios_efetivos:['anon','authenticated'].map(papel=>({papel,select:papel==='authenticated',insert:false,update:false,delete:false,truncate:false,trigger:false,references:false})),membros:[],dependencias:[]})
test('diagnóstico completo compatível não exige recriação',()=>{
 const f=fixture(),r=compareMetadata(f,f)
 assert.ok(r.prontoParaGerarIncremental)
 assert.ok(!r.itens.some(x=>['ausente','divergente'].includes(x.status)))
})

test('CRLF/LF não exige substituir função; mudanças no corpo continuam divergentes',()=>{
 const e=fixture(),r=structuredClone(e)
 e.funcoes[0].definicao="BEGIN\n RAISE EXCEPTION 'teste';\nEND;"
 r.funcoes[0].definicao=e.funcoes[0].definicao.replace(/\n/g,'\r\n')
 r.funcoes[0].fingerprint='outro-hash'
 assert.equal(compareMetadata(r,e).itens.find(x=>x.recurso==='Função va_contatos_imutaveis').status,'compativel')
 r.funcoes[0].definicao=r.funcoes[0].definicao.replace('teste','alterado')
 assert.equal(compareMetadata(r,e).itens.find(x=>x.recurso==='Função va_contatos_imutaveis').status,'divergente')
})
test('nome diferente de índice/constraint/trigger equivalente não causa duplicação',()=>{
 const e=fixture(),r=structuredClone(e)
 r.constraints[0].nome='pk_antiga'
 r.indices[0].nome='ix_antigo';r.indices[0].definicao=r.indices[0].definicao.replace('INDEX ix ','INDEX ix_antigo ')
 r.triggers[0].nome='tr_antigo';r.triggers[0].definicao=r.triggers[0].definicao.replace('TRIGGER tr ','TRIGGER tr_antigo ')
 assert.ok(compareMetadata(r,e).prontoParaGerarIncremental)
})
test('coluna ausente ou política adicional bloqueia geração automática',()=>{
 const e=fixture(),r=structuredClone(e);r.colunas=[]
 assert.equal(compareMetadata(r,e).prontoParaGerarIncremental,false)
 const policy=structuredClone(e);policy.politicas.push({...policy.politicas[0],nome:'escrita_extra',comando:'ALL'})
 assert.equal(compareMetadata(policy,e).prontoParaGerarIncremental,false)
})
test('corpo diferente ou overload é divergência, não ausência de função',()=>{
 const e=fixture(),r=structuredClone(e);r.funcoes[1].assinatura='public.va_registrar_contato_v1(text)'
 const report=compareMetadata(r,e)
 assert.equal(report.itens.find(x=>x.recurso==='Função va_registrar_contato_v1').status,'divergente')
 assert.equal(report.prontoParaGerarIncremental,false)
})
test('recusa snapshot antigo/incompleto e preserva espaços em literais SQL',()=>{
 assert.throws(()=>compareMetadata({versao:1},fixture()),/diagnóstico 014/)
 const incomplete=fixture();delete incomplete.colunas[0].default
 assert.throws(()=>compareMetadata(incomplete,fixture()),/incompletos/)
 assert.notEqual(normalizeSql("CHECK (x = 'a  b')"),normalizeSql("CHECK (x = 'a b')"))
})
