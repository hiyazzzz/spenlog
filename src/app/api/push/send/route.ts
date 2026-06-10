import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
// @ts-ignore
import webpush from 'web-push'
import dayjs from 'dayjs'

type NotifType = 'due_date_reminder' | 'due_date_unprocessed' | 'report' | 'daily' | 'premium_d7'

interface PushSubscription {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

async function sendToUser(sub: PushSubscription, payload: object, supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
  } catch (err: any) {
    // 410 Gone = 구독 만료 → 삭제
    if (err.statusCode === 410) {
      await supabase.from('push_subscriptions').delete()
        .eq('user_id', sub.user_id).eq('endpoint', sub.endpoint)
    }
  }
}

export async function GET(req: Request) {
  // VAPID 설정 — 런타임에만 실행 (모듈 최상위 실행 시 빌드 에러 방지)
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@spenlog.app',
    vapidPublic,
    vapidPrivate,
  )

  // Vercel Cron은 Authorization: Bearer {CRON_SECRET} 헤더 전송
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as NotifType | null
  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  // daily = due_date_reminder(오전 9시) + due_date_unprocessed(저녁 처리) 통합
  if (type === 'daily') {
    const hour = dayjs().hour()
    const subType: NotifType = hour < 15 ? 'due_date_reminder' : 'due_date_unprocessed'
    const url = new URL(req.url)
    url.searchParams.set('type', subType)
    return GET(new Request(url.toString(), req))
  }

  const supabase = await createClient()
  const today = dayjs()
  let sent = 0

  if (type === 'due_date_reminder') {
    // 7일 후 출금일인 고정비/저축 유저에게 알림
    const targetDay = today.add(7, 'day').date()

    const { data: fixedCosts } = await supabase
      .from('fixed_costs')
      .select('user_id, name, amount, due_day')
      .eq('due_day', targetDay)

    const userIds = [...new Set((fixedCosts ?? []).map(f => f.user_id))]

    for (const userId of userIds) {
      const { data: userProfile } = await supabase.from('users').select('push_enabled, push_due_date_reminder').eq('id', userId).single()
      if (!userProfile?.push_enabled || !userProfile?.push_due_date_reminder) continue

      const items = (fixedCosts ?? []).filter(f => f.user_id === userId)
      const names = items.map(f => f.name).join(', ')

      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId)
      for (const sub of (subs ?? [])) {
        await sendToUser(sub as PushSubscription, {
          title: '📅 출금일 D-7 알림',
          body: `${names} 출금이 7일 후 예정되어 있어요`,
          url: '/assets',
          tag: 'due-date-reminder',
        }, supabase)
        sent++
      }
    }
  } else if (type === 'due_date_unprocessed') {
    // 오늘 출금일인데 savings_payments.is_paid = false인 유저
    const todayDay = today.date()
    const yearMonth = today.format('YYYY-MM')

    const { data: unpaid } = await supabase
      .from('savings_payments')
      .select('user_id, fixed_cost_id, fixed_costs(name, due_day)')
      .eq('year_month', yearMonth)
      .eq('is_paid', false)

    const todayUnpaid = (unpaid ?? []).filter(p => {
      const fc = p.fixed_costs as any
      return fc?.due_day === todayDay
    })

    const userIds = [...new Set(todayUnpaid.map(p => p.user_id))]

    for (const userId of userIds) {
      const { data: userProfile } = await supabase.from('users').select('push_enabled, push_due_date_unprocessed').eq('id', userId).single()
      if (!userProfile?.push_enabled || !userProfile?.push_due_date_unprocessed) continue

      const items = todayUnpaid.filter(p => p.user_id === userId)
      const names = items.map(p => (p.fixed_costs as any)?.name).filter(Boolean).join(', ')

      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId)
      for (const sub of (subs ?? [])) {
        await sendToUser(sub as PushSubscription, {
          title: '⚠️ 오늘 미처리 항목',
          body: `${names} — 오늘 출금일인데 아직 처리되지 않았어요`,
          url: '/assets',
          tag: 'due-date-unprocessed',
        }, supabase)
        sent++
      }
    }
  } else if (type === 'report') {
    // 매월 1일: 전월 리포트 발송
    const prevMonth = today.subtract(1, 'month').format('YYYY-MM')

    const { data: users } = await supabase.from('users').select('id, name, push_enabled, push_report')
      .eq('push_enabled', true).eq('push_report', true)

    for (const u of (users ?? [])) {
      const { data: expenses } = await supabase.from('expenses')
        .select('amount').eq('user_id', u.id).neq('type', 'transfer')
        .gte('date', `${prevMonth}-01`).lt('date', `${today.format('YYYY-MM')}-01`)

      const total = (expenses ?? []).reduce((s, e) => s + e.amount, 0)

      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', u.id)
      for (const sub of (subs ?? [])) {
        await sendToUser(sub as PushSubscription, {
          title: `📊 ${pre