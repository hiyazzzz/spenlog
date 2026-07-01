import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import dayjs from 'dayjs'
import { carryoverBudgetsIfEmpty } from '@/lib/budget-carryover'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const thisMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')

  const [{ data: profile }, { data: expenses }, { data: budgets }, { data: userCategories }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', thisMonth + '-01').lt('date', nextMonth + '-01').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', thisMonth),
    supabase.from('categories').select('name, color').eq('user_id', user.id).eq('is_hidden', false).order('sort_order'),
  ])

  // Budget carryover: 이번 달 예산 없으면 가장 최근 이전 달에서 복사 (persist)
  const resolvedBudgets = await carryoverBudgetsIfEmpty(supabase, user.id, budgets ?? [], thisMonth)

  return NextResponse.json({
    userId: user.id,
    profile: profile ?? null,
    expenses: (expenses ?? []).map(e => ({ ...e, type: e.type ?? 'expense' })),
    budgets: resolvedBudgets,
    userCategories: userCategories ?? [],
  })
}
