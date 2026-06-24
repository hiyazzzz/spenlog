-- ============================================================
-- Spenlog 버그 수정 마이그레이션
-- 작성일: 2026-06-24
-- 내용:
--   1. fixed_costs 누락 컬럼 추가 (type, linked_card_id, linked_target_account_id)
--   2. budgets.source 컬럼 추가 (manual/ai)
--   3. fixed_costs 표준 RLS 정책 추가 (auth.uid() = user_id)
--   4. budgets 표준 RLS 정책 추가 (auth.uid() = user_id)
--   5. savings_payments 보정 (card_id, paid_at, amount 컬럼)
-- ============================================================

-- 1. fixed_costs 누락 컬럼 추가
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS type text DEFAULT '월정액';
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS linked_card_id uuid REFERENCES cards(id) ON DELETE SET NULL;
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS linked_target_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- 2. budgets.source 컬럼 추가
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- 3. fixed_costs 표준 RLS 정책
--    (기존 TEMP debug 정책과 공존 가능 — OR 조건으로 동작)
DROP POLICY IF EXISTS "fixed_costs_select_own" ON fixed_costs;
CREATE POLICY "fixed_costs_select_own" ON fixed_costs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "fixed_costs_insert_own" ON fixed_costs;
CREATE POLICY "fixed_costs_insert_own" ON fixed_costs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "fixed_costs_update_own" ON fixed_costs;
CREATE POLICY "fixed_costs_update_own" ON fixed_costs
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "fixed_costs_delete_own" ON fixed_costs;
CREATE POLICY "fixed_costs_delete_own" ON fixed_costs
  FOR DELETE USING (auth.uid() = user_id);

-- 4. budgets 표준 RLS 정책
DROP POLICY IF EXISTS "budgets_select_own" ON budgets;
CREATE POLICY "budgets_select_own" ON budgets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_insert_own" ON budgets;
CREATE POLICY "budgets_insert_own" ON budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_update_own" ON budgets;
CREATE POLICY "budgets_update_own" ON budgets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "budgets_delete_own" ON budgets;
CREATE POLICY "budgets_delete_own" ON budgets
  FOR DELETE USING (auth.uid() = user_id);

-- 5. savings_payments 보정
ALTER TABLE savings_payments ALTER COLUMN fixed_cost_id DROP NOT NULL;
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES cards(id) ON DELETE CASCADE;
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS amount integer;

CREATE UNIQUE INDEX IF NOT EXISTS savings_payments_user_year_card_unique
  ON savings_payments (user_id, year_month, card_id);

-- 완료 확인
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='fixed_costs' AND column_name='type') AS fc_type,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='fixed_costs' AND column_name='linked_card_id') AS fc_linked_card,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='budgets' AND column_name='source') AS budgets_source,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='savings_payments' AND column_name='card_id') AS sp_card_id;
-- 모두 1이면 정상
