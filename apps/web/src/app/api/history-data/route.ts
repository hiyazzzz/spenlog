import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import dayjs from 'dayjs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const from = dayjs().subtract(2, 'month').startOf('month').format('YYYY-MM-DD')

  const [{ data: expenses }, { data: cards }, { data: categories }] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', from).order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('cards').select('name').eq('user_id', user.id),
    supabase.from('categories').select('name').eq('user_id', user.id).eq('is_hidden', false).order('sort_order'),
  ])

  const normalizedExpenses = (expenses ?? []).map(e => ({ ...e, type: e.type ?? 'expense' }))
  const paymentMethods = [...new Set(normalizedExpenses.map(e => e.payment_method).filter(Boolean))] as string[]
  const userCategories = (categories ?? []).map(c => c.name)

  return NextResponse.json({ expenses: normalizedExpenses, paymentMethods, userCategories })
}
