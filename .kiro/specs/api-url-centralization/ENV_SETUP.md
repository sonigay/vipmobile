# 환경 변수 설정 가이드

## 개요

이 문서는 VIP Map Application의 API URL 중앙화 시스템에 필요한 환경 변수 설정 방법을 설명합니다. 올바른 환경 변수 설정은 프론트엔드와 백엔드 간의 원활한 통신과 CORS 오류 방지를 위해 필수적입니다.

## 목차

1. [Frontend 환경 변수](#frontend-환경-변수)
2. [Backend 환경 변수](#backend-환경-변수)
3. [배포 환경별 설정](#배포-환경별-설정)
4. [설정 우선순위](#설정-우선순위)
5. [검증 및 디버깅](#검증-및-디버깅)
6. [Android 앱 설정](#android-앱-설정)

---

## Frontend 환경 변수

### REACT_APP_API_URL

**설명**: 백엔드 API 서버의 기본 URL을 지정합니다. 모든 API 요청은 이 URL을 기반으로 수행됩니다.

**타입**: `string` (HTTP/HTTPS URL)

**필수 여부**: 선택 (기본값 사용 가능)

**기본값**: `https://vipmobile-backend.cloudtype.app`

**사용 위치**: `src/api.js`에서 `API_BASE_URL`로 export됨

### 설정 방법

#### 1. 로컬 개발 환경

프로젝트 루트에 `.env` 파일을 생성하거나 수정합니다:

```bash
# .env
REACT_APP_API_URL=http://localhost:4000
```


#### 2. Vercel 배포 환경

Vercel 대시보드에서 환경 변수를 설정합니다:

1. Vercel 프로젝트 설정 페이지로 이동
2. **Settings** → **Environment Variables** 선택
3. 다음 변수 추가:
   - **Name**: `REACT_APP_API_URL`
   - **Value**: `https://vipmobile-backend.cloudtype.app`
   - **Environment**: Production, Preview, Development 모두 선택

또는 `vercel.json`에 환경 변수를 추가할 수 있습니다:

```json
{
  "env": {
    "REACT_APP_API_URL": "https://vipmobile-backend.cloudtype.app"
  }
}
```

#### 3. 빌드 시 환경 변수 설정

빌드 명령어에 직접 환경 변수를 포함할 수 있습니다:

```bash
REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app npm run build
```

### 주의사항

⚠️ **중요**: React 앱에서 환경 변수를 사용하려면 반드시 `REACT_APP_` 접두사가 필요합니다.

⚠️ **보안**: 환경 변수는 빌드 시 번들에 포함되므로, 민감한 정보(API 키, 비밀번호 등)를 포함하지 마세요.

⚠️ **재빌드 필요**: 환경 변수 변경 후에는 반드시 애플리케이션을 재빌드해야 합니다.

---

## Backend 환경 변수

### ALLOWED_ORIGINS

**설명**: CORS(Cross-Origin Resource Sharing) 정책에서 허용할 프론트엔드 오리진(도메인) 목록을 지정합니다.

**타입**: `string` (쉼표로 구분된 URL 목록)

**필수 여부**: 선택 (기본값 사용 가능)


**기본값**: 
```
https://vipmobile.vercel.app
http://localhost:3000
```

**사용 위치**: `server/corsConfigManager.js`에서 CORS 미들웨어 설정에 사용됨

### 설정 방법

#### 1. 로컬 개발 환경

`server/.env` 파일을 생성하거나 수정합니다:

```bash
# server/.env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
```

#### 2. Cloudtype 배포 환경

Cloudtype 대시보드에서 환경 변수를 설정합니다:

1. Cloudtype 프로젝트 설정 페이지로 이동
2. **환경 변수** 섹션 선택
3. 다음 변수 추가:
   - **키**: `ALLOWED_ORIGINS`
   - **값**: `https://vipmobile.vercel.app,https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app,https://vipmobile-backend.cloudtype.app,http://localhost:3000`

#### 3. PM2 Ecosystem 설정

`ecosystem.config.js` 파일에 환경 변수를 추가할 수 있습니다:

```javascript
module.exports = {
  apps: [{
    name: 'vipmobile-backend',
    script: './server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 4000,
      ALLOWED_ORIGINS: 'https://vipmobile.vercel.app,https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app'
    }
  }]
};
```

### 형식 규칙

- 여러 오리진은 **쉼표(,)**로 구분합니다
- 공백 없이 작성합니다
- 각 오리진은 완전한 URL 형식이어야 합니다 (프로토콜 포함)
- 포트 번호가 있는 경우 포함해야 합니다


**올바른 예시**:
```bash
ALLOWED_ORIGINS=https://example.com,http://localhost:3000,https://app.example.com:8080
```

**잘못된 예시**:
```bash
# ❌ 공백 포함
ALLOWED_ORIGINS=https://example.com, http://localhost:3000

# ❌ 프로토콜 누락
ALLOWED_ORIGINS=example.com,localhost:3000

# ❌ 세미콜론 사용
ALLOWED_ORIGINS=https://example.com;http://localhost:3000
```

### 주의사항

⚠️ **CORS 오류 방지**: 프론트엔드가 배포된 모든 도메인을 반드시 포함해야 합니다.

⚠️ **재시작 필요**: 환경 변수 변경 후에는 반드시 서버를 재시작해야 합니다.

⚠️ **보안**: 프로덕션 환경에서는 신뢰할 수 있는 도메인만 포함하세요. `*` (모든 오리진 허용)은 사용하지 마세요.

---

## 배포 환경별 설정

### 1. 로컬 개발 환경 (Development)

**목적**: 로컬에서 프론트엔드와 백엔드를 동시에 개발

**Frontend (.env)**:
```bash
REACT_APP_API_URL=http://localhost:4000
REACT_APP_ENV=development
REACT_APP_LOGGING_ENABLED=true
```

**Backend (server/.env)**:
```bash
PORT=4000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DISCORD_LOGGING_ENABLED=false
```

**실행 방법**:
```bash
# Terminal 1: Backend 실행
cd server
npm run dev

# Terminal 2: Frontend 실행
npm start
```


### 2. 스테이징 환경 (Staging)

**목적**: 프로덕션 배포 전 테스트

**Frontend (Vercel - Preview 환경)**:
```bash
REACT_APP_API_URL=https://staging-vipmobile-backend.cloudtype.app
REACT_APP_ENV=staging
REACT_APP_LOGGING_ENABLED=true
```

**Backend (Cloudtype - Staging 인스턴스)**:
```bash
PORT=4000
ALLOWED_ORIGINS=https://vipmobile-staging.vercel.app,https://staging-vipmobile-backend.cloudtype.app
DISCORD_LOGGING_ENABLED=true
DISCORD_CHANNEL_ID=<staging-channel-id>
```

### 3. 프로덕션 환경 (Production)

**목적**: 실제 사용자에게 서비스 제공

**Frontend (Vercel - Production)**:
```bash
REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app
REACT_APP_ENV=production
REACT_APP_LOGGING_ENABLED=false
```

**Backend (Cloudtype - Production)**:
```bash
PORT=4000
ALLOWED_ORIGINS=https://vipmobile.vercel.app,https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app,https://vipmobile-backend.cloudtype.app
DISCORD_LOGGING_ENABLED=true
DISCORD_CHANNEL_ID=<production-channel-id>
SHEET_ID=<google-sheet-id>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<service-account-email>
GOOGLE_PRIVATE_KEY=<service-account-private-key>
KAKAO_API_KEY=<kakao-api-key>
VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
```

### 4. 하이브리드 환경 (로컬 Frontend + 프로덕션 Backend)

**목적**: 프론트엔드 개발 시 실제 데이터로 테스트

**Frontend (.env)**:
```bash
REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app
REACT_APP_ENV=development
REACT_APP_LOGGING_ENABLED=true
```

**Backend**: 프로덕션 서버의 `ALLOWED_ORIGINS`에 `http://localhost:3000` 추가 필요


⚠️ **주의**: 프로덕션 백엔드에 로컬 오리진을 추가할 때는 보안에 주의하세요. 개발 완료 후 제거하는 것을 권장합니다.

---

## 설정 우선순위

환경 변수가 여러 곳에서 정의될 수 있을 때, 다음 우선순위로 적용됩니다:

### Frontend 우선순위

1. **빌드 시 명령줄 환경 변수** (최우선)
   ```bash
   REACT_APP_API_URL=https://custom.com npm run build
   ```

2. **`.env.local` 파일** (Git에 포함되지 않음, 로컬 개인 설정)
   ```bash
   # .env.local
   REACT_APP_API_URL=http://localhost:4000
   ```

3. **`.env.production` / `.env.development` 파일** (환경별 설정)
   ```bash
   # .env.production
   REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app
   ```

4. **`.env` 파일** (기본 설정)
   ```bash
   # .env
   REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app
   ```

5. **코드 내 기본값** (최후 수단)
   ```javascript
   // src/api.js
   export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app';
   ```

### Backend 우선순위

1. **명령줄 환경 변수** (최우선)
   ```bash
   ALLOWED_ORIGINS=https://example.com node server/index.js
   ```

2. **PM2 Ecosystem 설정**
   ```javascript
   // ecosystem.config.js
   env: { ALLOWED_ORIGINS: '...' }
   ```

3. **`.env` 파일**
   ```bash
   # server/.env
   ALLOWED_ORIGINS=https://example.com
   ```

4. **코드 내 기본값** (최후 수단)
   ```javascript
   // server/corsConfigManager.js
   const defaultOrigins = ['https://vipmobile.vercel.app', 'http://localhost:3000'];
   ```


---

## 검증 및 디버깅

### Frontend 설정 확인

#### 1. 브라우저 콘솔에서 확인

애플리케이션 시작 시 `src/api.js`에서 로그를 출력하도록 임시로 수정:

```javascript
// src/api.js
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://vipmobile-backend.cloudtype.app';

console.log('🔧 API Configuration:', {
  API_BASE_URL,
  source: process.env.REACT_APP_API_URL ? 'environment' : 'default'
});
```

브라우저 개발자 도구 콘솔에서 출력 확인:
```
🔧 API Configuration: {
  API_BASE_URL: "http://localhost:4000",
  source: "environment"
}
```

#### 2. 네트워크 탭에서 확인

1. 브라우저 개발자 도구 열기 (F12)
2. **Network** 탭 선택
3. 애플리케이션에서 API 요청 수행
4. 요청 URL이 올바른 도메인으로 시작하는지 확인

**올바른 예시**:
```
Request URL: http://localhost:4000/api/stores
```

**잘못된 예시** (하드코딩된 URL 사용):
```
Request URL: https://vipmobile-backend.cloudtype.app/api/stores
```

#### 3. 빌드 시 환경 변수 확인

빌드된 파일에 환경 변수가 올바르게 포함되었는지 확인:

```bash
npm run build
grep -r "REACT_APP_API_URL" build/
```

### Backend 설정 확인

#### 1. 서버 시작 로그 확인

서버 시작 시 CORS 설정이 로그에 출력됩니다:

```bash
cd server
npm start
```

**출력 예시**:
```
✅ [CORS] 설정 로드 완료
📋 [CORS] 허용된 오리진 목록:
  - https://vipmobile.vercel.app
  - https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app
  - http://localhost:3000
🔧 [CORS] 설정 출처: environment
```


#### 2. CORS 오류 디버깅

CORS 오류가 발생하면 서버 로그에 상세 정보가 출력됩니다:

```
❌ [CORS] 허용되지 않은 오리진: {
  요청오리진: 'https://new-deployment.vercel.app',
  허용된오리진목록: [
    'https://vipmobile.vercel.app',
    'http://localhost:3000'
  ],
  실패이유: 'origin_not_in_allowed_list'
}
```

**해결 방법**:
1. `ALLOWED_ORIGINS` 환경 변수에 새 오리진 추가
2. 서버 재시작

#### 3. 환경 변수 로드 확인

서버에서 환경 변수가 올바르게 로드되었는지 확인:

```javascript
// server/index.js 또는 corsConfigManager.js에 임시 로그 추가
console.log('Environment Variables:', {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  PORT: process.env.PORT
});
```

### 일반적인 문제 해결

#### 문제 1: CORS 오류 발생

**증상**:
```
Access to fetch at 'https://vipmobile-backend.cloudtype.app/api/stores' 
from origin 'https://vipmobile.vercel.app' has been blocked by CORS policy
```

**원인**: 백엔드 `ALLOWED_ORIGINS`에 프론트엔드 도메인이 없음

**해결**:
```bash
# server/.env 또는 Cloudtype 환경 변수에 추가
ALLOWED_ORIGINS=https://vipmobile.vercel.app,https://vipmobile-backend.cloudtype.app,http://localhost:3000
```

#### 문제 2: 환경 변수가 적용되지 않음

**증상**: `.env` 파일을 수정했지만 여전히 기본값 사용

**원인**: 
- Frontend: 재빌드하지 않음
- Backend: 서버를 재시작하지 않음

**해결**:
```bash
# Frontend
npm run build  # 또는 npm start 재실행

# Backend
npm restart  # 또는 PM2: pm2 restart vipmobile-backend
```


#### 문제 3: 잘못된 URL 형식

**증상**: API 요청이 실패하거나 이상한 URL로 요청됨

**원인**: 환경 변수에 잘못된 URL 형식 입력

**잘못된 예시**:
```bash
# ❌ 프로토콜 누락
REACT_APP_API_URL=vipmobile-backend.cloudtype.app

# ❌ 후행 슬래시 포함
REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app/

# ❌ 경로 포함
REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app/api
```

**올바른 예시**:
```bash
# ✅ 프로토콜 포함, 후행 슬래시 없음, 경로 없음
REACT_APP_API_URL=https://vipmobile-backend.cloudtype.app
```

#### 문제 4: 로컬 개발 시 연결 실패

**증상**: `localhost:4000`으로 요청했지만 연결 거부됨

**원인**: 백엔드 서버가 실행되지 않음

**해결**:
```bash
# 백엔드 서버 실행 확인
cd server
npm run dev

# 또는 포트 사용 확인
lsof -i :4000  # macOS/Linux
netstat -ano | findstr :4000  # Windows
```

---

## Android 앱 설정

### BuildConfig를 통한 API URL 설정

Android 앱은 `BuildConfig`를 사용하여 빌드 타입별로 다른 API URL을 설정할 수 있습니다.

#### 1. build.gradle 설정

`android-app/app/build.gradle` 파일에 다음 설정을 추가합니다:

```gradle
android {
    defaultConfig {
        applicationId "com.vipplus.manager"
        // ... 기타 설정
        
        // 기본 API URL
        buildConfigField "String", "API_BASE_URL", "\"https://vipmobile-backend.cloudtype.app\""
    }
    
    buildTypes {
        debug {
            // 개발 환경용 로컬 서버
            buildConfigField "String", "API_BASE_URL", "\"http://10.0.2.2:4000\""
            // 주의: 10.0.2.2는 Android 에뮬레이터에서 호스트 머신의 localhost를 가리킴
            // 실제 기기에서는 컴퓨터의 로컬 IP 주소 사용 (예: "http://192.168.0.10:4000")
        }
        
        release {
            // 프로덕션 환경
            buildConfigField "String", "API_BASE_URL", "\"https://vipmobile-backend.cloudtype.app\""
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```


#### 2. MainActivity.kt에서 사용

`android-app/app/src/main/java/com/vipplus/manager/MainActivity.kt` 파일에서 BuildConfig 사용:

```kotlin
package com.vipplus.manager

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    
    // BuildConfig에서 API URL 가져오기
    private val apiBaseUrl: String = BuildConfig.API_BASE_URL
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 디버그 로그로 확인
        Log.d("MainActivity", "API Base URL: $apiBaseUrl")
        
        // API 클라이언트 초기화
        ApiClient.initialize(apiBaseUrl)
    }
}
```

#### 3. ApiClient.kt 수정

`android-app/app/src/main/java/com/vipplus/manager/ApiClient.kt`:

```kotlin
package com.vipplus.manager

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiClient {
    private var baseUrl: String = BuildConfig.API_BASE_URL
    private var retrofit: Retrofit? = null
    
    fun initialize(url: String) {
        baseUrl = url
        retrofit = null // 재초기화를 위해 null로 설정
    }
    
    fun getClient(): Retrofit {
        if (retrofit == null) {
            retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .addConverterFactory(GsonConverterFactory.create())
                .client(OkHttpClient.Builder().build())
                .build()
        }
        return retrofit!!
    }
}
```

### 로컬 개발 시 주의사항

#### Android 에뮬레이터

에뮬레이터에서 호스트 머신의 localhost에 접근하려면:
- `10.0.2.2`를 사용 (localhost:4000 → 10.0.2.2:4000)

```gradle
debug {
    buildConfigField "String", "API_BASE_URL", "\"http://10.0.2.2:4000\""
}
```

#### 실제 Android 기기

실제 기기에서 테스트할 때는 컴퓨터의 로컬 네트워크 IP 주소를 사용:

1. 컴퓨터의 IP 주소 확인:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. build.gradle에 IP 주소 설정:
   ```gradle
   debug {
       buildConfigField "String", "API_BASE_URL", "\"http://192.168.0.10:4000\""
   }
   ```

3. 방화벽에서 포트 4000 허용 확인


### 빌드 및 배포

#### Debug 빌드 생성

```bash
cd android-app
./gradlew assembleDebug

# APK 위치: app/build/outputs/apk/debug/app-debug.apk
```

#### Release 빌드 생성

```bash
cd android-app
./gradlew assembleRelease

# APK 위치: app/build/outputs/apk/release/app-release.apk
```

#### 빌드 타입 확인

빌드된 APK가 올바른 API URL을 사용하는지 확인:

```kotlin
// 앱 실행 후 로그 확인
Log.d("BuildConfig", "Build Type: ${BuildConfig.BUILD_TYPE}")
Log.d("BuildConfig", "API URL: ${BuildConfig.API_BASE_URL}")
```

---

## 빠른 참조 (Quick Reference)

### Frontend 환경 변수

| 변수명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `REACT_APP_API_URL` | string | 선택 | `https://vipmobile-backend.cloudtype.app` | 백엔드 API 서버 URL |

### Backend 환경 변수

| 변수명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `ALLOWED_ORIGINS` | string | 선택 | `https://vipmobile.vercel.app,http://localhost:3000` | CORS 허용 오리진 (쉼표 구분) |
| `PORT` | number | 선택 | `4000` | 서버 포트 |

### 환경별 설정 요약

| 환경 | Frontend URL | Backend URL | ALLOWED_ORIGINS |
|------|--------------|-------------|-----------------|
| **로컬 개발** | `http://localhost:3000` | `http://localhost:4000` | `http://localhost:3000` |
| **스테이징** | `https://vipmobile-staging.vercel.app` | `https://staging-vipmobile-backend.cloudtype.app` | `https://vipmobile-staging.vercel.app` |
| **프로덕션** | `https://vipmobile.vercel.app` | `https://vipmobile-backend.cloudtype.app` | `https://vipmobile.vercel.app,https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app` |

### 체크리스트

#### 새 환경 배포 시

- [ ] Frontend `.env` 파일 또는 Vercel 환경 변수에 `REACT_APP_API_URL` 설정
- [ ] Backend `.env` 파일 또는 Cloudtype 환경 변수에 `ALLOWED_ORIGINS` 설정
- [ ] Frontend 빌드 및 배포
- [ ] Backend 재시작
- [ ] 브라우저에서 CORS 오류 없이 API 요청 성공 확인
- [ ] 서버 로그에서 CORS 설정 로드 확인


#### CORS 오류 발생 시

- [ ] 브라우저 콘솔에서 요청 오리진 확인
- [ ] 서버 로그에서 CORS 오류 메시지 확인
- [ ] `ALLOWED_ORIGINS`에 요청 오리진 추가
- [ ] 서버 재시작
- [ ] 브라우저 캐시 삭제 후 재시도

#### API URL 변경 시

- [ ] Frontend: `.env` 파일 또는 배포 플랫폼 환경 변수 업데이트
- [ ] Frontend: 애플리케이션 재빌드
- [ ] Backend: `ALLOWED_ORIGINS`에 새 프론트엔드 URL 추가
- [ ] Backend: 서버 재시작
- [ ] 모든 환경에서 API 연결 테스트

---

## 추가 리소스

### 관련 문서

- [API URL 중앙화 요구사항](.kiro/specs/api-url-centralization/requirements.md)
- [API URL 중앙화 설계](.kiro/specs/api-url-centralization/design.md)
- [CORS 설정 가이드](../server/corsConfigManager.js)
- [React 환경 변수 공식 문서](https://create-react-app.dev/docs/adding-custom-environment-variables/)

### 배포 플랫폼 문서

- [Vercel 환경 변수 설정](https://vercel.com/docs/concepts/projects/environment-variables)
- [Cloudtype 환경 변수 설정](https://docs.cloudtype.io/)
- [PM2 Ecosystem 파일](https://pm2.keymetrics.io/docs/usage/application-declaration/)

### 문제 해결

문제가 지속되면 다음을 확인하세요:

1. **서버 로그**: 백엔드 서버의 콘솔 출력 확인
2. **브라우저 콘솔**: 프론트엔드 오류 메시지 확인
3. **네트워크 탭**: 실제 요청 URL과 응답 헤더 확인
4. **환경 변수 로드**: 서버/클라이언트 시작 시 로그 확인

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2024-01-XX | 1.0.0 | 초기 문서 작성 | Kiro AI |

---

**문서 끝**
