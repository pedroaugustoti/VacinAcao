-- BANCO LOCAL DESCARTÁVEL. Schema reduzido dos metadados fornecidos, sem dados reais.
-- Não aplicar este arquivo no Supabase. Não cria contas de Authentication.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
-- Tabela mínima de fixture; não há senhas, tokens, login ou contas remotas.
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
INSERT INTO auth.users VALUES('20000000-0000-0000-0000-000000000004','demo-paciente@vacinacao.invalid');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
CREATE TABLE public.unidades_saude(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nome text NOT NULL);
CREATE TABLE public.perfis(id uuid PRIMARY KEY,unidade_id uuid REFERENCES public.unidades_saude,nome text NOT NULL,role text DEFAULT 'ubs' CHECK(role IN ('admin','ubs')));
CREATE TABLE public.pacientes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,unidade_id uuid NOT NULL REFERENCES public.unidades_saude,nome text NOT NULL,cpf text NOT NULL UNIQUE,whatsapp text NOT NULL,data_acidente date NOT NULL,data_nascimento date);
CREATE TABLE public.esquemas_vacinais(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),paciente_id uuid NOT NULL REFERENCES public.pacientes ON DELETE CASCADE,numero_dose int NOT NULL CHECK(numero_dose BETWEEN 1 AND 5),data_prevista date NOT NULL,data_aplicacao date,status text DEFAULT 'pendente' CHECK(status IN ('pendente','atrasada','aplicada')),conferencia_documental_pendente boolean);
CREATE TABLE public.vacinas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nome text NOT NULL,si_pni text NOT NULL UNIQUE,ativo boolean NOT NULL DEFAULT true);
CREATE TABLE public.lotes_vacinas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vacina_id uuid NOT NULL REFERENCES public.vacinas,unidade_id uuid NOT NULL REFERENCES public.unidades_saude,numero_lote text NOT NULL,fabricante text NOT NULL,validade date NOT NULL,UNIQUE(id,vacina_id,unidade_id));
CREATE TABLE public.aplicacoes_vacinais(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),paciente_id uuid NOT NULL REFERENCES public.pacientes,esquema_id uuid REFERENCES public.esquemas_vacinais,vacina_id uuid NOT NULL REFERENCES public.vacinas,lote_id uuid NOT NULL,unidade_id uuid NOT NULL REFERENCES public.unidades_saude,profissional_id uuid NOT NULL REFERENCES public.perfis,aplicada_em timestamptz NOT NULL,via_administracao text,local_aplicacao text,quantidade numeric(12,3) CHECK(quantidade IS NULL OR quantidade>0),unidade_medida text,observacoes text,status text NOT NULL DEFAULT 'valida' CHECK(status IN ('valida','cancelada')),motivo_cancelamento text,cancelada_em timestamptz,cancelada_por uuid REFERENCES public.perfis,
 FOREIGN KEY(lote_id,vacina_id,unidade_id) REFERENCES public.lotes_vacinas(id,vacina_id,unidade_id),
 CHECK((status='valida' AND cancelada_em IS NULL AND cancelada_por IS NULL AND motivo_cancelamento IS NULL) OR (status='cancelada' AND cancelada_em IS NOT NULL AND cancelada_por IS NOT NULL AND nullif(btrim(motivo_cancelamento),'') IS NOT NULL)));
CREATE UNIQUE INDEX aplicacoes_esquema_valida_unique ON public.aplicacoes_vacinais(esquema_id) WHERE esquema_id IS NOT NULL AND status='valida';
CREATE TABLE public.historico_pacientes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),paciente_id uuid NOT NULL REFERENCES public.pacientes,unidade_id uuid NOT NULL REFERENCES public.unidades_saude,autor_id uuid REFERENCES public.perfis,acao text NOT NULL,detalhes jsonb NOT NULL DEFAULT '{}');
CREATE TABLE public.notificacoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario_id uuid REFERENCES public.perfis,lida boolean DEFAULT false);

