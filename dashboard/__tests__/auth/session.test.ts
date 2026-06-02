import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.AUTH_SECRET = 'a'.repeat(64)
})

describe('session', () => {
  it('round-trips a session payload through sign/verify', async () => {
    const { signSession, verifySession } = await import('@/lib/auth/session')
    const payload = {
      sub: 'user-1',
      email: 'a@b.com',
      name: 'Alice',
      role: 'ADMIN' as const,
    }
    const token = await signSession(payload)
    const verified = await verifySession(token)
    expect(verified).toMatchObject(payload)
  })

  it('returns null for a tampered token', async () => {
    const { signSession, verifySession } = await import('@/lib/auth/session')
    const token = await signSession({
      sub: 'u', email: 'a@b.com', name: 'n', role: 'VIEWER',
    })
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'b' : 'a')
    expect(await verifySession(tampered)).toBeNull()
  })

  it('returns null for a token signed with a different secret', async () => {
    const { signSession } = await import('@/lib/auth/session')
    const token = await signSession({
      sub: 'u', email: 'a@b.com', name: 'n', role: 'VIEWER',
    })
    process.env.AUTH_SECRET = 'b'.repeat(64)
    const fresh = await import('@/lib/auth/session?secret-swap')
    expect(await fresh.verifySession(token)).toBeNull()
    process.env.AUTH_SECRET = 'a'.repeat(64)
  })

  it('returns null for malformed JWTs', async () => {
    const { verifySession } = await import('@/lib/auth/session')
    expect(await verifySession('not-a-jwt')).toBeNull()
    expect(await verifySession('')).toBeNull()
  })

  it('throws if AUTH_SECRET is missing or too short', async () => {
    process.env.AUTH_SECRET = 'too-short'
    const mod = await import('@/lib/auth/session?too-short')
    await expect(
      mod.signSession({ sub: 'u', email: 'a@b.com', name: 'n', role: 'VIEWER' }),
    ).rejects.toThrow(/AUTH_SECRET/)
    process.env.AUTH_SECRET = 'a'.repeat(64)
  })
})
