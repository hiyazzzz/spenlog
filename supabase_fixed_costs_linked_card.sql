-- ============================================================
-- fixed_costs 테이블 — 연결 카드 컬럼 추가
-- 고정지출 폼에서 "연결 계좌/카드" 선택 시 카드를 선택한 경우 사용
-- 기존 데이터에 영향 없음 (nullable, 기본값 없음)
-- ============================================================

ALTER TABLE fixed_costs
  ADD COLUMN IF NOT EXISTS linked_card_id uuid REFERENCES cards(id) ON DELETE SET NULL;

-- 확인용
SELECT 'fixed_costs.linked_card_id' AS col, COUNT(*) AS present
FROM information_schema.columns
WHERE table_name = 'fixed_costs' AND column_name = 'linked_card_id';
-- present 값이 1이면 정상
