-- SOMENTE LEITURA. Exportar a coluna backup como JSON ANTES da aplicação aprovada.
-- Sem linhas de pacientes, perfis ou auth.users; sem senhas, tokens ou chaves.
-- Snapshot de código/ACLs não é backup dos dados nem autorização para rollback.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH tabelas AS (
 SELECT c.oid,format('%I.%I',n.nspname,c.relname) AS identidade,
   pg_get_userbyid(c.relowner) AS proprietario,c.relrowsecurity,c.relforcerowsecurity,
   coalesce((SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable)) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),'[]'::jsonb) AS grants,
   coalesce((SELECT jsonb_agg(jsonb_build_object('column',att.attname,'grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable)) FROM pg_attribute att CROSS JOIN LATERAL aclexplode(att.attacl) a WHERE att.attrelid=c.oid AND att.attnum>0 AND NOT att.attisdropped),'[]'::jsonb) AS column_grants
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN ('unidades_saude','perfis','pacientes','esquemas_vacinais','vacinas','lotes_vacinas','aplicacoes_vacinais','historico_pacientes','notificacoes') AND c.relkind IN ('r','p')
), funcoes AS (
 SELECT p.oid,format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) AS identidade,
   p.proname,format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) AS assinatura,
   pg_get_userbyid(p.proowner) AS proprietario,pg_get_functiondef(p.oid) AS definicao,
   md5(pg_get_functiondef(p.oid)) AS fingerprint,
   coalesce((SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable)) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a),'[]'::jsonb) AS grants
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.proname LIKE 'va\_%' ESCAPE '\'
)
SELECT jsonb_build_object('versao',1,'capturado_em',CURRENT_TIMESTAMP,'postgres',current_setting('server_version'),
 'funcoes',(SELECT jsonb_agg(to_jsonb(f)-'oid') FROM funcoes f),
 'tabelas',(SELECT jsonb_agg(to_jsonb(t)-'oid') FROM tabelas t),
 'politicas',(SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname='public'),
 'constraints',(SELECT jsonb_agg(jsonb_build_object('tabela',c.conrelid::regclass::text,'nome',c.conname,'definicao',pg_get_constraintdef(c.oid))) FROM pg_constraint c WHERE c.conrelid IN (SELECT oid FROM tabelas)),
 'indices',(SELECT jsonb_agg(to_jsonb(i)) FROM pg_indexes i WHERE schemaname='public'),
 'triggers',(SELECT jsonb_agg(jsonb_build_object('tabela',t.tgrelid::regclass::text,'definicao',pg_get_triggerdef(t.oid),'funcao',pg_get_functiondef(t.tgfoid))) FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN (SELECT oid FROM tabelas)),
 'papeis',(SELECT jsonb_agg(jsonb_build_object('nome',rolname,'superuser',rolsuper,'bypassrls',rolbypassrls,'inherit',rolinherit)) FROM pg_roles WHERE rolname IN ('anon','authenticated') OR oid IN (SELECT proowner FROM pg_proc WHERE oid IN (SELECT oid FROM funcoes))),
 'membros',(SELECT jsonb_agg(jsonb_build_object('papel',pg_get_userbyid(roleid),'membro',pg_get_userbyid(member),'opcoes',to_jsonb(m)-'grantor')) FROM pg_auth_members m),
 'default_acls',(SELECT jsonb_agg(to_jsonb(d)) FROM pg_default_acl d)
) AS backup;
ROLLBACK;
