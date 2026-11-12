'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export default function RefreshReadButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><RefreshCw size={16} aria-hidden="true" className={pending ? 'animate-spin' : ''} />{pending ? 'Consultando…' : 'Consultar novamente'}</button>
}
