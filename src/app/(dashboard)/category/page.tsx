import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CategoryPage from '@/components/category/CategoryPage'

const DEFAULT_CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비', '수입']

export default async function CategoryRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: categories }, { data: expenses }] = await Promise.all([
    supabase.from('categories').select('*, color').eq('user_id', user.id).order('sort_order'),
    supabase.from('expenses').select('category, amount, type')
      .eq('user_id', user.id)
      .gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
  ])

  // 카테고리가 없으면 기본 카테고리 seed
  let cats = categories ?? []
  if (cats.length === 0) {
    const seedData = DEFAULT_CATEGORIES.map((name, i) => ({
      user_id: user.id, name, is_default: true, is_hidden: false, sort_order: i,
    }))
    const { data: seeded } = await supabase
      .from('categories').insert(seedData).select()
    cats = seeded ?? []
  }

  const spentMap: Record<string, number> = {}
  ;(expenses ?? []).filter(e => e.type !== 'transfer').forEach(e => {
    spentMap[e.category] = (spentMap[e.category] ?? 0) + e.amount
  })

  return (
    <CategoryPage
      userId={user.id}
      initialCategories={cats}
      spentMap={spentMap}
    />
  )
}
