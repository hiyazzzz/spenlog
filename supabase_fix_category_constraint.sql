-- ============================================================
-- Spenlog 카테고리 동적화 픽스 마이그레이션
-- 실행: Supabase SQL Editor에서 전체 선택 후 실행
-- ============================================================

-- 1. expenses.category 하드코딩 제약 삭제
--    (커스텀 카테고리 저장이 막히던 원인)
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 2. categories 테이블 color 컬럼 추가 (없으면)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS color TEXT;

-- 3. 기본 카테고리 색상 설정 (이미 있으면 유지)
UPDATE categories SET color = '#6B1E2E' WHERE name = '생활비' AND color IS NULL;
UPDATE categories SET color = '#4A7541' WHERE name = '활동비' AND color IS NULL;
UPDATE categories SET color = '#5C4B8A' WHERE name = '고정비' AND color IS NULL;
UPDATE categories SET color = '#A0522D' WHERE name = '친목비' AND color IS NULL;
UPDATE categories SET color = '#1565C0' WHERE name = '예비비' AND color IS NULL;
UPDATE categories SET color = '#00695C' WHERE name = '수입'   AND color IS NULL;

-- 완료 확인
SELECT 'Fix applied successfully' AS status;
