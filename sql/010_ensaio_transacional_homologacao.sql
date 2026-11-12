-- ROTEIRO MANUAL. NÃO APLICA 006. SOMENTE EM PROJETO DE TESTE APÓS APROVAÇÃO.
-- Preencher TODOS os placeholders com contas/unidades/catálogos DEMO já criados.
-- Não cria usuários nem perfis. Novos registros clínicos são sintéticos e revertidos.
-- SET ROLE + claims testa o SQL/RLS; NÃO substitui login/JWT real via API.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT set_config('vacinacao.demo.ubs_a','UUID_UBS_A',true);
SELECT set_config('vacinacao.demo.ubs_b','UUID_UBS_B',true);
SELECT set_config('vacinacao.demo.admin','UUID_ADMIN_DEMO',true);
SELECT set_config('vacinacao.demo.paciente','UUID_AUTH_PACIENTE_DEMO',true);
SELECT set_config('vacinacao.demo.unidade_a','UUID_UNIDADE_A',true);
SELECT set_config('vacinacao.demo.unidade_b','UUID_UNIDADE_B',true);
SELECT set_config('vacinacao.demo.vacina','UUID_VACINA_DEMO',true);
SELECT set_config('vacinacao.demo.lote','UUID_LOTE_DEMO_A',true);
SELECT set_config('vacinacao.demo.cpf','CPF_SINTETICO_INEDITO',true);

-- Validação de fixture, sem imprimir nomes/documentos nem ler contas reais.
DO $fixture$
DECLARE a uuid:=current_setting('vacinacao.demo.ubs_a')::uuid;
 b uuid:=current_setting('vacinacao.demo.ubs_b')::uuid;
 admin_id uuid:=current_setting('vacinacao.demo.admin')::uuid;
 patient_id uuid:=current_setting('vacinacao.demo.paciente')::uuid;
 ua uuid:=current_setting('vacinacao.demo.unidade_a')::uuid;
 ub uuid:=current_setting('vacinacao.demo.unidade_b')::uuid;
BEGIN
 IF ua=ub OR a=b OR a=admin_id OR b=admin_id OR patient_id IN (a,b,admin_id)
   OR current_setting('vacinacao.demo.cpf') !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'Fixture inválida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=a AND role='ubs' AND unidade_id=ua AND nome LIKE 'DEMO%')
   OR NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=b AND role='ubs' AND unidade_id=ub AND nome LIKE 'DEMO%')
   OR NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=admin_id AND role='admin' AND nome LIKE 'DEMO%')
   OR EXISTS(SELECT 1 FROM public.perfis WHERE id=patient_id AND role IS NOT NULL)
   OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=patient_id AND email LIKE 'demo-%@vacinacao.invalid') THEN
   RAISE EXCEPTION 'Usar somente contas fictícias provisionadas conforme roteiro';
 END IF;
 IF (SELECT count(*) FROM public.unidades_saude WHERE id IN (ua,ub) AND nome LIKE 'DEMO%')<>2
   OR NOT EXISTS(SELECT 1 FROM public.vacinas WHERE id=current_setting('vacinacao.demo.vacina')::uuid AND ativo AND nome LIKE 'DEMO%')
   OR NOT EXISTS(SELECT 1 FROM public.lotes_vacinas WHERE id=current_setting('vacinacao.demo.lote')::uuid AND unidade_id=ua AND vacina_id=current_setting('vacinacao.demo.vacina')::uuid AND numero_lote LIKE 'DEMO%' AND validade IS NOT NULL AND isfinite(validade) AND validade>=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) THEN
   RAISE EXCEPTION 'Usar somente unidades, vacina e lote sintéticos válidos';
 END IF;
END;
$fixture$;

