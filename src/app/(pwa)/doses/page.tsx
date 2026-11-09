import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, AlertCircle, Calendar } from 'lucide-react'
import { connection } from 'next/server' // ADICIONE AQUI

// Utilidade para formatar datas
const formatarData = (dataStr: string) => {
  if (!dataStr) return '--/--/----'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date(dataStr + 'T00:00:00'))
}

export default async function HistoricoDoses() {
  await connection() // ADICIONE AQUI
  
  const supabase = await createClient()

  // 1. Verifica autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Busca o ID do paciente logado
  const { data: paciente } = await supabase
    .from('pacientes')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!paciente) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-gray-500">
        Nenhum dado de saúde vinculado a esta conta.
      </div>
    )
  }

  // 3. Busca o esquema vacinal completo (as 5 doses)
  const { data: doses } = await supabase
    .from('esquemas_vacinais')
    .select('*')
    .eq('paciente_id', paciente.id)
    .order('numero_dose', { ascending: true })

  // Helpers para o visual baseado no status
  const getStatusConfig = (status: string, dataPrevista: string) => {
    const hoje = new Date().toISOString().split('T')[0]
    
    // Calcula dinamicamente se a dose pendente já passou da data
    const isAtrasada = status === 'pendente' && dataPrevista < hoje || status === 'atrasada'

    if (status === 'aplicada') {
      return {
        corBorder: 'border-green-500',
        corBgIcon: 'bg-green-100',
        corIcon: 'text-green-600',
        corTexto: 'text-green-700',
        icone: <CheckCircle2 size={24} />,
        label: 'Aplicada'
      }
    }
    
    if (isAtrasada) {
      return {
        corBorder: 'border-red-500',
        corBgIcon: 'bg-red-100',
        corIcon: 'text-red-600',
        corTexto: 'text-red-700',
        icone: <AlertCircle size={24} />,
        label: 'Atrasada'
      }
    }

    return {
      corBorder: 'border-blue-400',
      corBgIcon: 'bg-blue-50',
      corIcon: 'text-blue-500',
      corTexto: 'text-blue-600',
      icone: <Clock size={24} />,
      label: 'Pendente'
    }
  }

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Histórico de Doses</h1>
        <p className="text-gray-500 text-sm mt-1">
          Acompanhe seu protocolo antirrábico
        </p>
      </header>

      <div className="space-y-4">
        {doses?.map((dose) => {
          const config = getStatusConfig(dose.status, dose.data_prevista)

          return (
            <div 
              key={dose.id} 
              className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${config.corBorder} flex gap-4 items-center`}
            >
              <div className={`p-3 rounded-full flex-shrink-0 ${config.corBgIcon} ${config.corIcon}`}>
                {config.icone}
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-gray-900">
                    {dose.numero_dose}ª Dose
                  </h3>
                  <span className={`text-xs font-bold uppercase tracking-wider ${config.corTexto}`}>
                    {config.label}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <Calendar size={14} />
                  <span>Prevista: {formatarData(dose.data_prevista)}</span>
                </div>

                {dose.data_aplicacao && (
                  <div className="text-sm text-green-600 font-medium mt-1">
                    Aplicada em: {formatarData(dose.data_aplicacao)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}