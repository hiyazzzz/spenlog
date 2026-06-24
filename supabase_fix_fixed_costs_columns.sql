-- ============================================================
-- Spenlog 고정비 저장 안됨 수정 (2차)
-- 작성일: 2026-06-25
-- 원인: linked_account_id 컬럼 누락 (1차 SQL에서 linked_target_account_id만 추가됨)
--       → INSERT 시 null도 포함되면 42703 에러로 전체 실패
-- ============================================================

-- linked_account_id 컬럼 추가 (코드에서 사용하는 컬럼명)
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS linked_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- kind 컬럼 추가 (고정지출/고정저축 구분)
ALTER TABLE fixed_costs ADD COLUMN IF NOT EXISTS kind text DEFAULT '고정지출';

-- 완료 확인
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='fixed_costs' AND column_name='linked_account_id') AS linked_account_id_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='fixed_costs' AND column_name='kind') AS kind_exists;
-- 둘 다 1이면 정상
