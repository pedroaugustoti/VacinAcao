-- PROPOSTA. Exige aprovação, snapshots 008/014/018 atuais e 006-r2 -> 015.
-- Modelo DEMO em UNIDADES DE APLICAÇÃO: uma aplicação consome UMA unidade,
-- independentemente do volume clínico (mL). Sem frascos multidose/conversões.
-- Não executar se 018 identificar modelo existente que deva ser integrado.
-- Sem IF NOT EXISTS: conflito aborta, não mascara schema incompatível.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Papel de API com privilégios incompatíveis com RLS'; END IF;
 IF md5(replace(pg_get_functiondef('public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text)'::regprocedure),E'\r\n',E'\n'))<>'007708301342dc583006c487fb7964af'
 OR has_function_privilege('anon','public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text)','EXECUTE')
 OR has_any_column_privilege('authenticated','public.aplicacoes_vacinais','INSERT,UPDATE') THEN
 RAISE EXCEPTION '006-r2 ausente ou permissões clínicas incompatíveis'; END IF;
END $$;
CREATE TABLE public.va_estoque_saldos(
 lote_id uuid PRIMARY KEY REFERENCES public.lotes_vacinas(id),
 unidade_id uuid NOT NULL REFERENCES public.unidades_saude(id),
 saldo integer NOT NULL DEFAULT 0 CHECK(saldo>=0),
 contexto text NOT NULL DEFAULT 'demonstracao' CHECK(contexto='demonstracao')
);
CREATE TABLE public.va_estoque_movimentos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lote_id uuid NOT NULL REFERENCES public.lotes_vacinas(id),
 unidade_id uuid NOT NULL REFERENCES public.unidades_saude(id),
 delta integer NOT NULL CHECK(delta<>0), motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 8 AND 500),
 responsavel_id uuid NOT NULL REFERENCES public.perfis(id), criado_em timestamptz NOT NULL DEFAULT now(),
 chave uuid NOT NULL, aplicacao_id uuid UNIQUE REFERENCES public.aplicacoes_vacinais(id),
 contexto text NOT NULL DEFAULT 'demonstracao' CHECK(contexto='demonstracao'), UNIQUE(responsavel_id,chave)
);
CREATE INDEX va_estoque_mov_lote_idx ON public.va_estoque_movimentos(lote_id,criado_em DESC);
ALTER TABLE public.va_estoque_saldos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_estoque_movimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY va_estoque_saldos_read ON public.va_estoque_saldos FOR SELECT TO authenticated USING(public.va_is_admin() OR unidade_id=public.va_my_unidade());
CREATE POLICY va_estoque_mov_read ON public.va_estoque_movimentos FOR SELECT TO authenticated USING(public.va_is_admin() OR unidade_id=public.va_my_unidade());
REVOKE ALL ON public.va_estoque_saldos,public.va_estoque_movimentos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.va_estoque_saldos,public.va_estoque_movimentos TO authenticated;

