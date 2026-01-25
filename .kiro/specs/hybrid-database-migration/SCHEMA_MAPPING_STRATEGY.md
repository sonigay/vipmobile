# Schema Mapping Strategy

## 핵심 원칙

**Google Sheets 컬럼명 = Supabase 컬럼명**

기존 코드가 수정 없이 작동하려면 Google Sheets의 헤더 행(컬럼명)과 Supabase 테이블의 컬럼명이 **정확히 일치**해야 합니다.

## 매핑 전략

### 1. 컬럼명 보존
```javascript
// Google Sheets 헤더
['정책명', '마진율', '활성여부', '설명']

// Supabase 테이블 (동일하게)
CREATE TABLE direct_store_policy_margin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "정책명" TEXT,           -- 한글 컬럼명 그대로 사용
  "마진율" NUMERIC,
  "활성여부" BOOLEAN,
  "설명" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. 컬럼 순서 보존
- Google Sheets의 컬럼 순서와 동일하게 테이블 생성
- 기존 코드에서 컬럼 순서에 의존하는 경우 대비

### 3. 데이터 타입 매핑

| Google Sheets | Supabase PostgreSQL |
|---------------|---------------------|
| 텍스트 | TEXT |
| 숫자 (정수) | INTEGER 또는 BIGINT |
| 숫자 (소수) | NUMERIC 또는 DECIMAL |
| 날짜 | DATE |
| 날짜+시간 | TIMESTAMP WITH TIME ZONE |
| 체크박스 (O/X) | BOOLEAN |
| URL | TEXT |
| 이메일 | TEXT |
| JSON 문자열 | JSONB |

### 4. 특수 컬럼 처리

#### 자동 생성 컬럼 (추가)
```sql
-- 모든 테이블에 공통 추가
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- 고유 ID
created_at TIMESTAMPTZ DEFAULT NOW(),           -- 생성 시간
updated_at TIMESTAMPTZ DEFAULT NOW()            -- 수정 시간
```

#### 기존 ID 컬럼이 있는 경우
```sql
-- Google Sheets에 이미 'id' 컬럼이 있다면
"id" TEXT,                    -- 기존 ID (Google Sheets 원본)
"_id" UUID PRIMARY KEY,       -- 새 UUID (내부용)
```

### 5. 한글 컬럼명 처리

PostgreSQL은 한글 컬럼명을 지원하지만 **큰따옴표**로 감싸야 합니다:

```sql
-- 올바른 방법
SELECT "정책명", "마진율" FROM direct_store_policy_margin;

-- 잘못된 방법 (에러 발생)
SELECT 정책명, 마진율 FROM direct_store_policy_margin;
```

**DAL 구현에서 자동 처리:**
```javascript
// DatabaseImplementation.js에서 자동으로 큰따옴표 처리
async read(entity, filters = {}) {
  let query = supabase.from(entity).select('*');
  
  // 필터 적용 시 컬럼명 자동 이스케이프
  Object.entries(filters).forEach(([key, value]) => {
    // Supabase 클라이언트가 자동으로 처리
    query = query.eq(key, value);
  });
  
  return await query;
}
```

## 마이그레이션 프로세스

### Step 1: Google Sheets 헤더 분석
```javascript
// 각 시트의 헤더 행 읽기
const sheet = doc.sheetsByTitle['직영점_정책_마진'];
await sheet.loadHeaderRow();
const headers = sheet.headerValues;

