// src/app/(pwa)/doses/page.tsx
import { Suspense } from 'react'
import ListaDoses from '@/components/pwa/ListaDoses'
import ListaDosesSkeleton from '@/components/pwa/ListaDosesSkeleton'
import { connection } from 'next/server'

export default async function HistoricoDoses() {
  await connection() // Mantendo a instrução de que a rota usa cookies
  
  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Histórico de Doses</h1>
      </header>

      {/* O Suspense segura o carregamento e exibe o Skeleton */}
      <Suspense fallback={<ListaDosesSkeleton />}>
        {/* O componente que efetivamente busca os dados no Supabase */}
        <ListaDoses />
      </Suspense>
    </div>
  )
}