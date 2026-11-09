import { createClient } from '@/lib/supabase/server'
import { Calendar } from 'lucide-react'

export default async function ListaDoses() {
  const supabase = await createClient()
  
  // Simulando a busca de dados...
  const { data: { user } } = await supabase.auth.getUser()
  const { data: doses } = await supabase
    .from('esquemas_vacinais')
    .select('*')
    // ... filtros e lógica
    
  return (
    <div className="space-y-4">
      {doses?.map((dose) => (
        <div key={dose.id} className="bg-white p-4 rounded-xl shadow-sm">
           <h3 className="font-bold">{dose.numero_dose}ª Dose</h3>
           <p className="text-sm text-gray-500">Data: {dose.data_prevista}</p>
        </div>
      ))}
    </div>
  )
}