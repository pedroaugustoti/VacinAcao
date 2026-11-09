import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock, Syringe } from 'lucide-react'
import { connection } from 'next/server' // ADICIONE AQUI

// Utilidade para formatar datas no padrão BR
const formatarData = (dataStr: string) => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(dataStr + 'T00:00:00')) // Força timezone local
}

export default async function HomePWA() {
  await connection() // ADICIONE AQUI

  const supabase = await createClient()
  // 1. Verifica quem é o usuário
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca o perfil do paciente
  const { data: paciente } = await supabase
    .from('pacientes')
    .select('*, unidades_saude(nome)')
    .eq('user_id', user.id)
    .single()

  if (!paciente) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-gray-500">
        Seu cadastro ainda não foi vinculado pela UBS.
      </div>
    )
  }

  // 3. Busca as doses do paciente
  const { data: doses } = await supabase
    .from('esquemas_vacinais')
    .select('*')
    .eq('paciente_id', paciente.id)
    .order('numero_dose', { ascending: true })

  // Lógica para descobrir qual é a próxima dose
  const proximaDose = doses?.find(d => d.status === 'pendente')
  const dosesAplicadas = doses?.filter(d => d.status === 'aplicada').length || 0

  return (
    <div className="p-6">
      {/* Header estilo App de Banco */}
      <header className="mb-8 mt-4">
        <h1 className="text-xl font-medium text-gray-500">Olá,</h1>
        <h2 className="text-2xl font-bold text-gray-900 truncate">
          {paciente.nome.split(' ')[0]}
        </h2>
      </header>

      {/* Card Principal - Status da Vacinação */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-lg mb-6 relative overflow-hidden">
        {/* Efeito visual de fundo */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10"></div>
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-blue-100 text-sm font-medium mb-1">Protocolo Antirrábico</p>
            <h3 className="text-2xl font-bold">{dosesAplicadas} de 5 Doses</h3>
          </div>
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
            <Syringe size={24} className="text-white" />
          </div>
        </div>

        <div className="bg-black/20 rounded-2xl p-4 backdrop-blur-md border border-white/10">
          {proximaDose ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-200 mb-1">Próxima Dose ({proximaDose.numero_dose}ª)</p>
                <p className="font-bold text-lg">{formatarData(proximaDose.data_prevista)}</p>
              </div>
              <div className="flex items-center gap-1 bg-amber-400 text-amber-950 px-3 py-1 rounded-full text-xs font-bold">
                <Clock size={14} /> Pendente
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-300">
              <CheckCircle2 size={20} />
              <span className="font-medium">Protocolo Concluído!</span>
            </div>
          )}
        </div>
      </section>

      {/* Informações da UBS */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-blue-600" />
          Unidade de Atendimento
        </h4>
        <div className="text-sm text-gray-600">
          <p className="font-medium text-gray-900">{paciente.unidades_saude?.nome}</p>
          <p className="mt-1">Acidente em: {formatarData(paciente.data_acidente)}</p>
        </div>
      </section>
    </div>
  )
}