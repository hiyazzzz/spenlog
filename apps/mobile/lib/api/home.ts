import { supabase } from '@/lib/supabase'
import { monthString } from '@/lib/date'
import type { Expense, Budget, FixedCost, User } from '@spenlog/types'

export interface HomeData {
  profile: User | null
  expenses: Expense[]
  budgets: Budget[]
  categories: { name: string; color: string | null }[]
  fixedCosts: Pick<FixedCost, 'amount' | 'kind'>[]
}

export async function getHomeData(userId: string): Promise<HomeData> {
  const thisMonth = monthString()

  const [
    { data: profile, error: profileError },
    { data: expenses, error: expensesError },
    { data: budgets, error: budgetsError },
    { data: categories, error: categoriesError },
    { data: fixedCosts, error: fixedCostsError },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('expenses').select('*').eq('user_id', userId)
      .gte('date', `${thisMonth}-01`).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', userId).eq('month', thisMonth),
    supabase.from('categories').select('name, color').eq('user_id', userId).eq('is_hidden', false).order('sort_order'),
    supabase.from('fixed_costs').select('amount, kind').eq('user_id', userId),
  ])

  console.log('[getHomeData] userId:', userId)
  console.log('[getHomeData] profile:', profile, 'error:', profileError)
  console.log('[getHomeData] expenses:', expenses?.length, 'error:', expensesError)
  console.log('[getHomeData] budgets:', budgets?.length, 'error:', budgetsError)
  console.log('[getHomeData] categories:', categories?.length, 'error:', categoriesError)
  console.log('[getHomeData] fixedCosts:', fixedCosts?.length, 'error:', fixedCostsError)

  return {
    profile: (profile as User) ?? null,
    expenses: (expenses as Expense[]) ?? [],
    budgets: (budgets as Budget[]) ?? [],
    categories: categories ?? [],
    fixedCosts: (fixedCosts as Pick<FixedCost, 'amount' | 'kind'>[]) ?? [],
  }
}

export const CAT_IMG_FIELDS = ['category_img_url_1', 'category_img_url_2', 'category_img_url_3', 'category_img_url_4'] as const

export async function uploadHomeImage(userId: string, base64: string, mimeType: string, slug: string): Promise<{ url: string | null; error: string | null }> {
  const { decode } = await import('base64-arraybuffer')
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${slug}-${Date.now()}.${ext}`
  const { data, error } = await supabase.storage
    .from('user-assets')
    .upload(path, decode(base64), { upsert: true, contentType: mimeType })
  if (error) {
    console.error('[uploadHomeImage] error:', error)
    return { url: null, error: error.message }
  }
  const { data: urlData } = supabase.storage.from('user-assets').getPublicUrl(data.path)
  return { url: urlData.publicUrl, error: null }
}

export async function updateHomeCustomization(userId: string, updates: Record<string, string | null>) {
  return supabase.from('users').update(updates).eq('id', userId)
}
