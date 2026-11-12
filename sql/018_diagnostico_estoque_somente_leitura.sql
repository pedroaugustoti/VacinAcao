-- SOMENTE LEITURA. Exportar JSON integral antes de aprovar 019. Não lê pessoas.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object('capturado_em',now(),
 'tabelas_publicas',(SELECT jsonb_agg(tablename) FROM pg_tables WHERE schemaname='public'),
 'colunas',(SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public' AND (table_name IN ('vacinas','lotes_vacinas') OR table_name ~* 'estoque|saldo|moviment')),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('tabela',conrelid::regclass::text,'definicao',pg_get_constraintdef(oid))) FROM pg_constraint WHERE connamespace='public'::regnamespace),
 'politicas',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),
 'indices',(SELECT jsonb_agg(to_jsonb(i)) FROM pg_indexes i WHERE schemaname='public'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('tabela',tgrelid::regclass::text,'definicao',pg_get_triggerdef(oid),'habilitado',tgenabled)) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)),
 'funcoes',(SELECT jsonb_agg(jsonb_build_object('assinatura',p.oid::regprocedure::text,'definicao',pg_get_functiondef(p.oid),'acl',p.proacl)) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND prokind='f' AND (proname LIKE 'va_%' OR proname ~* 'estoque|saldo|moviment')),
 'grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.table_privileges g WHERE table_schema='public'),
 'grants_colunas',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.column_privileges g WHERE table_schema='public' AND table_name IN ('vacinas','lotes_vacinas'))
) AS diagnostico_estoque;
ROLLBACK;
