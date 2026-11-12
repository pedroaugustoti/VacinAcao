-- ROTEIRO MANUAL, NÃO CRIA auth.users, NÃO ENVIA EMAIL E NÃO EXECUTA SEM APROVAÇÃO.
-- Exige 024 revisado e 025 aprovado/aplicado. Substituir apenas UUIDs/alias DEMO.
BEGIN;
-- SELECT set_config('request.jwt.claim.sub','UUID_ADMIN_EXISTENTE',true);
SET LOCAL ROLE authenticated;
-- SELECT public.va_vincular_conta_paciente_v1(
-- 'UUID_FICHA_DEMO_SEM_VINCULO','UUID_NOVA_CONTA_DEMO',
-- 'demo-paciente-20261112@vacinacao.invalid',
-- 'DEMO: conferência institucional de identidade e conta pelo responsável',true);
-- Conferir user_id e histórico. Trocar ROLLBACK por COMMIT somente com aprovação.
ROLLBACK;
