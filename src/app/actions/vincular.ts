"use server"

/**
 * A vinculação automática por CPF foi suspensa por segurança.
 * CPF isolado não comprova a titularidade de um cadastro de saúde.
 * A versão anterior permitia alterar pacientes e excluir contas com service_role
 * sem validar a identidade do solicitante.
 *
 * Próxima versão: fluxo de verificação presencial pela UBS ou token
 * de convite de uso único, com auditoria e expiração.
 */
export async function vincularCpf() {
  throw new Error('Vinculação automática indisponível. Solicite a ativação da sua conta à UBS responsável.')
}
