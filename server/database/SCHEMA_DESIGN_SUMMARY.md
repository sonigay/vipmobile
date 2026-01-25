# Database Schema Design Summary

## 개요

VIP Map Application의 31개 Google Sheets 시트를 Supabase PostgreSQL 데이터베이스로 마이그레이션하기 위한 스키마 설계 문서입니다.

**설계 일시**: 2025-01-26  
**설계자**: Kiro AI  
**총 테이블 수**: 31개

## 핵심 설계 원칙

### 1. 컬럼명 보존 전략
- **Google Sheets 헤더 = Supabase 컬럼명**
- 한글 컬럼명을 그대로 사용하여 기존 코드 호환성 유지
- PostgreSQL에서 한글 컬럼명은 큰따옴표로 감싸야 함
  ```sql
  SELECT "통신사", "마진" FROM direct_store_policy_margin;
  ```

### 2. 공통 컬럼
모든 테이블에 다음 컬럼 추가:
- `id UUID PRIMARY KEY` - 고유 식별자
- `created_at TIMESTAMPTZ` - 생성 시간
- `updated_at TIMESTAMPTZ` - 수정 시간 (자동 업데이트)

### 3. 데이터 타입 매핑

| Google Sheets | PostgreSQL |
|---------------|------------|
| 텍스트 | TEXT |
| 숫자 (정수) | INTEGER |
| 숫자 (소수) | NUMERIC(10,2) |
| 날짜 | DATE |
| 날짜+시간 | TIMESTAMPTZ |
| 체크박스 (O/X) | BOOLEAN |
| JSON 문자열 | JSONB |
| 배열 | TEXT[] |

## 테이블 목록

### 직영점 모드 (14개 테이블)

1. **direct_store_policy_margin** (직영점_정책_마진)
   - 통신사별 마진 정책
   - 컬럼: 통신사, 마진

2. **direct_store_policy_addon_services** (직영점_정책_부가서비스)
   - 부가서비스 정책
   - 컬럼: 통신사, 서비스명, 월요금, 유치추가금액, 미유치차감금액, 상세설명, 공식사이트URL

3. **direct_store_policy_insurance** (직영점_정책_보험상품)
   - 보험상품 정책
   - 컬럼: 통신사, 보험상품명, 출고가최소, 출고가최대, 월요금, 유치추가금액, 미유치차감금액, 상세설명, 공식사이트URL

4. **direct_store_policy_special** (직영점_정책_별도)
   - 특별 정책
   - 컬럼: 통신사, 정책명, 정책타입, 금액, 적용여부, 조건JSON

5. **direct_store_settings** (직영점_설정)
   - 직영점 설정
   - 컬럼: 통신사, 설정유형, 시트ID, 시트URL, 설정값JSON

6. **direct_store_main_page_texts** (직영점_메인페이지문구)
   - 메인 페이지 문구
   - 컬럼: 통신사, 카테고리, 설정유형, 문구내용, 이미지URL, 수정일시

7. **direct_store_plan_master** (직영점_요금제마스터)
   - 요금제 마스터 데이터
   - 컬럼: 통신사, 요금제명, 요금제군, 기본료, 요금제코드, 사용여부, 비고

8. **direct_store_device_master** (직영점_단말마스터)
   - 단말기 마스터 데이터
   - 컬럼: 통신사, 모델ID, 모델명, 펫네임, 제조사, 출고가, 기본요금제군, isPremium, isBudget, isPopular, isRecommended, isCheap, 이미지URL, 사용여부, 비고, Discord메시지ID, Discord포스트ID, Discord스레드ID

9. **direct_store_device_pricing_policy** (직영점_단말요금정책)
   - 단말기 요금 정책
   - 컬럼: 통신사, 모델ID, 모델명, 요금제군, 요금제코드, 개통유형, 출고가, 이통사지원금, 대리점추가지원금_부가유치, 정책마진, 정책ID, 기준일자, 비고

10. **direct_store_model_images** (직영점_모델이미지)
    - 모델 이미지
    - 컬럼: 통신사, 모델ID, 모델명, 펫네임, 제조사, 이미지URL, 비고, 색상, Discord메시지ID, Discord포스트ID, Discord스레드ID

