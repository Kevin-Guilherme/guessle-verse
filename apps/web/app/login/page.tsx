import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-neon-purple to-neon-pink mb-4 shadow-neon-purple">
            <span className="font-display text-white text-lg">G</span>
          </div>
          <h1 className="font-display text-2xl text-white tracking-wide mb-1">ENTRAR</h1>
          <p className="text-slate-500 text-sm">
            Sem conta?{' '}
            <Link href="/register" className="text-neon-purple-light hover:text-neon-purple transition-colors">
              Criar agora
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
