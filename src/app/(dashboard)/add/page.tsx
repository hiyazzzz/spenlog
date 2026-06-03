import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddTabs from '@/components/expense/AddTabs'

export default async function AddExpensePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(100)

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-20">
      <h1 className="text-lg font-semibold text-[#4A1220] mb-5">지출 관리</h1>
      <AddTabs expenses={expenses ?? []} />
    </div>
  )
}
