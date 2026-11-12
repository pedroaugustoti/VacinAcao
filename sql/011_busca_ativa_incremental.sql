-- PROPOSTA NÃO EXECUTADA REMOTAMENTE. Aplicar manualmente após 006-r2 aprovada.
-- ATENÇÃO: contatos_busca_ativa já responde no projeto remoto. Neste estado,
-- este arquivo é REFERÊNCIA/BOOTSTRAP LOCAL, NÃO migração para reaplicar.
-- Comparar diagnóstico 014 e preparar somente o delta comprovadamente necessário.
-- Projeto de desenvolvimento: todos os contatos são marcados como demonstração.
-- Não envia mensagens, não modifica prescrições/doses, não cria contas.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE TABLE public.contatos_busca_ativa (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 paciente_id uuid NOT NULL REFERENCES public.pacientes(id),
 unidade_id uuid NOT NULL REFERENCES public.unidades_saude(id),
 esquema_id uuid REFERENCES public.esquemas_vacinais(id),
 responsavel_id uuid NOT NULL REFERENCES public.perfis(id),
 responsavel_nome text NOT NULL,
 canal text NOT NULL CHECK(canal IN ('whatsapp','telefone','presencial','sms','outro')),
 resultado text NOT NULL CHECK(resultado IN ('sem_resposta','orientado','retorno_agendado','recusa','telefone_invalido')),
 observacoes text CHECK(length(observacoes)<=1000),
 realizado_em timestamptz NOT NULL,
 proximo_acompanhamento date,
 contexto text NOT NULL DEFAULT 'demonstracao' CHECK(contexto='demonstracao'),
 chave_idempotencia uuid NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(responsavel_id,chave_idempotencia)
);
CREATE INDEX contatos_paciente_historico_idx ON public.contatos_busca_ativa(paciente_id,realizado_em DESC,criado_em DESC);
CREATE INDEX contatos_unidade_idx ON public.contatos_busca_ativa(unidade_id,proximo_acompanhamento);
ALTER TABLE public.contatos_busca_ativa ENABLE ROW LEVEL SECURITY;
CREATE POLICY contatos_leitura_equipe ON public.contatos_busca_ativa FOR SELECT TO authenticated
 USING(public.va_is_admin() OR unidade_id=public.va_my_unidade());
REVOKE ALL ON TABLE public.contatos_busca_ativa FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.contatos_busca_ativa TO authenticated;
CREATE FUNCTION public.va_contatos_imutaveis() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Histórico de contatos é imutável; registre uma nova tentativa/correção' USING ERRCODE='42501'; END;
$$;
CREATE TRIGGER contatos_imutaveis BEFORE UPDATE OR DELETE ON public.contatos_busca_ativa FOR EACH ROW EXECUTE FUNCTION public.va_contatos_imutaveis();

CREATE FUNCTION public.va_registrar_contato_v1(
 p_paciente_id uuid,p_esquema_id uuid,p_canal text,p_resultado text,p_observacoes text,
 p_realizado_em timestamptz,p_proximo_acompanhamento date,p_chave_idempotencia uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_usuario uuid:=auth.uid(); v_role text; v_unidade uuid; v_nome text; v_paciente public.pacientes%ROWTYPE;
 v_existente public.contatos_busca_ativa%ROWTYPE; v_id uuid;
BEGIN
 SELECT role,unidade_id,nome INTO v_role,v_unidade,v_nome FROM public.perfis WHERE id=v_usuario;
 IF v_usuario IS NULL OR v_role IS NULL OR v_role NOT IN ('admin','ubs') THEN RAISE EXCEPTION 'Acesso profissional obrigatório' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_paciente FROM public.pacientes WHERE id=p_paciente_id AND (v_role='admin' OR (v_unidade IS NOT NULL AND unidade_id=v_unidade)) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não acessível nesta unidade' USING ERRCODE='42501'; END IF;
 IF p_esquema_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.esquemas_vacinais WHERE id=p_esquema_id AND paciente_id=p_paciente_id) THEN RAISE EXCEPTION 'Dose não pertence ao paciente' USING ERRCODE='22023'; END IF;
 IF p_canal IS NULL OR p_canal NOT IN ('whatsapp','telefone','presencial','sms','outro')
  OR p_resultado IS NULL OR p_resultado NOT IN ('sem_resposta','orientado','retorno_agendado','recusa','telefone_invalido')
  OR length(coalesce(p_observacoes,''))>1000 OR p_realizado_em IS NULL OR NOT isfinite(p_realizado_em) OR p_realizado_em>CURRENT_TIMESTAMP
  OR p_chave_idempotencia IS NULL
  OR (p_proximo_acompanhamento IS NOT NULL AND (NOT isfinite(p_proximo_acompanhamento) OR p_proximo_acompanhamento<(p_realizado_em AT TIME ZONE 'America/Sao_Paulo')::date))
  OR (p_resultado='retorno_agendado' AND p_proximo_acompanhamento IS NULL) THEN
  RAISE EXCEPTION 'Dados do contato inválidos' USING ERRCODE='22023';
 END IF;
 -- Serializa tentativas da mesma chave sem depender de retries no navegador.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_usuario::text||p_chave_idempotencia::text,0));
 SELECT * INTO v_existente FROM public.contatos_busca_ativa WHERE responsavel_id=v_usuario AND chave_idempotencia=p_chave_idempotencia;
 IF FOUND THEN
  IF v_existente.paciente_id IS DISTINCT FROM p_paciente_id OR v_existente.esquema_id IS DISTINCT FROM p_esquema_id
    OR v_existente.canal IS DISTINCT FROM p_canal OR v_existente.resultado IS DISTINCT FROM p_resultado
    OR v_existente.observacoes IS DISTINCT FROM nullif(btrim(p_observacoes),'') OR v_existente.realizado_em IS DISTINCT FROM p_realizado_em
    OR v_existente.proximo_acompanhamento IS DISTINCT FROM p_proximo_acompanhamento THEN
    RAISE EXCEPTION 'Chave de tentativa já utilizada com outros dados' USING ERRCODE='22023';
  END IF;
  RETURN v_existente.id;
 END IF;
 INSERT INTO public.contatos_busca_ativa(paciente_id,unidade_id,esquema_id,responsavel_id,responsavel_nome,canal,resultado,observacoes,realizado_em,proximo_acompanhamento,chave_idempotencia)
 VALUES(p_paciente_id,v_paciente.unidade_id,p_esquema_id,v_usuario,v_nome,p_canal,p_resultado,nullif(btrim(p_observacoes),''),p_realizado_em,p_proximo_acompanhamento,p_chave_idempotencia)
 RETURNING id INTO v_id;
 INSERT INTO public.historico_pacientes(paciente_id,unidade_id,autor_id,acao,detalhes)
 VALUES(p_paciente_id,v_paciente.unidade_id,v_usuario,'CONTATO_BUSCA_ATIVA',jsonb_build_object('contato_id',v_id,'canal',p_canal,'resultado',p_resultado,'contexto','demonstracao'));
 RETURN v_id;
