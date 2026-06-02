import { NextResponse } from 'next/server'
import { getCurrentUser } from './current-user'
import type { SessionPayload } from './session'

export type Role = SessionPayload['role']

export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  OPERATOR: 2,
  ADMIN: 3,
}

export function hasRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min]
}

export const can = {
  retry:     (role: Role) => hasRole(role, 'OPERATOR'),
  replayAll: (role: Role) => hasRole(role, 'OPERATOR'),
  configure: (role: Role) => hasRole(role, 'ADMIN'),
  revealSecrets: (role: Role) => hasRole(role, 'ADMIN'),
  simulate:  (role: Role) => hasRole(role, 'OPERATOR'),
}

export async function requireRole(min: Role) {
  const user = await getCurrentUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }), user: null }
  }
  if (!hasRole(user.role, min)) {
    return { error: NextResponse.json({ error: 'forbidden', requiredRole: min }, { status: 403 }), user: null }
  }
  return { error: null, user }
}
