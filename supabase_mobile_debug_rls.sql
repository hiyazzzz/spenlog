-- ⚠️ 디버그 전용 임시 RLS 정책
-- 모바일 앱은 아직 Supabase 인증(구글 로그인 연동)을 붙이지 않아서
-- anon key로 쿼리하면 auth.uid() 가 NULL이라 기존 RLS(`auth.uid() = user_id`)에 막혀
-- users/expenses/budgets/categories/fixed_costs 가 전부 빈 배열로 내려오고
-- 화면이 mockData(MOCK_CATEGORIES, MOCK_PROFILE)로 폴백되는 문제를 임시로 우회하기 위한 정책.
--
-- apps/mobile/.env 의 EXPO_PUBLIC_TEST_USER_ID 값과 동일해야 함:
--   9b7cbb51-d877-43be-a661-13a55255174f
--
-- 🚨 우선순위 4번 "구글 계정 연동" 작업 완료 후 반드시 제거할 것.
-- 출시 전 체크리스트에도 "임시 디버그 RLS 정책 제거" 항목 추가 필요.

DROP POLICY IF EXISTS "TEMP debug: mobile read own profile" ON users;
CREATE POLICY "TEMP debug: mobile read own profile"
  ON users FOR SELECT
  USING (id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile read own expenses" ON expenses;
CREATE POLICY "TEMP debug: mobile read own expenses"
  ON expenses FOR SELECT
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile read own budgets" ON budgets;
CREATE POLICY "TEMP debug: mobile read own budgets"
  ON budgets FOR SELECT
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile read own categories" ON categories;
CREATE POLICY "TEMP debug: mobile read own categories"
  ON categories FOR SELECT
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');

DROP POLICY IF EXISTS "TEMP debug: mobile read own fixed_costs" ON fixed_costs;
CREATE POLICY "TEMP debug: mobile read own fixed_costs"
  ON fixed_costs FOR SELECT
  USING (user_id = '9b7cbb51-d877-43be-a661-13a55255174f');
