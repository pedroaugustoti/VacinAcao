-- PROPOSTA PARA REVISÃO E APROVAÇÃO. NÃO EXECUTADA PELO AGENTE.
-- Baseada nos corpos, constraints e triggers enviados pelo usuário em 12/11/2026.
-- Substitui as 3 RPCs e restringe grants de escrita direta, mantendo dados/schema.
-- Antes de executar: exportar as definições atuais para rollback de código,
-- conferir que não houve mudança desde o diagnóstico e revisar em homologação.
-- Não executar 004. Não cria usuários, não envia mensagens, não remove dados.
-- Revisão 006-r2: backup 008 obrigatório antes de aplicação aprovada; executar
-- diagnóstico 009 e revisar integrações/ACLs. Não usar em produção sem homologar.
-- Pacote de entrega: docs/ENTREGA-19H.md (ordem, backup, reversão e aceite).
-- Projeto confirmado como desenvolvimento com dados fictícios; execução remota
-- continua manual e depende de aprovação. Este arquivo não se autoexecuta.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.va_cadastrar_atendimento_v2(
  p_unidade_id uuid, p_nome text, p_cpf text, p_whatsapp text,
  p_data_acidente date, p_data_nascimento date, p_datas_previstas date[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_usuario uuid := (SELECT auth.uid());
  v_role text;
  v_unidade uuid;
  v_paciente uuid;
  v_data date;
  v_anterior date;
  v_numero integer := 0;
  v_cpf text := regexp_replace(coalesce(p_cpf,''),'[^0-9]','','g');
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g');
BEGIN
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  SELECT role,unidade_id INTO v_role,v_unidade FROM public.perfis WHERE id=v_usuario;
  IF v_role IS NULL OR v_role NOT IN ('admin','ubs') THEN
    RAISE EXCEPTION 'Papel não autorizado' USING ERRCODE='42501';
  END IF;
  IF v_role='ubs' AND (v_unidade IS NULL OR v_unidade IS DISTINCT FROM p_unidade_id) THEN
    RAISE EXCEPTION 'Unidade não autorizada' USING ERRCODE='42501';
  END IF;
  IF p_unidade_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.unidades_saude WHERE id=p_unidade_id) THEN
    RAISE EXCEPTION 'Unidade inválida' USING ERRCODE='22023';
  END IF;
  IF nullif(btrim(p_nome),'') IS NULL OR length(btrim(p_nome)) NOT BETWEEN 3 AND 200
    OR length(v_cpf)<>11 OR length(v_whatsapp) NOT BETWEEN 10 AND 13
    OR p_data_acidente IS NULL OR NOT isfinite(p_data_acidente)
    OR p_data_acidente>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
    OR (p_data_nascimento IS NOT NULL AND (NOT isfinite(p_data_nascimento)
      OR p_data_nascimento>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
      OR p_data_nascimento>p_data_acidente))
    OR p_datas_previstas IS NULL OR array_ndims(p_datas_previstas) IS DISTINCT FROM 1
    OR cardinality(p_datas_previstas) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Dados cadastrais ou cronograma inválidos' USING ERRCODE='22023';
  END IF;
  -- 1..5 é o limite técnico da constraint existente, não um protocolo médico.
  FOREACH v_data IN ARRAY p_datas_previstas LOOP
    IF v_data IS NULL OR NOT isfinite(v_data) OR (v_anterior IS NOT NULL AND v_data<=v_anterior) THEN
      RAISE EXCEPTION 'Datas inválidas ou fora de ordem' USING ERRCODE='22023';
    END IF;
    v_anterior:=v_data;
  END LOOP;
  INSERT INTO public.pacientes(unidade_id,nome,cpf,whatsapp,data_acidente,data_nascimento)
  VALUES(p_unidade_id,btrim(p_nome),v_cpf,v_whatsapp,p_data_acidente,p_data_nascimento)
  RETURNING id INTO v_paciente;
  FOREACH v_data IN ARRAY p_datas_previstas LOOP
    v_numero:=v_numero+1;
    INSERT INTO public.esquemas_vacinais(paciente_id,numero_dose,data_prevista,data_aplicacao,status,conferencia_documental_pendente)
    VALUES(v_paciente,v_numero,v_data,NULL,'pendente',false);
  END LOOP;
  INSERT INTO public.historico_pacientes(paciente_id,unidade_id,autor_id,acao,detalhes)
  VALUES(v_paciente,p_unidade_id,v_usuario,'CADASTRO_INICIAL',jsonb_build_object('datas_previstas',p_datas_previstas,'data_acidente',p_data_acidente));
  RETURN v_paciente;
END;
$function$;

CREATE OR REPLACE FUNCTION public.va_atualizar_paciente_v1(
  p_paciente_id uuid, p_nome text, p_cpf text, p_whatsapp text,
  p_data_nascimento date, p_data_acidente date, p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_usuario uuid := (SELECT auth.uid());
  v_role text;
  v_unidade uuid;
  v_paciente public.pacientes%ROWTYPE;
  v_cpf text := regexp_replace(coalesce(p_cpf,''),'[^0-9]','','g');
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp,''),'[^0-9]','','g');
BEGIN
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  SELECT role,unidade_id INTO v_role,v_unidade FROM public.perfis WHERE id=v_usuario;
  IF v_role IS NULL OR v_role NOT IN ('admin','ubs') THEN
    RAISE EXCEPTION 'Papel não autorizado' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_paciente FROM public.pacientes WHERE id=p_paciente_id
    AND (v_role='admin' OR (v_unidade IS NOT NULL AND unidade_id=v_unidade)) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paciente não acessível nesta unidade' USING ERRCODE='42501';
  END IF;
  IF nullif(btrim(p_nome),'') IS NULL OR length(btrim(p_nome)) NOT BETWEEN 3 AND 200
    OR length(v_cpf)<>11 OR length(v_whatsapp) NOT BETWEEN 10 AND 13
    OR p_data_acidente IS NULL OR NOT isfinite(p_data_acidente)
    OR p_data_acidente>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
    OR (p_data_nascimento IS NOT NULL AND (NOT isfinite(p_data_nascimento)
      OR p_data_nascimento>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
      OR p_data_nascimento>p_data_acidente))
    OR nullif(btrim(p_motivo),'') IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'Dados ou justificativa inválidos' USING ERRCODE='22023';
  END IF;
  UPDATE public.pacientes SET nome=btrim(p_nome),cpf=v_cpf,whatsapp=v_whatsapp,
    data_nascimento=p_data_nascimento,data_acidente=p_data_acidente WHERE id=p_paciente_id;
  INSERT INTO public.historico_pacientes(paciente_id,unidade_id,autor_id,acao,detalhes)
  VALUES(p_paciente_id,v_paciente.unidade_id,v_usuario,'ATUALIZACAO_CADASTRAL',
    jsonb_build_object('motivo',btrim(p_motivo),'antes',jsonb_build_object('nome',v_paciente.nome,'cpf',v_paciente.cpf,'whatsapp',v_paciente.whatsapp,'data_nascimento',v_paciente.data_nascimento,'data_acidente',v_paciente.data_acidente),
      'depois',jsonb_build_object('nome',btrim(p_nome),'cpf',v_cpf,'whatsapp',v_whatsapp,'data_nascimento',p_data_nascimento,'data_acidente',p_data_acidente)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.va_registrar_aplicacao_v1(
  p_paciente_id uuid,p_esquema_id uuid,p_vacina_id uuid,p_lote_id uuid,
  p_aplicada_em timestamptz,p_via text,p_local text,p_quantidade numeric,
  p_unidade_medida text,p_observacoes text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_usuario uuid := (SELECT auth.uid());
  v_role text;
  v_unidade uuid;
  v_unidade_paciente uuid;
  v_dose public.esquemas_vacinais%ROWTYPE;
  v_lote public.lotes_vacinas%ROWTYPE;
  v_vacina_ativa boolean;
  v_data date;
  v_aplicacao uuid;
BEGIN
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  SELECT role,unidade_id INTO v_role,v_unidade FROM public.perfis WHERE id=v_usuario;
  IF v_role IS NULL OR v_role NOT IN ('admin','ubs') THEN
    RAISE EXCEPTION 'Papel não autorizado' USING ERRCODE='42501';
  END IF;
  SELECT unidade_id INTO v_unidade_paciente FROM public.pacientes WHERE id=p_paciente_id
    AND (v_role='admin' OR (v_unidade IS NOT NULL AND unidade_id=v_unidade)) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paciente não acessível nesta unidade' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_dose FROM public.esquemas_vacinais WHERE id=p_esquema_id FOR UPDATE;
  IF NOT FOUND OR v_dose.paciente_id IS DISTINCT FROM p_paciente_id THEN
    RAISE EXCEPTION 'Dose não pertence ao paciente' USING ERRCODE='22023';
  END IF;
  IF v_dose.status IS NULL OR v_dose.status NOT IN ('pendente','atrasada') OR v_dose.conferencia_documental_pendente IS TRUE
    OR EXISTS(SELECT 1 FROM public.aplicacoes_vacinais WHERE esquema_id=p_esquema_id AND status='valida') THEN
    RAISE EXCEPTION 'Dose não elegível ou já aplicada' USING ERRCODE='23505';
  END IF;
  IF p_aplicada_em IS NULL OR NOT isfinite(p_aplicada_em) OR p_aplicada_em>CURRENT_TIMESTAMP
    OR p_quantidade IS NULL OR p_quantidade<=0 OR p_quantidade::text IN ('NaN','Infinity','-Infinity')
    OR nullif(btrim(p_via),'') IS NULL OR length(btrim(p_via))>80
    OR nullif(btrim(p_local),'') IS NULL OR length(btrim(p_local))>80
    OR nullif(btrim(p_unidade_medida),'') IS NULL OR length(btrim(p_unidade_medida))>16
    OR length(coalesce(p_observacoes,''))>1000 THEN
    RAISE EXCEPTION 'Dados da aplicação inválidos' USING ERRCODE='22023';
  END IF;
  v_data:=(p_aplicada_em AT TIME ZONE 'America/Sao_Paulo')::date;
  SELECT ativo INTO v_vacina_ativa FROM public.vacinas WHERE id=p_vacina_id FOR SHARE;
  IF NOT FOUND OR v_vacina_ativa IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Vacina não ativa' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_lote FROM public.lotes_vacinas WHERE id=p_lote_id FOR SHARE;
  IF NOT FOUND OR v_lote.vacina_id IS DISTINCT FROM p_vacina_id OR v_lote.unidade_id IS DISTINCT FROM v_unidade_paciente
    OR v_lote.validade IS NULL OR NOT isfinite(v_lote.validade) OR v_lote.validade<v_data THEN
    RAISE EXCEPTION 'Lote incompatível ou vencido na data' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.aplicacoes_vacinais(paciente_id,esquema_id,vacina_id,lote_id,unidade_id,profissional_id,aplicada_em,via_administracao,local_aplicacao,quantidade,unidade_medida,observacoes,status)
  VALUES(p_paciente_id,p_esquema_id,p_vacina_id,p_lote_id,v_unidade_paciente,v_usuario,p_aplicada_em,btrim(p_via),btrim(p_local),p_quantidade,btrim(p_unidade_medida),nullif(btrim(p_observacoes),''),'valida')
  RETURNING id INTO v_aplicacao;
  UPDATE public.esquemas_vacinais SET status='aplicada',data_aplicacao=v_data,conferencia_documental_pendente=false WHERE id=p_esquema_id;
  INSERT INTO public.historico_pacientes(paciente_id,unidade_id,autor_id,acao,detalhes)
  VALUES(p_paciente_id,v_unidade_paciente,v_usuario,'APLICACAO_VACINAL',jsonb_build_object('esquema_id',p_esquema_id,'aplicacao_id',v_aplicacao,'lote_id',p_lote_id));
  RETURN v_aplicacao;
END;
$function$;

REVOKE ALL ON FUNCTION public.va_cadastrar_atendimento_v2(uuid,text,text,text,date,date,date[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.va_atualizar_paciente_v1(uuid,text,text,text,date,date,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.va_cadastrar_atendimento_v2(uuid,text,text,text,date,date,date[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.va_atualizar_paciente_v1(uuid,text,text,text,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text) TO authenticated;
-- O frontend escreve nessas tabelas somente pelas RPCs. Sem esta restrição,
-- policies ALL permitiriam ignorar validação e auditoria via acesso direto.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.pacientes,public.esquemas_vacinais,
  public.aplicacoes_vacinais,public.historico_pacientes FROM PUBLIC,anon,authenticated;
-- TRUNCATE não é protegido por RLS. Não é necessário para a aplicação.
REVOKE TRUNCATE,TRIGGER,REFERENCES ON TABLE public.unidades_saude,public.perfis,
  public.pacientes,public.esquemas_vacinais,public.vacinas,public.lotes_vacinas,
  public.aplicacoes_vacinais,public.historico_pacientes,public.notificacoes
  FROM PUBLIC,anon,authenticated;
-- REVOKE na tabela não elimina grants concedidos diretamente por coluna.
DO $acl$
DECLARE v_tabela text; v_coluna record; v_papel text; v_rpc regprocedure;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY['unidades_saude','perfis','pacientes','esquemas_vacinais','vacinas','lotes_vacinas','aplicacoes_vacinais','historico_pacientes','notificacoes'] LOOP
    FOR v_coluna IN SELECT attname FROM pg_attribute WHERE attrelid=format('public.%I',v_tabela)::regclass AND attnum>0 AND NOT attisdropped LOOP
      EXECUTE format('REVOKE REFERENCES (%I) ON TABLE public.%I FROM PUBLIC,anon,authenticated',v_coluna.attname,v_tabela);
      IF v_tabela IN ('pacientes','esquemas_vacinais','aplicacoes_vacinais','historico_pacientes') THEN
        EXECUTE format('REVOKE INSERT (%I), UPDATE (%I) ON TABLE public.%I FROM PUBLIC,anon,authenticated',v_coluna.attname,v_coluna.attname,v_tabela);
      END IF;
    END LOOP;
    -- Não revogar automaticamente privilégios de papéis herdados compartilhados.
    -- Se ainda existir uma via efetiva, abortar a transação inteira sem CASCADE.
    FOREACH v_papel IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(v_papel,format('public.%I',v_tabela),'TRUNCATE')
        OR has_table_privilege(v_papel,format('public.%I',v_tabela),'TRIGGER')
        OR has_any_column_privilege(v_papel,format('public.%I',v_tabela),'REFERENCES') THEN
        RAISE EXCEPTION 'Privilégios efetivos residuais em %.%: revisar herança/grantor antes de aplicar',v_papel,v_tabela;
      END IF;
      IF v_tabela IN ('pacientes','esquemas_vacinais','aplicacoes_vacinais','historico_pacientes')
        AND (has_table_privilege(v_papel,format('public.%I',v_tabela),'DELETE')
          OR has_any_column_privilege(v_papel,format('public.%I',v_tabela),'INSERT')
          OR has_any_column_privilege(v_papel,format('public.%I',v_tabela),'UPDATE')) THEN
        RAISE EXCEPTION 'Escrita efetiva residual em %.%: revisar herança/grantor antes de aplicar',v_papel,v_tabela;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH v_rpc IN ARRAY ARRAY[
    'public.va_cadastrar_atendimento_v2(uuid,text,text,text,date,date,date[])'::regprocedure,
    'public.va_atualizar_paciente_v1(uuid,text,text,text,date,date,text)'::regprocedure,
    'public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text)'::regprocedure
  ] LOOP
    IF has_function_privilege('anon',v_rpc,'EXECUTE') OR NOT has_function_privilege('authenticated',v_rpc,'EXECUTE') THEN
      RAISE EXCEPTION 'EXECUTE efetivo incompatível em %: revisar herança/grantor',v_rpc;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'Papel de API com SUPERUSER/BYPASSRLS: revisar configuração';
  END IF;
END;
$acl$;
-- O cancelamento deverá ter RPC própria antes de ser disponibilizado.
NOTIFY pgrst,'reload schema';
COMMIT;