CREATE FUNCTION public.va_movimentar_estoque_v1(p_lote_id uuid,p_delta integer,p_motivo text,p_chave uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r text; un uuid; l public.lotes_vacinas%ROWTYPE; old public.va_estoque_movimentos%ROWTYPE; result uuid;
BEGIN
 SELECT role,unidade_id INTO r,un FROM public.perfis WHERE id=u;
 IF u IS NULL OR r IS NULL OR r NOT IN ('admin','ubs') THEN RAISE EXCEPTION 'Acesso profissional obrigatório' USING ERRCODE='42501'; END IF;
 -- Mesma ordem de locks em movimentos e consumo: lote -> saldo.
 SELECT * INTO l FROM public.lotes_vacinas WHERE id=p_lote_id AND (r='admin' OR unidade_id=un) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lote não acessível' USING ERRCODE='42501'; END IF;
 IF p_delta IS NULL OR p_delta=0 OR p_delta NOT BETWEEN -1000000 AND 1000000 OR p_chave IS NULL OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'Movimento inválido' USING ERRCODE='22023'; END IF;
 IF p_delta>0 AND (l.validade IS NULL OR NOT isfinite(l.validade) OR l.validade<(now() AT TIME ZONE 'America/Sao_Paulo')::date) THEN RAISE EXCEPTION 'Entrada exige lote com validade vigente' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||p_chave::text,0));
 SELECT * INTO old FROM public.va_estoque_movimentos WHERE responsavel_id=u AND chave=p_chave;
 IF FOUND THEN
  IF old.lote_id IS DISTINCT FROM p_lote_id OR old.delta IS DISTINCT FROM p_delta OR old.motivo IS DISTINCT FROM btrim(p_motivo) OR old.aplicacao_id IS NOT NULL THEN RAISE EXCEPTION 'Chave reutilizada com outros dados' USING ERRCODE='22023'; END IF;
  RETURN old.id;
 END IF;
 INSERT INTO public.va_estoque_saldos(lote_id,unidade_id) VALUES(l.id,l.unidade_id) ON CONFLICT(lote_id) DO NOTHING;
 UPDATE public.va_estoque_saldos SET saldo=saldo+p_delta WHERE lote_id=l.id AND saldo::bigint+p_delta BETWEEN 0 AND 2147483647;
 IF NOT FOUND THEN RAISE EXCEPTION 'Saldo insuficiente ou limite excedido' USING ERRCODE='22023'; END IF;
 INSERT INTO public.va_estoque_movimentos(lote_id,unidade_id,delta,motivo,responsavel_id,chave) VALUES(l.id,l.unidade_id,p_delta,btrim(p_motivo),u,p_chave) RETURNING id INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.va_consumir_estoque_aplicacao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.lotes_vacinas%ROWTYPE;
