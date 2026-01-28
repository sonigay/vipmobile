-- error_logs 테이블에 status 컬럼 추가
ALTER TABLE error_logs ADD COLUMN status text DEFAULT 'open';

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX idx_error_logs_status ON error_logs(status);

-- 코멘트
COMMENT ON COLUMN error_logs.status IS '에러 상태: open(미해결), resolved(해결됨), ignored(무시됨)';