SET LOCAL ROLE authenticated;
DO $test$
DECLARE a uuid:=current_setting('vacinacao.demo.ubs_a')::uuid;
 b uuid:=current_setting('vacinacao.demo.ubs_b')::uuid;
 admin_id uuid:=current_setting('vacinacao.demo.admin')::uuid;
 patient_id uuid:=current_setting('vacinacao.demo.paciente')::uuid;
 ua uuid:=current_setting('vacinacao.demo.unidade_a')::uuid;
 ub uuid:=current_setting('vacinacao.demo.unidade_b')::uuid;
 vaccine uuid:=current_setting('vacinacao.demo.vacina')::uuid;
 lot uuid:=current_setting('vacinacao.demo.lote')::uuid;
 cpf text:=current_setting('vacinacao.demo.cpf');
 today date:=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
 p uuid; dose uuid; application uuid; n integer;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 p:=public.va_cadastrar_atendimento_v2(ua,'DEMO HOMOLOG TRANSACIONAL',cpf,'00000000000',today,'2000-01-01',ARRAY[today,today+2,today+8,today+22]);
 SELECT count(*) INTO n FROM public.esquemas_vacinais WHERE paciente_id=p;
 IF p IS NULL OR n<>4 THEN RAISE EXCEPTION 'Cadastro/configuração não persistiu na transação'; END IF;
 BEGIN
   PERFORM public.va_cadastrar_atendimento_v2(ub,'DEMO HOMOLOG NEGATIVO',cpf,'00000000000',today,'2000-01-01',ARRAY[today]);
   RAISE EXCEPTION 'Falha: UBS A cadastrou em B';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT id INTO STRICT dose FROM public.esquemas_vacinais WHERE paciente_id=p AND numero_dose=1;

 PERFORM set_config('request.jwt.claim.sub',b::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 IF EXISTS(SELECT 1 FROM public.pacientes WHERE id=p) THEN RAISE EXCEPTION 'Falha: UBS B leu A'; END IF;
 BEGIN
   PERFORM public.va_atualizar_paciente_v1(p,'DEMO HOMOLOG NEGATIVO',cpf,'00000000000','2000-01-01',today,'Teste de isolamento entre unidades');
   RAISE EXCEPTION 'Falha: UBS B editou A';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.va_registrar_aplicacao_v1(p,dose,vaccine,lot,CURRENT_TIMESTAMP,'DEMO','DEMO',1,'mL','SIMULAÇÃO');
   RAISE EXCEPTION 'Falha: UBS B aplicou em A';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 PERFORM set_config('request.jwt.claim.sub',patient_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',patient_id,'role','authenticated')::text,true);
 IF EXISTS(SELECT 1 FROM public.pacientes WHERE id=p) THEN RAISE EXCEPTION 'Falha: paciente leu outro vínculo'; END IF;
 BEGIN
   PERFORM public.va_registrar_aplicacao_v1(p,dose,vaccine,lot,CURRENT_TIMESTAMP,'DEMO','DEMO',1,'mL','SIMULAÇÃO');
   RAISE EXCEPTION 'Falha: paciente executou aplicação profissional';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
 IF NOT EXISTS(SELECT 1 FROM public.pacientes WHERE id=p) THEN RAISE EXCEPTION 'Falha: admin não leu conforme regra central'; END IF;
 PERFORM public.va_atualizar_paciente_v1(p,'DEMO HOMOLOG TRANSACIONAL',cpf,'00000000000',NULL,today,'Edição retrospectiva sintética, nascimento desconhecido');

 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 application:=public.va_registrar_aplicacao_v1(p,dose,vaccine,lot,CURRENT_TIMESTAMP,'DEMO','DEMO',1,'mL','SIMULAÇÃO EM PROJETO DE TESTE');
 IF application IS NULL OR NOT EXISTS(SELECT 1 FROM public.esquemas_vacinais WHERE id=dose AND status='aplicada' AND data_aplicacao=today)
   OR NOT EXISTS(SELECT 1 FROM public.historico_pacientes WHERE paciente_id=p AND acao='APLICACAO_VACINAL' AND detalhes->>'aplicacao_id'=application::text) THEN
   RAISE EXCEPTION 'Falha: acompanhamento ou auditoria não sincronizado';
 END IF;
 BEGIN
   PERFORM public.va_registrar_aplicacao_v1(p,dose,vaccine,lot,CURRENT_TIMESTAMP,'DEMO','DEMO',1,'mL','SIMULAÇÃO DUPLICIDADE');
   RAISE EXCEPTION 'Falha: duplicidade permitida';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 SELECT count(*) INTO n FROM public.aplicacoes_vacinais WHERE esquema_id=dose AND status='valida';
 IF n<>1 THEN RAISE EXCEPTION 'Falha: histórico válido não único'; END IF;
 RAISE NOTICE 'Cenários transacionais passaram. Ainda falta login/JWT, reload UI e concorrência em sessões separadas.';
END;
$test$;
ROLLBACK;
-- Se houver erro, executar ROLLBACK manual antes de qualquer outro comando.
-- Não trocar por COMMIT para este roteiro. Nenhuma linha de teste deve persistir.
