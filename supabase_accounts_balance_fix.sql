-- accounts 테이블의 balance 컬럼이 없을 경우 추가
-- (CREATE TABLE IF NOT EXISTS는 기존 테이블에 no-op이므로, 컬럼이 누락된 경우 이 마이그레이션 필요)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS balance integer DEFAULT 0;

-- NULL인 기존 행은 0으로 초기화
UPDATE accounts SET balance = 0 WHERE balance IS NULL;
