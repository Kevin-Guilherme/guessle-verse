import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { UserAvatarButton } from './UserAvatarButton'

export async function Header() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name      = (user?.user_metadata?.name as string) || user?.email?.split('@')[0] || 'U'
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || null

  return (
    <header className="sticky top-0 z-50 border-b border-purple-500/10 bg-void/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center shadow-neon-sm group-hover:shadow-neon-purple transition-shadow duration-300">
            <span className="font-display text-white text-sm font-bold">G</span>
          </div>
          <span className="font-display text-xl text-white tracking-wide group-hover:text-neon-purple-light transition-colors duration-300">
            GUESSLE
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/ranking"
            className="text-sm text-slate-400 hover:text-neon-cyan transition-colors duration-200 px-3 py-2 rounded-lg hover:bg-neon-cyan/5 font-medium tracking-wide"
          >
            RANKING
          </Link>
          {user ? (
            <UserAvatarButton name={name} avatarUrl={avatarUrl} />
          ) : (
            <Link
              href="/login"
              className="text-sm font-medium tracking-wide px-4 py-2 rounded-lg bg-gradient-to-r from-neon-purple to-neon-pink text-white hover:shadow-neon-purple transition-all duration-200"
            >
              ENTRAR
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
