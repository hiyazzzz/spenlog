-- Migration: 탈퇴 soft-delete + 재로그인 시 신규 유저 생성 지원
-- Supabase SQL Editor에서 실행

-- users 테이블: 탈퇴 상태 컬럼
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 탈퇴 유저 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted) WHERE is_deleted = true;

-- (선택사항) RLS 정책 업데이트: 탈퇴 유저 데이터 숨김
-- 기존 users SELECT 정책에 is_deleted = false 조건 추가 필요시 별도 확인
