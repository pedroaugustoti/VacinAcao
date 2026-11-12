-- CANDIDATOS PARA REVISÃO HUMANA, NÃO É AUTORIZAÇÃO DE EXCLUSÃO.
-- Prefixo DEMO é somente indício; não identifica sozinho dado obsoleto.
BEGIN TRANSACTION READ ONLY;
SELECT p.id AS candidato_id,
 (SELECT count(*) FROM public.esquemas_vacinais e WHERE e.paciente_id=p.id) doses,
 (SELECT count(*) FROM public.aplicacoes_vacinais a WHERE a.paciente_id=p.id) aplicacoes,
 (SELECT count(*) FROM public.historico_pacientes h WHERE h.paciente_id=p.id) historicos,
 (SELECT count(*) FROM public.contatos_busca_ativa c WHERE c.paciente_id=p.id) contatos,
 'Revisar finalidade e dependências; nenhuma exclusão proposta automaticamente' AS orientacao
FROM public.pacientes p WHERE p.nome ILIKE 'DEMO%' ORDER BY p.id;
ROLLBACK;
