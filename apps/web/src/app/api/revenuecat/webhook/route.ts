import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/revenuecat/webhook
 * RevenueCat 구독 이벤트 수신 → users 테이블 프리미엄 상태 갱신
 *
 * RevenueCat 대시보드의 Webhook Authorization header 값을
 * REVENUECAT_WEBHOOK_SECRET 환경변수와 동일하게 설정해야 함
 * subscriber.app_user_id == Supabase users.id (UUID) 기준
 */

const ACTIVE_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE'])
const EXPIRED_TYPES = new Set(['EXPIRATION', 'CANCELLATION'])

export async function POST(req: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET
  if (!secret) {
    console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Server config error' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}` && authHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const event = body?.event
  if (!event?.type || !event?.app_user_id) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('[revenuecat-webhook] SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Server config error' }, { status: 500 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const userId = event.app_user_id as string

  if (ACTIVE_TYPES.has(event.type)) {
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null
    const { error } = await admin
      .from('users')
      .update({
        is_premium: true,
        premium_status: 'active',
        premium_expires_at: expiresAt,
      })
      .eq('id', userId)

    if (error) {
      console.error('[revenuecat-webhook] update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else if (EXPIRED_TYPES.has(event.type)) {
    const { error } = await admin
      .from('users')
      .update({
        is_premium: false,
        premium_status: 'expired',
      })
      .eq('id', userId)

    if (error) {
      console.error('[revenuecat-webhook] update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
