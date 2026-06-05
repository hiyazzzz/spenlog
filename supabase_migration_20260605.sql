-- ============================================================
-- Spenlog DB 마이그레이션 v2  (2026-06-05)
-- ============================================================
-- 실행 순서: Supabase SQL Editor에서 순서대로 실행
-- ============================================================

-- 1. expenses 테이블에 type 컬럼 추가 (없으면)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';

-- 2. type 값 체크 제약
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_type_check;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_type_check CHECK (type IN ('expense', 'income'));

-- 3-A. category 체크 제약에 '수입' 추가
--      기존 제약 이름 확인 후 drop → 재생성
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_category_check
    CHECK (category IN ('생활비', '활동비', '고정비', '친목비', '예비비', '수입'));

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_expenses_user_type_date
  ON expenses (user_id, type, date DESC);

-- 4. incomes 테이블 데이터를 expenses로 이전 (incomes 테이블이 있는 경우)
-- 실행 전 incomes 테이블 존재 여부 확인 후 실행
INSERT INTO expenses (user_id, name, amount, category, date, payment_method, memo, type, created_at)
SELECT
  user_id,
  name,
  amount,
  '수입' AS category,
  date,
  NULL AS payment_method,
  memo,
  'income' AS type,
  created_at
FROM incomes
ON CONFLICT DO NOTHING;

-- 5. RLS 정책 — expenses INSERT (type=expense)
DROP POLICY IF EXISTS "users can insert own expenses" ON expenses;
CREATE POLICY "users can insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. RLS 정책 — expenses SELECT
DROP POLICY IF EXISTS "users can select own expenses" ON expenses;
CREATE POLICY "users can select own expenses"
  ON expenses FOR SELECT
  USING (auth.uid() = user_id);

-- 7. RLS 정책 — expenses UPDATE
DROP POLICY IF EXISTS "users can update own expenses" ON expenses;
CREATE POLICY "users can update own expenses"
  ON expenses FOR UPDATE
  USING (auth.uid() = user_id);

-- 8. RLS 정책 — expenses DELETE
DROP POLICY IF EXISTS "users can delete own expenses" ON expenses;
CREATE POLICY "users can delete own expenses"
  ON expenses FOR DELETE
  USING (auth.uid() = user_id);

-- 9. RLS 활성화
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 10. users 테이블 온보딩 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS guide_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS asset_onboarding_done BOOLEAN DEFAULT false;

-- 11. users 테이블 알림 설정 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_expense_reminder BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_due_date_reminder BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_due_date_unprocessed BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_report BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_permission_asked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gif_autoplay BOOLEAN DEFAULT true;

-- 12. users 테이블 프리미엄 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS premium_status TEXT DEFAULT 'free_trial',
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;

-- 13. savings_payments 테이블 신규 생성 (루틴화 기능)
CREATE TABLE IF NOT EXISTS savings_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  fixed_cost_id UUID REFERENCES fixed_costs(id) ON DELETE CASCADE,
  year_month    TEXT NOT NULL,         -- '2026-06' 형식
  is_paid       BOOLEAN DEFAULT false,
  paid_amount   INTEGER,
  paid_at       TIMESTAMP,
  created_at    TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, fixed_cost_id, year_month)
);

ALTER TABLE savings_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can manage own savings_payments" ON savings_payments;
CREATE POLICY "users can manage own savings_payments"
  ON savings_payments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 14. users 테이블 홈 커스텀 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS home_cover_url       TEXT,
  ADD COLUMN IF NOT EXISTS category_img_url_1   TEXT,
  ADD COLUMN IF NOT EXISTS category_img_url_2   TEXT,
  ADD COLUMN IF NOT EXISTS category_img_url_3   TEXT,
  ADD COLUMN IF NOT EXISTS category_img_url_4   TEXT,
  ADD COLUMN IF NOT EXISTS greeting_last_ids    TEXT;

-- 15. Supabase Storage 버킷 생성 (대시보드에서 수동 생성 필요)
-- Storage > New bucket > "user-assets" > Public ON
-- 또는 SQL로:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('user-assets', 'user-assets', true) ON CONFLICT DO NOTHING;


-- 16. expenses type에 'transfer' 추가 (이체 = 지출 통계 제외)
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_type_check;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_type_check CHECK (type IN ('expense', 'income', 'transfer'));

-- 17. fixed_costs에 이체 대상 계좌 컬럼 추가 (고정저축 → 적금계좌)
ALTER TABLE fixed_costs
  ADD COLUMN IF NOT EXISTS linked_target_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- 완료 확인
SELECT 'Migration completed successfully' AS status;
