-- NÃO EXECUTAR SEM APROVAÇÃO. Operador configura identidade/unidade DEMO reais do projeto.
-- SQL Editor como postgres, sem chave service_role. Não cria usuários nem pacientes.
-- Preencher UUIDs e trocar ROLLBACK por COMMIT somente após revisar os resultados.
BEGIN;
-- SELECT set_config('request.jwt.claim.sub','UUID_ADMIN_EXISTENTE',true);
SET LOCAL ROLE authenticated;
-- SELECT public.va_salvar_vacina_v1(NULL,'DEMO — vacina para apresentação','DEMO-NAO-VALIDO-SIPNI',true);
-- Copiar UUID retornado. Não reutilizar códigos institucionais reais nesta demonstração.
-- SELECT public.va_cadastrar_lote_v1('UUID_VACINA','UUID_UNIDADE','DEMO-2026-001','DEMO — fabricante fictício','2027-12-31');
-- Copiar UUID do lote. Usar a MESMA chave UUID ao repetir a mesma entrada.
-- SELECT public.va_movimentar_estoque_v1('UUID_LOTE',10,'DEMO — carga inicial da apresentação','UUID_CHAVE_NOVA');
ROLLBACK;
