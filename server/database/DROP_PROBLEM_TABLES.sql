-- ============================================================================
-- 문제 테이블 DROP 스크립트
-- ============================================================================
-- 
-- 목적: NOT NULL 제약이 있는 3개 테이블을 삭제하여 재생성 준비
-- 
-- 사용 방법:
--   1. Supabase 대시보드 접속: https://supabase.com/dashboard
--   2. SQL Editor 메뉴 클릭
--   3. 이 파일 내용을 복사하여 실행
--   4. server/database/schema-direct-store.sql의 해당 테이블 부분만 다시 실행
-- 
-- ============================================================================

-- 1. 오늘의 모바일 테이블 삭제
DROP TABLE IF EXISTS direct_store_todays_mobiles CASCADE;

-- 2. 매장 사진 테이블 삭제
DROP TABLE IF EXISTS direct_store_photos CASCADE;

-- 3. 메인 페이지 텍스트 테이블 삭제
DROP TABLE IF EXISTS direct_store_main_page_texts CASCADE;

-- 완료 메시지
SELECT '✅ 3개 테이블 삭제 완료!' AS status;
SELECT '다음 단계: schema-direct-store.sql의 해당 테이블 CREATE 문을 실행하세요.' AS next_step;
