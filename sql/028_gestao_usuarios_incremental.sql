-- PROPOSTA: NÃO EXECUTAR SEM APROVAÇÃO E BACKUP FINAL ATUALIZADO.
-- Pré-requisitos: objetos 019/025 compatíveis. Não recria Auth nem políticas anteriores.
-- Salva corpos anteriores para reversão; guard adicionado às RPCs sem mudar contratos.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.perfis ADD COLUMN funcao text;
CREATE TABLE public.va_gestao_operacoes(
 id uuid PRIMARY KEY, autor_id uuid NOT NULL REFERENCES public.perfis(id),
 tipo text NOT NULL CHECK(tipo IN ('equipe','paciente')), email text NOT NULL,
 nome text NOT NULL, funcao text, unidade_id uuid REFERENCES public.unidades_saude(id),
 paciente_id uuid UNIQUE REFERENCES public.pacientes(id), usuario_id uuid REFERENCES auth.users(id),
 fingerprint text NOT NULL, estado text NOT NULL DEFAULT 'reservado' CHECK(estado IN ('reservado','auth_criado','concluido','falha')),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX va_gestao_email_unico ON public.va_gestao_operacoes(lower(email));
CREATE TABLE public.va_acessos_bloqueados(usuario_id uuid PRIMARY KEY REFERENCES auth.users(id),bloqueado boolean NOT NULL,autor_id uuid NOT NULL REFERENCES public.perfis(id),atualizado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.va_gestao_eventos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),autor_id uuid NOT NULL REFERENCES public.perfis(id),usuario_id uuid REFERENCES auth.users(id),acao text NOT NULL,criado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.va_gestao_definicoes(assinatura text PRIMARY KEY,definicao text NOT NULL);
ALTER TABLE public.va_gestao_operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_acessos_bloqueados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_gestao_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_gestao_definicoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.va_gestao_operacoes,public.va_acessos_bloqueados,public.va_gestao_eventos,public.va_gestao_definicoes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.va_gestao_operacoes,public.va_acessos_bloqueados,public.va_gestao_eventos TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.va_gestao_operacoes TO service_role;
CREATE FUNCTION public.va_acesso_habilitado() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.va_acessos_bloqueados WHERE usuario_id=auth.uid() AND bloqueado)
$$;
REVOKE ALL ON FUNCTION public.va_acesso_habilitado() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.va_acesso_habilitado() TO authenticated;
CREATE POLICY va_gestao_admin_read ON public.va_gestao_operacoes FOR SELECT TO authenticated USING(public.va_is_admin() AND public.va_acesso_habilitado());
CREATE POLICY va_bloqueios_admin_read ON public.va_acessos_bloqueados FOR SELECT TO authenticated USING(public.va_is_admin() AND public.va_acesso_habilitado());
CREATE POLICY va_eventos_admin_read ON public.va_gestao_eventos FOR SELECT TO authenticated USING(public.va_is_admin() AND public.va_acesso_habilitado());
-- Guard nas RPCs SECURITY DEFINER já existentes: RLS sozinho não as protege.
DO $guard$
DECLARE f record; names text[]:=ARRAY['va_cadastrar_atendimento','va_cadastrar_atendimento_v2','va_atualizar_paciente_v1','va_registrar_aplicacao_v1','va_registrar_contato_v1','va_listar_busca_ativa_v1','va_movimentar_estoque_v1','va_salvar_vacina_v1','va_cadastrar_lote_v1','va_vincular_conta_paciente_v1']; n int:=0;
BEGIN
 FOR f IN SELECT p.oid,p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=ANY(names) AND p.prokind='f' LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=f.oid AND prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')) OR f.definition !~ '\mBEGIN\M' THEN RAISE EXCEPTION 'Contrato divergente: %',f.signature; END IF;
  INSERT INTO public.va_gestao_definicoes VALUES(f.signature,f.definition);
  EXECUTE regexp_replace(f.definition,'\mBEGIN\M','BEGIN IF NOT public.va_acesso_habilitado() THEN RAISE EXCEPTION ''Acesso desativado'' USING ERRCODE=''42501''; END IF;');
  n:=n+1;
 END LOOP;
 IF n<>10 THEN RAISE EXCEPTION 'Esperadas dez RPCs, encontradas %; rever snapshot',n; END IF;
