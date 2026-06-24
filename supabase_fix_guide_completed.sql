-- ============================================================
-- Spenlog 온보딩 가이드 반복 노출 버그 수정
-- 작성일: 2026-06-25
-- 내용:
--   1. users.guide_completed 컬럼 추가 (없으면 SELECT가 42703 에러 → profile=null → 항상 오버레이 노출)
--   2. users 테이블 UPDATE RLS 추가 (없으면 markGuideCompleted upsert 실패)
-- ============================================================

-- 1. guide_completed 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS guide_completed boolean DEFAULT false;

-- 2. users UPDATE RLS (클라이언트에서 guide_completed=true 업데이트 가능하게)
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 완료 확인
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='users' AND column_name='guide_completed') AS guide_col_exists,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename='users' AND cmd='UPDATE') AS users_update_policy_count;
-- guide_col_exists=1, users_update_policy_count>=1 이면 정상
