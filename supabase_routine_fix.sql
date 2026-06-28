-- =============================================
-- 루틴 기록 버그 수정 마이그레이션
-- 2026-06-25
-- =============================================

-- 1. savings_payments: 누락 컬럼 추가
--    (migration_20260605 가 IF NOT EXISTS로 건너뛴 경우 대비)
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS year_month text;
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false;
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS paid_amount integer;
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES cards(id) ON DELETE CASCADE;
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 3. UNIQUE 인덱스 추가 (upsert onConflict 에 필요)
--    partial index: NULL 값은 uniqueness 제외 (NULL != NULL in Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS savings_payments_fc_uniq
  ON savings_payments (user_id, year_month, fixed_cost_id)
  WHERE fixed_cost_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS savings_payments_card_uniq
  ON savings_payments (user_id, year_month, card_id)
  WHERE card_id IS NOT NULL;

-- 4. fixed_cost_id NOT NULL 제약 제거
--    (카드 납부 시 fixed_cost_id: null 로 upsert 하기 때문)
ALTER TABLE savings_payments ALTER COLUMN fixed_cost_id DROP NOT NULL;

-- 5. expenses type 체크 제약에 'savings' 추가
--    (고정저축 루틴 기록이 type='savings' 로 insert 되는데 기존 제약에서 누락됨)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_type_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_type_check
  CHECK (type IN ('expense', 'income', 'savings', 'transfer'));

-- 확인
SELECT 'supabase_routine_fix 적용 완료' AS status;
