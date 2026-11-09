import Link from 'next/link'
import { Home, Syringe, User } from 'lucide-react'

// Desliga o cache estático para todas as telas do paciente
export const instant = false 

export default function PwaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-200 flex justify-center selection:bg-blue-100">
      
      <div className="w-full max-w-md bg-gray-50 min-h-screen relative shadow-2xl flex flex-col overflow-hidden">
        
        <main className="flex-1 overflow-y-auto pb-20 no-scrollbar">
          {children}
        </main>

        <nav className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center pb-safe">
          <Link href="/" className="flex flex-col items-center gap-1 text-blue-600">
            <Home size={24} strokeWidth={2.5} />
            <span className="text-[10px] font-semibold">Início</span>
          </Link>
          
          <Link href="/doses" className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors">
            <Syringe size={24} strokeWidth={2.5} />
            <span className="text-[10px] font-semibold">Doses</span>
          </Link>
          
          <Link href="/perfil" className="flex flex-col items-center gap-1 text-gray-400 hover:text-blue-600 transition-colors">
            <User size={24} strokeWidth={2.5} />
            <span className="text-[10px] font-semibold">Perfil</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}