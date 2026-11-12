BEGIN TRANSACTION READ ONLY;
SELECT 'Saldo deve conferir com movimentos DEMO' AS verificacao,s.lote_id,s.saldo,coalesce(sum(m.delta),0) AS saldo_calculado
FROM public.va_estoque_saldos s LEFT JOIN public.va_estoque_movimentos m ON m.lote_id=s.lote_id
GROUP BY s.lote_id,s.saldo HAVING s.saldo<>coalesce(sum(m.delta),0);
-- Resultado anterior deve ter zero linhas. Próximos checks devem ser true.
SELECT c.relname,c.relrowsecurity AS rls_ativo,
 NOT has_any_column_privilege('authenticated',c.oid,'INSERT,UPDATE') AND NOT has_table_privilege('authenticated',c.oid,'DELETE,TRUNCATE') AS sem_escrita_direta
FROM pg_class c WHERE c.oid IN ('public.va_estoque_saldos'::regclass,'public.va_estoque_movimentos'::regclass);
SELECT nome,has_function_privilege('authenticated',nome,'EXECUTE') AND NOT has_function_privilege('anon',nome,'EXECUTE') AS execute_correto
FROM unnest(ARRAY['public.va_movimentar_estoque_v1(uuid,integer,text,uuid)','public.va_salvar_vacina_v1(uuid,text,text,boolean)','public.va_cadastrar_lote_v1(uuid,uuid,text,text,date)'])nome;
SELECT tgname,tgenabled,pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid='public.aplicacoes_vacinais'::regclass;
ROLLBACK;
