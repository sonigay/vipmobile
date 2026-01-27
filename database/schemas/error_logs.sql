-- =====================================================
-- ERROR_LOGS 테이블 스키마
-- 프론트엔드 + 백엔드 에러 통합 저장
-- =====================================================

CREATE TABLE IF NOT EXISTS error_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 에러 기본 정보
    type VARCHAR(20) NOT NULL CHECK (type IN ('frontend', 'backend', 'network', 'react')),
    level VARCHAR(10) NOT NULL CHECK (level IN ('error', 'warning', 'info')) DEFAULT 'error',
    message TEXT NOT NULL,
    stack TEXT,
    
    -- 에러 발생 위치
    source VARCHAR(255),           -- 파일명 또는 API 엔드포인트
    line_number INTEGER,
    column_number INTEGER,
    
    -- 컨텍스트 정보
    url TEXT,                       -- 발생한 페이지 URL
    user_agent TEXT,                -- 브라우저 정보
    user_id VARCHAR(100),           -- 로그인한 사용자 ID (있는 경우)
    mode VARCHAR(50),               -- 현재 모드 (agent, inventory 등)
    
    -- 네트워크 에러 관련
    api_endpoint VARCHAR(255),
    status_code INTEGER,
    request_method VARCHAR(10),
    response_body TEXT,
    
    -- 메타데이터
    metadata JSONB DEFAULT '{}',    -- 추가 정보 (커스텀 데이터)
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 중복 방지용 해시 (같은 에러 반복 저장 방지)
    error_hash VARCHAR(64)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(type);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_hash ON error_logs(error_hash);
CREATE INDEX IF NOT EXISTS idx_error_logs_mode ON error_logs(mode);

-- 중복 에러 방지를 위한 유니크 제약 (최근 1시간 내 동일 에러)
-- 이 기능은 애플리케이션 레벨에서 처리

-- Row Level Security 활성화 (선택사항)
-- ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- 정책 예시: 모든 사용자가 에러 로그 삽입 가능
-- CREATE POLICY "Anyone can insert error logs" ON error_logs FOR INSERT WITH CHECK (true);

-- 정책 예시: 관리자만 에러 로그 조회 가능
-- CREATE POLICY "Only admins can view error logs" ON error_logs FOR SELECT USING (auth.role() = 'admin');

COMMENT ON TABLE error_logs IS '프론트엔드/백엔드 에러 통합 로깅 테이블';
COMMENT ON COLUMN error_logs.type IS 'frontend: 브라우저 에러, backend: 서버 에러, network: API 호출 실패, react: React 컴포넌트 에러';
COMMENT ON COLUMN error_logs.error_hash IS '동일 에러 중복 방지용 MD5 해시 (message + source + line_number 조합)';
