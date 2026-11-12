-- SOMENTE LEITURA: executar depois de 006-r2 e 015 aprovados/aplicados.
-- Inspeciona permissões efetivas, inclusive herança e colunas; não homologa escrita.
BEGIN TRANSACTION READ ONLY;
WITH rpcs(assinatura) AS (VALUES
 ('public.va_cadastrar_atendimento_v2(uuid,text,text,text,date,date,date[])'),
 ('public.va_atualizar_paciente_v1(uuid,text,text,text,date,date,text)'),
 ('public.va_registrar_aplicacao_v1(uuid,uuid,uuid,uuid,timestamptz,text,text,numeric,text,text)'),
 ('public.va_cadastrar_atendimento(text,text,text,date,date[],uuid)'),
 ('public.va_registrar_contato_v1(uuid,uuid,text,text,text,timestamptz,date,uuid)'),
 ('public.va_listar_busca_ativa_v1(text,integer,integer)')
), checks AS (
 SELECT 'EXECUTE '||assinatura AS verificacao,
  has_function_privilege('authenticated',assinatura,'EXECUTE') AND NOT has_function_privilege('anon',assinatura,'EXECUTE') AS aprovado
 FROM rpcs
 UNION ALL
 SELECT 'Contatos: SELECT autenticado, sem leitura anônima',
  has_table_privilege('authenticated','public.contatos_busca_ativa','SELECT') AND NOT has_any_column_privilege('anon','public.contatos_busca_ativa','SELECT')
 UNION ALL
 SELECT 'Sem escrita direta: '||r||'.'||t,
  NOT has_any_column_privilege(r,'public.'||t,'INSERT,UPDATE') AND NOT has_table_privilege(r,'public.'||t,'DELETE,TRUNCATE,TRIGGER')
 FROM unnest(ARRAY['anon','authenticated'])r CROSS JOIN unnest(ARRAY['pacientes','esquemas_vacinais','aplicacoes_vacinais','historico_pacientes','contatos_busca_ativa'])t
)
SELECT * FROM checks ORDER BY verificacao;
ROLLBACK;
