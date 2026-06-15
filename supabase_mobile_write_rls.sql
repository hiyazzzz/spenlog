-- ⚠️ 디버그 전용 임시 RLS 정책 (WRITE)
-- supabase_mobile_debug_rls.sql 의 SELECT 정책과 짝을 이루는 INSERT/UPDATE/DELETE 정책.
-- 모바일 앱이 아직 Supabase 인증(구글 로그인 연동)을 붙이지 않아서
-- anon key로 쓰기 작업을 하면 auth.uid() 가 NULL이라 기존 RLS(`auth.uid() = user_id`)에 막혀
-- 등록/수정/삭제가 전부 실패하는 문제를 임시로 우회하기 위한 정책.
--
-- apps/mobile/.env 의 EXPO_PUBLIC_TEST_USER_ID 값과 동일해야 함:
--   9b7cbb51-d877-43be-a661-13a55255174f
--
-- 🚨 우선순위 4번 "구글 계정 연동" 작업 완료 후 supabase_mobile_debug_rls.sql 과 함께 반드시 제거할 것.
-- 출시 전 체크리스트에도 "임시 디버그 RLS 정책 제거" 항목 추가 필요.

-- ============================================================
-- users (월 수입/저축 목표 수정)
-- ============================================================
DROP POLICY IF EXISTS "TEMP debug: mobile update own profile" ON users;
CREATE POLICY "TEMP debug: mobile update own profile"
  ON users FOR UPDATE
  USING (id = '9b7cbb51-d877-43be-a661-13a55255174f')
  WITH CHECK (id = '9b7cbb51-d877-43be-a661-13a55255174f');

-- ============================================================
-- expenses (한 줄 기록 등록 / 삭제)
-- ============================================================
DROP POLICY IF EXISTS "TEMP debug: mobile insert own expenses" ON expenses;
CREATE POLICY "TEMP debug: mobile insert own expenses"
  ON expenses FOR INSERT
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile update own expenses" ON expenses;
CREATE POLICY "TEMP debug: mobile update own expenses"
  ON expenses FOR UPDATE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f')
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile delete own expenses" ON expenses;
CREATE POLICY "TEMP debug: mobile delete own expenses"
  ON expenses FOR DELETE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

-- ============================================================
-- accounts (계좌/현금 추가 / 삭제) — SELECT 정책도 함께 보강
-- ============================================================
DROP POLICY IF EXISTS "TEMP debug: mobile read own accounts" ON accounts;
CREATE POLICY "TEMP debug: mobile read own accounts"
  ON accounts FOR SELECT
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile insert own accounts" ON accounts;
CREATE POLICY "TEMP debug: mobile insert own accounts"
  ON accounts FOR INSERT
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile update own accounts" ON accounts;
CREATE POLICY "TEMP debug: mobile update own accounts"
  ON accounts FOR UPDATE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f')
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile delete own accounts" ON accounts;
CREATE POLICY "TEMP debug: mobile delete own accounts"
  ON accounts FOR DELETE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

-- ============================================================
-- cards (카드 추가 / 삭제) — SELECT 정책도 함께 보강
-- ============================================================
DROP POLICY IF EXISTS "TEMP debug: mobile read own cards" ON cards;
CREATE POLICY "TEMP debug: mobile read own cards"
  ON cards FOR SELECT
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile insert own cards" ON cards;
CREATE POLICY "TEMP debug: mobile insert own cards"
  ON cards FOR INSERT
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile update own cards" ON cards;
CREATE POLICY "TEMP debug: mobile update own cards"
  ON cards FOR UPDATE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f')
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile delete own cards" ON cards;
CREATE POLICY "TEMP debug: mobile delete own cards"
  ON cards FOR DELETE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

-- ============================================================
-- fixed_costs (고정비 추가 / 수정 / 삭제)
-- ============================================================
DROP POLICY IF EXISTS "TEMP debug: mobile insert own fixed_costs" ON fixed_costs;
CREATE POLICY "TEMP debug: mobile insert own fixed_costs"
  ON fixed_costs FOR INSERT
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile update own fixed_costs" ON fixed_costs;
CREATE POLICY "TEMP debug: mobile update own fixed_costs"
  ON fixed_costs FOR UPDATE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f')
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile delete own fixed_costs" ON fixed_costs;
CREATE POLICY "TEMP debug: mobile delete own fixed_costs"
  ON fixed_costs FOR DELETE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

-- ============================================================
-- budgets (예산 직접 설정 / AI 추천 저장 — upsert + 비활성 카테고리 삭제)
-- ============================================================
DROP POLICY IF EXISTS "TEMP debug: mobile insert own budgets" ON budgets;
CREATE POLICY "TEMP debug: mobile insert own budgets"
  ON budgets FOR INSERT
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile update own budgets" ON budgets;
CREATE POLICY "TEMP debug: mobile update own budgets"
  ON budgets FOR UPDATE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f')
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile delete own budgets" ON budgets;
CREATE POLICY "TEMP debug: mobile delete own budgets"
  ON budgets FOR DELETE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

-- ============================================================
-- categories (카테고리 추가 / 숨김 / 복원)
-- ============================================================
DROP POLICY IF EXISTS "TEMP debug: mobile insert own categories" ON categories;
CREATE POLICY "TEMP debug: mobile insert own categories"
  ON categories FOR INSERT
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile update own categories" ON categories;
CREATE POLICY "TEMP debug: mobile update own categories"
  ON categories FOR UPDATE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f')
  WITH CHECK (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile delete own categories" ON categories;
CREATE POLICY "TEMP debug: mobile delete own categories"
  ON categories FOR DELETE
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');
