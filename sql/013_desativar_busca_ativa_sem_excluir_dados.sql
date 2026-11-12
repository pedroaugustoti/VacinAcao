-- REVERSÃO DE DISPONIBILIDADE, SOMENTE APÓS APROVAÇÃO MANUAL.
-- Para instalação que já recebeu 011. Preserva tabela, contatos, auditoria e dados.
-- Não reverte 006/012; usar o rollback gerado do snapshot para esses corpos/grants.
BEGIN;
REVOKE ALL ON FUNCTION public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.va_listar_busca_ativa_v1(text,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.contatos_busca_ativa FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid)','EXECUTE')
   OR has_function_privilege('authenticated','public.va_listar_busca_ativa_v1(text,integer,integer)','EXECUTE') THEN
   RAISE EXCEPTION 'Permissão herdada residual: revisar antes de desativar';
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
