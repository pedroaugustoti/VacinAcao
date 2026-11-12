'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

export default function PatientError({ retry }: { retry: () => void }) {
  return <div className="p-6"><div role="alert" className="va-panel p-6"><AlertCircle size={28} className="text-rose-700" aria-hidden="true" /><h1 className="mt-4 text-xl font-bold text-slate-900">Não foi possível carregar esta tela</h1><p className="mt-3 text-sm leading-relaxed text-slate-600">Confira sua conexão e tente novamente. Se o problema continuar, procure a UBS responsável pelo seu acompanhamento.</p><button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"><RefreshCw size={17} aria-hidden="true" /> Tentar novamente</button></div></div>
}
