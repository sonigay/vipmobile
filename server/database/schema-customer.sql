-- ============================================================================
-- 고객 모드 스키마 (7개 테이블)
-- ============================================================================
--
-- 📋 테이블 목록 (7개):
-- 1. customer_info (고객정보)
-- 2. purchase_queue (구매대기)
-- 3. board (게시판)
-- 4. direct_store_pre_approval_marks (직영점_사전승낙서마크)
-- 5. reservation_all_customers (예약판매전체고객)
-- 6. reservation_customers (예약판매고객)
-- 7. unmatched_customers (미매칭고객)
-- ============================================================================

-- 1. 고객정보
CREATE TABLE IF NOT EXISTS customer_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "고객명" TEXT NOT NULL,
  "연락처" TEXT NOT NULL UNIQUE,
  "이메일" TEXT,
  "생년월일" DATE,
  "주소" TEXT,
  "선호매장" TEXT,
  "선호매장POS코드" TEXT,
  "가입일시" TIMESTAMPTZ,
  "최근방문일시" TIMESTAMPTZ,
  "총구매횟수" INTEGER DEFAULT 0,
  "회원등급" TEXT,
  "비고" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer_info("연락처");
CREATE INDEX IF NOT EXISTS idx_customer_name ON customer_info("고객명");
CREATE INDEX IF NOT EXISTS idx_customer_store ON customer_info("선호매장POS코드");

-- 2. 구매대기
CREATE TABLE IF NOT EXISTS purchase_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "고객명" TEXT NOT NULL,
  "연락처" TEXT NOT NULL,
  "매장명" TEXT,
  "매장POS코드" TEXT,
  "통신사" TEXT,
  "모델명" TEXT,
  "펫네임" TEXT,
  "개통유형" TEXT, -- "신규", "번호이동", "기기변경"
  "요금제명" TEXT,
  "출고가" NUMERIC(10,2),
  "이통사지원금" NUMERIC(10,2),
  "대리점지원금" NUMERIC(10,2),
  "예상구매가" NUMERIC(10,2),
  "상태" TEXT DEFAULT '구매대기', -- "구매대기", "처리중", "처리완료", "취소"
  "등록일시" TIMESTAMPTZ NOT NULL,
  "처리일시" TIMESTAMPTZ,
  "처리자" TEXT,
  "비고" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_phone ON purchase_queue("연락처");
CREATE INDEX IF NOT EXISTS idx_queue_store ON purchase_queue("매장POS코드");
CREATE INDEX IF NOT EXISTS idx_queue_status ON purchase_queue("상태");
CREATE INDEX IF NOT EXISTS idx_queue_date ON purchase_queue("등록일시");

-- 3. 게시판
CREATE TABLE IF NOT EXISTS board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "제목" TEXT NOT NULL,
  "내용" TEXT NOT NULL,
  "작성자" TEXT NOT NULL,
  "작성자연락처" TEXT,
  "매장명" TEXT,
  "매장POS코드" TEXT,
  "카테고리" TEXT, -- "공지", "문의", "후기", "일반"
  "조회수" INTEGER DEFAULT 0,
  "비밀글여부" BOOLEAN DEFAULT false,
  "답변여부" BOOLEAN DEFAULT false,
  "답변내용" TEXT,
  "답변자" TEXT,
  "답변일시" TIMESTAMPTZ,
  "첨부파일URL" TEXT,
  "작성일시" TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_store ON board("매장POS코드");
CREATE INDEX IF NOT EXISTS idx_board_category ON board("카테고리");
CREATE INDEX IF NOT EXISTS idx_board_date ON board("작성일시");
CREATE INDEX IF NOT EXISTS idx_board_answered ON board("답변여부");

-- 4. 직영점_사전승낙서마크
CREATE TABLE IF NOT EXISTS direct_store_pre_approval_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "매장명" TEXT NOT NULL,
  "매장POS코드" TEXT,
  "마크타입" TEXT, -- "로고", "서명", "도장"
  "마크이미지URL" TEXT NOT NULL,
  "사용여부" BOOLEAN DEFAULT true,
  "등록일시" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_marks_store ON direct_store_pre_approval_marks("매장POS코드");
