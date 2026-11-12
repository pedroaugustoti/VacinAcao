import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import FormEditarPaciente from './form-editar'

async function Conteudo({ id }: { id: string }) {
  await connection()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login-ubs')

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role,unidade_id')
    .eq('id', user.id)
    .single()

  if (!perfil || !['ubs', 'admin'].includes(perfil.role) || (perfil.role === 'ubs' && !perfil.unidade_id)) redirect('/')

  const { data: paciente, error } = await supabase
    .from('pacientes')
    .select('id,unidade_id,nome,cpf,whatsapp,data_nascimento,data_acidente')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return (
      <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">
        Não foi possível consultar o paciente.
      </p>
    )
  }

  if (
    !paciente ||
    (perfil.role === 'ubs' && paciente.unidade_id !== perfil.unidade_id)
  ) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/admin/pacientes/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
      >
        <ArrowLeft size={15} />
        Voltar para a ficha do paciente
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Editar Dados do Paciente
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Informe uma justificativa para a correção cadastral. A rastreabilidade deve ser validada na configuração do banco da UBS.
        </p>
      </div>
      <FormEditarPaciente paciente={paciente} />
    </div>
  )
}

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  return (
    <Suspense
      fallback={
        <p className="rounded-xl bg-white p-8 text-sm text-slate-500">
          Carregando cadastro...
        </p>
      }
    >
      <Conteudo id={id} />
    </Suspense>
  )
}
