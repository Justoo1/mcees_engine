import { describe, it, expect } from 'vitest'
import { can, hasRole, ROLE_RANK } from '@/lib/auth/permissions'

describe('permissions', () => {
  it('orders roles VIEWER < OPERATOR < ADMIN', () => {
    expect(ROLE_RANK.VIEWER).toBeLessThan(ROLE_RANK.OPERATOR)
    expect(ROLE_RANK.OPERATOR).toBeLessThan(ROLE_RANK.ADMIN)
  })

  it('hasRole respects the ordering', () => {
    expect(hasRole('ADMIN', 'OPERATOR')).toBe(true)
    expect(hasRole('OPERATOR', 'OPERATOR')).toBe(true)
    expect(hasRole('VIEWER', 'OPERATOR')).toBe(false)
    expect(hasRole('VIEWER', 'ADMIN')).toBe(false)
    expect(hasRole('ADMIN', 'ADMIN')).toBe(true)
  })

  it('can.retry / replayAll require OPERATOR or higher', () => {
    expect(can.retry('VIEWER')).toBe(false)
    expect(can.retry('OPERATOR')).toBe(true)
    expect(can.retry('ADMIN')).toBe(true)
    expect(can.replayAll('VIEWER')).toBe(false)
    expect(can.replayAll('ADMIN')).toBe(true)
  })

  it('can.configure / revealSecrets require ADMIN only', () => {
    expect(can.configure('VIEWER')).toBe(false)
    expect(can.configure('OPERATOR')).toBe(false)
    expect(can.configure('ADMIN')).toBe(true)
    expect(can.revealSecrets('OPERATOR')).toBe(false)
    expect(can.revealSecrets('ADMIN')).toBe(true)
  })
})
