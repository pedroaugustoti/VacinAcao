-- APENAS COM APROVAÇÃO. Antes: VACINACAO_GESTAO_ESCRITA=nao e EMAIL_AUTORIZADO=nao.
-- Suspende novas operações administrativas; mantém bloqueios/RLS/guards/dados e auditoria.
-- Não restaura corpos antigos enquanto existirem contas bloqueadas ou operações pendentes.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.va_gestao_auth_uuid(uuid),public.va_gestao_finalizar_equipe(uuid,uuid),public.va_gestao_bloquear(uuid,boolean),public.va_salvar_unidade_admin_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY['public.va_gestao_auth_uuid(uuid)'::regprocedure,'public.va_gestao_finalizar_equipe(uuid,uuid)'::regprocedure,'public.va_gestao_bloquear(uuid,boolean)'::regprocedure,'public.va_salvar_unidade_admin_v1(uuid,text,text,text)'::regprocedure] LOOP
 IF has_function_privilege('authenticated',f,'EXECUTE') THEN RAISE EXCEPTION 'EXECUTE herdado residual; revisar contenção'; END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
