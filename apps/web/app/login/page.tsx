import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-white mb-2">Entrar</h1>
      <p className="text-gray-400 text-sm mb-8">
        Nao tem conta?{' '}
        <Link href="/register" className="text-blue-400 hover:text-blue-300">
          Criar conta
        </Link>
      </p>
      <LoginForm />
    </div>
  )
}
