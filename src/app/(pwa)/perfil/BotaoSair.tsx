"use client"

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'
import { useState } from 'react'

export default function BotaoSair() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const handleSair = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.refresh() // Atualiza os cookies no Next.js
    router.push('/login')
  }

  return (
    <button 
      onClick={handleSair}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-70"
    >
      <LogOut size={20} />
      {loading ? 'Saindo...' : 'Sair da conta'}
    </button>
  )
} 