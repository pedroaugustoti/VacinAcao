-- SOMENTE LEITURA: executar antes/depois; análise de catálogo não encontra todo
-- SQL dinâmico ou corpo PL/pgSQL. Inventariar jobs, BI e integrações fora do banco.
BEGIN TRANSACTION READ ONLY;
SELECT pg_get_userbyid(defaclrole) AS dono,defaclnamespace::regnamespace AS schema,
 defaclobjtype,defaclacl FROM pg_default_acl;
SELECT table_name,is_nullable,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='lotes_vacinas' AND column_name='validade';
SELECT membro.rolname AS membro,papel.rolname AS papel,m.admin_option,
  to_jsonb(m) AS opcoes,pg_has_role(membro.oid,papel.oid,'USAGE') AS heranca_efetiva,
  pg_has_role(membro.oid,papel.oid,'MEMBER') AS membro_direto_ou_indireto
FROM pg_auth_members m JOIN pg_roles membro ON membro.oid=m.member JOIN pg_roles papel ON papel.oid=m.roleid;
SELECT r.rolname,c.relname,
 has_table_privilege(r.oid,c.oid,'SELECT') AS leitura,
 has_any_column_privilege(r.oid,c.oid,'INSERT') AS algum_insert,
 has_any_column_privilege(r.oid,c.oid,'UPDATE') AS algum_update,
 has_table_privilege(r.oid,c.oid,'DELETE') AS exclusao,
 has_table_privilege(r.oid,c.oid,'TRUNCATE') AS truncate,
 has_table_privilege(r.oid,c.oid,'TRIGGER') AS trigger,
 has_any_column_privilege(r.oid,c.oid,'REFERENCES') AS references
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('anon','authenticated') AND n.nspname='public' AND c.relkind IN ('r','p');
SELECT c.oid::regclass AS tabela,a.attname AS coluna,x.* FROM pg_attribute a
JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(a.attacl) x WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped;
SELECT d.deptype,pg_describe_object(d.classid,d.objid,d.objsubid) AS dependente,
 pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid) AS referencia
FROM pg_depend d WHERE (d.refclassid='pg_class'::regclass AND d.refobjid IN (
 SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
)) OR (d.refclassid='pg_proc'::regclass AND d.refobjid IN (
 SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'va\_%' ESCAPE '\'
));
SELECT p.oid::regprocedure AS funcao,p.prosecdef,pg_get_userbyid(p.proowner) AS dono,
 pg_get_functiondef(p.oid) AS corpo,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executa,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_executa
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f';
ROLLBACK;
