-- REVERSÃO DIRECIONADA DO 015. Aprovação manual obrigatória.
-- Restaura a ausência dos três grants observada no diagnóstico 014 de 12/11.
-- Preserva funções, políticas, tabela e TODOS os registros/auditoria.
-- Não reverte 006-r2. Não restaura dados nem desfaz contatos já registrados.
BEGIN;
REVOKE SELECT ON TABLE public.contatos_busca_ativa FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.va_listar_busca_ativa_v1(text,integer,integer) FROM authenticated;
DO $$ BEGIN
 IF has_any_column_privilege('authenticated','public.contatos_busca_ativa','SELECT')
  OR has_function_privilege('authenticated','public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid)','EXECUTE')
  OR has_function_privilege('authenticated','public.va_listar_busca_ativa_v1(text,integer,integer)','EXECUTE') THEN
  RAISE EXCEPTION 'Permissão residual por coluna/PUBLIC/herança: reversão abortada para revisão';
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
