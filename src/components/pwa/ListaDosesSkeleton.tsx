// src/components/pwa/ListaDosesSkeleton.tsx
export default function ListaDosesSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Carregando calendário de doses…</span>
      <div aria-hidden="true" className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="va-skeleton h-28 w-full rounded-2xl" />)}
      </div>
    </div>
  )
}
