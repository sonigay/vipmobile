-- ============================================================================
-- 정책 모드 스키마 (10개 테이블)
-- ============================================================================

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

CREATE INDEX idx_policy_settings_id ON policy_table_settings("정책표ID");
CREATE INDEX idx_policy_settings_active ON policy_table_settings("사용여부");

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

CREATE INDEX idx_policy_list_table_id ON policy_table_list("정책표ID");
CREATE INDEX idx_policy_list_carrier ON policy_table_list("통신사");
CREATE INDEX idx_policy_list_active ON policy_table_list("사용여부");

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

CREATE INDEX idx_user_groups_code ON policy_user_groups("그룹코드");

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

CREATE INDEX idx_tab_order_table_id ON policy_tab_order("정책표ID");
CREATE INDEX idx_tab_order_sequence ON policy_tab_order("순서");

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

CREATE INDEX idx_history_table_id ON policy_group_change_history("정책표ID");
CREATE INDEX idx_history_date ON policy_group_change_history("변경일시");

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

CREATE INDEX idx_default_groups_code ON policy_default_groups("그룹코드");
CREATE INDEX idx_default_groups_default ON policy_default_groups("기본적용여부");

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

CREATE INDEX idx_other_types_type ON policy_other_types("정책타입");
CREATE INDEX idx_other_types_active ON policy_other_types("사용여부");

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

CREATE INDEX idx_budget_channel_code ON budget_channel_settings("채널코드");
CREATE INDEX idx_budget_channel_active ON budget_channel_settings("사용여부");

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

CREATE INDEX idx_budget_basic_type ON budget_basic_settings("설정타입");
CREATE INDEX idx_budget_basic_active ON budget_basic_settings("사용여부");

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

CREATE INDEX idx_budget_data_type ON budget_basic_data_settings("데이터타입");
CREATE INDEX idx_budget_data_active ON budget_basic_data_settings("사용여부");

-- ============================================================================
-- 자동 업데이트 트리거
-- ============================================================================

CREATE TRIGGER update_policy_table_settings_updated_at 
  BEFORE UPDATE ON policy_table_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_table_list_updated_at 
  BEFORE UPDATE ON policy_table_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_user_groups_updated_at 
  BEFORE UPDATE ON policy_user_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_tab_order_updated_at 
  BEFORE UPDATE ON policy_tab_order
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_group_change_history_updated_at 
  BEFORE UPDATE ON policy_group_change_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_default_groups_updated_at 
  BEFORE UPDATE ON policy_default_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_other_types_updated_at 
  BEFORE UPDATE ON policy_other_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_channel_settings_updated_at 
  BEFORE UPDATE ON budget_channel_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_basic_settings_updated_at 
  BEFORE UPDATE ON budget_basic_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_basic_data_settings_updated_at 
  BEFORE UPDATE ON budget_basic_data_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
