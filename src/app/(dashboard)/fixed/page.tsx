import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FixedCostList from '@/components/fixed/FixedCostList'
import ApplyFixedCosts from '@/components/fixed/ApplyFixedCosts'
import dayjs from 'dayjs'

export default async function FixedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const thisMonth = dayjs().format('YYYY-MM')

  const [{ data: fixedCosts }, { data: appliedExpenses }] = await Promise.all([
    supabase.from('fixed_costs').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    supabase.from('expenses').select('name').eq('user_id', user.id)
      .gte('date', `${thisMonth}-01`).eq('category', '고정비'),
  ])

  const total = fixedCosts?.reduce((s, f) => s + f.amount, 0) ?? 0
  const appliedNames = new Set(appliedExpenses?.map(e => e.name) ?? [])

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <h1 className="text-lg font-semibold mb-5" style={{ color: 'var(--color-accent)' }}>고정비</h1>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <p className="text-xs text-gray-400 mb-1">월 고정비 합계</p>
        <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
          ₩{total.toLocaleString()}
        </p>
      </div>

      <ApplyFixedCosts
        fixedCosts={fixedCosts ?? []}
        userId={user.id}
        appliedNames={Array.from(appliedNames)}
        thisMonth={thisMonth}
      />

      <FixedCostList initialItems={fixedCosts ?? []} userId={user.id} />
    </div>
  )
}
