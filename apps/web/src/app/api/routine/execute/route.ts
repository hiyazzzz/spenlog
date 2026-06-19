import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { recordFixedCostPayment, getPaidIds } from '@/lib/routine'
import dayjs from 'dayjs'

/**
 * GET /api/routine/execute
 * Vercel Cron: 매일 자정 실행 — 오늘이 due_day인 고정비/고정저축을 자동으로
 * savings_payments에 기록하고 expenses/accounts에 반영.
 *
 * Vercel Cron은 Authorization: Bearer {CRON_SECRET} 헤더 전송
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('[routine/execute] SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Server config error' }, { status: 500 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const today = dayjs()
  const todayDay = today.date()
  const yearMonth = today.format('YYYY-MM')
  // TODO: due_day가 29/30/31인 고정비는 짧은 달(2월 등)에는 매칭되지 않음.
  // 월말 보정 로직(예: 그 달의 마지막 날과 비교) 필요 여부는 기획 확인 후 결정.

  const { data: fixedCosts, error } = await admin
    .from('fixed_costs')
    .select('id, user_id, name, amount, kind, due_day, linked_account_id, linked_target_account_id')
    .eq('due_day', todayDay)

  if (error) {
    console.error('[routine/execute] fixed_costs fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let processed = 0
  let skipped = 0
  const results: { id: string; status: 'processed' | 'skipped' }[] = []

  for (const fc of (fixedCosts ?? [])) {
    const { fixedCostIds: paidIds } = await getPaidIds(admin, fc.user_id, yearMonth)
    if (paidIds.has(fc.id)) {
      skipped++
      results.push({ id: fc.id, status: 'skipped' })
      continue
    }

    await recordFixedCostPayment(admin, fc.user_id, {
      id: fc.id, name: fc.name, amount: fc.amount,
      kind: fc.kind, linked_account_id: fc.linked_account_id,
      linked_target_account_id: fc.linked_target_account_id,
    }, yearMonth)

    processed++
    results.push({ id: fc.id, status: 'processed' })
  }

  return NextResponse.json({ ok: true, date: today.format('YYYY-MM-DD'), processed, skipped, results })
}
