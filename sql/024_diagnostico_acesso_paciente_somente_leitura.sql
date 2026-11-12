-- SOMENTE METADADOS/CONTAGENS. Não lê emails, senhas, tokens ou dados clínicos.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object('capturado_em',now(),
 'triggers_auth',(SELECT jsonb_agg(jsonb_build_object('nome',tgname,'definicao',pg_get_triggerdef(oid),'funcao',pg_get_functiondef(tgfoid))) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('tabela',conrelid::regclass::text,'definicao',pg_get_constraintdef(oid))) FROM pg_constraint WHERE conrelid IN ('public.perfis'::regclass,'public.pacientes'::regclass)),
 'defaults_perfis',(SELECT jsonb_agg(jsonb_build_object('coluna',column_name,'default',column_default,'nullable',is_nullable)) FROM information_schema.columns WHERE table_schema='public' AND table_name='perfis'),
 'politicas',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),
 'rls',(SELECT jsonb_agg(jsonb_build_object('tabela',relname,'ativo',relrowsecurity)) FROM pg_class WHERE oid IN ('public.pacientes'::regclass,'public.esquemas_vacinais'::regclass,'public.aplicacoes_vacinais'::regclass,'public.perfis'::regclass)),
 'contas_com_multiplos_cadastros',(SELECT count(*) FROM (SELECT user_id FROM public.pacientes WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*)>1)x),
 'vinculos_profissionais',(SELECT count(*) FROM public.pacientes p JOIN public.perfis f ON f.id=p.user_id WHERE f.role IN ('admin','ubs')),
 'papeis_api',(SELECT jsonb_agg(jsonb_build_object('papel',rolname,'super',rolsuper,'bypassrls',rolbypassrls)) FROM pg_roles WHERE rolname IN ('anon','authenticated')),
 'escrita_efetiva',(SELECT jsonb_agg(jsonb_build_object('tabela',t,'insert',has_any_column_privilege('authenticated','public.'||t,'INSERT'),'update',has_any_column_privilege('authenticated','public.'||t,'UPDATE'),'delete',has_table_privilege('authenticated','public.'||t,'DELETE'))) FROM unnest(ARRAY['pacientes','esquemas_vacinais','perfis'])t)
) AS acesso_paciente;
ROLLBACK;
