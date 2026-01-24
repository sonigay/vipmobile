# Design Document

## Overview

이 설계는 VIP Map Application의 API URL 중앙화 시스템을 정의합니다. 현재 시스템은 여러 파일에 하드코딩된 API URL(`https://vipmobile-backend.cloudtype.app`)을 사용하고 있어 유지보수가 어렵고 CORS 오류가 발생하고 있습니다. 이 설계는 `src/api.js`의 `API_BASE_URL`을 단일 진실 공급원(Single Source of Truth)으로 확립하고, 모든 컴포넌트가 이를 참조하도록 리팩토링합니다.

## Architecture

### 현재 아키텍처 문제점

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
├─────────────────────────────────────────────────────────────┤
│  src/api.js                                                  │
│  ✅ API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app'
│                                                              │
│  src/utils/policyService.js                                 │
│  ❌ API_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app'
│                                                              │
│  src/components/PolicyMode.js (3곳)                         │
│  ❌ const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app'
│                                                              │
│  src/components/BudgetMode.js (1곳)                         │
│  ❌ const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app'
│                                                              │
│  src/components/ActivationInfoPage.js (1곳)                 │
│  ❌ const API_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app'
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                         │
├─────────────────────────────────────────────────────────────┤
│  server/corsMiddleware.js                                   │
│  ❌ CORS 설정: vipmobile-backend.cloudtype.app만 허용       │
│  ❌ 실제 서버: port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app
│  → CORS 오류 발생!                                          │
└─────────────────────────────────────────────────────────────┘
```

### 개선된 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
├─────────────────────────────────────────────────────────────┤
│  src/api.js (Single Source of Truth)                        │
│  ✅ export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app'
│                                                              │
│  src/utils/policyService.js                                 │
│  ✅ import { API_BASE_URL } from '../api';                  │
│                                                              │
│  src/components/PolicyMode.js                               │
│  ✅ import { API_BASE_URL } from '../api';                  │
│                                                              │
│  src/components/BudgetMode.js                               │
│  ✅ import { API_BASE_URL } from '../api';                  │
│                                                              │
│  src/components/ActivationInfoPage.js                       │
│  ✅ import { API_BASE_URL } from '../api';                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                         │
├─────────────────────────────────────────────────────────────┤
│  server/corsConfigManager.js                                │
│  ✅ ALLOWED_ORIGINS 환경 변수에서 동적 로드                 │
│  ✅ 실제 배포 URL 포함:                                     │
│     - vipmobile-backend.cloudtype.app                       │
│     - port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app │
│     - vipmobile.vercel.app                                  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. API Configuration Module (`src/api.js`)

**역할**: 단일 진실 공급원(Single Source of Truth)으로 모든 API URL 관리

**현재 구현** (이미 올바름):
```javascript
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app';
```

**인터페이스**:
- `API_BASE_URL`: string - 백엔드 API의 기본 URL
- 환경 변수 `REACT_APP_API_URL`이 설정되면 우선 사용
- 설정되지 않으면 기본값 사용

### 2. Policy Service Module (`src/utils/policyService.js`)

**현재 문제**:
```javascript
const API_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app';
```

**개선 방안**:
```javascript
import { API_BASE_URL } from '../api';
// API_URL 변수 제거, API_BASE_URL 직접 사용
```

**변경 사항**:
- 1번째 줄: 하드코딩된 URL 제거
- 모든 `API_URL` 참조를 `API_BASE_URL`로 변경

### 3. Policy Mode Component (`src/components/PolicyMode.js`)

**현재 문제** (3곳에서 하드코딩):
1. Line 391: `handleNoticeSave` 함수 내부
2. Line 444: `handleNoticeDelete` 함수 내부
3. Line 768: `handleDeleteClick` 함수 내부

**개선 방안**:
```javascript
import { API_BASE_URL } from '../api';
// 함수 내부의 하드코딩된 URL 선언 제거
// API_BASE_URL 직접 사용
```

### 4. Budget Mode Component (`src/components/BudgetMode.js`)

**현재 문제** (1곳에서 하드코딩):
- Line 605: `handleRecalculateAll` 함수 내부

**개선 방안**:
```javascript
import { API_BASE_URL } from '../api';
// 함수 내부의 하드코딩된 URL 선언 제거
```

### 5. Activation Info Page Component (`src/components/ActivationInfoPage.js`)

**현재 문제** (1곳에서 하드코딩):
- Line 87: `loadEditData` 함수 내부

**개선 방안**:
```javascript
import { API_BASE_URL } from '../api';
// 함수 내부의 하드코딩된 URL 선언 제거
```

### 6. Android App Configuration (`android-app/app/src/main/java/com/vipplus/manager/MainActivity.kt`)

**현재 문제**:
```kotlin
val defaultUrl = "https://vipmobile-backend.cloudtype.app"
```

**개선 방안**:
```kotlin
// BuildConfig를 통한 중앙화된 설정
val defaultUrl = BuildConfig.API_BASE_URL
```

**build.gradle 설정**:
```gradle
android {
    defaultConfig {
        buildConfigField "String", "API_BASE_URL", "\"https://vipmobile-backend.cloudtype.app\""
    }
    buildTypes {
        debug {
            buildConfigField "String", "API_BASE_URL", "\"http://localhost:4000\""
        }
        release {
            buildConfigField "String", "API_BASE_URL", "\"https://vipmobile-backend.cloudtype.app\""
        }
    }
}
```

### 7. CORS Configuration (`server/corsConfigManager.js`)

**현재 상태**: 이미 환경 변수 기반으로 동적 로드 구현됨

**필요한 작업**: 환경 변수에 실제 배포 URL 추가

**환경 변수 설정 예시**:
```bash
ALLOWED_ORIGINS=https://vipmobile.vercel.app,https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app,https://vipmobile-backend.cloudtype.app,http://localhost:3000
```

## Data Models

### Configuration Data Model

```typescript
interface APIConfiguration {
  baseURL: string;           // 기본 API URL
  source: 'env' | 'default'; // 설정 출처
  isValid: boolean;          // URL 유효성
}

