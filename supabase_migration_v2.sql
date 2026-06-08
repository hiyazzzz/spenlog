-- ============================================================
-- Spenlog DB 마이그레이션 v2
-- Supabase SQL Editor에서 실행하세요
-- 실행 순서: 위에서 아래로 전체 실행
-- ============================================================

-- ▶ 1. expenses 테이블 — type / source 컬럼 추가
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type   text DEFAULT 'expense';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- type 인덱스 (내역 탭 필터 성능)
CREATE INDEX IF NOT EXISTS expenses_user_type_date_idx
  ON expenses (user_id, type, date DESC);

-- ▶ 2. users 테이블 — 온보딩 플래그
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed  boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS init_setup_completed  boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS asset_setup_completed boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS asset_setup_skipped   boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guide_completed       boolean DEFAULT false;

-- ▶ 3. users 테이블 — 프리미엄
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium        boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_developer      boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_status    text    DEFAULT 'free_trial';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at  timestamp DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires_at timestamp;

-- ▶ 4. users 테이블 — 홈 커스텀
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_cover_url      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_img_url_1  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_img_url_2  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_img_url_3  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_img_url_4  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS greeting_last_ids   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gif_autoplay        boolean DEFAULT true;

-- ▶ 5. categories 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  is_default boolean DEFAULT false,
  is_hidden  boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  color      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'categories_own'
  ) THEN
    CREATE POLICY categories_own ON categories FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- expenses category 체크 제약 제거 (커스텀 카테고리 허용)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- ▶ 6. budgets 테이블 — AI 추천 소스 컬럼
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- ▶ 7. 인사말 템플릿 테이블
CREATE TABLE IF NOT EXISTS greeting_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text       text NOT NULL,
  is_active  boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- ▶ 8. 푸시 알림 테이블
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  device_info text,
  created_at  timestamp DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled              boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_expense_reminder     boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_due_date_reminder    boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_due_date_unprocessed boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_report               boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_permission_asked     boolean DEFAULT false;

-- ▶ 9. 기존 expenses 레코드 type 백필 (type이 null인 경우 expense로)
UPDATE expenses SET type = 'expense' WHERE type IS NULL;

-- ▶ 확인용
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'expenses' AND column_name IN ('type', 'source')
ORDER BY column_name;

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users' AND column_name LIKE '%premium%' OR column_name LIKE '%onboarding%'
ORDER BY column_name;
