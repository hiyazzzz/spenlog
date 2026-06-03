import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FixedCostList from '@/components/fixed/FixedCostList'

export default async function FixedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: fixedCosts } = await supabase
    .from('fixed_costs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const total = fixedCosts?.reduce((s, f) => s + f.amount, 0) ?? 0

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-20">
      <h1 className="text-lg font-semibold text-[#4A1220] mb-5">고정비</h1>

      {/* 월 고정비 합계 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4">
        <p className="text-xs text-gray-400 mb-1">월 고정비 합계</p>
        <p className="text-2xl font-bold text-[#6B1E2E]">₩{total.toLocaleString()}</p>
      </div>

      <FixedCostList initialItems={fixedCosts ?? []} userId={user.id} />
    </div>
  )
}
