import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AssetsDataLoader from '@/components/assets/AssetsDataLoader'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <AssetsDataLoader userId={user.id} />
}
