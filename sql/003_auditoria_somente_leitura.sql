-- Diagnóstico: executar com conta administrativa no SQL Editor.
-- Somente metadados; não consulta pacientes nem executa RPCs.
BEGIN TRANSACTION READ ONLY;

SELECT n.nspname AS schema, p.proname,
       pg_get_function_identity_arguments(p.oid) AS assinatura,
       pg_get_function_result(p.oid) AS retorno,
       p.prosecdef AS security_definer, p.proconfig,
       pg_get_functiondef(p.oid) AS definicao,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_executa,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS autenticado_executa
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'va_cadastrar_atendimento_v2', 'va_cadastrar_paciente_com_esquema',
  'va_registrar_aplicacao_v1', 'va_atualizar_paciente_v1'
);

SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN (
  'perfis', 'unidades_saude', 'pacientes', 'esquemas_vacinais',
  'vacinas', 'lotes_vacinas', 'aplicacoes_vacinais', 'notificacoes'
) ORDER BY table_name, ordinal_position;

SELECT c.relname, c.relrowsecurity AS rls_ativo, c.relforcerowsecurity AS rls_forcado
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p');

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon','authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'perfis'
  AND grantee IN ('anon','authenticated');

SELECT t.relname AS tabela, c.conname, pg_get_constraintdef(c.oid) AS definicao
FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public';

SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';

SELECT c.relname AS tabela, t.tgname, pg_get_triggerdef(t.oid) AS definicao
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal;

ROLLBACK;
