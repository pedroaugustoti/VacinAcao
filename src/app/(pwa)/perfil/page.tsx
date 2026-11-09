import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Phone, FileText, LogOut, MapPin } from 'lucide-react'
import BotaoSair from './BotaoSair' // Vamos criar esse componente logo abaixo

export default async function PerfilPaciente() {
  const supabase = await createClient()

  // 1. Verifica autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca o perfil do paciente
  const { data: paciente } = await supabase
    .from('pacientes')
    .select('nome, cpf, whatsapp, unidades_saude(nome, cidade)')
    .eq('user_id', user.id)
    .single()

  if (!paciente) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        <p className="text-gray-500 mb-4">Nenhum dado de saúde vinculado.</p>
        <BotaoSair />
      </div>
    )
  }

  // Máscara básica para CPF e Telefone (apenas para exibição)
  const formatarCPF = (cpf: string) => cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  const formatarWhatsapp = (num: string) => num.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
  const unidade = paciente.unidades_saude as any;

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
      </header>

      {/* Card de Informações Pessoais */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <User size={32} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{paciente.nome}</h2>
            <p className="text-sm text-gray-500">Paciente</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg text-gray-500">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500">CPF</p>
              <p className="font-medium text-gray-900">{formatarCPF(paciente.cpf)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 rounded-lg text-gray-500">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500">WhatsApp</p>
              <p className="font-medium text-gray-900">{formatarWhatsapp(paciente.whatsapp)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card da Unidade de Saúde */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-8">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Unidade de Vínculo</h3>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <MapPin size={18} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{unidade?.nome || 'Não informada'}</p>
            <p className="text-xs text-gray-500">{unidade?.cidade || ''}</p>
          </div>
        </div>
      </div>

      {/* Botão de Logout Interativo */}
      <BotaoSair />
    </div>
  )
}