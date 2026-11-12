-- PROPOSTA PARA APROVAÇÃO. Exige revisão do 024 e backup atual 008/018.
-- Não cria nem modifica auth.users/perfis. Não envia mensagem ou cria credenciais.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Papel da API incompatível com RLS'; END IF;
 IF has_column_privilege('authenticated','public.pacientes','user_id','UPDATE') OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='perfis' AND cmd IN ('ALL','INSERT','UPDATE')) THEN RAISE EXCEPTION 'Revisar escrita direta de vínculos/perfis antes de habilitar'; END IF;
 IF EXISTS(SELECT 1 FROM public.pacientes WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Vínculos múltiplos existentes exigem revisão humana, sem exclusão automática'; END IF;
END $$;
CREATE UNIQUE INDEX va_paciente_conta_unica ON public.pacientes(user_id) WHERE user_id IS NOT NULL;
-- A unidade do próprio cadastro precisa ser legível no PWA. Preserva policies anteriores.
CREATE POLICY va_paciente_unidade_select ON public.unidades_saude FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.pacientes p WHERE p.user_id=(SELECT auth.uid()) AND p.unidade_id=unidades_saude.id));
CREATE FUNCTION public.va_vincular_conta_paciente_v1(p_paciente_id uuid,p_usuario_id uuid,p_email_confirmado text,p_motivo text,p_identidade_conferida boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); p public.pacientes%ROWTYPE; email_conta text; confirmado timestamptz;
BEGIN
 IF u IS NULL OR NOT public.va_is_admin() THEN RAISE EXCEPTION 'Vínculo exige administrador autorizado' USING ERRCODE='42501'; END IF;
 IF p_identidade_conferida IS DISTINCT FROM true OR p_usuario_id IS NULL OR nullif(btrim(p_email_confirmado),'') IS NULL OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 20 AND 500 THEN RAISE EXCEPTION 'Conferência institucional e justificativa obrigatórias' USING ERRCODE='22023'; END IF;
 SELECT email,email_confirmed_at INTO email_conta,confirmado FROM auth.users WHERE id=p_usuario_id FOR UPDATE;
 IF NOT FOUND OR confirmado IS NULL OR lower(email_conta) IS DISTINCT FROM lower(btrim(p_email_confirmado)) OR EXISTS(SELECT 1 FROM public.perfis WHERE id=p_usuario_id) THEN RAISE EXCEPTION 'Conta não elegível ou conferência divergente' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM public.pacientes WHERE id=p_paciente_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não acessível' USING ERRCODE='42501'; END IF;
 IF p.user_id IS NOT NULL AND p.user_id IS DISTINCT FROM p_usuario_id THEN RAISE EXCEPTION 'Cadastro já possui vínculo; não será substituído' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM public.pacientes WHERE user_id=p_usuario_id AND id<>p_paciente_id) THEN RAISE EXCEPTION 'Conta já vinculada a outro cadastro' USING ERRCODE='23505'; END IF;
 IF p.user_id=p_usuario_id THEN RETURN p.id; END IF;
 UPDATE public.pacientes SET user_id=p_usuario_id WHERE id=p.id;
 INSERT INTO public.historico_pacientes(paciente_id,unidade_id,autor_id,acao,detalhes)
 VALUES(p.id,p.unidade_id,u,'VINCULO_CONTA_PACIENTE',jsonb_build_object('usuario_id',p_usuario_id,'motivo',btrim(p_motivo),'conferencia_institucional',true));
 RETURN p.id;
END $$;
REVOKE ALL ON FUNCTION public.va_vincular_conta_paciente_v1(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.va_vincular_conta_paciente_v1(uuid,uuid,text,text,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
