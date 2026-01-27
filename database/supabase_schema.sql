-- ============================================================================
-- VIP Plus - Supabase 스키마 (퀵비용 관리 + 기타 테이블)
-- 
-- 사용법:
-- 1. Supabase 대시보드 > SQL Editor 열기
-- 2. 이 파일 내용 전체 복사/붙여넣기
-- 3. Run 버튼 클릭
-- ============================================================================

-- ============================================================================
-- 1. 퀵비용 견적 기록 테이블 (quick_cost_entries)
-- Google Sheets: 퀵비용관리
-- ============================================================================
CREATE TABLE IF NOT EXISTS quick_cost_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 기본 정보
    registered_at TIMESTAMPTZ DEFAULT NOW(),           -- 등록 일시
    registrant_store_name VARCHAR(255),                -- 등록자 매장명
    registrant_store_id VARCHAR(100),                  -- 등록자 매장 ID
    from_store_name VARCHAR(255),                      -- 출발 매장명
    from_store_id VARCHAR(100) NOT NULL,               -- 출발 매장 ID
    to_store_name VARCHAR(255),                        -- 도착 매장명
    to_store_id VARCHAR(100) NOT NULL,                 -- 도착 매장 ID
    mode_type VARCHAR(50) DEFAULT '관리자모드',          -- 등록 모드 (관리자모드/사용자모드)
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_quick_cost_from_to ON quick_cost_entries(from_store_id, to_store_id);
CREATE INDEX IF NOT EXISTS idx_quick_cost_registered_at ON quick_cost_entries(registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_cost_registrant ON quick_cost_entries(registrant_store_id);

-- ============================================================================
-- 2. 퀵서비스 업체 정보 테이블 (quick_cost_companies)
-- 각 견적에 연결된 업체 정보 (1:N 관계)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quick_cost_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES quick_cost_entries(id) ON DELETE CASCADE,
    
    -- 업체 정보
    company_order SMALLINT NOT NULL CHECK (company_order BETWEEN 1 AND 5), -- 업체 순서 (1~5)
    company_name VARCHAR(255) NOT NULL,                 -- 업체명 (원본)
    normalized_name VARCHAR(255),                       -- 정규화된 업체명
    phone VARCHAR(50) NOT NULL,                         -- 연락처 (원본)
    normalized_phone VARCHAR(20),                       -- 정규화된 연락처
    cost INTEGER NOT NULL CHECK (cost >= 0),            -- 비용 (원)
    
    -- 속도 평가 (빠름/중간/느림)
    dispatch_speed VARCHAR(10) DEFAULT '중간',           -- 배차 속도
    pickup_speed VARCHAR(10) DEFAULT '중간',             -- 픽업 속도
    arrival_speed VARCHAR(10) DEFAULT '중간',            -- 도착 속도
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_quick_companies_entry ON quick_cost_companies(entry_id);
CREATE INDEX IF NOT EXISTS idx_quick_companies_name ON quick_cost_companies(normalized_name);
CREATE INDEX IF NOT EXISTS idx_quick_companies_phone ON quick_cost_companies(normalized_phone);

-- ============================================================================
-- 3. 매장 정보 테이블 (stores)
-- Google Sheets: 폰클출고처데이터
-- ============================================================================
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id VARCHAR(100) UNIQUE NOT NULL,              -- 매장 고유 ID
    store_name VARCHAR(255) NOT NULL,                   -- 매장명
    
    -- 위치 정보
    address VARCHAR(500),                               -- 주소
    region VARCHAR(50),                                 -- 지역 (서울/경기/부산 등)
    city VARCHAR(50),                                   -- 도시
    latitude DECIMAL(10, 7),                            -- 위도
    longitude DECIMAL(10, 7),                           -- 경도
    
    -- 상태 정보
    is_active BOOLEAN DEFAULT TRUE,                     -- 활성화 여부
    is_shipped BOOLEAN DEFAULT FALSE,                   -- 출고처 여부
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_stores_store_id ON stores(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_region ON stores(region);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);

-- ============================================================================
-- 4. 퀵서비스 업체 마스터 테이블 (quick_service_vendors)
-- 정규화된 업체 데이터 (통계 집계용)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quick_service_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    normalized_name VARCHAR(255) UNIQUE NOT NULL,        -- 정규화된 업체명
    display_name VARCHAR(255),                          -- 표시용 업체명
    phone_numbers TEXT[],                               -- 연락처 목록
    
    -- 통계 정보 (캐시용, 주기적 업데이트)
    total_entries INTEGER DEFAULT 0,                    -- 총 등록 건수
    average_cost INTEGER,                               -- 평균 비용
    reliability_score DECIMAL(5, 2),                    -- 신뢰도 점수
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_vendors_name ON quick_service_vendors(normalized_name);
CREATE INDEX IF NOT EXISTS idx_vendors_reliability ON quick_service_vendors(reliability_score DESC);

-- ============================================================================
-- 5. Feature Flags 테이블 (feature_flags)
-- 런타임 Feature Flag 저장
-- ============================================================================
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key VARCHAR(100) UNIQUE NOT NULL,              -- 플래그 키 (예: quick-service)
    is_enabled BOOLEAN DEFAULT FALSE,                   -- 활성화 여부
    description VARCHAR(500),                           -- 설명
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 플래그 삽입
INSERT INTO feature_flags (flag_key, is_enabled, description)
VALUES 
    ('quick-service', false, '퀵서비스 관리 - Supabase 사용'),
    ('direct-store', false, '직영점 모드 - Supabase 사용'),
    ('policy', false, '정책 관리 - Supabase 사용'),
    ('customer', false, '고객 관리 - Supabase 사용'),
    ('budget', false, '알뜰폰 관리 - Supabase 사용')
ON CONFLICT (flag_key) DO NOTHING;

-- ============================================================================
-- 6. 자동 업데이트 트리거 함수
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
DROP TRIGGER IF EXISTS update_quick_cost_entries_updated_at ON quick_cost_entries;
CREATE TRIGGER update_quick_cost_entries_updated_at
    BEFORE UPDATE ON quick_cost_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quick_service_vendors_updated_at ON quick_service_vendors;
CREATE TRIGGER update_quick_service_vendors_updated_at
    BEFORE UPDATE ON quick_service_vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. Row Level Security (RLS) 정책 (선택사항)
-- 필요시 활성화
-- ============================================================================
-- ALTER TABLE quick_cost_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE quick_cost_companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 완료 메시지
-- ============================================================================
SELECT 'VIP Plus Supabase 스키마 생성 완료!' AS message;
