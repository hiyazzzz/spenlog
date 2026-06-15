import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, subscription } = await req.json()
    if (user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { endpoint, keys } = subscription
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'user_id,endpoint' })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/subscribe POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, endpoint } = await req.json()
    if (user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await supabase.from('push_subscriptions').delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[push/subscribe DELETE]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
