-- =============================================
-- Spenlog DB 마이그레이션
-- Supabase Dashboard > SQL Editor에서 실행
-- 한 번에 전체 실행 (Run)
-- =============================================

-- 1. fixed_costs 테이블 수정
ALTER TABLE fixed_costs
  ADD COLUMN IF NOT EXISTS linked_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_day integer,
  ADD COLUMN IF NOT EXISTS kind text DEFAULT '고정지출';

-- 2. cards 테이블 수정
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS deduct_immediately boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- 3. users 테이블 수정 (온보딩 상태)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS guide_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS asset_onboarding_done boolean DEFAULT false;

-- 4. expenses 테이블 수정
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- 5. accounts 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  bank       text,
  balance    integer DEFAULT 0,
  type       text DEFAULT '입출금',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_own'
  ) THEN
    CREATE POLICY accounts_own ON accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6. incomes 테이블 신규 생성
CREATE TABLE IF NOT EXISTS incomes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  amount     integer NOT NULL,
  date       date NOT NULL,
  memo       text,
  source     text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'incomes' AND policyname = 'incomes_own'
  ) THEN
    CREATE POLICY incomes_own ON incomes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 7. reports 테이블 (AI 코치 캐싱)
CREATE TABLE IF NOT EXISTS reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  year_month   text NOT NULL,
  total_expense integer DEFAULT 0,
  ai_coach     jsonb,
  generated_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, year_month)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'reports_own'
  ) THEN
    CREATE POLICY reports_own ON reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================
-- Sprint 1 Migration: 지출 저장 오류 수정
-- =============================================

-- expenses 테이블 source 컬럼 (없으면 추가)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- expenses RLS 정책 재정비
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성 (중복 방지)
DROP POLICY IF EXISTS "expenses_select_own" ON expenses;
DROP POLICY IF EXISTS "expenses_insert_own" ON expenses;
DROP POLICY IF EXISTS "expenses_update_own" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_own" ON expenses;

CREATE POLICY "expenses_select_own" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "expenses_insert_own" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_update_own" ON expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "expenses_delete_own" ON expenses FOR DELETE USING (auth.uid() = user_id);


-- =============================================
-- Sprint 2: 카테고리 소프트 삭제
-- =============================================

CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  is_default  boolean DEFAULT false,
  is_hidden   boolean DEFAULT false,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'categories_own'
  ) THEN
    CREATE POLICY categories_own ON categories FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================
-- Sprint 3: 고정비/적금 루틴 월별 기록
-- =============================================

CREATE TABLE IF NOT EXISTS savings_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  fixed_cost_id   uuid REFERENCES fixed_costs(id) ON DELETE CASCADE NOT NULL,
  year_month      text NOT NULL,
  is_paid         boolean DEFAULT false,
  paid_amount     integer,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, fixed_cost_id, year_month)
);

ALTER TABLE savings_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'savings_payments' AND policyname = 'sp_own'
  ) THEN
    CREATE POLICY sp_own ON savings_payments FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- =============================================
-- Sprint 4: expenses type 컬럼 + premium 컬럼
-- =============================================

-- expenses 테이블에 type 컬럼 추가 (expense/income 구분)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense'
    CHECK (type IN ('expense', 'income'));

-- users 테이블 프리미엄 컬럼 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS premium_status text DEFAULT 'free'
    CHECK (premium_status IN ('free', 'trial', 'premium')),
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
