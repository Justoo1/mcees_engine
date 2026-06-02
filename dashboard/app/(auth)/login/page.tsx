import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')
  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="auth-logo">mcees</span>
        <span className="auth-tag">sync operations</span>
      </div>
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-sub">Access the sync operations console.</p>
      <LoginForm />
      <div className="auth-foot">
        New here? <a href="/signup">Create an account</a>
      </div>
    </div>
  )
}
