import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session'

export async function POST(req: Request) {
  let body: { email?: string; password?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const name = body.name?.trim()

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'email, password, and name are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email format' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'email already registered' }, { status: 409 })
  }

  const password_hash = await hashPassword(password)
  const isFirstUser = (await prisma.user.count()) === 0

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password_hash,
      role: isFirstUser ? 'ADMIN' : 'VIEWER',
      last_login_at: new Date(),
    },
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
