-- Somente metadados. Não inclui operações, emails, usuários, tokens ou senhas.
-- Executar antes/depois da aplicação aprovada; guardar JSON ignorado com data/hash.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object('capturado_em',now(),
 'colunas',(SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public' AND (table_name LIKE 'va_gestao_%' OR table_name IN ('va_acessos_bloqueados','perfis'))),
 'grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.table_privileges g WHERE table_schema='public' AND (table_name LIKE 'va_gestao_%' OR table_name='va_acessos_bloqueados')),
 'funcoes',(SELECT jsonb_agg(jsonb_build_object('assinatura',p.oid::regprocedure::text,'definicao',pg_get_functiondef(p.oid),'acl',p.proacl,'proprietario',pg_get_userbyid(p.proowner))) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f' AND p.proname LIKE 'va_%'),
 'tabelas',(SELECT jsonb_agg(jsonb_build_object('nome',c.relname,'acl',c.relacl,'proprietario',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'rls_forcado',c.relforcerowsecurity)) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')),
 'acl_colunas',(SELECT jsonb_agg(jsonb_build_object('tabela',c.relname,'coluna',a.attname,'acl',a.attacl)) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),
 'membros',(SELECT jsonb_agg(jsonb_build_object('papel',pg_get_userbyid(m.roleid),'membro',pg_get_userbyid(m.member),'opcoes',to_jsonb(m))) FROM pg_auth_members m),
 'policies',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),
 'indices',(SELECT jsonb_agg(to_jsonb(i)) FROM pg_indexes i WHERE schemaname='public')
) AS backup_gestao;
ROLLBACK;
