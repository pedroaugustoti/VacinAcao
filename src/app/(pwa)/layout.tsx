import Link from 'next/link'
import { Home, Syringe, User } from 'lucide-react'

export default function PwaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Fundo escuro/cinza no desktop para destacar o "celular" no meio
    <div className="min-h-screen bg-gray-200 flex justify-center selection:bg-blue-100">
      
      {/* Container do App - Largura máxima de celular (max-w-md), branco e com sombra */}
      <div className="w-full max-w-md bg-gray-50 min-h-screen relative shadow-2xl flex flex-col overflow-hidden">
        
        {/* Área de conteúdo rolável */}
        <main className="flex-1 overflow-y-auto pb-20 no-scrollbar">
          {children}
        </main>

        {/* Bottom Navigation Fixa */}
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