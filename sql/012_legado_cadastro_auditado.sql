-- PROPOSTA NÃO EXECUTADA. Aplicar após 006-r2 aprovada e exame do snapshot 008.
-- Preserva assinatura e defaults do legado; encaminha ao cadastro v2 auditado.
-- Nenhuma chamada foi localizada em src. Consumidores externos precisam de revisão.
BEGIN;
CREATE OR REPLACE FUNCTION public.va_cadastrar_atendimento(
 p_nome text,p_cpf text,p_whatsapp text,p_data_acidente date,p_datas_previstas date[],p_unidade_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_role text; v_unidade uuid;
BEGIN
 SELECT role,unidade_id INTO v_role,v_unidade FROM public.perfis WHERE id=v_uid;
 IF v_uid IS NULL OR v_role IS NULL OR v_role NOT IN ('admin','ubs') THEN RAISE EXCEPTION 'Papel não autorizado' USING ERRCODE='42501'; END IF;
 IF v_role='ubs' AND (v_unidade IS NULL OR (p_unidade_id IS NOT NULL AND p_unidade_id IS DISTINCT FROM v_unidade)) THEN RAISE EXCEPTION 'Unidade não autorizada' USING ERRCODE='42501'; END IF;
 RETURN public.va_cadastrar_atendimento_v2(coalesce(p_unidade_id,v_unidade),p_nome,p_cpf,p_whatsapp,p_data_acidente,NULL,p_datas_previstas);
END;
$$;
REVOKE ALL ON FUNCTION public.va_cadastrar_atendimento(text,text,text,date,date[],uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.va_cadastrar_atendimento(text,text,text,date,date[],uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