interface CORSConfiguration {
  allowedOrigins: string[];  // 허용된 오리진 목록
  source: 'env' | 'default'; // 설정 출처
}
```

### Environment Variables

**Frontend (.env)**:
```bash
REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app
```

**Backend (server/.env)**:
```bash
ALLOWED_ORIGINS=https://vipmobile.vercel.app,https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app,https://vipmobile-backend.cloudtype.app,http://localhost:3000
```

**Android (local.properties)**:
```properties
api.base.url=https://vipmobile-backend.cloudtype.app
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Single Source Import Consistency
*For any* frontend file that makes API requests, importing `API_BASE_URL` from `src/api.js` should result in the same URL value across all files at runtime.
**Validates: Requirements 1.1, 1.2**

### Property 2: No Hardcoded URLs
*For any* search of the codebase for the pattern `vipmobile-backend.cloudtype.app`, the only occurrence should be in `src/api.js` as a default fallback value (excluding comments and documentation).
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 3: Environment Variable Override
*For any* deployment environment where `REACT_APP_API_URL` is set, the application should use that value instead of the hardcoded default.
**Validates: Requirements 1.4, 4.1, 4.2**

### Property 4: CORS Origin Matching
*For any* HTTP request from the frontend to the backend, if the request origin is in the `ALLOWED_ORIGINS` list, the backend should allow the request (no CORS error).
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Configuration Validation
*For any* API URL value (from environment or default), if it is not a valid HTTP/HTTPS URL, the system should log a warning at startup.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 6: Android Build Variant Configuration
*For any* Android build variant (debug/release), the API URL should match the configured value for that variant without requiring code changes.
**Validates: Requirements 6.1, 6.2, 6.3**

## Error Handling

### 1. Invalid API URL

**시나리오**: 환경 변수에 잘못된 URL 형식이 설정됨

**처리 방법**:
```javascript
// src/api.js
const validateURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const envURL = process.env.REACT_APP_API_URL;
const defaultURL = 'https://vipmobile-backend.cloudtype.app';

if (envURL && !validateURL(envURL)) {
  console.warn(`⚠️ Invalid REACT_APP_API_URL: ${envURL}. Using default: ${defaultURL}`);
}

export const API_BASE_URL = (envURL && validateURL(envURL)) ? envURL : defaultURL;
```

### 2. Missing Environment Variable

**시나리오**: 환경 변수가 설정되지 않음

**처리 방법**:
- 기본값 사용
- 시작 시 로그 출력
```javascript
if (!process.env.REACT_APP_API_URL) {
  console.log(`ℹ️ REACT_APP_API_URL not set. Using default: ${defaultURL}`);
}
```

### 3. CORS Error

**시나리오**: 프론트엔드 배포 URL이 CORS 설정에 없음

**처리 방법**:
- 백엔드 로그에 요청 오리진 기록 (이미 구현됨)
- 환경 변수에 오리진 추가
- 서버 재시작

**로그 예시** (이미 구현됨):
```javascript
console.warn(`❌ [CORS] 허용되지 않은 오리진:`, {
  요청오리진: origin,
  허용된오리진목록: config.allowedOrigins,
  실패이유: validation.reason
});
```

### 4. Android Configuration Error

**시나리오**: BuildConfig 생성 실패

**처리 방법**:
```kotlin
val defaultUrl = try {
    BuildConfig.API_BASE_URL
} catch (e: Exception) {
    Log.e("MainActivity", "Failed to load API_BASE_URL from BuildConfig", e)
    "https://vipmobile-backend.cloudtype.app"
}
```

## Testing Strategy

### Unit Tests

