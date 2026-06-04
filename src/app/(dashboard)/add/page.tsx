import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AddExpenseForm from '@/components/expense/AddExpenseForm'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ name?: string; amount?: string; category?: string }>
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
  }

  return (
    <div className="m