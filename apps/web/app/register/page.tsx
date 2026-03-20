import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <div className="max-w-sm mx-auto px-4 py-20">
      <h1 className="text-2xl font-bold text-white mb-2">Criar conta</h1>
      <p className="text-gray-400 text-sm mb-8">
        Ja tem conta?{' '}
        <Link href="/login" className="text-blue-400 hover:text-blue-300">
          Entrar
        </Link>
      </p>
      <RegisterForm />
    </div>
  )
}