console.log('컬럼명:', headers);
// 출력: ['정책명', '마진율', '활성여부', '설명', ...]
```

### Step 2: 스키마 자동 생성
```javascript
// 헤더 기반 CREATE TABLE 문 생성
function generateSchema(tableName, headers, sampleData) {
  const columns = headers.map(header => {
    const dataType = inferDataType(header, sampleData);
    return `"${header}" ${dataType}`;
  });
  
  return `
CREATE TABLE ${tableName} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ${columns.join(',\n  ')},
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
  `;
}
```

### Step 3: 데이터 타입 추론
```javascript
function inferDataType(columnName, sampleValues) {
  // 샘플 데이터 기반 타입 추론
  const sample = sampleValues[columnName];
  
  if (sample === null || sample === undefined) return 'TEXT';
  
  // 숫자 체크
  if (!isNaN(sample) && sample !== '') {
    if (Number.isInteger(Number(sample))) {
      return 'INTEGER';
    }
    return 'NUMERIC';
  }
  
  // 날짜 체크
  if (isValidDate(sample)) {
    return 'TIMESTAMP WITH TIME ZONE';
  }
  
  // 불리언 체크 (O/X, true/false, 1/0)
  if (['O', 'X', 'true', 'false', '1', '0'].includes(sample)) {
    return 'BOOLEAN';
  }
  
  // 기본값
  return 'TEXT';
}
```

### Step 4: 데이터 변환
```javascript
function transformRowData(row, schema) {
  const transformed = {};
  
  Object.entries(row).forEach(([key, value]) => {
    const columnType = schema[key];
    
    // 타입별 변환
    if (columnType === 'BOOLEAN') {
      transformed[key] = ['O', 'true', '1'].includes(value);
    } else if (columnType === 'INTEGER') {
      transformed[key] = parseInt(value) || null;
    } else if (columnType === 'NUMERIC') {
      transformed[key] = parseFloat(value) || null;
    } else if (columnType === 'TIMESTAMP WITH TIME ZONE') {
      transformed[key] = new Date(value).toISOString();
    } else {
      transformed[key] = value;
    }
  });
  
  return transformed;
}
```

## 검증 체크리스트

### 마이그레이션 전
- [ ] Google Sheets 헤더 행 확인
- [ ] 샘플 데이터 10-20행 추출
- [ ] 각 컬럼의 데이터 타입 분석
- [ ] 특수 문자, 공백 포함 컬럼명 확인

### 스키마 생성 후
- [ ] 컬럼명이 Google Sheets와 정확히 일치하는지 확인
- [ ] 데이터 타입이 적절한지 확인
- [ ] 인덱스 필요 컬럼 식별
- [ ] Foreign Key 관계 확인

### 마이그레이션 후
- [ ] 행 수 일치 확인 (Google Sheets vs Supabase)
- [ ] 샘플 데이터 비교 (무작위 10행)
- [ ] NULL 값 처리 확인
- [ ] 특수 문자 데이터 확인

### API 테스트
- [ ] 기존 API 엔드포인트 호출
- [ ] 응답 데이터 형식 확인
- [ ] 필터링/정렬 동작 확인
- [ ] 에러 처리 확인

## 예제: 실제 시트 분석

### 직영점_정책_마진 시트

**Google Sheets 구조:**
```
| 정책명 | 마진율 | 활성여부 | 설명 | 등록일 |
|--------|--------|----------|------|--------|
| 기본정책 | 15.5 | O | 기본 마진 정책 | 2024-01-01 |
```

**생성될 Supabase 스키마:**
```sql
CREATE TABLE direct_store_policy_margin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "정책명" TEXT NOT NULL,
  "마진율" NUMERIC(5,2),
  "활성여부" BOOLEAN DEFAULT true,
  "설명" TEXT,
  "등록일" DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_policy_margin_active ON direct_store_policy_margin("활성여부");
CREATE INDEX idx_policy_margin_name ON direct_store_policy_margin("정책명");
```

**마이그레이션 코드:**
```javascript
const transformFn = (row) => ({
  "정책명": row["정책명"],
  "마진율": parseFloat(row["마진율"]),
  "활성여부": row["활성여부"] === 'O',
  "설명": row["설명"] || null,
  "등록일": row["등록일"] ? new Date(row["등록일"]).toISOString().split('T')[0] : null
});

await migrator.migrateSheet(
  '직영점_정책_마진',
  'direct_store_policy_margin',
  transformFn
);
```

## 주의사항

### 1. 컬럼명 공백 처리
```sql
-- Google Sheets: "정책 이름" (공백 포함)
-- Supabase: "정책 이름" (그대로 유지, 큰따옴표 필수)
SELECT "정책 이름" FROM table_name;
```

### 2. 특수 문자 컬럼명
```sql
-- Google Sheets: "마진율(%)"
-- Supabase: "마진율(%)" (그대로 유지)
SELECT "마진율(%)" FROM table_name;
```

### 3. 예약어 컬럼명
```sql
-- Google Sheets: "order", "select", "from" 등
-- Supabase: 큰따옴표로 감싸기
SELECT "order", "select" FROM table_name;
```

### 4. 대소문자 구분
PostgreSQL은 기본적으로 대소문자를 구분하지 않지만, 큰따옴표로 감싸면 구분합니다:
```sql
-- 다른 컬럼으로 인식됨
"정책명" ≠ "정책명" (전각/반각 차이)
"Name" ≠ "name"
```

## 롤백 전략

마이그레이션 실패 시:
1. Feature Flag를 false로 설정 → Google Sheets로 즉시 복귀
2. Supabase 테이블 DROP (데이터 삭제)
3. 스키마 재검토 후 재시도

## 다음 단계

1. **Task 12**: 실제 Google Sheets 31개 시트 분석
2. **Task 13**: 분석 결과 기반 SQL 스키마 파일 작성
3. **Task 14-16**: 마이그레이션 스크립트 구현 (컬럼명 보존 로직 포함)
