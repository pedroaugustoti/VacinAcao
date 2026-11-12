-- HISTÓRICO: NÃO EXECUTAR. Na Fase 2 o usuário confirmou que a RPC já existe.
-- O diagnóstico atual é sql/005_inspecao_fase2_somente_leitura.sql.
-- PROPOSTA NÃO EXECUTADA. Aprovar somente após 003 e teste em homologação.
-- Adiciona o contrato chamado pelo frontend APENAS se não existir função com
-- este nome. Não substitui função remota nem altera tabelas ou dados existentes.
-- Se já existir, comparar a definição/assinatura e criar outra migração revisada.
BEGIN;
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='va_cadastrar_atendimento_v2') THEN
    RAISE NOTICE 'RPC existente preservada; revisar contrato remoto antes de qualquer alteração.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM (VALUES ('perfis'), ('pacientes'), ('esquemas_vacinais'), ('unidades_saude')) AS required(nome)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=required.nome AND c.relkind IN ('r','p') AND c.relrowsecurity
    )
  ) THEN
    RAISE EXCEPTION 'Tabelas esperadas e RLS ativo são pré-requisitos. Revisar diagnóstico 003.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('perfis','id'), ('perfis','role'), ('perfis','unidade_id'),
      ('unidades_saude','id'), ('pacientes','id'), ('pacientes','unidade_id'),
      ('pacientes','nome'), ('pacientes','cpf'), ('pacientes','whatsapp'),
      ('pacientes','data_acidente'), ('pacientes','data_nascimento'),
      ('esquemas_vacinais','paciente_id'), ('esquemas_vacinais','numero_dose'),
      ('esquemas_vacinais','data_prevista'), ('esquemas_vacinais','status')
    ) AS required(tabela,coluna)
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=required.tabela AND c.column_name=required.coluna)
  ) THEN
    RAISE EXCEPTION 'Contrato de colunas incompatível; nenhuma alteração foi aplicada.';
  END IF;

  EXECUTE $definition$
    CREATE FUNCTION public.va_cadastrar_atendimento_v2(
      p_unidade_id uuid, p_nome text, p_cpf text, p_whatsapp text,
      p_data_acidente date, p_data_nascimento date, p_datas_previstas date[]
    ) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
    AS $body$
    DECLARE
      v_usuario uuid := (SELECT auth.uid());
      v_perfil record;
      v_paciente uuid;
      v_data date;
      v_anterior date;
      v_numero integer := 0;
    BEGIN
      IF v_usuario IS NULL THEN
        RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501';
      END IF;
      SELECT role, unidade_id INTO v_perfil FROM public.perfis WHERE id=v_usuario;
      IF NOT FOUND OR v_perfil.role IS NULL OR v_perfil.role NOT IN ('admin','ubs') THEN
        RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
      END IF;
      IF v_perfil.role='ubs' AND (v_perfil.unidade_id IS NULL OR v_perfil.unidade_id IS DISTINCT FROM p_unidade_id) THEN
        RAISE EXCEPTION 'Unidade não autorizada' USING ERRCODE='42501';
      END IF;
      IF p_unidade_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.unidades_saude WHERE id=p_unidade_id) THEN
        RAISE EXCEPTION 'Unidade inválida' USING ERRCODE='22023';
      END IF;
      IF NULLIF(btrim(p_nome),'') IS NULL OR length(btrim(p_nome))>200
        OR p_cpf IS NULL OR p_cpf !~ '^[0-9]{11}$'
        OR p_whatsapp IS NULL OR p_whatsapp !~ '^[0-9]{10,13}$'
        OR p_data_acidente IS NULL OR NOT isfinite(p_data_acidente)
        OR p_data_nascimento IS NULL OR NOT isfinite(p_data_nascimento)
        OR p_data_nascimento > (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
        OR p_datas_previstas IS NULL OR cardinality(p_datas_previstas) NOT BETWEEN 1 AND 20
        OR array_ndims(p_datas_previstas) IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'Dados obrigatórios inválidos' USING ERRCODE='22023';
      END IF;
      FOREACH v_data IN ARRAY p_datas_previstas LOOP
        IF v_data IS NULL OR NOT isfinite(v_data) OR (v_anterior IS NOT NULL AND v_data <= v_anterior) THEN
          RAISE EXCEPTION 'Datas devem ser válidas e estritamente crescentes' USING ERRCODE='22023';
        END IF;
        v_anterior := v_data;
      END LOOP;
      INSERT INTO public.pacientes(unidade_id,nome,cpf,whatsapp,data_acidente,data_nascimento)
      VALUES(p_unidade_id,btrim(p_nome),p_cpf,p_whatsapp,p_data_acidente,p_data_nascimento)
      RETURNING id INTO v_paciente;
      FOREACH v_data IN ARRAY p_datas_previstas LOOP
        v_numero := v_numero + 1;
        INSERT INTO public.esquemas_vacinais(paciente_id,numero_dose,data_prevista,status)
        VALUES(v_paciente,v_numero,v_data,'pendente');
      END LOOP;
      RETURN v_paciente;
    END;
    $body$
  $definition$;
  EXECUTE 'REVOKE ALL ON FUNCTION public.va_cadastrar_atendimento_v2(uuid,text,text,text,date,date,date[]) FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.va_cadastrar_atendimento_v2(uuid,text,text,text,date,date,date[]) TO authenticated';
END;
$migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
