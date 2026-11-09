import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, Users, Phone, Calendar, ArrowRight } from 'lucide-react'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // 1. Busca os pacientes e cruza (JOIN) com as doses deles.
  // Graças ao RLS, isso traz APENAS os pacientes desta UBS específica.
  const { data: pacientes, error } = await supabase
    .from('pacientes')
    .select(`
      id,
      nome,
      whatsapp,
      esquemas_vacinais (
        numero_dose,
        data_prevista,
        status
      )
    `)

  // 2. Lógica para separar os pacientes atrasados
  // Pega a data de hoje no formato YYYY-MM-DD (sem fuso horário)
  const hoje = new Date().toISOString().split('T')[0]

  let pacientesAtrasados: any[] = []
  const totalPacientes = pacientes?.length || 0

  if (pacientes) {
    pacientesAtrasados = pacientes.map(paciente => {
      // Procura se tem alguma dose pendente cuja data já passou de hoje
      const doseAtrasada = paciente.esquemas_vacinais.find(
        (dose: any) => (dose.status === 'pendente' && dose.data_prevista < hoje) || dose.status === 'atrasada'
      )
      
      // Se achar, retorna o paciente com a dose específica anexada
      if (doseAtrasada) {
        return { ...paciente, doseAtrasada }
      }
      return null
    }).filter(Boolean) // Remove os nulos (pacientes em dia)
  }

  // Função auxiliar para formatar a data na tela
  const formatarData = (dataStr: string) => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      .format(new Date(dataStr + 'T00:00:00'))
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Painel de Controle</h1>
        <p className="text-gray-500 mt-1">Garantia de Adesão ao Protocolo Antirrábico</p>
      </header>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-blue-100 p-4 rounded-xl text-blue-600">
            <Users size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total de Pacientes</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalPacientes}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-50 flex items-center gap-4">
          <div className="bg-red-100 p-4 rounded-xl text-red-600">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Pacientes Atrasados</p>
            <h3 className="text-2xl font-bold text-red-600">{pacientesAtrasados.length}</h3>
          </div>
        </div>
      </div>

      {/* Tabela de Busca Ativa (Faltosos) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            Atenção Necessária (Busca Ativa)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-sm text-gray-500">
                <th className="p-4 font-medium">Paciente</th>
                <th className="p-4 font-medium">Dose Atrasada</th>
                <th className="p-4 font-medium">Data Prevista</th>
                <th className="p-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pacientesAtrasados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    Nenhum paciente atrasado no momento. Ótimo trabalho! 🎉
                  </td>
                </tr>
              ) : (
                pacientesAtrasados.map((paciente) => {
                  // Monta a mensagem padrão para o WhatsApp
                  const mensagem = encodeURIComponent(
                    `Olá, ${paciente.nome}. Aqui é da sua Unidade de Saúde. Consta em nosso sistema que a sua ${paciente.doseAtrasada.numero_dose}ª dose da vacina antirrábica, prevista para ${formatarData(paciente.doseAtrasada.data_prevista)}, está atrasada. É de extrema importância que você compareça à unidade o mais rápido possível para não perder a imunização.`
                  )
                  const linkWhatsapp = `https://wa.me/55${paciente.whatsapp.replace(/\D/g, '')}?text=${mensagem}`

                  return (
                    <tr key={paciente.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium text-gray-900">{paciente.nome}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          {paciente.doseAtrasada.numero_dose}ª Dose
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        {formatarData(paciente.doseAtrasada.data_prevista)}
                      </td>
                      <td className="p-4 text-right">
                        <a 
                          href={linkWhatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                        >
                          <Phone size={16} />
                          Cobrar via Whats
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}