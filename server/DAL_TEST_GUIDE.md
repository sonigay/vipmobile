# DAL API 테스트 가이드

## 배포 완료 후 테스트

클라우드타입 재배포가 완료되면 (1-2분 소요) 다음 API들을 테스트할 수 있습니다.

## 1. DAL 상태 확인

```bash
curl https://your-domain.com/api/direct-dal/status
```

**예상 응답**:
```json
{
  "success": true,
  "data": {
    "database": true,
    "googleSheets": true,
    "featureFlags": {
      "direct-store": true,
      "policy": true,
      "customer": true
    },
    "currentMode": "direct-store",
    "usingDatabase": true,
    "dalInitialized": true
  }
}
```

`usingDatabase: true`이면 Supabase를 사용 중입니다!

## 2. 오늘의 휴대폰 조회 (읽기)

```bash
curl https://your-domain.com/api/direct-dal/todays-mobiles
```

**예상 응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "modelName": "SM-F966N256",
      "petName": "갤럭시 Z Fold7 256GB",
      "carrier": "LG",
      "factoryPrice": 0,
      "carrierSubsidy": 0,
      "dealerSubsidyWithAddon": 0,
      "dealerSubsidyWithoutAddon": 0,
      "imageUrl": "",
      "requiredAddon": "유플레이 프리미엄",
      "isPopular": false,
      "isRecommended": false,
      "isCheap": false,
      "isPremium": false,
      "isBudget": false,
      "updatedAt": "2026-01-25T08:17:45.942Z"
    }
  ]
}
```

## 3. 휴대폰 태그 업데이트 (쓰기)

```bash
curl -X PUT https://your-domain.com/api/direct-dal/mobiles/SM-F966N256/tags \
  -H "Content-Type: application/json" \
  -d '{
    "tags": {
      "isPopular": true,
      "isRecommended": true,
      "isCheap": false,
      "isPremium": true,
      "isBudget": false
    }
  }'
```

**예상 응답**:
```json
{
  "success": true,
  "message": "태그가 업데이트되었습니다."
}
```

## 4. 메인 페이지 문구 조회

```bash
curl https://your-domain.com/api/direct-dal/main-page-texts
```

## 5. 메인 페이지 문구 저장

```bash
curl -X POST https://your-domain.com/api/direct-dal/main-page-texts \
  -H "Content-Type: application/json" \
  -d '{
    "carrier": "LG",
    "category": "메인",
    "textType": "mainHeader",
    "content": "테스트 문구입니다.",
    "imageUrl": ""
  }'
```

## 6. 대중교통 위치 조회

```bash
curl https://your-domain.com/api/direct-dal/transit-location/all
```

## 7. 대중교통 위치 생성

```bash
curl -X POST https://your-domain.com/api/direct-dal/transit-location/create \
  -H "Content-Type: application/json" \
  -d '{
    "type": "버스터미널",
    "name": "테스트 터미널",
    "address": "서울시 강남구",
    "latitude": 37.5,
    "longitude": 127.0
  }'
```

## 8. 대중교통 위치 수정

```bash
curl -X PUT https://your-domain.com/api/direct-dal/transit-location/TL_1234567890_abc \
  -H "Content-Type: application/json" \
  -d '{
    "name": "수정된 터미널 이름"
  }'
```

## 9. 대중교통 위치 삭제

```bash
curl -X DELETE https://your-domain.com/api/direct-dal/transit-location/TL_1234567890_abc
```

## 10. 정책 설정 조회

```bash
curl https://your-domain.com/api/direct-dal/policy-settings?carrier=LG
```

**예상 응답**:
```json
{
  "success": true,
  "data": {
    "baseMargin": 100000,
    "addonList": [
      {
        "name": "통화편의+구글원 패키지",
        "fee": 10300,
        "incentive": 30000,
        "deduction": -10000
      }
    ],
    "insuranceList": [
      {
        "name": "폰교체 패스 50",
        "minPrice": 1,
        "maxPrice": 500000,
        "fee": 5990,
        "incentive": 30000,
        "deduction": -10000
      }
    ],
    "specialPolicies": []
  }
}
```

## Supabase 대시보드에서 확인

1. https://supabase.com/dashboard 접속
2. Table Editor 클릭
3. `direct_store_todays_mobiles` 테이블 선택
4. 태그 업데이트가 반영되었는지 확인

## 프론트엔드 연동

### 기존 API 경로
```javascript
// 기존: Google Sheets 직접 호출
fetch('/api/direct/todays-mobiles')
```

### 새로운 DAL API 경로
```javascript
// 새로운: DAL 사용 (Supabase 자동 전환)
fetch('/api/direct-dal/todays-mobiles')
```

### 점진적 전환 전략

1. **1단계**: 새로운 API 테스트
   - `/api/direct-dal/*` 엔드포인트로 테스트
   - 기존 `/api/direct/*`는 그대로 유지

2. **2단계**: 프론트엔드 일부 전환
   - 중요하지 않은 기능부터 전환
   - 예: 대중교통 위치, 메인 페이지 문구

3. **3단계**: 전체 전환
   - 모든 기능이 정상 작동 확인 후
   - `/api/direct/*`를 `/api/direct-dal/*`로 교체

## 문제 해결

### 1. "usingDatabase: false"인 경우

```bash
# .env 파일 확인
cat server/.env | grep USE_DB_DIRECT_STORE
# 출력: USE_DB_DIRECT_STORE=true

# 서버 재시작
npm restart
```

### 2. "database: false"인 경우

```bash
# Supabase 환경 변수 확인
cat server/.env | grep SUPABASE
# SUPABASE_URL과 SUPABASE_KEY가 설정되어 있는지 확인
```

### 3. API 오류 발생 시

```bash
# 서버 로그 확인
tail -f server/logs/app.log

# DAL 로그 확인
tail -f server/logs/app.log | grep "DALFactory"
```

## 성능 비교

### Google Sheets (기존)
- 응답 시간: 500ms ~ 2000ms
- Rate Limit: 100 requests/100 seconds
- 캐싱 필수

### Supabase (새로운)
- 응답 시간: 50ms ~ 200ms (10배 빠름!)
- Rate Limit: 없음 (충분한 용량)
- 캐싱 불필요

## 다음 단계

1. ✅ DAL API 테스트 완료
2. ⏭️ 프론트엔드 일부 기능 전환
3. ⏭️ 전체 기능 전환
4. ⏭️ Google Sheets를 읽기 전용 백업으로 유지
5. ⏭️ Policy 모드, Customer 모드 마이그레이션
