import { supabase } from '@/lib/supabase'
import { monthString } from '@/lib/date'

export interface CategoryItem {
  id: string
  name: string
  is_default: boolean
  is_hidden: boolean
  sort_order: number
  color: string | null
}

export const DEFAULT_CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비']

export async function getCategories(userId: string): Promise<CategoryItem[]> {
  const { data } = await supabase.from('categories').select('*').eq('user_id', userId).order('sort_order')
  return (data as CategoryItem[]) ?? []
}

// 기본 카테고리가 DB에 없으면 자동 생성
export async function ensureDefaultCategories(userId: string): Promise<CategoryItem[]> {
  const existing = await getCategories(userId)
  const missing = DEFAULT_CATEGORIES.filter(name => !existing.some(c => c.name === name))
  if (missing.length === 0) return existing

  const maxOrder = existing.reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1)
  const seedRows = missing.map((name, i) => ({
    user_id: userId, name, is_default: true, is_hidden: false, sort_order: maxOrder + 1 + i,
  }))
  const { data } = await supabase.from('categories').insert(seedRows).select()
  return [...existing, ...((data as CategoryItem[]) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

export async function addCategory(userId: string, name: string) {
  const existing = await getCategories(userId)
  const maxOrder = existing.reduce((max, c) => Math.max(max, c.sort_order ?? 0), -1)
  return supabase.from('categories').insert({
    user_id: userId, name, is_default: false, is_hidden: false, sort_order: maxOrder + 1,
  })
}

export async function renameCategory(id: string, name: string) {
  return supabase.from('categories').update({ name }).eq('id', id)
}

export async function hideCategory(id: string) {
  return supabase.from('categories').update({ is_hidden: true }).eq('id', id)
}

export async function restoreCategory(id: string) {
  return supabase.from('categories').update({ is_hidden: false }).eq('id', id)
}

// 드래그 정렬 후 순서 일괄 반영
export async function reorderCategories(items: { id: string; sort_order: number }[]) {
  await Promise.all(items.map(item =>
    supabase.from('categories').update({ sort_order: item.sort_order }).eq('id', item.id)
  ))
}

// 이번 달 카테고리별 지출 합계
export async function getCategorySpending(userId: string): Promise<Record<string, number>> {
  const thisMonth = monthString()
  const nextMonth = monthString(1)
  const { data } = await supabase.from('expenses').select('category, amount, type')
    .eq('user_id', userId)
    .gte('date', `${thisMonth}-01`).lt('date', `${nextMonth}-01`)

  const spent: Record<string, number> = {}
  ;(data ?? []).forEach((e: any) => {
    if (e.type === 'income') return
    spent[e.category] = (spent[e.category] ?? 0) + e.amount
  })
  return spent
}
