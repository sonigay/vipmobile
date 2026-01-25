-- ============================================================================
-- 정책 모드 스키마 (11개 테이블)
-- ============================================================================
--
-- 📋 테이블 목록 (11개):
-- 0. policy_basic_info (정책_기본정보) ⭐ 추가
-- 1. policy_table_settings (정책모드_정책표설정)
-- 2. policy_table_list (정책모드_정책표목록)
-- 3. policy_user_groups (정책모드_일반사용자그룹)
-- 4. policy_tab_order (정책표목록_탭순서)
-- 5. policy_group_change_history (정책모드_정책영업그룹_변경이력)
-- 6. policy_default_groups (정책모드_기본정책영업그룹)
-- 7. policy_other_types (정책모드_기타정책목록)
-- 8. budget_channel_settings (예산모드_예산채널설정)
-- 9. budget_basic_settings (예산모드_기본예산설정)
-- 10. budget_basic_data_settings (예산모드_기본데이터설정)
-- ============================================================================

-- 0. 정책_기본정보 (핵심 테이블)
CREATE TABLE IF NOT EXISTS policy_basic_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "정책ID" TEXT UNIQUE NOT NULL,
  "정책명" TEXT NOT NULL,
  "정책적용일" TEXT,
  "정책적용점" TEXT,
  "정책내용" TEXT,
  "금액" TEXT,
  "정책유형" TEXT,
  "무선유선" TEXT,
  "하위카테고리" TEXT,
  "입력자ID" TEXT,
  "입력자명" TEXT,
  "입력일시" TEXT,
  "승인상태_총괄" TEXT DEFAULT '대기',
  "승인상태_정산팀" TEXT DEFAULT '대기',
  "승인상태_소속팀" TEXT DEFAULT '대기',
  "정책상태" TEXT DEFAULT '활성',
  "취소사유" TEXT,
  "취소일시" TEXT,
  "취소자명" TEXT,
  "정산반영상태" TEXT DEFAULT '미반영',
  "정산반영자명" TEXT,
  "정산반영일시" TEXT,
  "정산반영자ID" TEXT,
  "대상년월" TEXT,
  "복수점명" TEXT,
  "업체명" TEXT,
  "개통유형" TEXT,
  "95군이상금액" TEXT,
  "95군미만금액" TEXT,
  "소속팀" TEXT,
  "부가미유치금액" TEXT,
  "보험미유치금액" TEXT,
  "연결음미유치금액" TEXT,
  "부가유치시조건" TEXT,
  "보험유치시조건" TEXT,
  "연결음유치시조건" TEXT,
  "유플레이프리미엄유치금액" TEXT,
  "폰교체패스유치금액" TEXT,
  "음악감상유치금액" TEXT,
  "지정번호필터링유치금액" TEXT,
  "VAS2종동시유치조건" TEXT,
  "VAS2종중1개유치조건" TEXT,
  "부가3종모두유치조건" TEXT,
  "요금제유형별정책JSON" JSONB,
  "정산입금처" TEXT,
  "연합대상하부점JSON" JSONB,
  "조건JSON" JSONB,
  "적용대상JSON" JSONB,
  "개통유형_개별" TEXT,
  "담당자명" TEXT,
  "직접입력여부" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_basic_id ON policy_basic_info("정책ID");
CREATE INDEX IF NOT EXISTS idx_policy_basic_yearmonth ON policy_basic_info("대상년월");
CREATE INDEX IF NOT EXISTS idx_policy_basic_type ON policy_basic_info("정책유형");
CREATE INDEX IF NOT EXISTS idx_policy_basic_status ON policy_basic_info("정책상태");
CREATE INDEX IF NOT EXISTS idx_policy_basic_input_user ON policy_basic_info("입력자ID");

-- 1. 정책모드_정책표설정
CREATE TABLE IF NOT EXISTS policy_table_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "정책표ID" TEXT UNIQUE NOT NULL,
  "정책표명" TEXT NOT NULL,
  "통신사" TEXT,
  "시트ID" TEXT,
  "시트URL" TEXT,
  "생성자" TEXT,
  "생성일시" TIMESTAMPTZ,
  "수정일시" TIMESTAMPTZ,
  "사용여부" BOOLEAN DEFAULT true,
  "비고" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_settings_id ON policy_table_settings("정책표ID");
CREATE INDEX IF NOT EXISTS idx_policy_settings_active ON policy_table_settings("사용여부");

-- 2. 정책모드_정책표목록
CREATE TABLE IF NOT EXISTS policy_table_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "정책표ID" TEXT NOT NULL,
  "정책명" TEXT NOT NULL,
  "통신사" TEXT,
  "정책타입" TEXT,
  "정책값" TEXT,
  "적용조건" TEXT,
  "우선순위" INTEGER,
  "사용여부" BOOLEAN DEFAULT true,
  "등록일시" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_list_table_id ON policy_table_list("정책표ID");
CREATE INDEX IF NOT EXISTS idx_policy_list_carrier ON policy_table_list("통신사");
CREATE INDEX IF NOT EXISTS idx_policy_list_active ON policy_table_list("사용여부");

