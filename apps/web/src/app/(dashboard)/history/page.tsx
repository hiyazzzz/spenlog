import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import HistoryDataLoader from '@/components/history/HistoryDataLoader'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <Suspense>
      <HistoryDataLoader userId={user.id} />
    </Suspense>
  )
}
