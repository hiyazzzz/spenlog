-- ============================================================
-- expenses.category NULL 허용 마이그레이션
-- 실행: Supabase Dashboard > SQL Editor > 전체 선택 후 Run
-- ============================================================

-- expenses.category 컬럼의 NOT NULL 제약 제거
-- (카테고리 '없음' 선택 시 null 저장을 허용하기 위함)
ALTER TABLE expenses ALTER COLUMN category DROP NOT NULL;

-- 완료 확인
SELECT 'expenses.category now allows NULL' AS status;
