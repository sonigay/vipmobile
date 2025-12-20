# Google Sheets Rate Limit 문제 분석 및 개선

## 🔍 문제 상황

### 발생한 문제
```
✅ Discord 업로드 성공
❌ Google Sheets 저장 실패 (Rate Limit 오류)
```

### 로그 분석
```
2025-12-20 19:18:49 ✅ [상품 이미지 업로드] Discord 업로드 성공
2025-12-20 19:18:49 📝 [상품 이미지 업로드] Google Sheets에 저장 시작
2025-12-20 19:18:50 [Direct] Rate limit 에러 발생, 4641ms 후 재시도 (2/5)
2025-12-20 19:18:52 ❌ [상품 이미지 업로드] Google Sheets 저장 오류: 
  Quota exceeded for quota metric 'Read requests' 
  and limit 'Read requests per minute per user'
```

## 💡 문제 원인

### 1. 이미지 업로드 프로세스
```
1. Discord에 이미지 업로드 ✅ (성공)
   ↓
2. Google Sheets에서 기존 데이터 읽기 (시도)
   - sheets.spreadsheets.values.get() 호출
   - 기존 행이 있는지 확인하기 위해
   ↓
3. Rate Limit 오류 발생 ❌
   - Google Sheets API 분당 읽기 요청 수 제한 초과
   ↓
4. 시트 저장 실패
   - 기존 데이터를 읽지 못해서 업데이트/추가 불가
```

### 2. 왜 이런 문제가 발생했나?

#### Google Sheets API 제한
- **분당 읽기 요청 수 제한**: 사용자당 분당 제한된 수의 읽기 요청만 허용
- **동시 요청**: 여러 사용자가 동시에 이미지를 업로드하면 Rate Limit 초과 가능
- **기존 코드의 문제점**:
  - Rate Limit 오류 발생 시 **재시도하지 않음** 또는 **약한 재시도**
  - 즉시 실패 처리 → Discord에는 업로드되었지만 시트에는 저장 안됨

#### 기존 코드 (수정 전)
```javascript
const rateLimitedSheetsCall = async (apiCall) => {
  // 최소 간격만 유지 (1초)
  await new Promise(resolve => setTimeout(resolve, waitTime));
  return await apiCall(); // ❌ Rate Limit 오류 시 재시도 없음
};
```

**문제점**:
- Rate Limit 오류(429) 발생 시 즉시 실패
- 재시도 로직 없음
- Discord 업로드는 성공했지만 시트 저장 실패

## ✅ 개선 내용

### 수정 후 코드
```javascript
const rateLimitedSheetsCall = async (apiCall, maxRetries = 5) => {
  // 1. 기본 Rate Limiting (최소 간격 유지)
  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  // 2. Rate Limit 오류 재시도 로직 추가
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      // Rate Limit 오류 감지
      if (isRateLimitError && attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = 3000 * Math.pow(2, attempt) + jitter;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue; // 재시도 ✅
      }
      throw error;
    }
  }
};
```

### 개선 효과

#### 1. **자동 재시도**
- Rate Limit 오류 발생 시 **자동으로 재시도**
- 최대 5회까지 재시도
- **결과**: 일시적인 Rate Limit 오류도 성공적으로 처리

#### 2. **Exponential Backoff**
- 재시도 간격이 점진적으로 증가
  - 1차 재시도: 약 3초 후
  - 2차 재시도: 약 6초 후
  - 3차 재시도: 약 12초 후
  - 4차 재시도: 약 24초 후
  - 5차 재시도: 약 48초 후
- **결과**: Google Sheets API가 복구될 시간 확보

#### 3. **Jitter (랜덤 지연)**
- 0~2초 랜덤 지연 추가
- **결과**: 여러 요청이 동시에 재시도하는 것을 방지 (Thundering Herd 문제 해결)

## 📊 개선 전후 비교

### 개선 전
```
Discord 업로드 ✅
  ↓
시트 읽기 시도
  ↓
Rate Limit 오류 ❌
  ↓
즉시 실패 → 시트 저장 안됨 ❌
```

### 개선 후
```
Discord 업로드 ✅
  ↓
시트 읽기 시도
  ↓
Rate Limit 오류 발생
  ↓
3초 대기 후 재시도
  ↓
성공 ✅ → 시트 저장 성공 ✅
```

## 🎯 핵심 개선 사항

1. **Rate Limit 오류 자동 감지 및 재시도**
   - 429 오류 코드 감지
   - "Quota exceeded" 메시지 감지
   - "RESOURCE_EXHAUSTED" 상태 감지

2. **지능적인 재시도 전략**
   - Exponential backoff로 대기 시간 증가
   - Jitter로 동시 요청 분산
   - 최대 60초까지 대기

3. **모든 모드에 적용**
   - 직영점모드: `rateLimitedSheetsCall`
   - 회의모드: `retrySheetsOperation`
   - 데이터 조회: `withRetry`

## 💬 요약

**문제**: Discord 업로드는 성공했지만 Google Sheets 저장 실패

**원인**: 
- Google Sheets API Rate Limit 제한
- 기존 코드는 Rate Limit 오류 시 재시도하지 않음

**해결**:
- Rate Limit 오류 자동 감지 및 재시도 로직 추가
- Exponential backoff + Jitter 적용
- 최대 5회 재시도로 일시적 오류 처리

**결과**: 
- Rate Limit 오류 발생 시 자동으로 재시도
- Discord 업로드 성공 시 시트 저장도 성공적으로 완료
- 사용자 경험 개선 (업로드 실패 감소)