**Frontend Unit Tests** (`src/api.test.js`):
```javascript
describe('API Configuration', () => {
  test('should export API_BASE_URL', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe('string');
  });
  
  test('should use environment variable when set', () => {
    process.env.REACT_APP_API_URL = 'https://test.example.com';
    // Re-import to get new value
    jest.resetModules();
    const { API_BASE_URL } = require('./api');
    expect(API_BASE_URL).toBe('https://test.example.com');
  });
  
  test('should use default when environment variable not set', () => {
    delete process.env.REACT_APP_API_URL;
    jest.resetModules();
    const { API_BASE_URL } = require('./api');
    expect(API_BASE_URL).toBe('https://vipmobile-backend.cloudtype.app');
  });
});
```

**Import Verification Tests**:
```javascript
describe('API URL Import Consistency', () => {
  test('PolicyService should import from api.js', () => {
    const policyServiceCode = fs.readFileSync('src/utils/policyService.js', 'utf8');
    expect(policyServiceCode).toContain("import { API_BASE_URL } from '../api'");
    expect(policyServiceCode).not.toContain('vipmobile-backend.cloudtype.app');
  });
  
  test('PolicyMode should import from api.js', () => {
    const policyModeCode = fs.readFileSync('src/components/PolicyMode.js', 'utf8');
    expect(policyModeCode).toContain("import { API_BASE_URL } from '../api'");
  });
  
  // Similar tests for other components...
});
```

**CORS Configuration Tests** (이미 존재):
- `server/__tests__/cors.test.js`: CORS 미들웨어 단위 테스트
- `server/__tests__/cors-properties.test.js`: Property-based 테스트

### Integration Tests

**End-to-End CORS Test**:
```javascript
describe('CORS Integration', () => {
  test('should allow requests from configured origins', async () => {
    const response = await fetch(`${API_BASE_URL}/api/test`, {
      method: 'GET',
      headers: {
        'Origin': 'https://vipmobile.vercel.app'
      }
    });
    
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://vipmobile.vercel.app');
    expect(response.ok).toBe(true);
  });
});
```

### Manual Testing Checklist

1. **Frontend 로컬 개발**:
   - [ ] `npm start` 실행
   - [ ] API 요청이 정상 작동하는지 확인
   - [ ] 브라우저 콘솔에 CORS 오류가 없는지 확인

2. **Frontend Vercel 배포**:
   - [ ] Vercel에 배포
   - [ ] 배포된 URL에서 API 요청 테스트
   - [ ] CORS 오류 확인

3. **Backend Cloudtype 배포**:
   - [ ] 환경 변수 `ALLOWED_ORIGINS` 설정
   - [ ] 서버 재시작
   - [ ] 로그에서 CORS 설정 확인

4. **Android 앱**:
   - [ ] Debug 빌드에서 API 요청 테스트
   - [ ] Release 빌드에서 API 요청 테스트
   - [ ] 로그에서 사용된 API URL 확인

### Property-Based Tests

**Property 1 Test**:
```javascript
// Property: Single Source Import Consistency
test('all files should use same API_BASE_URL at runtime', () => {
  const apiModule = require('./api');
  const policyService = require('./utils/policyService');
  const policyMode = require('./components/PolicyMode');
  
  // All should reference the same value
  expect(policyService.API_BASE_URL).toBe(apiModule.API_BASE_URL);
  expect(policyMode.API_BASE_URL).toBe(apiModule.API_BASE_URL);
});
```

**Property 2 Test**:
```javascript
// Property: No Hardcoded URLs
test('no hardcoded API URLs outside api.js', () => {
  const filesToCheck = [
    'src/utils/policyService.js',
    'src/components/PolicyMode.js',
    'src/components/BudgetMode.js',
    'src/components/ActivationInfoPage.js'
  ];
  
  filesToCheck.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.match(/vipmobile-backend\.cloudtype\.app/g) || [];
    expect(matches.length).toBe(0);
  });
});
```

## Implementation Notes

### Migration Strategy

**Phase 1: Frontend Refactoring**
1. `src/utils/policyService.js` 수정
2. `src/components/PolicyMode.js` 수정
3. `src/components/BudgetMode.js` 수정
4. `src/components/ActivationInfoPage.js` 수정
5. 각 파일 수정 후 로컬 테스트

**Phase 2: Backend CORS Configuration**
1. Cloudtype 환경 변수에 `ALLOWED_ORIGINS` 추가
2. 실제 배포 URL 포함
3. 서버 재시작 및 로그 확인

**Phase 3: Android Configuration**
1. `build.gradle` 수정
2. `MainActivity.kt` 수정
3. Debug/Release 빌드 테스트

**Phase 4: Documentation**
1. 환경 변수 설정 문서 작성
2. 배포 가이드 업데이트
3. 개발자 온보딩 문서 업데이트

### Rollback Plan

각 Phase는 독립적으로 롤백 가능:
- **Frontend**: Git revert로 이전 커밋으로 복구
- **Backend**: 환경 변수 제거 또는 이전 값으로 복구
- **Android**: 이전 빌드 배포

### Performance Considerations

- **캐싱**: CORS 검증 결과는 이미 캐싱됨 (1시간 TTL)
- **번들 크기**: import 추가로 인한 번들 크기 증가 없음 (이미 api.js 사용 중)
- **런타임 성능**: 영향 없음 (컴파일 타임에 해결됨)
