-- ============================================================
-- Spenlog 고정비/자산 저장 안됨 진단 SQL
-- Supabase > SQL Editor 에 전체 붙여넣고 실행
-- ============================================================

-- 1. fixed_costs 현재 행 수 + 최신 항목
SELECT id, name, amount, kind, user_id, created_at
FROM fixed_costs
ORDER BY created_at DESC
LIMIT 10;

-- 2. fixed_costs RLS 정책 목록
SELECT policyname, cmd, permissive,
       pg_get_expr(qual, relid)       AS using_expr,
       pg_get_expr(with_check, relid) AS with_check_expr
FROM pg_policies
WHERE tablename = 'fixed_costs'
ORDER BY cmd;

-- 3. fixed_costs 트리거 목록
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'fixed_costs';

-- 4. fixed_costs 체크 제약 목록
SELECT c.constraint_name, c.check_clause
FROM information_schema.check_constraints c
JOIN information_schema.constraint_table_usage t USING (constraint_name)
WHERE t.table_name = 'fixed_costs';

-- 5. accounts / cards RLS 정책
SELECT tablename, policyname, cmd,
       pg_get_expr(qual, relid)       AS using_expr,
       pg_get_expr(with_check, relid) AS with_check_expr
FROM pg_policies
WHERE tablename IN ('accounts', 'cards')
ORDER BY tablename, cmd;

-- 6. 직접 INSERT 테스트 (실제 user_id로 바꿔서 실행)
-- 아래 YOUR_USER_ID 를 본인 auth.uid() 값으로 교체 후 실행
-- INSERT INTO fixed_costs (user_id, name, amount, type, kind)
-- VALUES ('YOUR_USER_ID', '테스트4번', 10000, '월정액', '고정지출')
-- RETURNING *;
