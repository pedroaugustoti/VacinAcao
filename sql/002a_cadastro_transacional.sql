-- VacinAção v0.2: executar SOMENTE após backup restaurável e teste em ambiente separado.
-- Não altera os dados existentes. Não define protocolo clínico.
BEGIN;
CREATE OR REPLACE FUNCTION public.va_cadastrar_paciente_com_esquema(
  p_unidade_id uuid, p_nome text, p_cpf text, p_whatsapp text,
  p_data_acidente date, p_datas_previstas date[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_usuario uuid := (SELECT auth.uid());
  v_perfil record;
  v_paciente uuid;
  v_i integer;
BEGIN
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória' USING ERRCODE='42501'; END IF;
  SELECT role, unidade_id INTO v_perfil FROM public.perfis WHERE id=v_usuario;
  IF NOT FOUND OR v_perfil.role NOT IN ('admin','ubs') THEN
    RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';
  END IF;
  IF v_perfil.role='ubs' AND v_perfil.unidade_id IS DISTINCT FROM p_unidade_id THEN
    RAISE EXCEPTION 'Unidade não autorizada' USING ERRCODE='42501';
  END IF;
  IF p_unidade_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.unidades_saude WHERE id=p_unidade_id) THEN
    RAISE EXCEPTION 'Unidade inválida';
  END IF;
  IF NULLIF(btrim(p_nome),'') IS NULL OR length(btrim(p_nome))>200
    OR p_cpf !~ '^[0-9]{11}$' OR p_whatsapp !~ '^[0-9]{10,13}$'
    OR p_data_acidente IS NULL OR array_length(p_datas_previstas,1) IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Dados obrigatórios inválidos';
  END IF;
  FOR v_i IN 1..5 LOOP
    IF p_datas_previstas[v_i] IS NULL OR (v_i>1 AND p_datas_previstas[v_i]<p_datas_previstas[v_i-1]) THEN
      RAISE EXCEPTION 'Datas previstas inválidas';
    END IF;
  END LOOP;
  INSERT INTO public.pacientes(unidade_id,nome,cpf,whatsapp,data_acidente)
    VALUES(p_unidade_id,btrim(p_nome),p_cpf,p_whatsapp,p_data_acidente)
    RETURNING id INTO v_paciente;
  FOR v_i IN 1..5 LOOP
    INSERT INTO public.esquemas_vacinais(paciente_id,numero_dose,data_prevista,status)
      VALUES(v_paciente,v_i,p_datas_previstas[v_i],'pendente');
  END LOOP;
  RETURN v_paciente;
END;
$$;
REVOKE ALL ON FUNCTION public.va_cadastrar_paciente_com_esquema(uuid,text,text,text,date,date[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.va_cadastrar_paciente_com_esquema(uuid,text,text,text,date,date[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.va_cadastrar_paciente_com_esquema(uuid,text,text,text,date,date[]) TO authenticated;
COMMIT;
