-- expenses 테이블 type, source 컬럼 추가
-- CLAUDE.md DB 스키마 추가 필요 항목
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
