-- Executar manualmente antes de criar contas: apenas metadados de auth/users.
-- Não lê e-mails, senhas, tokens ou linhas de auth.users.
BEGIN TRANSACTION READ ONLY;
SELECT t.tgname,pg_get_triggerdef(t.oid) AS trigger,
  pg_get_functiondef(t.tgfoid) AS corpo_funcao
FROM pg_trigger t WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
SELECT conname,pg_get_constraintdef(oid) AS definicao FROM pg_constraint
WHERE conrelid IN ('public.perfis'::regclass,'public.pacientes'::regclass);
SELECT rolname,rolbypassrls,rolsuper,rolinherit FROM pg_roles
WHERE rolname IN ('anon','authenticated');
SELECT r.rolname AS papel,t.tablename,
  has_table_privilege(r.rolname,format('%I.%I',t.schemaname,t.tablename),'TRUNCATE') AS pode_truncate,
  has_table_privilege(r.rolname,format('%I.%I',t.schemaname,t.tablename),'INSERT') AS pode_insert,
  has_table_privilege(r.rolname,format('%I.%I',t.schemaname,t.tablename),'UPDATE') AS pode_update,
  has_table_privilege(r.rolname,format('%I.%I',t.schemaname,t.tablename),'DELETE') AS pode_delete
FROM pg_roles r CROSS JOIN pg_tables t
WHERE r.rolname IN ('anon','authenticated') AND t.schemaname='public';
ROLLBACK;
