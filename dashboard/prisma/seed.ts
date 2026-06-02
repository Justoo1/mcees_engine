import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@mcees.local').toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345'
  const name = process.env.SEED_ADMIN_NAME ?? 'Admin'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`[seed] admin user already exists: ${email}`)
    return
  }

  const password_hash = await bcrypt.hash(password, 12)
  await prisma.user.create({
    data: { email, name, password_hash, role: 'ADMIN' },
  })
  console.log(`[seed] created admin user: ${email}`)
  console.log(`[seed] password: ${password}  (CHANGE THIS in production)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
