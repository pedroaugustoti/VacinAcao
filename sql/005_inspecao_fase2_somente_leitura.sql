-- Fase 2: SOMENTE LEITURA. Retorna um único resultado, evitando perder os
-- primeiros resultsets ao copiar a saída do SQL Editor. Não executar 004.
BEGIN TRANSACTION READ ONLY;
WITH funcoes AS (
  SELECT p.oid, p.proname, pg_get_userbyid(p.proowner) AS proprietario,
    r.rolsuper AS dono_superusuario, r.rolbypassrls AS dono_bypassrls,
    p.prosecdef AS security_definer, p.proconfig AS configuracao,
    pg_get_function_identity_arguments(p.oid) AS argumentos,
    pg_get_function_result(p.oid) AS retorno,
    pg_get_functiondef(p.oid) AS corpo,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executa,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_executa,
    (SELECT jsonb_agg(jsonb_build_object(
      'beneficiario', CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
      'privilegio', a.privilege_type, 'pode_conceder', a.is_grantable
    )) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a) AS grants
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_roles r ON r.oid=p.proowner
  WHERE n.nspname='public' AND p.prokind='f' AND (
    p.proname LIKE 'va\_%' ESCAPE '\' OR p.oid IN (
      SELECT t.tgfoid FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace ns ON ns.oid=c.relnamespace
      WHERE ns.nspname='public' AND NOT t.tgisinternal
    )
  )
), tabelas AS (
  SELECT c.relname AS tabela, pg_get_userbyid(c.relowner) AS proprietario,
    c.relrowsecurity AS rls_ativo, c.relforcerowsecurity AS rls_forcado
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
), triggers AS (
  SELECT c.relname AS tabela, t.tgname, pg_get_triggerdef(t.oid) AS definicao
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND NOT t.tgisinternal
), constraints AS (
  SELECT c.relname AS tabela, x.conname, pg_get_constraintdef(x.oid) AS definicao
  FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
)
SELECT jsonb_build_object(
  'funcoes', coalesce((SELECT jsonb_agg(to_jsonb(f)-'oid') FROM funcoes f),'[]'::jsonb),
  'tabelas', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM tabelas t),'[]'::jsonb),
  'politicas', coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),'[]'::jsonb),
  'grants_tabelas', coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_table_grants g WHERE table_schema='public' AND grantee IN ('anon','authenticated')),'[]'::jsonb),
  'grants_colunas_perfis', coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.column_privileges g WHERE table_schema='public' AND table_name='perfis' AND grantee IN ('anon','authenticated')),'[]'::jsonb),
  'colunas', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public'),'[]'::jsonb),
  'triggers', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM triggers t),'[]'::jsonb),
  'constraints', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM constraints c),'[]'::jsonb),
  'indices', coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM pg_indexes i WHERE schemaname='public'),'[]'::jsonb)
) AS diagnostico_fase2;
ROLLBACK;
