/**
 * 푸시 알림 구독 유틸리티
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY 환경변수 필요
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)))
}

export async function subscribePush(userId: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.ready
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return false
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: subJson }),
    })

    return res.ok
  } catch (e) {
    console.error('[push] subscribe error', e)
    return false
  }
}

export async function unsubscribePush(userId: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, endpoint: sub.endpoint }),
      })
    }
  } catch (e) {
    console.error('[push] unsubscribe error', e)
  }
}

export async function isSubscribed(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}
