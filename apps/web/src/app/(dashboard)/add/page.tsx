import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddExpenseForm from '@/components/expense/AddExpenseForm'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ name?: string; amount?: string; category?: string; type?: string }>
}

export default async function AddExpensePage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const prefill = {
    name: params.name,
    amount: params.amount ? parseInt(params.amount) : undefined,
    category: params.category,
    type: params.type as 'expense' | 'income' | undefined,
  }

  const { data: categories } = await supabase
    .from('categories').select('name').eq('user_id', user.id)
    .eq('is_hidden', false).order('sort_order')
  const userCategories = (categories ?? []).map(c => c.name)

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>직접 입력</h1>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">취소</Link>
      </div>
      <AddExpenseForm prefill={prefill} userCategories={userCategories} />
    </div>
  )
}
