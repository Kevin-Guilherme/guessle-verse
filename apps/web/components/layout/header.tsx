import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function Header() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header className="border-b border-border bg-bg-surface sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
            G
          </div>
          <span className="font-bold text-xl text-white">Guessle</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/ranking" className="text-sm text-gray-400 hover:text-white transition-colors duration-200">
            Ranking
          </Link>
          {user ? (
            <Link href="/profile" className="text-sm bg-bg-surface border border-border px-4 py-2 rounded-lg text-gray-200 hover:border-gray-500 transition-colors duration-200">
              Perfil
            </Link>
          ) : (
            <Link href="/login" className="text-sm bg-bg-surface border border-border px-4 py-2 rounded-lg text-gray-200 hover:border-gray-500 transition-colors duration-200">
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
