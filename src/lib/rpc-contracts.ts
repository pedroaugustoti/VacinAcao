// Contratos informados pelo diagnóstico do Supabase na Fase 2.
// Tipos locais não substituem a inspeção das funções SECURITY DEFINER.
export type RpcContracts = {
  va_registrar_contato_v1: {
    Args: {p_paciente_id:string;p_esquema_id:string|null;p_canal:string;p_resultado:string;p_observacoes:string|null;p_realizado_em:string;p_proximo_acompanhamento:string|null;p_chave_idempotencia:string}
    Returns:string
  }
  va_cadastrar_atendimento_v2: {
    Args: { p_unidade_id: string; p_nome: string; p_cpf: string; p_whatsapp: string; p_data_acidente: string; p_data_nascimento: string | null; p_datas_previstas: string[] }
    Returns: string
  }
  va_registrar_aplicacao_v1: {
    Args: { p_paciente_id: string; p_esquema_id: string; p_vacina_id: string; p_lote_id: string; p_aplicada_em: string; p_via: string; p_local: string; p_quantidade: number; p_unidade_medida: string; p_observacoes: string | null }
    Returns: string
  }
  va_atualizar_paciente_v1: {
    Args: { p_paciente_id: string; p_nome: string; p_cpf: string; p_whatsapp: string; p_data_nascimento: string | null; p_data_acidente: string; p_motivo: string }
    Returns: void
  }
}

export type RpcArgs<Name extends keyof RpcContracts> = RpcContracts[Name]['Args']

/** O PostgREST entrega RETURNS uuid como string escalar, não objeto ou lista. */
export function exigirUuidRetornado(data: unknown): string {
  if (typeof data !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
    throw new Error('O banco não retornou um identificador válido. A operação pode ter sido gravada. Confira a lista e o histórico antes de tentar novamente.')
  }
  return data
}
