-- ============================================================
-- Spenlog DB 마이그레이션 — greeting_templates 시드 데이터
-- ============================================================
-- greeting_templates 테이블은 supabase_migration_v2.sql 에서 생성됨
-- 비어있을 경우에만 기본 인사말 추가
-- ============================================================

INSERT INTO greeting_templates (text, is_active)
SELECT text, true
FROM (VALUES
  ('안녕하세요 👋'),
  ('오늘도 좋은 하루예요 😊'),
  ('소비 기록할 시간이에요 ✍️'),
  ('오늘 지출, 한 줄로 남겨볼까요? 📝'),
  ('차곡차곡 저축 중이에요 💰'),
  ('오늘도 화이팅! 🔥'),
  ('가계부 쓰는 당신, 멋져요 ✨')
) AS seed(text)
WHERE NOT EXISTS (SELECT 1 FROM greeting_templates);

-- 완료 확인
SELECT 'Greeting templates seeded' AS status;
