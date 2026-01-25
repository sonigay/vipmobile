# Google Sheets 참조 검증 가이드

## 생성 일시
2025-01-25

---

## 개요
코드에서 참조하는 Google Sheets 시트 이름이 실제 스프레드시트와 일치하는지 검증하는 가이드입니다.

---

## 1. 현재 사용 중인 시트 목록 (22개)

### 인증 및 권한 관리
1. **대리점아이디관리** - 대리점 관리자 정보, 권한 관리
2. **일반모드권한관리** - 일반 사용자 권한 관리

### 매장 및 재고
3. **폰클출고처데이터** - 매장 정보
4. **폰클재고데이터** - 재고 정보
5. **판매점정보** - 판매점 정보 (별도 스프레드시트)

### 영업 및 개통
6. **당월개통실적** - 당월 개통 실적
7. **전월개통실적** - 전월 개통 실적
8. **raw데이터** - 영업 데이터

### 직영점
9. **고객정보** - 직영점 고객 정보
10. **구매대기** - 직영점 구매 대기열
11. **게시판** - 직영점 게시판
12. **직영점_사전승낙서마크** - 사전승낙서 마크
13. **직영점_매장사진** - 매장 사진
14. **직영점_판매일보** - 판매 일보

### 온세일
15. **온세일_개통정보** - 온세일 개통 정보
16. **온세일_링크관리** - 온세일 링크 관리
17. **온세일_정책게시판** - 온세일 정책 게시판

### 기타
18. **검수관리** - 검수 데이터
19. **정규화작업시트** - 정규화 상태
20. **지도재고노출옵션** - 지도 표시 옵션
21. **예약관리** - 예약 데이터
22. **예약설정** - 예약 설정

---

## 2. 검증 방법

### 2.1 수동 검증 (권장)

#### Step 1: Google Sheets 접속
1. 실제 사용 중인 Google Spreadsheet 열기
2. 하단 시트 탭 목록 확인

#### Step 2: 시트 이름 비교
위의 22개 시트 이름과 실제 스프레드시트의 시트 이름을 비교:

```
체크리스트:
[ ] 대리점아이디관리
[ ] 일반모드권한관리
[ ] 폰클출고처데이터
[ ] 폰클재고데이터
[ ] 판매점정보 (별도 스프레드시트)
[ ] 당월개통실적
[ ] 전월개통실적
[ ] raw데이터
[ ] 고객정보
[ ] 구매대기
[ ] 게시판
[ ] 직영점_사전승낙서마크
[ ] 직영점_매장사진
[ ] 직영점_판매일보
[ ] 온세일_개통정보
[ ] 온세일_링크관리
[ ] 온세일_정책게시판
[ ] 검수관리
[ ] 정규화작업시트
[ ] 지도재고노출옵션
[ ] 예약관리
[ ] 예약설정
```

#### Step 3: 불일치 발견 시
- 실제 시트 이름을 기록
- 코드에서 수정 필요한 파일 확인 (sheets-references.json 참고)

### 2.2 자동 검증 (환경변수 설정 후)

환경변수가 설정되어 있다면 다음 스크립트로 자동 검증 가능:

```javascript
// server/scripts/validate-sheets.js
const { google } = require('googleapis');
require('dotenv').config();

async function validateSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.SHEET_ID
    });

    const actualSheets = response.data.sheets.map(sheet => sheet.properties.title);
    
    console.log('📋 실제 시트 목록:');
    actualSheets.forEach(name => console.log(`  - ${name}`));
    
    // 코드에서 참조하는 시트 목록
    const expectedSheets = [
      '대리점아이디관리',
      '일반모드권한관리',
      '폰클출고처데이터',
      '폰클재고데이터',
      '당월개통실적',
      '전월개통실적',
      'raw데이터',
      '고객정보',
      '구매대기',
      '게시판',
      '직영점_사전승낙서마크',
      '직영점_매장사진',
      '직영점_판매일보',
      '온세일_개통정보',
      '온세일_링크관리',
      '온세일_정책게시판',
      '검수관리',
      '정규화작업시트',
      '지도재고노출옵션',
      '예약관리',
      '예약설정'
    ];

    console.log('\n🔍 검증 결과:');
    
    const missing = expectedSheets.filter(name => !actualSheets.includes(name));
    const extra = actualSheets.filter(name => !expectedSheets.includes(name));

    if (missing.length > 0) {
      console.log('\n❌ 코드에서 참조하지만 실제로 없는 시트:');
      missing.forEach(name => console.log(`  - ${name}`));
    }

    if (extra.length > 0) {
      console.log('\n⚠️ 실제로 있지만 코드에서 참조하지 않는 시트:');
      extra.forEach(name => console.log(`  - ${name}`));
    }

    if (missing.length === 0 && extra.length === 0) {
      console.log('✅ 모든 시트 이름이 일치합니다!');
    }

  } catch (error) {
    console.error('❌ 검증 실패:', error.message);
  }
}

validateSheets();
```

---

