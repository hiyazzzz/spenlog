-- ============================================================
-- Spenlog: categories 테이블 비어있을 때 복구용 SQL
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. categories 테이블 없으면 생성
CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  is_default  boolean DEFAULT false,
  is_hidden   boolean DEFAULT false,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- 2. color 컬럼 없으면 추가 (nullable - 코드에서 theme palette로 처리)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT;

-- 3. RLS 활성화
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 (없으면 생성)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'categories_own'
  ) THEN
    CREATE POLICY categories_own ON categories FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. expenses category 체크 제약 제거 (커스텀 카테고리 저장 가능하게)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- 6. 확인용 — 실행 후 categories 테이블 내용 확인
SELECT id, user_id, name, sort_order, is_hidden FROM categories ORDER BY user_id, sort_order;
