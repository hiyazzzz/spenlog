/**
 * 이번 달 예산이 없으면 가장 최근 이전 달에서 복사해서 저장(persist).
 * ignoreDuplicates=true로 동시 호출 중복 insert 방지.
 * already-fetched budgets를 받으므로 추가 select 없음.
 */
export async function carryoverBudgetsIfEmpty(
  supabase: any,
  userId: string,
  existing: any[],
  thisMonth: string
): Promise<any[]> {
  if (existing.length > 0) return existing

  const { data: prevBudgets } = await supabase
    .from('budgets')
    .select('category, amount, month')
    .eq('user_id', userId)
    .lt('month', thisMonth)
    .order('month', { ascending: false })
    .limit(50)

  if (!prevBudgets || prevBudgets.length === 0) return []

  const latestMonth = prevBudgets[0].month as string
  const latestRows = prevBudgets.filter((b: any) => b.month === latestMonth)

  const newBudgets = latestRows.map((b: any) => ({
    user_id: userId,
    category: b.category as string,
    amount: b.amount as number,
    month: thisMonth,
    source: 'manual',
  }))

  await supabase
    .from('budgets')
    .upsert(newBudgets, { onConflict: 'user_id,category,month', ignoreDuplicates: true })

  return newBudgets
}
