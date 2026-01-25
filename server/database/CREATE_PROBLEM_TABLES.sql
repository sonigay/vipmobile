-- ============================================================================
-- 문제 테이블 재생성 스크립트 (NOT NULL 제약 제거)
-- ============================================================================
-- 
-- 목적: 3개 테이블을 NULL 허용으로 재생성
-- 
-- 사용 방법:
--   1. DROP_PROBLEM_TABLES.sql 실행 후
--   2. 이 파일을 Supabase SQL Editor에서 실행
-- 
-- ============================================================================

-- 1. 오늘의 모바일 테이블 (NULL 허용)
CREATE TABLE direct_store_todays_mobiles (
  id SERIAL PRIMARY KEY,
  "통신사" VARCHAR(50),              -- NULL 허용으로 변경
  "모델ID" VARCHAR(100),             -- NULL 허용으로 변경
  "모델명" VARCHAR(200),             -- NULL 허용으로 변경
  "출고가" INTEGER,
  "공시지원금" INTEGER,
  "추가지원금" INTEGER,
  "선택약정" INTEGER,
  "선택약정할인" INTEGER,
  "요금할인" INTEGER,
  "최종가격" INTEGER,
  "재고수량" INTEGER DEFAULT 0,
  "태그" TEXT,
  "업데이트일시" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_todays_mobiles_carrier ON direct_store_todays_mobiles("통신사");
CREATE INDEX idx_todays_mobiles_model_id ON direct_store_todays_mobiles("모델ID");
CREATE INDEX idx_todays_mobiles_updated ON direct_store_todays_mobiles("업데이트일시");

-- 2. 매장 사진 테이블 (NULL 허용)
CREATE TABLE direct_store_photos (
  id SERIAL PRIMARY KEY,
  "매장명" VARCHAR(200),             -- NULL 허용으로 변경
  "사진URL" TEXT,                    -- NULL 허용으로 변경
  "업로드일시" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "설명" TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_photos_store_name ON direct_store_photos("매장명");
CREATE INDEX idx_photos_uploaded ON direct_store_photos("업로드일시");

-- 3. 메인 페이지 텍스트 테이블 (NULL 허용)
CREATE TABLE direct_store_main_page_texts (
  id SERIAL PRIMARY KEY,
  "통신사" VARCHAR(50),              -- NULL 허용으로 변경
  "텍스트내용" TEXT,
  "표시순서" INTEGER DEFAULT 0,
  "활성화여부" BOOLEAN DEFAULT true,
  "업데이트일시" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_main_texts_carrier ON direct_store_main_page_texts("통신사");
CREATE INDEX idx_main_texts_order ON direct_store_main_page_texts("표시순서");
CREATE INDEX idx_main_texts_active ON direct_store_main_page_texts("활성화여부");

-- 완료 메시지
SELECT '✅ 3개 테이블 재생성 완료 (NULL 허용)!' AS status;
SELECT '다음 단계: node migration/autoMigrate.js --mode=direct 실행' AS next_step;
