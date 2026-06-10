-- ============================================================
-- Spenlog 자산 탭 저장 버그 수정 마이그레이션
-- 누락된 컬럼 추가 (IF NOT EXISTS — 중복 실행 안전)
-- Supabase SQL Editor에서 전체 실행
-- ============================================================

-- 1. cards 테이블 — linked_account_id 컬럼 추가
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- 2. fixed_costs 테이블 — linked_account_id, due_day, kind 컬럼 추가
ALTER TABLE fixed_costs
  ADD COLUMN IF NOT EXISTS linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_day           INTEGER,
  ADD COLUMN IF NOT EXISTS kind              TEXT DEFAULT '고정지출';

-- 3. fixed_costs 테이블 — linked_target_account_id 컬럼 추가 (고정저축 대상 계좌)
ALTER TABLE fixed_costs
  ADD COLUMN IF NOT EXISTS linked_target_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- 4. expenses 테이블 — type, source 컬럼 추가 (없으면)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS type   TEXT DEFAULT 'expense',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- type CHECK 제약 재정비 (expense / income / transfer 허용)
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_type_check;
ALTER TABLE expenses
  ADD CONSTRAINT expenses_type_check
    CHECK (type IN ('expense', 'income', 'transfer'));

-- 기존 NULL 백필
UPDATE expenses SET type = 'expense' WHERE type IS NULL;

-- 5. 확인용
SELECT
  'cards.linked_account_id'        AS col, COUNT(*) AS present FROM information_schema.columns WHERE table_name = 'cards'       AND column_name = 'linked_account_id'
UNION ALL
SELECT 'fixed_costs.linked_account_id',      COUNT(*) FROM information_schema.columns WHERE table_name = 'fixed_costs'  AND column_name = 'linked_account_id'
UNION ALL
SELECT 'fixed_costs.linked_target_account_id', COUNT(*) FROM information_schema.columns WHERE table_name = 'fixed_costs'  AND column_name = 'linked_target_account_id'
UNION ALL
SELECT 'expenses.type',                      COUNT(*) FROM information_schema.columns WHERE table_name = 'expenses'     AND column_name = 'type'
UNION ALL
SELECT 'expenses.source',                    COUNT(*) FROM information_schema.columns WHERE table_name = 'expenses'     AND column_name = 'source';
-- 모든 present 값이 1이면 정상
