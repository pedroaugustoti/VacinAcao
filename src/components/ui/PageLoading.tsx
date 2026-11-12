export default function PageLoading({ label = 'Carregando informações…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-3">
          <div className="va-skeleton h-8 w-64 max-w-full rounded-lg" />
          <div className="va-skeleton h-4 w-96 max-w-full rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="va-panel space-y-4 p-5"><div className="va-skeleton h-10 w-10 rounded-xl" /><div className="va-skeleton h-8 w-20 rounded-lg" /><div className="va-skeleton h-3 w-32 rounded" /></div>)}
        </div>
        <div className="va-panel space-y-6 p-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="va-skeleton h-10 rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}
