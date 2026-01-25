-- ============================================================================
-- 직영점 모드 스키마 (14개 테이블)
-- ============================================================================
-- 
-- 중요: 한글 컬럼명은 큰따옴표로 감싸야 합니다.
-- 예: SELECT "통신사", "마진" FROM direct_store_policy_margin;
--
-- ============================================================================

-- 1. 직영점_정책_마진
CREATE TABLE IF NOT EXISTS direct_store_policy_margin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "마진" NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_margin_carrier ON direct_store_policy_margin("통신사");

-- 2. 직영점_정책_부가서비스
CREATE TABLE IF NOT EXISTS direct_store_policy_addon_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "서비스명" TEXT NOT NULL,
  "월요금" NUMERIC(10,2),
  "유치추가금액" NUMERIC(10,2),
  "미유치차감금액" NUMERIC(10,2),
  "상세설명" TEXT,
  "공식사이트URL" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addon_services_carrier ON direct_store_policy_addon_services("통신사");

-- 3. 직영점_정책_보험상품
CREATE TABLE IF NOT EXISTS direct_store_policy_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "보험상품명" TEXT NOT NULL,
  "출고가최소" NUMERIC(10,2),
  "출고가최대" NUMERIC(10,2),
  "월요금" NUMERIC(10,2),
  "유치추가금액" NUMERIC(10,2),
  "미유치차감금액" NUMERIC(10,2),
  "상세설명" TEXT,
  "공식사이트URL" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_carrier ON direct_store_policy_insurance("통신사");

