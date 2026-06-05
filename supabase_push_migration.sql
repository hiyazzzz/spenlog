-- ============================================================
-- 푸시 알림 구독 테이블
-- Supabase SQL Editor에서 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- RLS 활성화
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 본인 구독만 읽기/쓰기 가능
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role은 모두 접근 (Cron 발송용)
CREATE POLICY "Service role full access"
  ON push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
