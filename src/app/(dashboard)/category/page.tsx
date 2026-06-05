import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CategoryPage from '@/components/category/CategoryPage'

export default async function CategoryRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: categories }, { data: expenses }] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', user.id).order('sort_order'),
    supabase.from('expenses').select('category, amount, type')
      .eq('user_id', user.id)
      .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
  ])

  const spentMap: Record<string, number> = {}
  ;(expenses ?? []).filter(e => e.type !== 'transfer').forEach(e => {
    spentMap[e.category] = (spentMap[e.category] ?? 0) + e.amount
  })

  return (
    <CategoryPage
      userId={user.id}
      initialCategories={categories ?? []}
      spentMap={spentMap}
    />
  )
}
