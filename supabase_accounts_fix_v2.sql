-- ============================================================
-- Spenlog: 자산 탭 400 에러 수정 마이그레이션 v2
-- 실행: Supabase SQL Editor에서 전체 선택 후 Run
-- ============================================================

-- ▶ 1. accounts.balance 컬럼 보장 (없으면 추가)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance bigint DEFAULT 0;

-- balance가 NULL인 기존 레코드 0으로 초기화
UPDATE accounts SET balance = 0 WHERE balance IS NULL;

-- ▶ 2. accounts.type CHECK 제약 완전 제거 (파킹/CMA/현금 등 자유값 허용)
--    기존에 CHECK 제약이 있었다면 이것이 400 에러의 직접 원인
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'accounts'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE 'ALTER TABLE accounts DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- ▶ 3. expenses.type CHECK 제약 완전 정리
--    migration.sql Sprint 4의 인라인 CHECK가 auto-name으로 남아있을 수 있음
--    모든 CHECK 제약 drop 후 단일 named 제약으로 재설정
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'expenses'::regclass
      AND contype = 'c'
      AND conname LIKE '%type%'
  LOOP
    EXECUTE 'ALTER TABLE expenses DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- type CHECK: expense / income / transfer 3가지만 허용
ALTER TABLE expenses
  ADD CONSTRAINT expenses_type_check
    CHECK (type IN ('expense', 'income', 'transfer'));

-- ▶ 4. expenses.category CHECK 제약 제거 (커스텀 카테고리 허용)
--    supabase_migration_20260605.sql 에서 이 제약이 다시 추가됐을 수 있음
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- ▶ 5. accounts RLS 정책 재확인
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'accounts' AND policyname = 'accounts_own'
  ) THEN
    CREATE POLICY accounts_own ON accounts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ▶ 6. 결과 확인
SELECT
  'accounts.balance' AS check_item,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'accounts' AND column_name = 'balance'

UNION ALL

SELECT
  'expenses.type constraint' AS check_item,
  conname AS data_type,
  pg_get_constraintdef(oid) AS column_default
FROM pg_constraint
WHERE conrelid = 'expenses'::regclass
  AND contype = 'c'
  AND conname LIKE '%type%';

-- 실행 결과:
-- accounts.balance 행이 보이면 컬럼 정상
-- expenses.type constraint 행에 ('expense','income','transfer') 가 보이면 정상
