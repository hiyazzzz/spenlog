-- ⚠️ 디버그 전용 임시 RLS 정책 (Storage)
-- supabase_mobile_debug_rls.sql / supabase_mobile_write_rls.sql 의 짝.
-- 모바일 앱은 아직 Supabase 인증(구글 로그인 연동)을 붙이지 않아서
-- anon key로 storage.objects 에 업로드하면 auth.uid() 가 NULL이라
-- 기존 storage RLS(`auth.uid() = ...`)에 막혀 홈 편집(커버/카테고리 이미지) 저장이
-- "에러 없이 조용히 실패"하는 문제를 임시로 우회하기 위한 정책.
--
-- apps/mobile/.env 의 EXPO_PUBLIC_TEST_USER_ID 값과 동일해야 함:
--   9b7cbb51-d877-43be-a661-13a55255174f
--
-- 🚨 우선순위 4번 "구글 계정 연동" 작업 완료 후 supabase_mobile_debug_rls.sql,
-- supabase_mobile_write_rls.sql 과 함께 반드시 제거할 것.
-- 출시 전 체크리스트에도 "임시 디버그 RLS 정책 제거" 항목 추가 필요.

-- ============================================================
-- user-assets 버킷 (없으면 생성, public read)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-assets', 'user-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- storage.objects 정책 — 경로 prefix가 테스트 유저 UUID인 파일만 허용
-- (HomeEditModal 업로드 경로: `${userId}/cover-...`, `${userId}/cat-slot-...`)
-- ============================================================
DROP POLICY IF EXISTS "TEMP debug: mobile insert own assets" ON storage.objects;
CREATE POLICY "TEMP debug: mobile insert own assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = '9b7cbb51-d877-43be-a661-13a55255174f'
  );

DROP POLICY IF EXISTS "TEMP debug: mobile update own assets" ON storage.objects;
CREATE POLICY "TEMP debug: mobile update own assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = '9b7cbb51-d877-43be-a661-13a55255174f'
  )
  WITH CHECK (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = '9b7cbb51-d877-43be-a661-13a55255174f'
  );

DROP POLICY IF EXISTS "TEMP debug: mobile delete own assets" ON storage.objects;
CREATE POLICY "TEMP debug: mobile delete own assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-assets'
    AND (storage.foldername(name))[1] = '9b7cbb51-d877-43be-a661-13a55255174f'
  );

-- 읽기는 버킷이 public이면 storage가 자동으로 허용하지만,
-- public이 아닌 환경을 위해 SELECT 정책도 함께 추가
DROP POLICY IF EXISTS "TEMP debug: mobile read own assets" ON storage.objects;
CREATE POLICY "TEMP debug: mobile read own assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-assets');
