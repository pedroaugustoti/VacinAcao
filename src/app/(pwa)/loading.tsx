export default function PatientLoading() {
  return <div role="status" className="space-y-5 p-6"><span className="sr-only">Carregando seu acompanhamento…</span><div aria-hidden="true" className="space-y-5"><div className="va-skeleton h-8 w-48 rounded-xl" /><div className="va-skeleton h-56 rounded-3xl" />{[1,2].map(i=><div key={i} className="va-skeleton h-28 rounded-2xl" />)}</div></div>
}