CREATE INDEX IF NOT EXISTS idx_approval_marks_active ON direct_store_pre_approval_marks("사용여부");

-- 5. 예약판매전체고객
CREATE TABLE IF NOT EXISTS reservation_all_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "고객명" TEXT NOT NULL,
  "연락처" TEXT NOT NULL,
  "예약모델명" TEXT,
  "예약통신사" TEXT,
  "예약매장" TEXT,
  "예약매장POS코드" TEXT,
  "예약일시" TIMESTAMPTZ NOT NULL,
  "예약상태" TEXT DEFAULT '예약대기', -- "예약대기", "예약확정", "구매완료", "취소"
  "예약금" NUMERIC(10,2),
  "예약금입금여부" BOOLEAN DEFAULT false,
  "비고" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_all_phone ON reservation_all_customers("연락처");
CREATE INDEX IF NOT EXISTS idx_reservation_all_store ON reservation_all_customers("예약매장POS코드");
CREATE INDEX IF NOT EXISTS idx_reservation_all_status ON reservation_all_customers("예약상태");
CREATE INDEX IF NOT EXISTS idx_reservation_all_date ON reservation_all_customers("예약일시");

-- 6. 예약판매고객
CREATE TABLE IF NOT EXISTS reservation_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "고객명" TEXT NOT NULL,
  "연락처" TEXT NOT NULL,
  "예약모델명" TEXT NOT NULL,
  "예약통신사" TEXT,
  "예약매장" TEXT,
  "예약매장POS코드" TEXT,
  "예약일시" TIMESTAMPTZ NOT NULL,
  "희망개통일" DATE,
  "예약상태" TEXT DEFAULT '예약대기',
  "예약금" NUMERIC(10,2),
  "예약금입금일시" TIMESTAMPTZ,
  "예약금환불일시" TIMESTAMPTZ,
  "구매완료일시" TIMESTAMPTZ,
  "담당자" TEXT,
  "상세메모" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_phone ON reservation_customers("연락처");
CREATE INDEX IF NOT EXISTS idx_reservation_store ON reservation_customers("예약매장POS코드");
CREATE INDEX IF NOT EXISTS idx_reservation_status ON reservation_customers("예약상태");
CREATE INDEX IF NOT EXISTS idx_reservation_date ON reservation_customers("예약일시");
CREATE INDEX IF NOT EXISTS idx_reservation_model ON reservation_customers("예약모델명");

-- 7. 미매칭고객
CREATE TABLE IF NOT EXISTS unmatched_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "고객명" TEXT,
  "연락처" TEXT,
  "매장명" TEXT,
  "매장POS코드" TEXT,
  "문의내용" TEXT,
  "문의일시" TIMESTAMPTZ NOT NULL,
  "매칭상태" TEXT DEFAULT '미매칭', -- "미매칭", "매칭중", "매칭완료"
  "매칭일시" TIMESTAMPTZ,
  "매칭담당자" TEXT,
  "처리메모" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unmatched_phone ON unmatched_customers("연락처");
CREATE INDEX IF NOT EXISTS idx_unmatched_store ON unmatched_customers("매장POS코드");
CREATE INDEX IF NOT EXISTS idx_unmatched_status ON unmatched_customers("매칭상태");
CREATE INDEX IF NOT EXISTS idx_unmatched_date ON unmatched_customers("문의일시");

-- ============================================================================
-- 자동 업데이트 트리거
-- ============================================================================

CREATE OR REPLACE TRIGGER update_customer_info_updated_at 
  BEFORE UPDATE ON customer_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_purchase_queue_updated_at 
  BEFORE UPDATE ON purchase_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_board_updated_at 
  BEFORE UPDATE ON board
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_direct_store_pre_approval_marks_updated_at 
  BEFORE UPDATE ON direct_store_pre_approval_marks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_reservation_all_customers_updated_at 
  BEFORE UPDATE ON reservation_all_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_reservation_customers_updated_at 
  BEFORE UPDATE ON reservation_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_unmatched_customers_updated_at 
  BEFORE UPDATE ON unmatched_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