## 3. 시트 이름 불일치 수정 방법

### 3.1 불일치 발견 예시
```
코드: "대리점아이디관리"
실제: "대리점_아이디_관리"
```

### 3.2 수정 방법

#### Option 1: 코드 수정 (권장)
```javascript
// 수정 전
const AGENT_SHEET_NAME = '대리점아이디관리';

// 수정 후
const AGENT_SHEET_NAME = '대리점_아이디_관리';
```

#### Option 2: 시트 이름 변경
Google Sheets에서 시트 이름을 코드와 일치하도록 변경

**주의**: 시트 이름 변경 시 다른 시스템에 영향을 줄 수 있으므로 신중히 결정

### 3.3 수정 대상 파일 확인
`sheets-references.json` 파일에서 해당 시트를 사용하는 라우터 파일 확인:

```json
{
  "authRoutes.js": {
    "sheets": [
      {
        "name": "대리점아이디관리",
        "constant": "AGENT_SHEET_NAME"
      }
    ]
  }
}
```

위 예시의 경우 `server/routes/authRoutes.js` 파일 수정 필요

---

## 4. 컬럼 범위 검증

### 4.1 현재 사용 중인 범위
대부분의 라우터에서 다음 범위를 사용:
- `A:Z` (26개 컬럼)
- `A:AF` (32개 컬럼)
- `A:P` (16개 컬럼)

### 4.2 검증 방법
1. Google Sheets에서 각 시트의 실제 컬럼 수 확인
2. 코드에서 사용하는 컬럼 인덱스 확인
3. 범위가 충분한지 검증

### 4.3 예시
```javascript
// authRoutes.js
const response = await sheets.spreadsheets.values.get({
  range: '대리점아이디관리!A:AF'  // 32개 컬럼 (A-AF)
});

// 코드에서 사용하는 최대 컬럼 인덱스
const hasQuickServiceManagementPermission = agent[31]; // AF열 (32번째)
```

실제 시트에 32개 이상의 컬럼이 있는지 확인 필요

---

## 5. 별도 스프레드시트 검증

### 5.1 판매점정보 시트
`coordinateRoutes.js`에서 별도 스프레드시트 사용:

```javascript
const SALES_SPREADSHEET_ID = process.env.SALES_SPREADSHEET_ID || SPREADSHEET_ID;
```

**검증 항목**:
- [ ] `SALES_SPREADSHEET_ID` 환경변수 설정 여부
- [ ] 해당 스프레드시트에 "판매점정보" 시트 존재 여부

---

## 6. 일반적인 시트 이름 오류

### 6.1 띄어쓰기 vs 언더스코어
```
잘못된 예:
- "직영점 사전승낙서마크" (띄어쓰기)
- "직영점사전승낙서마크" (붙여쓰기)

올바른 예:
- "직영점_사전승낙서마크" (언더스코어)
```

### 6.2 한글 vs 영문
```
일관성 유지:
- "대리점아이디관리" (한글)
- "raw데이터" (영문+한글 혼용)
```

### 6.3 대소문자
```
일관성 유지:
- "raw데이터" (소문자)
- "Raw데이터" (대문자) ❌
```

---

## 7. 검증 체크리스트

### 시트 이름 검증
- [ ] 모든 시트 이름이 실제 스프레드시트와 일치
- [ ] 띄어쓰기, 언더스코어 일관성 확인
- [ ] 대소문자 일관성 확인

### 컬럼 범위 검증
- [ ] 각 시트의 실제 컬럼 수 확인
- [ ] 코드에서 사용하는 최대 컬럼 인덱스 확인
- [ ] 범위가 충분한지 검증

### 별도 스프레드시트 검증
- [ ] `SALES_SPREADSHEET_ID` 환경변수 설정
- [ ] 판매점정보 시트 존재 확인

---

## 8. 다음 단계

### 즉시 실행
1. **수동 검증**: Google Sheets에서 시트 이름 확인
2. **불일치 발견 시**: 코드 수정 또는 시트 이름 변경
3. **문서화**: 수정 내역을 `sheets-fixes.md`에 기록

### 환경변수 설정 후
1. **자동 검증 스크립트 실행**: `node server/scripts/validate-sheets.js`
2. **결과 확인**: 불일치 항목 수정
3. **재검증**: 수정 후 다시 스크립트 실행

---

## 9. 참고사항

### 현재 상태
- ✅ 시트 참조 목록 추출 완료 (`sheets-references.json`)
- ⏳ 실제 스프레드시트와 비교 필요 (환경변수 설정 후)
- ⏳ 불일치 발견 시 수정 필요

### 우선순위
1. **필수 시트** (로그인 불가 시 앱 사용 불가)
   - 대리점아이디관리
   - 일반모드권한관리
   - 폰클출고처데이터

2. **중요 시트** (주요 기능)
   - 폰클재고데이터
   - 당월개통실적
   - raw데이터

3. **선택적 시트** (추가 기능)
   - 직영점 관련 시트
   - 온세일 관련 시트
   - 예약 관련 시트
