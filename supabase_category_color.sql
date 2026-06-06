-- 카테고리 색상 컬럼 추가
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT;

-- 기존 기본 카테고리 색상 기본값 설정 (선택사항)
UPDATE categories SET color = '#6B1E2E' WHERE name = '생활비' AND color IS NULL;
UPDATE categories SET color = '#4A7541' WHERE name = '활동비' AND color IS NULL;
UPDATE categories SET color = '#5C4B8A' WHERE name = '고정비' AND color IS NULL;
UPDATE categories SET color = '#A0522D' WHERE name = '친목비' AND color IS NULL;
UPDATE categories SET color = '#1565C0' WHERE name = '예비비' AND color IS NULL;
UPDATE categories SET color = '#00695C' WHERE name = '수입' AND color IS NULL;
