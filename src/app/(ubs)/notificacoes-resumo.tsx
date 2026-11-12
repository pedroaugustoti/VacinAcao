import Link from 'next/link'
import { Bell, CheckCircle2 } from 'lucide-react'
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Notificacao = {
  id: string
  titulo: string
  mensagem: string | null
  link: string | null
  lida: boolean
  created_at: string
}

export default async function NotificacoesResumo({
  usuarioId,
}: {
  usuarioId: string
}) {
  await connection()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notificacoes')
    .select('id,titulo,mensagem,link,lida,created_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return (
      <span className="text-xs text-slate-400">Notificações indisponíveis</span>
    )
  }

  const notifications = (data || []) as Notificacao[]
  const unread = notifications.filter((n) => !n.lida).length

  return (
    <details className="relative z-40 group" aria-label="Notificações">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-emerald-50/50 hover:border-emerald-200">
        <Bell size={16} className="text-emerald-700" />
        <span>Alertas</span>
        {unread > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
            {unread}
            {notifications.length === 10 ? '+' : ''}
          </span>
        )}
      </summary>

      <div className="absolute right-0 mt-2 w-[min(92vw,360px)] rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Central de Alertas
          </span>
          <span className="text-[11px] font-medium text-emerald-700">
            {unread} não lida(s)
          </span>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 size={24} className="text-emerald-500 mb-1.5" />
            <p className="text-xs text-slate-500">
              Nenhuma notificação pendente.
            </p>
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id} className="py-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={
                      n.lida
                        ? 'font-medium text-slate-600'
                        : 'font-bold text-slate-900'
                    }
                  >
                    {n.titulo}
                  </span>
                  {!n.lida && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Nova
                    </span>
                  )}
                </div>
                {n.mensagem && (
                  <p className="mt-1 text-slate-500 leading-relaxed">
                    {n.mensagem}
                  </p>
                )}
                {n.link?.startsWith('/') && !n.link.startsWith('//') && (
                  <Link
                    href={n.link}
                    className="mt-2 inline-block font-semibold text-emerald-700 hover:underline"
                  >
                    Abrir prontuário →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}