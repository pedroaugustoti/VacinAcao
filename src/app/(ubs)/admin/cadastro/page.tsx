"use client"

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Syringe, UserPlus, Calendar, Phone, FileText } from 'lucide-react'

export default function CadastroPaciente() {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [dataAcidente, setDataAcidente] = useState('')
  const [dataPrimeiraDose, setDataPrimeiraDose] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null)

  const supabase = createClient()

  // Função auxiliar para somar dias a uma data de forma segura (evitando fuso horário)
  const adicionarDias = (dataBase: string, dias: number) => {
    const data = new Date(dataBase + 'T12:00:00')
    data.setDate(data.getDate() + dias)
    return data.toISOString().split('T')[0]
  }

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMensagem(null)

    try {
      // 1. Pega o usuário logado e descobre a qual UBS ele pertence
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Usuário não autenticado.")

      const { data: perfil } = await supabase
        .from('perfis')
        .select('unidade_id')
        .eq('id', user.id)
        .single()

      if (!perfil?.unidade_id) throw new Error("Unidade de saúde não encontrada para este perfil.")

      // 2. Insere o Paciente (O user_id fica nulo até ele criar a conta no PWA)
      const { data: paciente, error: pacienteError } = await supabase
        .from('pacientes')
        .insert({
          unidade_id: perfil.unidade_id,
          nome,
          cpf: cpf.replace(/\D/g, ''), // Salva apenas os números do CPF
          whatsapp: whatsapp.replace(/\D/g, ''),
          data_acidente: dataAcidente
        })
        .select()
        .single()

      if (pacienteError) {
        if (pacienteError.code === '23505') throw new Error("Este CPF já está cadastrado no sistema.")
        throw pacienteError
      }

      // 3. Gera automaticamente as 5 doses (Dias 0, 3, 7, 14 e 28)
      const esquemaDoses = [
        { 
          paciente_id: paciente.id, 
          numero_dose: 1, 
          data_prevista: dataPrimeiraDose, 
          data_aplicacao: dataPrimeiraDose, 
          status: 'aplicada' // A primeira dose já é aplicada no ato
        },
        { paciente_id: paciente.id, numero_dose: 2, data_prevista: adicionarDias(dataPrimeiraDose, 3), status: 'pendente' },
        { paciente_id: paciente.id, numero_dose: 3, data_prevista: adicionarDias(dataPrimeiraDose, 7), status: 'pendente' },
        { paciente_id: paciente.id, numero_dose: 4, data_prevista: adicionarDias(dataPrimeiraDose, 14), status: 'pendente' },
        { paciente_id: paciente.id, numero_dose: 5, data_prevista: adicionarDias(dataPrimeiraDose, 28), status: 'pendente' }
      ]

      const { error: dosesError } = await supabase
        .from('esquemas_vacinais')
        .insert(esquemaDoses)

      if (dosesError) throw dosesError

      setMensagem({ tipo: 'sucesso', texto: 'Paciente e calendário vacinal registrados com sucesso!' })
      
      // Limpa o formulário
      setNome('')
      setCpf('')
      setWhatsapp('')
      setDataAcidente('')
      setDataPrimeiraDose('')

    } catch (error: any) {
      setMensagem({ tipo: 'erro', texto: error.message || 'Ocorreu um erro ao cadastrar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <UserPlus className="text-blue-600" />
          Novo Atendimento
        </h1>
        <p className="text-gray-500 mt-1">
          Registre o paciente e inicie o protocolo de 5 doses (0, 3, 7, 14 e 28 dias).
        </p>
      </header>

      <form onSubmit={handleCadastro} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
        
        {mensagem && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {mensagem.texto}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText size={16} className="text-gray-400"/> Nome Completo
            </label>
            <input
              type="text" required value={nome} onChange={e => setNome(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: João da Silva"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText size={16} className="text-gray-400"/> CPF
            </label>
            <input
              type="text" required value={cpf} onChange={e => setCpf(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Apenas números"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Phone size={16} className="text-gray-400"/> WhatsApp (Com DDD)
            </label>
            <input
              type="text" required value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: 81999999999"
            />
            <p className="text-xs text-gray-500">Usado para os alertas automáticos de busca ativa.</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar size={16} className="text-gray-400"/> Data do Acidente
            </label>
            <input
              type="date" required value={dataAcidente} onChange={e => setDataAcidente(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Syringe size={16} className="text-blue-500"/> Data da 1ª Dose (Dia 0)
            </label>
            <input
              type="date" required value={dataPrimeiraDose} onChange={e => setDataPrimeiraDose(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-70 mt-4"
        >
          {loading ? 'Salvando...' : 'Salvar e Gerar Calendário'}
        </button>
      </form>
    </div>
  )
}