BEGIN
 IF NEW.status<>'valida' THEN RAISE EXCEPTION 'Nova aplicação exige status válida'; END IF;
 IF auth.uid() IS NULL OR NEW.profissional_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Responsável inválido' USING ERRCODE='42501'; END IF;
 -- 006 mantém SHARE no lote. Não elevar para UPDATE: evita deadlock entre aplicações.
 -- O UPDATE condicional do saldo serializa o consumo concorrente.
 SELECT * INTO l FROM public.lotes_vacinas WHERE id=NEW.lote_id;
 IF l.validade IS NULL OR NOT isfinite(l.validade) OR l.validade<(NEW.aplicada_em AT TIME ZONE 'America/Sao_Paulo')::date THEN RAISE EXCEPTION 'Lote vencido na aplicação' USING ERRCODE='22023'; END IF;
 UPDATE public.va_estoque_saldos SET saldo=saldo-1 WHERE lote_id=l.id AND unidade_id=NEW.unidade_id AND saldo>=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sem unidade de aplicação disponível no estoque DEMO' USING ERRCODE='22023'; END IF;
 INSERT INTO public.va_estoque_movimentos(lote_id,unidade_id,delta,motivo,responsavel_id,chave,aplicacao_id)
 VALUES(l.id,NEW.unidade_id,-1,'Consumo por aplicação DEMO',NEW.profissional_id,NEW.id,NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER va_estoque_consumo AFTER INSERT ON public.aplicacoes_vacinais FOR EACH ROW EXECUTE FUNCTION public.va_consumir_estoque_aplicacao();
-- AFTER INSERT participa da MESMA transação da RPC 006. Falha reverte tudo.
-- Não altera os dois triggers anteriores nem o índice único parcial.
CREATE FUNCTION public.va_estoque_imutavel() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Movimentos são imutáveis; registre movimento compensatório' USING ERRCODE='42501'; END $$;
CREATE TRIGGER va_estoque_imutavel BEFORE UPDATE OR DELETE ON public.va_estoque_movimentos FOR EACH ROW EXECUTE FUNCTION public.va_estoque_imutavel();
CREATE FUNCTION public.va_proteger_lote_estoque() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (to_jsonb(NEW)-'created_at') IS DISTINCT FROM (to_jsonb(OLD)-'created_at') AND EXISTS(SELECT 1 FROM public.va_estoque_movimentos WHERE lote_id=OLD.id) THEN RAISE EXCEPTION 'Lote com movimentos não pode ser alterado'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER va_lote_movimentado BEFORE UPDATE ON public.lotes_vacinas FOR EACH ROW EXECUTE FUNCTION public.va_proteger_lote_estoque();

CREATE FUNCTION public.va_salvar_vacina_v1(p_id uuid,p_nome text,p_si_pni text,p_ativo boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.va_is_admin() THEN RAISE EXCEPTION 'Somente administrador' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_nome),'') IS NULL OR length(p_nome)>200 OR nullif(btrim(p_si_pni),'') IS NULL OR length(p_si_pni)>80 OR p_ativo IS NULL THEN RAISE EXCEPTION 'Vacina inválida' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN INSERT INTO public.vacinas(nome,si_pni,ativo) VALUES(btrim(p_nome),btrim(p_si_pni),p_ativo) RETURNING id INTO result;
 ELSE UPDATE public.vacinas SET nome=btrim(p_nome),si_pni=btrim(p_si_pni),ativo=p_ativo WHERE id=p_id RETURNING id INTO result; IF NOT FOUND THEN RAISE EXCEPTION 'Vacina não encontrada'; END IF; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.va_cadastrar_lote_v1(p_vacina_id uuid,p_unidade_id uuid,p_numero text,p_fabricante text,p_validade date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text; un uuid; result uuid;
BEGIN
 SELECT role,unidade_id INTO r,un FROM public.perfis WHERE id=auth.uid();
 IF r IS NULL OR r NOT IN ('admin','ubs') OR (r='ubs' AND p_unidade_id IS DISTINCT FROM un) THEN RAISE EXCEPTION 'Unidade não autorizada' USING ERRCODE='42501'; END IF;
 IF p_unidade_id IS NULL OR nullif(btrim(p_numero),'') IS NULL OR length(p_numero)>100 OR nullif(btrim(p_fabricante),'') IS NULL OR length(p_fabricante)>200 OR p_validade IS NULL OR NOT isfinite(p_validade) OR p_validade<(now() AT TIME ZONE 'America/Sao_Paulo')::date OR NOT EXISTS(SELECT 1 FROM public.vacinas WHERE id=p_vacina_id AND ativo) THEN RAISE EXCEPTION 'Lote inválido' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.lotes_vacinas WHERE vacina_id=p_vacina_id AND unidade_id=p_unidade_id AND numero_lote=btrim(p_numero)) THEN RAISE EXCEPTION 'Lote já cadastrado' USING ERRCODE='23505'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_vacina_id::text||p_unidade_id::text||btrim(p_numero),0));
 IF EXISTS(SELECT 1 FROM public.lotes_vacinas WHERE vacina_id=p_vacina_id AND unidade_id=p_unidade_id AND numero_lote=btrim(p_numero)) THEN RAISE EXCEPTION 'Lote já cadastrado' USING ERRCODE='23505'; END IF;
 INSERT INTO public.lotes_vacinas(vacina_id,unidade_id,numero_lote,fabricante,validade) VALUES(p_vacina_id,p_unidade_id,btrim(p_numero),btrim(p_fabricante),p_validade) RETURNING id INTO result;
 RETURN result;
END $$;
-- Aplicação já aceita quantidade clínica em mL; estoque sempre conta unidades.
-- SELECT protegido por RLS; nenhuma escrita direta nos novos objetos.
DO $$ DECLARE f regprocedure; BEGIN
 FOREACH f IN ARRAY ARRAY['public.va_movimentar_estoque_v1(uuid,integer,text,uuid)'::regprocedure,'public.va_salvar_vacina_v1(uuid,text,text,boolean)'::regprocedure,'public.va_cadastrar_lote_v1(uuid,uuid,text,text,date)'::regprocedure] LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.va_consumir_estoque_aplicacao(),public.va_estoque_imutavel(),public.va_proteger_lote_estoque() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
