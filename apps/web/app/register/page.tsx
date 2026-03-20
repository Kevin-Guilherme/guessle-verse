import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-neon-purple to-neon-cyan mb-4 shadow-neon-cyan">
            <span className="font-display text-white text-lg">G</span>
          </div>
          <h1 className="font-display text-2xl text-white tracking-wide mb-1">CRIAR CONTA</h1>
          <p className="text-slate-500 text-sm">
            Ja tem conta?{' '}
            <Link href="/login" className="text-neon-purple-light hover:text-neon-purple transition-colors">
              Entrar
            </Link>
          </p>
        </div>

        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
