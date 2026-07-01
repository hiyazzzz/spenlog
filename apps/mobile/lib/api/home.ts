import { supabase } from '@/lib/supabase'
import { monthString } from '@/lib/date'
import type { Expense, Budget, FixedCost, User } from '@spenlog/types'
import { carryoverBudgetsIfEmpty } from './budget'

export interface HomeData {
  profile: User | null
  expenses: Expense[]
  budgets: Budget[]
  categories: { name: string; color: string | null }[]
  fixedCosts: Pick<FixedCost, 'amount' | 'kind'>[]
  paymentMethods: string[]
  cardNames: string[]
  accountNames: string[]
}

export async function getHomeData(userId: string): Promise<HomeData> {
  const thisMonth = monthString()

  const [
    { data: profile },
    { data: expenses },
    { data: budgets },
    { data: categories },
    { data: fixedCosts },
    { data: cards },
    { data: accs },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('expenses').select('*').eq('user_id', userId)
      .gte('date', `${thisMonth}-01`).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', userId).eq('month', thisMonth),
    supabase.from('categories').select('name, color').eq('user_id', userId).eq('is_hidden', false).order('sort_order'),
    supabase.from('fixed_costs').select('amount, kind').eq('user_id', userId),
    supabase.from('cards').select('name').eq('user_id', userId),
    supabase.from('accounts').select('name').eq('user_id', userId),
  ])

  const cardNames = (cards ?? []).map((c: { name: string }) => c.name)
  const accountNames = (accs ?? []).map((a: { name: string }) => a.name)
  const paymentMethods = [...new Set([
    ...cardNames,
    ...(expenses ?? []).map((e: Expense) => e.payment_method).filter(Boolean),
  ])] as string[]

  // Budget carryover: 이번 달 예산 없으면 가장 최근 이전 달에서 복사 (persist)
  const resolvedBudgets = await carryoverBudgetsIfEmpty(userId, (budgets as Budget[]) ?? [], thisMonth)

  return {
    profile: (profile as User) ?? null,
    expenses: ((expenses as Expense[]) ?? []).map(e => ({ ...e, type: e.type ?? 'expense' })),
    budgets: resolvedBudgets,
    categories: categories ?? [],
    fixedCosts: (fixedCosts as Pick<FixedCost, 'amount' | 'kind'>[]) ?? [],
    paymentMethods,
    cardNames,
    accountNames,
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
