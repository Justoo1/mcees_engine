import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { SignupForm } from './SignupForm'

export default async function SignupPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')
  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="auth-logo">mcees</span>
        <span className="auth-tag">sync operations</span>
      </div>
      <h1 className="auth-title">Create account</h1>
      <p className="auth-sub">The first account becomes the admin.</p>
      <SignupForm />
      <div className="auth-foot">
        Already have an account? <a href="/login">Sign in</a>
      </div>
    </div>
  )
}
