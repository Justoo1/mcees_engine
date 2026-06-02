import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('password', () => {
  it('produces a bcrypt hash that verifies against the original plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).toMatch(/^\$2[aby]\$/)
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret-pass')
    expect(await verifyPassword('wrong-pass', hash)).toBe(false)
  })

  it('produces different hashes for the same password (salted)', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
    expect(await verifyPassword('same-password', a)).toBe(true)
    expect(await verifyPassword('same-password', b)).toBe(true)
  })
})