END $guard$;
-- Restrição adicional mantém todas as policies anteriores, inclusive por unidade.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['perfis','unidades_saude','pacientes','esquemas_vacinais','aplicacoes_vacinais','historico_pacientes','contatos_busca_ativa','vacinas','lotes_vacinas','notificacoes','va_estoque_saldos','va_estoque_movimentos'] LOOP
  EXECUTE format('CREATE POLICY va_acesso_habilitado_restritivo ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING(public.va_acesso_habilitado()) WITH CHECK(public.va_acesso_habilitado())',t);
 END LOOP;
END $$;
CREATE FUNCTION public.va_gestao_auth_uuid(p_operacao uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; BEGIN
 IF auth.uid() IS NULL OR NOT public.va_is_admin() OR NOT public.va_acesso_habilitado() THEN RAISE EXCEPTION 'Administrador obrigatório' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.va_gestao_operacoes WHERE id=p_operacao AND autor_id=auth.uid()) THEN RAISE EXCEPTION 'Operação não acessível' USING ERRCODE='42501'; END IF;
 SELECT id INTO result FROM auth.users WHERE raw_app_meta_data->>'va_operation_id'=p_operacao::text;
 RETURN result;
END $$;
CREATE FUNCTION public.va_gestao_finalizar_equipe(p_operacao uuid,p_usuario uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.va_gestao_operacoes%ROWTYPE; BEGIN
 IF auth.uid() IS NULL OR NOT public.va_is_admin() OR NOT public.va_acesso_habilitado() THEN RAISE EXCEPTION 'Administrador obrigatório' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.va_gestao_operacoes WHERE id=p_operacao AND autor_id=auth.uid() AND tipo='equipe' FOR UPDATE;
 IF NOT FOUND OR o.unidade_id IS NULL OR o.unidade_id IS DISTINCT FROM (SELECT id FROM public.unidades_saude WHERE id=o.unidade_id) OR p_usuario IS DISTINCT FROM public.va_gestao_auth_uuid(p_operacao) THEN RAISE EXCEPTION 'Operação divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_usuario AND lower(email)=lower(o.email) AND email_confirmed_at IS NOT NULL) THEN RAISE EXCEPTION 'Identidade Auth não corresponde à operação'; END IF;
 IF EXISTS(SELECT 1 FROM public.pacientes WHERE user_id=p_usuario) THEN RAISE EXCEPTION 'Conta de paciente não pode ser profissional'; END IF;
 IF EXISTS(SELECT 1 FROM public.perfis WHERE id=p_usuario) THEN
  IF NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=p_usuario AND role='ubs' AND unidade_id=o.unidade_id AND nome=o.nome AND funcao IS NOT DISTINCT FROM o.funcao) THEN RAISE EXCEPTION 'Perfil existente divergente; não sobrescrever'; END IF;
 ELSE INSERT INTO public.perfis(id,nome,role,unidade_id,funcao)VALUES(p_usuario,o.nome,'ubs',o.unidade_id,o.funcao); END IF;
 UPDATE public.va_gestao_operacoes SET usuario_id=p_usuario,estado='concluido' WHERE id=o.id;
 INSERT INTO public.va_gestao_eventos(autor_id,usuario_id,acao)SELECT auth.uid(),p_usuario,'PROFISSIONAL_PROVISIONADO' WHERE o.estado<>'concluido';
END $$;
CREATE FUNCTION public.va_gestao_bloquear(p_usuario uuid,p_bloqueado boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.va_is_admin() OR NOT public.va_acesso_habilitado() THEN RAISE EXCEPTION 'Administrador obrigatório' USING ERRCODE='42501'; END IF;
 IF p_usuario=auth.uid() OR p_bloqueado IS NULL OR EXISTS(SELECT 1 FROM public.perfis WHERE id=p_usuario AND role='admin') THEN RAISE EXCEPTION 'Não é permitido alterar acesso de administrador' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=p_usuario AND role='ubs') AND NOT EXISTS(SELECT 1 FROM public.pacientes WHERE user_id=p_usuario) THEN RAISE EXCEPTION 'Conta não gerenciada' USING ERRCODE='42501'; END IF;
 IF NOT p_bloqueado AND EXISTS(SELECT 1 FROM public.va_gestao_operacoes WHERE usuario_id=p_usuario AND estado<>'concluido') THEN RAISE EXCEPTION 'Provisionamento pendente; concluir antes de liberar' USING ERRCODE='42501'; END IF;
 INSERT INTO public.va_acessos_bloqueados VALUES(p_usuario,p_bloqueado,auth.uid(),now()) ON CONFLICT(usuario_id) DO UPDATE SET bloqueado=EXCLUDED.bloqueado,autor_id=EXCLUDED.autor_id,atualizado_em=now();
 INSERT INTO public.va_gestao_eventos(autor_id,usuario_id,acao)VALUES(auth.uid(),p_usuario,CASE WHEN p_bloqueado THEN 'ACESSO_BLOQUEADO' ELSE 'ACESSO_LIBERADO' END);
