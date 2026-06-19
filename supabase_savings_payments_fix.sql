-- =============================================
-- savings_payments 스키마 보정
-- 기존 데이터에 영향 없는 방향 (IF NOT EXISTS / DEFAULT 포함)
-- =============================================

-- 1. fixed_cost_id NOT NULL 제약 제거
--    migration.sql 버전이 적용된 경우 fixed_cost_id가 NOT NULL인데,
--    카드 납부 시 (AssetsClient.tsx, routine.ts recordCardPayment) fixed_cost_id: null 을 upsert 함
ALTER TABLE savings_payments ALTER COLUMN fixed_cost_id DROP NOT NULL;

-- 2. amount 컬럼 추가
--    AssetsClient.tsx(333줄), routine.ts recordCardPayment(107줄) upsert에서 사용하나
--    어떤 마이그레이션에도 정의되어 있지 않음
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS amount integer;

-- 3. paid_at 컬럼 추가
--    supabase_migration_20260605.sql 에만 존재. migration.sql이 먼저 적용된 경우 누락됨
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 4. card_id 컬럼 추가 (add_billing_start_day.sql과 동일, 멱등 보장용 재확인)
ALTER TABLE savings_payments ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES cards(id) ON DELETE CASCADE;

-- 5. unique 제약 (user_id, year_month, card_id) 추가
--    web/mobile 모두 onConflict: 'user_id,year_month,card_id' 로 upsert하나
--    add_billing_start_day.sql에서 해당 제약이 주석 처리되어 미적용 상태였음
--    (card_id가 NULL인 고정비 행들은 NULL <> NULL 이므로 충돌하지 않음)
CREATE UNIQUE INDEX IF NOT EXISTS savings_payments_user_year_card_unique
  ON savings_payments (user_id, year_month, card_id);

-- 6. unique 제약 (user_id, year_month, fixed_cost_id) 보강
--    CREATE TABLE 시점에 UNIQUE(user_id, fixed_cost_id, year_month)으로 이미 생성되어 있을 가능성이 높으나,
--    혹시 누락된 환경을 위해 인덱스 형태로 재보장 (이미 있으면 무시됨)
CREATE UNIQUE INDEX IF NOT EXISTS savings_payments_user_year_fixed_cost_unique
  ON savings_payments (user_id, year_month, fixed_cost_id);
