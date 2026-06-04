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
