import { redirect } from 'next/navigation'
import { DashboardApp } from '@/components/DashboardApp'
import { getCurrentUser } from '@/lib/auth/current-user'

export default async function Page() {
  const session = await getCurrentUser()
  if (!session) redirect('/login')
  return (
    <DashboardApp
      currentUser={{
        id: session.sub,
        email: session.email,
        name: session.name,
        role: session.role,
      }}
    />
  )
}