END;
$$;

CREATE FUNCTION public.va_listar_busca_ativa_v1(p_busca text DEFAULT NULL,p_limite integer DEFAULT 20,p_offset integer DEFAULT 0)
RETURNS TABLE(paciente_id uuid,nome text,whatsapp text,unidade_id uuid,esquema_id uuid,numero_dose integer,data_prevista date,dias_atraso integer,doses_atrasadas bigint,total_pacientes bigint,ultimo_contato timestamptz,ultimo_resultado text,proximo_acompanhamento date,responsavel_nome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_usuario uuid:=auth.uid(); v_role text; v_unidade uuid; v_hoje date:=(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 SELECT role,perfis.unidade_id INTO v_role,v_unidade FROM public.perfis WHERE id=v_usuario;
 IF v_usuario IS NULL OR v_role IS NULL OR v_role NOT IN ('admin','ubs') OR (v_role='ubs' AND v_unidade IS NULL) THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 IF p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0 OR length(coalesce(p_busca,''))>100 THEN RAISE EXCEPTION 'Paginação inválida' USING ERRCODE='22023'; END IF;
 RETURN QUERY
 WITH atrasos AS (
  SELECT p.id AS pid,p.nome AS pname,p.whatsapp AS phone,p.unidade_id AS uid,e.id AS eid,e.numero_dose AS dose,e.data_prevista AS prevista,
   count(*) OVER(PARTITION BY p.id) AS total_doses,row_number() OVER(PARTITION BY p.id ORDER BY e.data_prevista,e.numero_dose,e.id) AS pos
  FROM public.pacientes p JOIN public.esquemas_vacinais e ON e.paciente_id=p.id
  WHERE (v_role='admin' OR p.unidade_id=v_unidade)
   AND (nullif(btrim(p_busca),'') IS NULL OR strpos(lower(p.nome),lower(btrim(p_busca)))>0)
   AND (e.status='atrasada' OR (e.status='pendente' AND e.data_prevista<v_hoje))
   AND e.conferencia_documental_pendente IS NOT TRUE
   AND NOT EXISTS(SELECT 1 FROM public.aplicacoes_vacinais a WHERE a.esquema_id=e.id AND a.status='valida')
 ), pacientes AS (SELECT * FROM atrasos WHERE pos=1)
 SELECT p.pid,p.pname,p.phone,p.uid,p.eid,p.dose,p.prevista,greatest(v_hoje-p.prevista,0),p.total_doses,count(*) OVER(),
  c.realizado_em,c.resultado,c.proximo_acompanhamento,c.responsavel_nome
 FROM pacientes p LEFT JOIN LATERAL(SELECT ct.realizado_em,ct.resultado,ct.proximo_acompanhamento,ct.responsavel_nome FROM public.contatos_busca_ativa ct WHERE ct.paciente_id=p.pid ORDER BY ct.realizado_em DESC,ct.criado_em DESC,ct.id DESC LIMIT 1)c ON true
 ORDER BY p.prevista,p.pname,p.pid LIMIT p_limite OFFSET p_offset;
END;
$$;
REVOKE ALL ON FUNCTION public.va_contatos_imutaveis() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.va_listar_busca_ativa_v1(text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.va_listar_busca_ativa_v1(text,integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
