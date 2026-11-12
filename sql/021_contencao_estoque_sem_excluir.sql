-- CONTENÇÃO, após aprovação. Não é desinstalação e não apaga movimentos.
-- Suspende as quatro RPCs abaixo enquanto uma correção é preparada.
-- Acesso direto antigo ao catálogo continua conforme RLS/grants anteriores:
-- interromper outros clientes durante a contenção; não é bloqueio global do catálogo.
-- Mantém trigger de consumo: removê-lo permitiria aplicações sem baixa.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.va_movimentar_estoque_v1(uuid,integer,text,uuid),public.va_salvar_vacina_v1(uuid,text,text,boolean),public.va_cadastrar_lote_v1(uuid,uuid,text,text,date),public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text) FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF has_function_privilege('authenticated','public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text)','EXECUTE') OR has_function_privilege('authenticated','public.va_movimentar_estoque_v1(uuid,integer,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Privilégio herdado residual; revisar contenção'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