END $$;
CREATE FUNCTION public.va_salvar_unidade_admin_v1(p_id uuid,p_nome text,p_cidade text,p_telefone text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; BEGIN
 IF auth.uid() IS NULL OR NOT public.va_is_admin() OR NOT public.va_acesso_habilitado() THEN RAISE EXCEPTION 'Administrador obrigatório' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_nome),'') IS NULL OR length(p_nome)>200 OR length(coalesce(p_cidade,''))>100 OR length(coalesce(p_telefone,''))>30 THEN RAISE EXCEPTION 'Unidade inválida'; END IF;
 IF p_id IS NULL THEN INSERT INTO public.unidades_saude(nome,cidade,telefone) VALUES(btrim(p_nome),nullif(btrim(p_cidade),''),nullif(btrim(p_telefone),'')) RETURNING id INTO result;
 ELSE UPDATE public.unidades_saude SET nome=btrim(p_nome),cidade=nullif(btrim(p_cidade),''),telefone=nullif(btrim(p_telefone),'') WHERE id=p_id RETURNING id INTO result; IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada'; END IF; END IF;
 INSERT INTO public.va_gestao_eventos(autor_id,acao)VALUES(auth.uid(),'UNIDADE_SALVA'); RETURN result;
END $$;
CREATE FUNCTION public.va_gestao_listar_equipe(p_busca text DEFAULT NULL,p_unidade uuid DEFAULT NULL,p_status text DEFAULT NULL,p_pagina integer DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 IF auth.uid() IS NULL OR NOT public.va_is_admin() OR NOT public.va_acesso_habilitado() THEN RAISE EXCEPTION 'Administrador obrigatório' USING ERRCODE='42501'; END IF;
 IF p_pagina IS NULL OR p_pagina NOT BETWEEN 1 AND 10000 OR length(coalesce(p_busca,''))>100 OR (p_status IS NOT NULL AND p_status NOT IN ('ativo','pendente','bloqueado','não verificado')) THEN RAISE EXCEPTION 'Filtros inválidos'; END IF;
 WITH equipe AS (
  SELECT p.id,p.nome,p.funcao,p.role,p.unidade_id,u.email,
   CASE WHEN b.bloqueado OR u.banned_until>now() THEN 'bloqueado' WHEN u.id IS NULL THEN 'não verificado' WHEN u.last_sign_in_at IS NULL THEN 'pendente' ELSE 'ativo' END AS status
  FROM public.perfis p LEFT JOIN auth.users u ON u.id=p.id LEFT JOIN public.va_acessos_bloqueados b ON b.usuario_id=p.id
 ), filtrada AS (SELECT * FROM equipe WHERE (p_unidade IS NULL OR unidade_id=p_unidade) AND (p_status IS NULL OR status=p_status) AND (nullif(btrim(p_busca),'') IS NULL OR strpos(lower(nome||' '||coalesce(email,'')),lower(btrim(p_busca)))>0)),
 pagina AS (SELECT * FROM filtrada ORDER BY nome,id LIMIT 50 OFFSET (p_pagina-1)*50)
 SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(pagina)) FROM pagina),'[]'::jsonb),'total',(SELECT count(*) FROM filtrada),'pagina',p_pagina) INTO result;
 RETURN result;
END $$;
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY['public.va_gestao_auth_uuid(uuid)'::regprocedure,'public.va_gestao_finalizar_equipe(uuid,uuid)'::regprocedure,'public.va_gestao_bloquear(uuid,boolean)'::regprocedure,'public.va_salvar_unidade_admin_v1(uuid,text,text,text)'::regprocedure,'public.va_gestao_listar_equipe(text,uuid,text,integer)'::regprocedure] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f); END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