-- 3. 정책모드_일반사용자그룹
CREATE TABLE IF NOT EXISTS policy_user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "그룹명" TEXT NOT NULL,
  "그룹코드" TEXT UNIQUE,
  "설명" TEXT,
  "권한레벨" TEXT,
  "사용자목록" TEXT[], -- 배열로 저장
  "생성일시" TIMESTAMPTZ,
  "수정일시" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_groups_code ON policy_user_groups("그룹코드");

-- 4. 정책표목록_탭순서
CREATE TABLE IF NOT EXISTS policy_tab_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "정책표ID" TEXT NOT NULL,
  "탭명" TEXT NOT NULL,
  "순서" INTEGER NOT NULL,
  "표시여부" BOOLEAN DEFAULT true,
  "아이콘" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tab_order_table_id ON policy_tab_order("정책표ID");
CREATE INDEX IF NOT EXISTS idx_tab_order_sequence ON policy_tab_order("순서");

-- 5. 정책모드_정책영업그룹_변경이력
CREATE TABLE IF NOT EXISTS policy_group_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "정책표ID" TEXT NOT NULL,
  "변경유형" TEXT, -- "생성", "수정", "삭제"
  "변경자" TEXT,
  "변경일시" TIMESTAMPTZ NOT NULL,
  "변경전데이터" JSONB,
  "변경후데이터" JSONB,
  "변경사유" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_table_id ON policy_group_change_history("정책표ID");
CREATE INDEX IF NOT EXISTS idx_history_date ON policy_group_change_history("변경일시");

-- 6. 정책모드_기본정책영업그룹
CREATE TABLE IF NOT EXISTS policy_default_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "그룹명" TEXT NOT NULL,
  "그룹코드" TEXT UNIQUE,
  "통신사" TEXT,
  "정책표ID" TEXT,
  "기본적용여부" BOOLEAN DEFAULT false,
  "우선순위" INTEGER,
  "설명" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_default_groups_code ON policy_default_groups("그룹코드");
CREATE INDEX IF NOT EXISTS idx_default_groups_default ON policy_default_groups("기본적용여부");

-- 7. 정책모드_기타정책목록
CREATE TABLE IF NOT EXISTS policy_other_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "정책타입" TEXT NOT NULL,
  "정책명" TEXT NOT NULL,
  "통신사" TEXT,
  "정책값" TEXT,
  "적용조건JSON" JSONB,
  "사용여부" BOOLEAN DEFAULT true,
  "등록일시" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_other_types_type ON policy_other_types("정책타입");
CREATE INDEX IF NOT EXISTS idx_other_types_active ON policy_other_types("사용여부");

-- 8. 예산모드_예산채널설정
CREATE TABLE IF NOT EXISTS budget_channel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "채널명" TEXT NOT NULL,
  "채널코드" TEXT UNIQUE,
  "통신사" TEXT,
  "예산금액" NUMERIC(15,2),
  "사용금액" NUMERIC(15,2) DEFAULT 0,
  "잔여금액" NUMERIC(15,2),
  "적용기간시작" DATE,
  "적용기간종료" DATE,
  "사용여부" BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_channel_code ON budget_channel_settings("채널코드");
CREATE INDEX IF NOT EXISTS idx_budget_channel_active ON budget_channel_settings("사용여부");

-- 9. 예산모드_기본예산설정
CREATE TABLE IF NOT EXISTS budget_basic_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "설정명" TEXT NOT NULL,
  "설정타입" TEXT,
  "설정값JSON" JSONB,
  "적용대상" TEXT,
  "적용기간시작" DATE,
  "적용기간종료" DATE,
  "사용여부" BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_basic_type ON budget_basic_settings("설정타입");
CREATE INDEX IF NOT EXISTS idx_budget_basic_active ON budget_basic_settings("사용여부");

-- 10. 예산모드_기본데이터설정
CREATE TABLE IF NOT EXISTS budget_basic_data_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "데이터타입" TEXT NOT NULL,
  "데이터명" TEXT NOT NULL,
  "데이터값" TEXT,
  "데이터JSON" JSONB,
  "순서" INTEGER,
  "사용여부" BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_data_type ON budget_basic_data_settings("데이터타입");
CREATE INDEX IF NOT EXISTS idx_budget_data_active ON budget_basic_data_settings("사용여부");

-- ============================================================================
-- 자동 업데이트 트리거
-- ============================================================================

CREATE OR REPLACE TRIGGER update_policy_basic_info_updated_at 
  BEFORE UPDATE ON policy_basic_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_policy_table_settings_updated_at 
  BEFORE UPDATE ON policy_table_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_policy_table_list_updated_at 
  BEFORE UPDATE ON policy_table_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_policy_user_groups_updated_at 
  BEFORE UPDATE ON policy_user_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_policy_tab_order_updated_at 
  BEFORE UPDATE ON policy_tab_order
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_policy_group_change_history_updated_at 
  BEFORE UPDATE ON policy_group_change_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_policy_default_groups_updated_at 
  BEFORE UPDATE ON policy_default_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_policy_other_types_updated_at 
  BEFORE UPDATE ON policy_other_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_budget_channel_settings_updated_at 
  BEFORE UPDATE ON budget_channel_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_budget_basic_settings_updated_at 
  BEFORE UPDATE ON budget_basic_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_budget_basic_data_settings_updated_at 
  BEFORE UPDATE ON budget_basic_data_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
