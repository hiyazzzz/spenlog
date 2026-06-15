'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const supabase = createClient()

  useEffect(() => {
    setOffline(!navigator.onLine)
    const handleOffline = () => setOffline(true)
    const handleOnline = async () => {
      setOffline(false)
      // 오프라인 임시저장 sync
      const raw = localStorage.getItem('spenlog_offline_queue')
      if (!raw) return
      const queue: any[] = JSON.parse(raw)
      if (queue.length === 0) return
      setSyncing(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const results = await Promise.allSettled(
          queue.map(item => supabase.from('expenses').insert({ ...item, user_id: user.id }))
        )
        const ok = results.filter(r => r.status === 'fulfilled').length
        localStorage.removeItem('spenlog_offline_queue')
        setSyncMsg('오프라인에서 저장한 ' + ok + '건이 반영됐어요 ✅')
        setTimeout(() => setSyncMsg(''), 3000)
      }
      setSyncing(false)
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (syncMsg) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
        background: '#10B981', color: '#fff',
        padding: '10px 16px', textAlign: 'center' as const,
        fontSize: 13, fontWeight: 600,
      }}>
        {syncMsg}
      </div>
    )
  }

  if (!offline) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
      background: '#374151', color: '#fff',
      padding: '10px 16px', textAlign: 'center' as const,
      fontSize: 13, fontWeight: 600,
    }}>
      인터넷 연결이 없어요 · 오프라인 모드
    </div>
  )
}