11. **direct_store_todays_mobiles** (직영점_오늘의휴대폰)
    - 오늘의 추천 휴대폰
    - 컬럼: 통신사, 모델ID, 모델명, 펫네임, 제조사, 출고가, 이미지URL, 순서, 표시여부, 등록일시

12. **direct_store_transit_locations** (직영점_대중교통위치)
    - 대중교통 위치 정보
    - 컬럼: 타입, 이름, 주소, 위도, 경도, 수정일시

13. **direct_store_photos** (직영점_매장사진)
    - 매장 사진
    - 컬럼: 매장명, POS코드, 사진URL, 사진타입, 설명, 촬영일시, 등록일시

14. **direct_store_sales_daily** (직영점_판매일보)
    - 일일 판매 기록
    - 컬럼: 매장명, POS코드, 판매일자, 통신사, 모델명, 개통유형, 요금제명, 고객명, 연락처, 출고가, 이통사지원금, 대리점지원금, 실구매가, 판매자, 비고

### 정책 모드 (10개 테이블)

1. **policy_table_settings** (정책모드_정책표설정)
   - 정책표 설정
   - 컬럼: 정책표ID, 정책표명, 통신사, 시트ID, 시트URL, 생성자, 생성일시, 수정일시, 사용여부, 비고

2. **policy_table_list** (정책모드_정책표목록)
   - 정책표 목록
   - 컬럼: 정책표ID, 정책명, 통신사, 정책타입, 정책값, 적용조건, 우선순위, 사용여부, 등록일시

3. **policy_user_groups** (정책모드_일반사용자그룹)
   - 사용자 그룹
   - 컬럼: 그룹명, 그룹코드, 설명, 권한레벨, 사용자목록, 생성일시, 수정일시

4. **policy_tab_order** (정책표목록_탭순서)
   - 탭 순서 설정
   - 컬럼: 정책표ID, 탭명, 순서, 표시여부, 아이콘

5. **policy_group_change_history** (정책모드_정책영업그룹_변경이력)
   - 정책 변경 이력
   - 컬럼: 정책표ID, 변경유형, 변경자, 변경일시, 변경전데이터, 변경후데이터, 변경사유

6. **policy_default_groups** (정책모드_기본정책영업그룹)
   - 기본 정책 그룹
   - 컬럼: 그룹명, 그룹코드, 통신사, 정책표ID, 기본적용여부, 우선순위, 설명

7. **policy_other_types** (정책모드_기타정책목록)
   - 기타 정책
   - 컬럼: 정책타입, 정책명, 통신사, 정책값, 적용조건JSON, 사용여부, 등록일시

8. **budget_channel_settings** (예산모드_예산채널설정)
   - 예산 채널 설정
   - 컬럼: 채널명, 채널코드, 통신사, 예산금액, 사용금액, 잔여금액, 적용기간시작, 적용기간종료, 사용여부

9. **budget_basic_settings** (예산모드_기본예산설정)
   - 기본 예산 설정
   - 컬럼: 설정명, 설정타입, 설정값JSON, 적용대상, 적용기간시작, 적용기간종료, 사용여부

10. **budget_basic_data_settings** (예산모드_기본데이터설정)
    - 기본 데이터 설정
    - 컬럼: 데이터타입, 데이터명, 데이터값, 데이터JSON, 순서, 사용여부

### 고객 모드 (7개 테이블)

1. **customer_info** (고객정보)
   - 고객 정보
   - 컬럼: 고객명, 연락처, 이메일, 생년월일, 주소, 선호매장, 선호매장POS코드, 가입일시, 최근방문일시, 총구매횟수, 회원등급, 비고

2. **purchase_queue** (구매대기)
   - 구매 대기 목록
   - 컬럼: 고객명, 연락처, 매장명, 매장POS코드, 통신사, 모델명, 펫네임, 개통유형, 요금제명, 출고가, 이통사지원금, 대리점지원금, 예상구매가, 상태, 등록일시, 처리일시, 처리자, 비고

3. **board** (게시판)
   - 게시판
   - 컬럼: 제목, 내용, 작성자, 작성자연락처, 매장명, 매장POS코드, 카테고리, 조회수, 비밀글여부, 답변여부, 답변내용, 답변자, 답변일시, 첨부파일URL, 작성일시

