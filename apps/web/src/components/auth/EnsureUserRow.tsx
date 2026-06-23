'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * 인증된 유저(특히 익명 게스트)의 public.users 행을 보장한다.
 * users.email 이 NOT NULL 이라 익명 유저는 행이 없으면
 * expenses/accounts/cards/fixed_costs 등 모든 insert 가
 * 외래키 위반(23503, *_user_id_fkey)으로 실패한다.
 * 서버 컴포넌트는 RSC 캐싱으로 매번 실행되지 않을 수 있어 클라이언트에서 보장.
 */
export default function EnsureUserRow() {
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: existing } = await supabase
          .from('users').select('id').eq('id', user.id).maybeSingle()
        if (!existing) {
          await supabase.from('users').upsert(
            { id: user.id, email: user.email ?? `${user.id}@guest.spenlog.app` },
            { onConflict: 'id' }
          )
        }
      } catch { /* noop */ }
    })()
  }, [])
  return null
}
