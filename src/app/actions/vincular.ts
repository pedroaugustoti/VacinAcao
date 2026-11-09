"use server"

import { createClient } from '@supabase/supabase-js'

export async function vincularCpf(userId: string, cpfLimpo: string) {
  // Inicializa o cliente com privilégios de Admin (Bypass RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Atualiza o user_id apenas se o CPF existir e ainda não tiver dono
  const { data, error } = await supabaseAdmin
    .from('pacientes')
    .update({ user_id: userId })
    .eq('cpf', cpfLimpo)
    .is('user_id', null)
    .select()
    .single()

  if (error || !data) {
    // Se falhar (ex: CPF não foi cadastrado pela UBS ou já foi vinculado),
    // deletamos o usuário recém-criado para não sujar o Auth
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw new Error("CPF não encontrado ou já vinculado a outra conta.")
  }

  return { sucesso: true }
}