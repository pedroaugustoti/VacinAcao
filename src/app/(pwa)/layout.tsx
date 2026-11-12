import PwaNav from '@/components/pwa/PwaNav'
import { HeartPulse } from 'lucide-react'

// Desliga o cache estático para todas as telas do paciente
export const instant = false 

export default function PwaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="va-patient min-h-screen flex justify-center selection:bg-blue-100">
      
      <div className="va-patient-frame w-full max-w-md min-h-screen relative flex flex-col">
        <a href="#conteudo-paciente" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Pular para o conteúdo</a>
        <div className="va-patient-brand flex items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-2.5"><span className="va-sidebar-brand flex h-9 w-9 items-center justify-center rounded-xl"><HeartPulse size={20} aria-hidden="true" /></span><p className="text-lg font-bold tracking-tight text-sky-950">Vacin<span className="text-teal-700">Ação</span></p></div>
          <span className="text-xs font-medium text-slate-600">Área do paciente</span>
        </div>
        
        <main id="conteudo-paciente" tabIndex={-1} className="min-w-0 flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))]">
          {children}
        </main>

        <PwaNav/>
      </div>
    </div>
  )
}
