import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock, Syringe } from 'lucide-react'
import { connection } from 'next/server' // ADICIONE AQUI
import {hojeBrasil} from '@/lib/busca-ativa'
import Link from 'next/link'

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
  const access=await supabase.rpc('va_acesso_habilitado')
  if(!access.error&&access.data===false)return <div role="alert" className="p-6"><h1 className="text-xl font-semibold">Acesso temporariamente bloqueado</h1><p className="mt-3 text-sm text-slate-600">Procure a unidade responsável para conferir seu acesso. Seus registros clínicos são preservados.</p></div>

  // 2. Busca o perfil do paciente
  const { data: paciente, error: pacienteError } = await supabase
    .from('pacientes')
    .select('*, unidades_saude(nome)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (pacienteError) return <p role="alert" className="p-6 text-red-700">Não foi possível consultar seu cadastro. Tente novamente.</p>

  if (!paciente) {
    return (
      <div className="p-6">
        <div className="va-empty mt-6 text-center"><AlertCircle size={28} className="mx-auto mb-4 text-sky-700" /><h1 className="text-lg font-semibold text-slate-800">Vamos conectar seu acompanhamento</h1><p className="mt-3 text-sm leading-relaxed">Seu cadastro ainda não foi vinculado pela UBS. Procure a equipe responsável para consultar seu cronograma.</p></div>
      </div>
    )
  }

  // 3. Busca as doses do paciente
  const { data: doses, error: dosesError } = await supabase
    .from('esquemas_vacinais')
    .select('*')
    .eq('paciente_id', paciente.id)
    .order('numero_dose', { ascending: true })

  if (dosesError) return <p role="alert" className="p-6 text-red-700">Não foi possível carregar seu esquema vacinal. Tente novamente.</p>

  // Inclui atrasos persistidos: a ausência de pendentes não significa conclusão.
  const proximaDose = doses?.find(d => d.status === 'pendente' || d.status === 'atrasada')
  const proximaAtrasada=proximaDose && (proximaDose.status==='atrasada' || proximaDose.data_prevista<hojeBrasil())
  const dosesAplicadas = doses?.filter(d => d.status === 'aplicada' && d.conferencia_documental_pendente !== true).length || 0
  const dosesConferencia = doses?.filter(d => d.status === 'aplicada' && d.conferencia_documental_pendente === true).length || 0

  return (
    <div className="p-6">
      {/* Header estilo App de Banco */}
      <header className="mb-6 mt-2">
        <p className="va-eyebrow mb-2">Seu acompanhamento</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 break-words">Olá, {paciente.nome.split(' ')[0]}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Acompanhe as datas e os registros do seu esquema vacinal.</p>
      </header>

      {/* Card Principal - Status da Vacinação */}
      <section className="va-patient-hero rounded-3xl p-6 text-white shadow-lg mb-6 relative overflow-hidden">
        {/* Efeito visual de fundo */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white opacity-10"></div>
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-blue-100 text-sm font-medium mb-1">{proximaDose?'Sua próxima dose':'Seu acompanhamento'}</p>
            <h2 className="text-3xl font-bold">{proximaDose?formatarData(proximaDose.data_prevista):'Consulte seu calendário'}</h2>
            <p className="mt-3 text-sm text-blue-100">{dosesAplicadas} de {doses?.length || 0} doses registradas no esquema</p>
          </div>
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
            <Syringe size={24} className="text-white" />
          </div>
        </div>

        {dosesConferencia > 0 && <p className="mb-4 rounded-xl bg-amber-100 p-3 text-sm font-medium text-amber-950">{dosesConferencia} dose(s) antiga(s) aguardando conferência documental pela UBS.</p>}
        <div className="bg-black/20 rounded-2xl p-4 backdrop-blur-md border border-white/10">
          {proximaDose ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-blue-200 mb-1">Próxima Dose ({proximaDose.numero_dose}ª)</p>
                <p className="text-sm font-medium">Conforme calendário da equipe</p>
              </div>
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${proximaAtrasada ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-950'}`}>
                <Clock size={14} /> {proximaAtrasada?'Em atraso':'Pendente'}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-300">
              <CheckCircle2 size={20} />
              <span className="font-medium">{dosesConferencia > 0 ? 'Há doses aguardando conferência' : 'Não há doses pendentes no esquema'}</span>
            </div>
          )}
        </div>
      </section>
      <Link href="/doses" className="mb-6 flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white px-5 py-4 text-sm font-semibold text-sky-900 hover:bg-sky-50"><span>Consultar calendário de doses</span><Syringe size={19} aria-hidden="true" /></Link>
      <section className={`mb-6 rounded-2xl border p-5 ${proximaAtrasada?'border-rose-200 bg-rose-50 text-rose-950':'border-teal-200 bg-teal-50 text-teal-950'}`}><h2 className="text-sm font-bold">{proximaAtrasada?'Procure a equipe para orientar seu retorno':'Orientações para o retorno'}</h2><p className="mt-2 text-sm leading-relaxed">{proximaAtrasada?'Há uma dose com data prevista anterior a hoje. Entre em contato com a UBS para receber orientação; não altere as datas por conta própria.':'Siga as datas confirmadas pelo profissional. Em caso de dúvida ou impossibilidade de comparecer, procure sua UBS para orientação.'}</p><p className="mt-2 text-xs leading-relaxed">Este portal consulta os registros da equipe. Não remarca doses nem envia lembretes automaticamente.</p></section>

      {/* Informações da UBS */}
      <section className="va-panel p-5">
        <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-blue-600" />
          Unidade de Atendimento
        </h2>
        <div className="text-sm text-gray-600">
          <p className="font-medium text-gray-900">{paciente.unidades_saude?.nome}</p>
          <p className="mt-1">Acidente em: {formatarData(paciente.data_acidente)}</p>
        </div>
      </section>
    </div>
  )
}
