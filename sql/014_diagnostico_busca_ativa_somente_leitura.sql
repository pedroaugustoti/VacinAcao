-- SOMENTE LEITURA. Executar no SQL Editor administrativo e exportar o JSON único.
-- Não lê registros, e-mails, tokens ou senhas; não executa RPCs nem migrações.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
WITH alvo AS (
 SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='contatos_busca_ativa' AND c.relkind IN ('r','p')
), funcoes AS (
 SELECT p.oid,p.proname,format('%I.%I(%s)',n.nspname,p.proname,oidvectortypes(p.proargtypes)) AS assinatura,
  pg_get_function_identity_arguments(p.oid) AS argumentos,pg_get_function_result(p.oid) AS retorno,
  pg_get_userbyid(p.proowner) AS proprietario,p.prosecdef,p.proconfig,
  pg_get_functiondef(p.oid) AS definicao,md5(pg_get_functiondef(p.oid)) AS fingerprint,
  coalesce((SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable)) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a),'[]'::jsonb) AS grants
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND (
  p.proname LIKE 'va\_%' ESCAPE '\'
  OR CASE WHEN p.prokind='f' THEN strpos(pg_get_functiondef(p.oid),'contatos_busca_ativa')>0 ELSE false END
  OR p.oid IN (SELECT tgfoid FROM pg_trigger WHERE tgrelid IN (SELECT oid FROM alvo) AND NOT tgisinternal)
 )
)
SELECT jsonb_build_object(
 'versao',1,'origem','diagnostico_014','capturado_em',CURRENT_TIMESTAMP,'postgres',current_setting('server_version'),
 'tabela',(SELECT jsonb_build_object('identidade','public.contatos_busca_ativa','proprietario',pg_get_userbyid(c.relowner),'rls_ativo',c.relrowsecurity,'rls_forcado',c.relforcerowsecurity,'grants',
   coalesce((SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,'privilege',a.privilege_type,'grantable',a.is_grantable)) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))a),'[]'::jsonb)) FROM alvo c),
 'colunas',coalesce((SELECT jsonb_agg(jsonb_build_object('nome',a.attname,'tipo',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'gerada',a.attgenerated,'identidade',a.attidentity,'grants',
   coalesce((SELECT jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(x.grantor),'grantee',CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,'privilege',x.privilege_type,'grantable',x.is_grantable)) FROM aclexplode(a.attacl)x),'[]'::jsonb)) ORDER BY a.attnum)
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid IN (SELECT oid FROM alvo) AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb),
 'constraints',coalesce((SELECT jsonb_agg(jsonb_build_object('nome',conname,'tipo',contype,'validada',convalidated,'definicao',pg_get_constraintdef(oid),'referencia',CASE WHEN confrelid=0 THEN NULL ELSE confrelid::regclass::text END)) FROM pg_constraint WHERE conrelid IN (SELECT oid FROM alvo)),'[]'::jsonb),
 'indices',coalesce((SELECT jsonb_agg(jsonb_build_object('nome',ci.relname,'definicao',pg_get_indexdef(i.indexrelid),'valido',i.indisvalid,'pronto',i.indisready,'unico',i.indisunique)) FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid WHERE i.indrelid IN (SELECT oid FROM alvo)),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_object('nome',t.tgname,'habilitado',t.tgenabled,'definicao',pg_get_triggerdef(t.oid),'funcao',t.tgfoid::regprocedure::text)) FROM pg_trigger t WHERE t.tgrelid IN (SELECT oid FROM alvo) AND NOT t.tgisinternal),'[]'::jsonb),
 'politicas',coalesce((SELECT jsonb_agg(jsonb_build_object('nome',p.policyname,'permissiva',p.permissive,'papeis',p.roles,'comando',p.cmd,'using',p.qual,'with_check',p.with_check)) FROM pg_policies p WHERE schemaname='public' AND tablename='contatos_busca_ativa'),'[]'::jsonb),
 'funcoes',coalesce((SELECT jsonb_agg(to_jsonb(f)-'oid') FROM funcoes f),'[]'::jsonb),
 'privilegios_efetivos',coalesce((SELECT jsonb_agg(jsonb_build_object('papel',r.rolname,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_any_column_privilege(r.oid,c.oid,'INSERT'),'update',has_any_column_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'),'truncate',has_table_privilege(r.oid,c.oid,'TRUNCATE'),'trigger',has_table_privilege(r.oid,c.oid,'TRIGGER'),'references',has_any_column_privilege(r.oid,c.oid,'REFERENCES'))) FROM pg_roles r CROSS JOIN alvo c WHERE r.rolname IN ('anon','authenticated')),'[]'::jsonb),
 'membros',coalesce((SELECT jsonb_agg(jsonb_build_object('papel',pg_get_userbyid(roleid),'membro',pg_get_userbyid(member),'opcoes',to_jsonb(m)-'grantor')) FROM pg_auth_members m),'[]'::jsonb),
 'dependencias',coalesce((SELECT jsonb_agg(jsonb_build_object('tipo',d.deptype,'dependente',pg_describe_object(d.classid,d.objid,d.objsubid),'referencia',pg_describe_object(d.refclassid,d.refobjid,d.refobjsubid))) FROM pg_depend d WHERE d.refclassid='pg_class'::regclass AND d.refobjid IN (SELECT oid FROM alvo)),'[]'::jsonb)
) AS diagnostico_busca_ativa;
ROLLBACK;