-- 4. 직영점_정책_별도
CREATE TABLE IF NOT EXISTS direct_store_policy_special (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "정책명" TEXT NOT NULL,
  "정책타입" TEXT,
  "금액" NUMERIC(10,2),
  "적용여부" BOOLEAN DEFAULT true,
  "조건JSON" JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_special_carrier ON direct_store_policy_special("통신사");
CREATE INDEX IF NOT EXISTS idx_special_active ON direct_store_policy_special("적용여부");

-- 5. 직영점_설정
CREATE TABLE IF NOT EXISTS direct_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "설정유형" TEXT NOT NULL,
  "시트ID" TEXT,
  "시트URL" TEXT,
  "설정값JSON" JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_carrier ON direct_store_settings("통신사");
CREATE INDEX IF NOT EXISTS idx_settings_type ON direct_store_settings("설정유형");

-- 6. 직영점_메인페이지문구
CREATE TABLE IF NOT EXISTS direct_store_main_page_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "카테고리" TEXT,
  "설정유형" TEXT,
  "문구내용" TEXT,
  "이미지URL" TEXT,
  "수정일시" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_main_texts_carrier ON direct_store_main_page_texts("통신사");

-- 7. 직영점_요금제마스터
CREATE TABLE IF NOT EXISTS direct_store_plan_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "요금제명" TEXT NOT NULL,
  "요금제군" TEXT,
  "기본료" NUMERIC(10,2),
  "요금제코드" TEXT,
  "사용여부" BOOLEAN DEFAULT true,
  "비고" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_carrier ON direct_store_plan_master("통신사");
CREATE INDEX IF NOT EXISTS idx_plan_active ON direct_store_plan_master("사용여부");
CREATE INDEX IF NOT EXISTS idx_plan_code ON direct_store_plan_master("요금제코드");

-- 8. 직영점_단말마스터
CREATE TABLE IF NOT EXISTS direct_store_device_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "모델ID" TEXT NOT NULL,
  "모델명" TEXT NOT NULL,
  "펫네임" TEXT,
  "제조사" TEXT,
  "출고가" NUMERIC(10,2),
  "기본요금제군" TEXT,
  "isPremium" BOOLEAN DEFAULT false,
  "isBudget" BOOLEAN DEFAULT false,
  "isPopular" BOOLEAN DEFAULT false,
  "isRecommended" BOOLEAN DEFAULT false,
  "isCheap" BOOLEAN DEFAULT false,
  "이미지URL" TEXT,
  "사용여부" BOOLEAN DEFAULT true,
  "비고" TEXT,
  "Discord메시지ID" TEXT,
  "Discord포스트ID" TEXT,
  "Discord스레드ID" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_carrier ON direct_store_device_master("통신사");
CREATE INDEX IF NOT EXISTS idx_device_model_id ON direct_store_device_master("모델ID");
CREATE INDEX IF NOT EXISTS idx_device_active ON direct_store_device_master("사용여부");
CREATE INDEX IF NOT EXISTS idx_device_premium ON direct_store_device_master("isPremium");
CREATE INDEX IF NOT EXISTS idx_device_popular ON direct_store_device_master("isPopular");

-- 9. 직영점_단말요금정책
CREATE TABLE IF NOT EXISTS direct_store_device_pricing_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "모델ID" TEXT NOT NULL,
  "모델명" TEXT,
  "요금제군" TEXT,
  "요금제코드" TEXT,
  "개통유형" TEXT,
  "출고가" NUMERIC(10,2),
  "이통사지원금" NUMERIC(10,2),
  "대리점추가지원금_부가유치" NUMERIC(10,2),
  "정책마진" NUMERIC(10,2),
  "정책ID" TEXT,
  "기준일자" DATE,
  "비고" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_carrier ON direct_store_device_pricing_policy("통신사");
CREATE INDEX IF NOT EXISTS idx_pricing_model_id ON direct_store_device_pricing_policy("모델ID");
CREATE INDEX IF NOT EXISTS idx_pricing_date ON direct_store_device_pricing_policy("기준일자");

-- 10. 직영점_모델이미지
CREATE TABLE IF NOT EXISTS direct_store_model_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "모델ID" TEXT NOT NULL,
  "모델명" TEXT,
  "펫네임" TEXT,
  "제조사" TEXT,
  "이미지URL" TEXT,
  "비고" TEXT,
  "색상" TEXT,
  "Discord메시지ID" TEXT,
  "Discord포스트ID" TEXT,
  "Discord스레드ID" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_carrier ON direct_store_model_images("통신사");
CREATE INDEX IF NOT EXISTS idx_images_model_id ON direct_store_model_images("모델ID");

-- 11. 직영점_오늘의휴대폰
CREATE TABLE IF NOT EXISTS direct_store_todays_mobiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "통신사" TEXT NOT NULL,
  "모델ID" TEXT NOT NULL,
  "모델명" TEXT,
  "펫네임" TEXT,
  "제조사" TEXT,
  "출고가" NUMERIC(10,2),
  "이미지URL" TEXT,
  "순서" INTEGER,
  "표시여부" BOOLEAN DEFAULT true,
  "등록일시" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todays_carrier ON direct_store_todays_mobiles("통신사");
CREATE INDEX IF NOT EXISTS idx_todays_display ON direct_store_todays_mobiles("표시여부");
CREATE INDEX IF NOT EXISTS idx_todays_order ON direct_store_todays_mobiles("순서");

-- 12. 직영점_대중교통위치
CREATE TABLE IF NOT EXISTS direct_store_transit_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "타입" TEXT NOT NULL, -- "버스터미널" 또는 "지하철역"
  "이름" TEXT NOT NULL,
  "주소" TEXT,
  "위도" NUMERIC(10,7),
  "경도" NUMERIC(10,7),
  "수정일시" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transit_type ON direct_store_transit_locations("타입");
CREATE INDEX IF NOT EXISTS idx_transit_location ON direct_store_transit_locations("위도", "경도");

-- 13. 직영점_매장사진
CREATE TABLE IF NOT EXISTS direct_store_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "매장명" TEXT NOT NULL,
  "POS코드" TEXT,
  "사진URL" TEXT NOT NULL,
  "사진타입" TEXT, -- "외부", "내부", "기타"
  "설명" TEXT,
  "촬영일시" TIMESTAMPTZ,
  "등록일시" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_store ON direct_store_photos("매장명");
CREATE INDEX IF NOT EXISTS idx_photos_pos ON direct_store_photos("POS코드");

-- 14. 직영점_판매일보
CREATE TABLE IF NOT EXISTS direct_store_sales_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "매장명" TEXT NOT NULL,
  "POS코드" TEXT,
  "판매일자" DATE NOT NULL,
  "통신사" TEXT,
  "모델명" TEXT,
  "개통유형" TEXT, -- "신규", "번호이동", "기기변경"
  "요금제명" TEXT,
  "고객명" TEXT,
  "연락처" TEXT,
  "출고가" NUMERIC(10,2),
  "이통사지원금" NUMERIC(10,2),
  "대리점지원금" NUMERIC(10,2),
  "실구매가" NUMERIC(10,2),
  "판매자" TEXT,
  "비고" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_store ON direct_store_sales_daily("매장명");
CREATE INDEX IF NOT EXISTS idx_sales_date ON direct_store_sales_daily("판매일자");
CREATE INDEX IF NOT EXISTS idx_sales_carrier ON direct_store_sales_daily("통신사");

-- ============================================================================
-- 자동 업데이트 트리거 (모든 테이블에 적용)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 각 테이블에 트리거 적용
CREATE OR REPLACE TRIGGER update_direct_store_policy_margin_updated_at 
  BEFORE UPDATE ON direct_store_policy_margin
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_policy_addon_services_updated_at 
  BEFORE UPDATE ON direct_store_policy_addon_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_policy_insurance_updated_at 
  BEFORE UPDATE ON direct_store_policy_insurance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_policy_special_updated_at 
  BEFORE UPDATE ON direct_store_policy_special
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_settings_updated_at 
  BEFORE UPDATE ON direct_store_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_main_page_texts_updated_at 
  BEFORE UPDATE ON direct_store_main_page_texts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_plan_master_updated_at 
  BEFORE UPDATE ON direct_store_plan_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_device_master_updated_at 
  BEFORE UPDATE ON direct_store_device_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_device_pricing_policy_updated_at 
  BEFORE UPDATE ON direct_store_device_pricing_policy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_model_images_updated_at 
  BEFORE UPDATE ON direct_store_model_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_todays_mobiles_updated_at 
  BEFORE UPDATE ON direct_store_todays_mobiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_transit_locations_updated_at 
  BEFORE UPDATE ON direct_store_transit_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_photos_updated_at 
  BEFORE UPDATE ON direct_store_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_sales_daily_updated_at 
  BEFORE UPDATE ON direct_store_sales_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
