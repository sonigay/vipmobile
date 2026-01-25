-- ============================================================================
-- VIP Map Application - Database Schema Master File
-- ============================================================================
-- 
-- 이 파일은 31개 테이블의 전체 스키마를 생성합니다.
-- 
-- 실행 순서:
-- 1. 공통 함수 생성 (update_updated_at_column)
-- 2. 직영점 모드 테이블 (14개)
-- 3. 정책 모드 테이블 (10개)
-- 4. 고객 모드 테이블 (7개)
--
-- Supabase SQL Editor에서 실행하거나
-- psql 명령어로 실행: psql -h <host> -U <user> -d <database> -f schema-master.sql
--
-- ============================================================================

-- 공통 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 직영점 모드 스키마 실행
\i schema-direct-store.sql

-- 정책 모드 스키마 실행
\i schema-policy.sql

-- 고객 모드 스키마 실행
\i schema-customer.sql

-- ============================================================================
-- 스키마 생성 완료 확인
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name LIKE 'direct_store_%'
     OR table_name LIKE 'policy_%'
     OR table_name LIKE 'budget_%'
     OR table_name LIKE 'customer_%'
     OR table_name LIKE 'purchase_%'
     OR table_name LIKE 'board'
     OR table_name LIKE 'reservation_%'
     OR table_name LIKE 'unmatched_%';
  
  RAISE NOTICE '✅ 스키마 생성 완료: % 개 테이블', table_count;
  
  IF table_count < 31 THEN
    RAISE WARNING '⚠️ 예상 테이블 수(31개)보다 적습니다. 스키마 파일을 확인하세요.';
  END IF;
END $$;
