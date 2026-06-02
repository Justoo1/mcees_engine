import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session'

export async function POST(req: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.is_active) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  })

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })

  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return res
}