4. **direct_store_pre_approval_marks** (직영점_사전승낙서마크)
   - 사전승낙서 마크
   - 컬럼: 매장명, 매장POS코드, 마크타입, 마크이미지URL, 사용여부, 등록일시

5. **reservation_all_customers** (예약판매전체고객)
   - 전체 예약 고객
   - 컬럼: 고객명, 연락처, 예약모델명, 예약통신사, 예약매장, 예약매장POS코드, 예약일시, 예약상태, 예약금, 예약금입금여부, 비고

6. **reservation_customers** (예약판매고객)
   - 예약 고객 상세
   - 컬럼: 고객명, 연락처, 예약모델명, 예약통신사, 예약매장, 예약매장POS코드, 예약일시, 희망개통일, 예약상태, 예약금, 예약금입금일시, 예약금환불일시, 구매완료일시, 담당자, 상세메모

7. **unmatched_customers** (미매칭고객)
   - 미매칭 고객
   - 컬럼: 고객명, 연락처, 매장명, 매장POS코드, 문의내용, 문의일시, 매칭상태, 매칭일시, 매칭담당자, 처리메모

## 인덱스 전략

### 주요 인덱스
- **통신사**: 대부분의 테이블에서 통신사별 필터링이 빈번
- **사용여부/표시여부**: 활성 데이터 조회 최적화
- **날짜 컬럼**: 기간별 조회 최적화
- **POS코드/매장명**: 매장별 데이터 조회 최적화
- **연락처**: 고객 조회 최적화
- **모델ID/요금제코드**: 상품 조회 최적화

## 스키마 파일 구조

```
server/database/
├── schema-master.sql           # 전체 스키마 실행 마스터 파일
├── schema-direct-store.sql     # 직영점 모드 (14개 테이블)
├── schema-policy.sql           # 정책 모드 (10개 테이블)
├── schema-customer.sql         # 고객 모드 (7개 테이블)
└── SCHEMA_DESIGN_SUMMARY.md    # 이 문서
```

## 실행 방법

### Supabase SQL Editor에서 실행
1. Supabase 대시보드 접속
2. SQL Editor 메뉴 선택
3. 각 스키마 파일 내용을 순서대로 복사하여 실행:
   - `schema-direct-store.sql`
   - `schema-policy.sql`
   - `schema-customer.sql`

### psql 명령어로 실행
```bash
cd server/database
psql -h <supabase-host> -U postgres -d postgres -f schema-direct-store.sql
psql -h <supabase-host> -U postgres -d postgres -f schema-policy.sql
psql -h <supabase-host> -U postgres -d postgres -f schema-customer.sql
```

## 다음 단계

1. ✅ **Task 12 완료**: 스키마 설계 문서 작성
2. ⏭️ **Task 13**: SQL 스키마 파일을 Supabase에서 실행
3. ⏭️ **Task 14-16**: 마이그레이션 스크립트 구현
4. ⏭️ **Task 17-53**: 31개 시트 개별 마이그레이션

## 주의사항

### 한글 컬럼명 사용 시
```javascript
// ✅ 올바른 사용
const { data } = await supabase
  .from('direct_store_policy_margin')
  .select('통신사, 마진'); // Supabase 클라이언트가 자동으로 처리

// ❌ 직접 SQL 작성 시 큰따옴표 필수
const { data } = await supabase
  .rpc('custom_function', {
    query: 'SELECT "통신사", "마진" FROM direct_store_policy_margin'
  });
```

### 데이터 마이그레이션 시
- Google Sheets의 빈 셀은 NULL로 처리
- 날짜 형식 변환 필요 (Google Sheets → ISO 8601)
- 불리언 값 변환 (O/X → true/false)
- JSON 컬럼은 문자열을 JSONB로 파싱

## 참고 문서

- [SCHEMA_MAPPING_STRATEGY.md](../../../.kiro/specs/hybrid-database-migration/SCHEMA_MAPPING_STRATEGY.md)
- [design.md](../../../.kiro/specs/hybrid-database-migration/design.md)
- [requirements.md](../../../.kiro/specs/hybrid-database-migration/requirements.md)
