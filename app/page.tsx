import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import Home from '@/src/Home'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const user = await currentUser()
  if (!user) redirect('/login')
  return <Home userEmail={user.email} />
}
