'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
}

export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function logout() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.replace('/login')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="user-pill" title={`${user.email} · ${user.role}`}>
      <span className="user-avatar">{initials || '·'}</span>
      <span className="mono" style={{ color: 'var(--t-0)' }}>{user.name}</span>
      <span className="role">{user.role}</span>
      <button onClick={logout} disabled={busy} title="Sign out">
        {busy ? '…' : 'Sign out'}
      </button>
    </span>
  )
}
