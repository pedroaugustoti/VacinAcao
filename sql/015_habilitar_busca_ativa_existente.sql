-- 015: DELTA DE PERMISSÕES sobre objetos já presentes no diagnóstico 014.
-- PROPOSTA: aprovação explícita obrigatória. Não executar 011/012 novamente.
-- Pré-requisito: 006-r2 e exportações atuais 008 + 014 preservadas fora do Git.
-- Nenhum registro, definição de função, índice, constraint ou trigger é alterado.
-- Hashes normalizam exclusivamente CRLF/LF. Drift aborta a transação inteira.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.contatos_busca_ativa IN ACCESS SHARE MODE;
DO $guard$
DECLARE f record; actual jsonb; role_name text; table_name text;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Papel de API com SUPERUSER/BYPASSRLS';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.contatos_busca_ativa'::regclass AND relrowsecurity AND pg_get_userbyid(relowner)='postgres') THEN
  RAISE EXCEPTION 'Tabela/RLS/owner divergente; exportar 014 novamente';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('nome',a.attname,'tipo',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'gerada',a.attgenerated,'identidade',a.attidentity) ORDER BY a.attnum)
 INTO actual FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.contatos_busca_ativa'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 IF actual IS DISTINCT FROM '[{"nome":"id","tipo":"uuid","not_null":true,"default":"gen_random_uuid()","gerada":"","identidade":""},{"nome":"paciente_id","tipo":"uuid","not_null":true,"default":null,"gerada":"","identidade":""},{"nome":"unidade_id","tipo":"uuid","not_null":true,"default":null,"gerada":"","identidade":""},{"nome":"esquema_id","tipo":"uuid","not_null":false,"default":null,"gerada":"","identidade":""},{"nome":"responsavel_id","tipo":"uuid","not_null":true,"default":null,"gerada":"","identidade":""},{"nome":"responsavel_nome","tipo":"text","not_null":true,"default":null,"gerada":"","identidade":""},{"nome":"canal","tipo":"text","not_null":true,"default":null,"gerada":"","identidade":""},{"nome":"resultado","tipo":"text","not_null":true,"default":null,"gerada":"","identidade":""},{"nome":"observacoes","tipo":"text","not_null":false,"default":null,"gerada":"","identidade":""},{"nome":"realizado_em","tipo":"timestamp with time zone","not_null":true,"default":null,"gerada":"","identidade":""},{"nome":"proximo_acompanhamento","tipo":"date","not_null":false,"default":null,"gerada":"","identidade":""},{"nome":"contexto","tipo":"text","not_null":true,"default":"''demonstracao''::text","gerada":"","identidade":""},{"nome":"chave_idempotencia","tipo":"uuid","not_null":true,"default":null,"gerada":"","identidade":""},{"nome":"criado_em","tipo":"timestamp with time zone","not_null":true,"default":"now()","gerada":"","identidade":""}]'::jsonb THEN RAISE EXCEPTION 'Colunas divergentes'; END IF;
 SELECT jsonb_agg(jsonb_build_object('nome',conname,'definicao',pg_get_constraintdef(oid)) ORDER BY conname COLLATE "C") INTO actual
 FROM pg_constraint WHERE conrelid='public.contatos_busca_ativa'::regclass AND contype<>'n' AND convalidated;
 IF actual IS DISTINCT FROM '[{"nome":"contatos_busca_ativa_canal_check","definicao":"CHECK ((canal = ANY (ARRAY[''whatsapp''::text, ''telefone''::text, ''presencial''::text, ''sms''::text, ''outro''::text])))"},{"nome":"contatos_busca_ativa_contexto_check","definicao":"CHECK ((contexto = ''demonstracao''::text))"},{"nome":"contatos_busca_ativa_esquema_id_fkey","definicao":"FOREIGN KEY (esquema_id) REFERENCES esquemas_vacinais(id)"},{"nome":"contatos_busca_ativa_observacoes_check","definicao":"CHECK ((length(observacoes) <= 1000))"},{"nome":"contatos_busca_ativa_paciente_id_fkey","definicao":"FOREIGN KEY (paciente_id) REFERENCES pacientes(id)"},{"nome":"contatos_busca_ativa_pkey","definicao":"PRIMARY KEY (id)"},{"nome":"contatos_busca_ativa_responsavel_id_chave_idempotencia_key","definicao":"UNIQUE (responsavel_id, chave_idempotencia)"},{"nome":"contatos_busca_ativa_responsavel_id_fkey","definicao":"FOREIGN KEY (responsavel_id) REFERENCES perfis(id)"},{"nome":"contatos_busca_ativa_resultado_check","definicao":"CHECK ((resultado = ANY (ARRAY[''sem_resposta''::text, ''orientado''::text, ''retorno_agendado''::text, ''recusa''::text, ''telefone_invalido''::text])))"},{"nome":"contatos_busca_ativa_unidade_id_fkey","definicao":"FOREIGN KEY (unidade_id) REFERENCES unidades_saude(id)"}]'::jsonb OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.contatos_busca_ativa'::regclass AND NOT convalidated) THEN RAISE EXCEPTION 'Constraints divergentes'; END IF;
 SELECT jsonb_agg(jsonb_build_object('nome',c.relname,'definicao',pg_get_indexdef(i.indexrelid)) ORDER BY c.relname COLLATE "C") INTO actual
 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.contatos_busca_ativa'::regclass AND i.indisvalid AND i.indisready;
 IF actual IS DISTINCT FROM '[{"nome":"contatos_busca_ativa_pkey","definicao":"CREATE UNIQUE INDEX contatos_busca_ativa_pkey ON public.contatos_busca_ativa USING btree (id)"},{"nome":"contatos_busca_ativa_responsavel_id_chave_idempotencia_key","definicao":"CREATE UNIQUE INDEX contatos_busca_ativa_responsavel_id_chave_idempotencia_key ON public.contatos_busca_ativa USING btree (responsavel_id, chave_idempotencia)"},{"nome":"contatos_paciente_historico_idx","definicao":"CREATE INDEX contatos_paciente_historico_idx ON public.contatos_busca_ativa USING btree (paciente_id, realizado_em DESC, criado_em DESC)"},{"nome":"contatos_unidade_idx","definicao":"CREATE INDEX contatos_unidade_idx ON public.contatos_busca_ativa USING btree (unidade_id, proximo_acompanhamento)"}]'::jsonb THEN RAISE EXCEPTION 'Índices divergentes'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='contatos_busca_ativa')<>1 OR NOT EXISTS(
  SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contatos_busca_ativa' AND policyname='contatos_leitura_equipe'
   AND cmd='SELECT' AND permissive='PERMISSIVE' AND roles=ARRAY['authenticated']::name[] AND with_check IS NULL
   AND qual='(va_is_admin() OR (unidade_id = va_my_unidade()))'
 ) THEN RAISE EXCEPTION 'Política divergente'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.contatos_busca_ativa'::regclass AND NOT tgisinternal)<>1 OR NOT EXISTS(
  SELECT 1 FROM pg_trigger WHERE tgrelid='public.contatos_busca_ativa'::regclass AND NOT tgisinternal AND tgname='contatos_imutaveis'
   AND tgenabled='O' AND tgtype=27 AND tgfoid='public.va_contatos_imutaveis()'::regprocedure
 ) THEN RAISE EXCEPTION 'Trigger de imutabilidade divergente'; END IF;
 FOR f IN SELECT * FROM (VALUES
   ('public.va_listar_busca_ativa_v1(text, integer, integer)','cf5ff0fb4e2554b127301d358c450c37'),
   ('public.va_cadastrar_atendimento_v2(uuid, text, text, text, date, date, date[])','822ff1f5bab3753012e4e917c322c3f5'),
   ('public.va_contatos_imutaveis()','54d3cf76fd7d84cf468b2f3d430203c4'),
   ('public.va_registrar_contato_v1(uuid, uuid, text, text, text, timestamp with time zone, date, uuid)','32cc7fb364369fa5e295226e657b15df'),
   ('public.va_atualizar_paciente_v1(uuid, text, text, text, date, date, text)','1124f1dc04e520a471208762652a45f1'),
   ('public.va_registrar_aplicacao_v1(uuid, uuid, uuid, uuid, timestamp with time zone, text, text, numeric, text, text)','007708301342dc583006c487fb7964af'),
   ('public.va_cadastrar_atendimento(text, text, text, date, date[], uuid)','d7e033e3e89d869720f46d79845324bb')
 ) expected(signature,fingerprint) LOOP
  IF to_regprocedure(f.signature) IS NULL OR md5(replace(pg_get_functiondef(to_regprocedure(f.signature)),E'\r\n',E'\n')) IS DISTINCT FROM f.fingerprint THEN
   RAISE EXCEPTION 'Função divergente ou pré-requisito 006-r2 ausente: %',f.signature;
  END IF;
  IF pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid=to_regprocedure(f.signature))) <> 'postgres' THEN
   RAISE EXCEPTION 'Owner de função divergente: %',f.signature;
  END IF;
 END LOOP;
 -- A presença dos corpos corrigidos não basta: conferir ACLs efetivas do 006.
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH table_name IN ARRAY ARRAY['pacientes','esquemas_vacinais','aplicacoes_vacinais','historico_pacientes'] LOOP
   IF has_any_column_privilege(role_name,'public.'||table_name,'INSERT,UPDATE,REFERENCES')
    OR has_table_privilege(role_name,'public.'||table_name,'DELETE,TRUNCATE,TRIGGER') THEN
    RAISE EXCEPTION '006 incompleto: privilégio clínico excessivo em %.%',role_name,table_name;
   END IF;
  END LOOP;
 END LOOP;
 FOR f IN SELECT * FROM (VALUES
  ('public.va_cadastrar_atendimento_v2(uuid,text,text,text,date,date,date[])'),
  ('public.va_atualizar_paciente_v1(uuid,text,text,text,date,date,text)'),
  ('public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text)'),
  ('public.va_cadastrar_atendimento(text,text,text,date,date[],uuid)')
 ) rpc(signature) LOOP
  IF has_function_privilege('anon',f.signature,'EXECUTE') OR NOT has_function_privilege('authenticated',f.signature,'EXECUTE') THEN
   RAISE EXCEPTION 'EXECUTE clínico/legado incompatível: %',f.signature;
  END IF;
 END LOOP;
END $guard$;
GRANT SELECT ON TABLE public.contatos_busca_ativa TO authenticated;
GRANT EXECUTE ON FUNCTION public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.va_listar_busca_ativa_v1(text,integer,integer) TO authenticated;
DO $check$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_any_column_privilege(r,'public.contatos_busca_ativa','INSERT,UPDATE,REFERENCES')
   OR has_table_privilege(r,'public.contatos_busca_ativa','DELETE,TRUNCATE,TRIGGER')
   OR (r='anon' AND (has_any_column_privilege(r,'public.contatos_busca_ativa','SELECT')
    OR has_function_privilege(r,'public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid)','EXECUTE')
    OR has_function_privilege(r,'public.va_listar_busca_ativa_v1(text,integer,integer)','EXECUTE'))) THEN
   RAISE EXCEPTION 'Privilégio efetivo excessivo (inclui coluna/herança): %',r;
  END IF;
 END LOOP;
END $check$;
NOTIFY pgrst,'reload schema';
COMMIT;
