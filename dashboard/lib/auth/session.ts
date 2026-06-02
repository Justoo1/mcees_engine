import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export const SESSION_COOKIE = 'mcees_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export type SessionPayload = {
  sub: string
  email: string
  name: string
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
}

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET
  if (!raw || raw.length < 32) {
    throw new Error('AUTH_SECRET env var must be set to at least 32 characters')
  }
  return new TextEncoder().encode(raw)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    if (
      typeof payload.sub === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.name === 'string' &&
      (payload.role === 'ADMIN' || payload.role === 'OPERATOR' || payload.role === 'VIEWER')
    ) {
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      }
    }
    return null
  } catch {
    return null
  }
}
