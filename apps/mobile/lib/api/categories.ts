import { supabase } from '@/lib/supabase'

export interface CategoryItem {
  id: string
  name: string
  is_default: boolean
  is_hidden: boolean
}

export const DEFAULT_CATEGORIES = ['생활비', '활동비', '고정비', '친목비', '예비비']

export async function getCategories(userId: string): Promise<CategoryItem[]> {
  const { data } = await supabase.from('categories').select('*').eq('user_id', userId).order('sort_order')
  return (data as CategoryItem[]) ?? []
}

export async function addCategory(userId: string, name: string) {
  return supabase.from('categories').insert({
    user_id: userId, name, is_default: false, is_hidden: false,
  })
}

export async function hideCategory(id: string) {
  return supabase.from('categories').update({ is_hidden: true }).eq('id', id)
}

export async function restoreCategory(id: string) {
  return supabase.from('categories').update({ is_hidden: false }).eq('id', id)
}
