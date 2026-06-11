import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isPremiumUnlocked } from '@/lib/premium'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 프리미엄 체크
    const { data: profile } = await supabase
      .from('users').select('*').eq('id', user.id).single()
    if (!isPremiumUnlocked(profile)) {
      return NextResponse.json({ error: 'PREMIUM_REQUIRED' }, { status: 403 })
    }

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') // YYYY-MM
    const to = searchParams.get('to')     // YYYY-MM

    let query = supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (from) query = query.gte('date', from + '-01')
    if (to) {
      // to 월의 마지막 날
      const [y, m] = to.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      query = query.lte('date', `${to}-${String(lastDay).padStart(2, '0')}`)
    }

    const { data: expenses, error } = await query
    if (error) throw error

    if (!expenses || expenses.length === 0) {
      return NextResponse.json({ error: 'NO_DATA' }, { status: 404 })
    }

    // CSV 생성
    const headers = ['날짜', '항목명', '유형', '카테고리', '금액', '결제수단', '메모', '입력방식']
    const rows = expenses.map(e => {
      const isIncome = e.type === 'income'
      const amt = isIncome ? `+${e.amount}` : `-${e.amount}`
      return [
        e.date ?? '',
        `"${(e.name ?? '').replace(/"/g, '""')}"`,
        isIncome ? '수입' : e.type === 'transfer' ? '이체' : '지출',
        `"${(e.category ?? '').replace(/"/g, '""')}"`,
        amt,
        `"${(e.payment_method ?? '').replace(/"/g, '""')}"`,
        `"${(e.memo ?? '').replace(/"/g, '""')}"`,
        e.source ?? 'manual',
      ].join(',')
    })

    const BOM = '﻿'
    const csv = BOM + [headers.join(','), ...rows].join('\n')

    const fileName = from && to
      ? `spenlog_${from}_${to}`
      : from
        ? `spenlog_${from}_이후`
        : 'spenlog_전체기간'

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}.csv"`,
      },
    })
  } catch (e: any) {
    console.error('[export/csv]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