CREATE FUNCTION public.va_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.perfis WHERE id=auth.uid() AND role='admin') $$;
CREATE FUNCTION public.va_my_unidade() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT unidade_id FROM public.perfis WHERE id=auth.uid() AND role='ubs' LIMIT 1 $$;
-- Corpos dos dois triggers reproduzidos dos metadados do usuário.
CREATE FUNCTION public.va_validar_aplicacao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_unidade uuid; v_esquema_paciente uuid; v_prof_unidade uuid; v_prof_role text;
BEGIN
 SELECT p.unidade_id INTO v_unidade FROM public.pacientes p WHERE p.id=NEW.paciente_id;
 IF v_unidade IS NULL OR v_unidade<>NEW.unidade_id THEN RAISE EXCEPTION 'Paciente nao pertence a unidade informada'; END IF;
 IF NEW.esquema_id IS NOT NULL THEN
 SELECT e.paciente_id INTO v_esquema_paciente FROM public.esquemas_vacinais e WHERE e.id=NEW.esquema_id;
 IF v_esquema_paciente IS DISTINCT FROM NEW.paciente_id THEN RAISE EXCEPTION 'Esquema nao pertence ao paciente'; END IF;
 END IF;
 SELECT p.unidade_id,p.role INTO v_prof_unidade,v_prof_role FROM public.perfis p WHERE p.id=NEW.profissional_id;
 IF v_prof_role IS NULL OR (v_prof_role<>'admin' AND (v_prof_role<>'ubs' OR v_prof_unidade IS DISTINCT FROM NEW.unidade_id)) THEN RAISE EXCEPTION 'Profissional sem permissao para unidade'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.va_proteger_aplicacao() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Aplicacoes nao podem ser excluidas'; END IF;
 IF OLD.status<>'valida' OR NEW.status<>'cancelada' OR (to_jsonb(NEW)-'status'-'motivo_cancelamento'-'cancelada_em'-'cancelada_por') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'motivo_cancelamento'-'cancelada_em'-'cancelada_por') THEN RAISE EXCEPTION 'Somente cancelamento auditado e permitido'; END IF;
 IF NEW.cancelada_por IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Cancelamento deve identificar usuario autenticado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER va_validar_aplicacao_trg BEFORE INSERT OR UPDATE ON public.aplicacoes_vacinais FOR EACH ROW EXECUTE FUNCTION public.va_validar_aplicacao();
CREATE TRIGGER va_proteger_aplicacao_trg BEFORE DELETE OR UPDATE ON public.aplicacoes_vacinais FOR EACH ROW EXECUTE FUNCTION public.va_proteger_aplicacao();

-- Baselines SIMULADAS somente para testar CREATE OR REPLACE/backup/rollback;
-- não se apresentam como as definições originais do Supabase.
CREATE FUNCTION public.va_cadastrar_atendimento_v2(p_unidade_id uuid,p_nome text,p_cpf text,p_whatsapp text,p_data_acidente date,p_data_nascimento date,p_datas_previstas date[]) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.va_atualizar_paciente_v1(p_paciente_id uuid,p_nome text,p_cpf text,p_whatsapp text,p_data_nascimento date,p_data_acidente date,p_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END $$;
CREATE FUNCTION public.va_registrar_aplicacao_v1(p_paciente_id uuid,p_esquema_id uuid,p_vacina_id uuid,p_lote_id uuid,p_aplicada_em timestamptz,p_via text,p_local text,p_quantidade numeric,p_unidade_medida text,p_observacoes text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT NULL::uuid $$;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
GRANT UPDATE(cpf) ON public.pacientes TO authenticated;
GRANT REFERENCES(validade) ON public.lotes_vacinas TO anon;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['unidades_saude','perfis','pacientes','esquemas_vacinais','vacinas','lotes_vacinas','aplicacoes_vacinais','historico_pacientes','notificacoes'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
CREATE POLICY profissional ON public.perfis FOR SELECT USING(id=auth.uid() OR public.va_is_admin());
CREATE POLICY paciente_own ON public.pacientes FOR SELECT USING(user_id=auth.uid());
CREATE POLICY paciente_staff ON public.pacientes FOR ALL USING(public.va_is_admin() OR unidade_id=public.va_my_unidade());
CREATE POLICY dose_read ON public.esquemas_vacinais FOR SELECT USING(EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=paciente_id));
CREATE POLICY dose_staff ON public.esquemas_vacinais FOR ALL USING(public.va_is_admin() OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=paciente_id AND p.unidade_id=public.va_my_unidade()));
CREATE POLICY application_read ON public.aplicacoes_vacinais FOR SELECT USING(public.va_is_admin() OR unidade_id=public.va_my_unidade() OR EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=paciente_id AND p.user_id=auth.uid()));
CREATE POLICY audit_read ON public.historico_pacientes FOR SELECT USING(public.va_is_admin() OR unidade_id=public.va_my_unidade());

INSERT INTO public.unidades_saude VALUES('10000000-0000-0000-0000-000000000001','DEMO A'),('10000000-0000-0000-0000-000000000002','DEMO B');
INSERT INTO public.perfis VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','DEMO UBS A','ubs'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','DEMO UBS B','ubs'),('20000000-0000-0000-0000-000000000003',NULL,'DEMO ADMIN','admin');
INSERT INTO public.pacientes VALUES('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','DEMO HOMOLOG FIXTURE','00000000000','00000000000','2001-01-01','2000-01-01');
INSERT INTO public.esquemas_vacinais(id,paciente_id,numero_dose,data_prevista,status,conferencia_documental_pendente) VALUES('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'2002-01-01','pendente',false);
INSERT INTO public.vacinas VALUES('50000000-0000-0000-0000-000000000001','DEMO','DEMO',true);
INSERT INTO public.lotes_vacinas VALUES('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','DEMO','DEMO','2005-01-01');
