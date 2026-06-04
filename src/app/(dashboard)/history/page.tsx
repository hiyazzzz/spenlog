import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dayjs from 'dayjs'
import HistoryClient from '@/components/history/HistoryClient'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 최근 3개월 데이터
  const from = dayjs().subtract(2, 'month').startOf('month').format('YYYY-MM-DD')

  const [{ data: expenses }, { data: cards }] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', from).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('cards').select('name').eq('user_id', user.id),
  ])

  const paymentMethods = [...new Set(
    (expenses ?? []).map(e => e.payment_method).filter(Boolean)
  )] as string[]

  return (
    <HistoryClient
      userId={user.id}
      initialExpenses={expenses ?? []}
      paymentMethods={paymentMethods}
    />
  )
}
