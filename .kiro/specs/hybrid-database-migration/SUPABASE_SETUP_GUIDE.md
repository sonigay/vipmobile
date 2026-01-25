# Supabase 가입 및 설정 가이드

## 📋 목차
1. [Supabase 계정 생성](#1-supabase-계정-생성)
2. [프로젝트 생성](#2-프로젝트-생성)
3. [연결 정보 확인](#3-연결-정보-확인)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [라이브러리 설치](#5-라이브러리-설치)
6. [연결 테스트](#6-연결-테스트)

---

## 1. Supabase 계정 생성

### Step 1-1: Supabase 웹사이트 접속
1. 브라우저에서 https://supabase.com 접속
2. 우측 상단 **"Start your project"** 버튼 클릭

### Step 1-2: 회원가입 방법 선택
다음 중 하나를 선택하세요:

**옵션 A: GitHub 계정으로 가입 (권장)**
- "Continue with GitHub" 클릭
- GitHub 로그인 후 권한 승인

**옵션 B: 이메일로 가입**
- 이메일 주소 입력
- 비밀번호 설정 (최소 8자 이상)
- "Sign up" 클릭
- 이메일 인증 링크 클릭

### Step 1-3: 가입 완료 확인
- 대시보드 화면이 나타나면 가입 완료!
- "Welcome to Supabase" 메시지 확인

---

## 2. 프로젝트 생성

### Step 2-1: 새 프로젝트 시작
1. 대시보드에서 **"New Project"** 버튼 클릭
2. Organization 선택 (처음이면 자동 생성됨)

### Step 2-2: 프로젝트 정보 입력

```
┌─────────────────────────────────────────┐
│ Project Name                            │
│ ┌─────────────────────────────────────┐ │
│ │ vip-map-production                  │ │ ← 원하는 이름 입력
│ └─────────────────────────────────────┘ │
│                                         │
│ Database Password                       │
│ ┌─────────────────────────────────────┐ │
│ │ ●●●●●●●●●●●●●●●●                    │ │ ← 강력한 비밀번호
│ └─────────────────────────────────────┘ │
│ [Generate a password] 버튼 클릭 권장    │
│                                         │
│ Region                                  │
│ ┌─────────────────────────────────────┐ │
│ │ Northeast Asia (Seoul) 🇰🇷           │ │ ← 반드시 서울 선택!
│ └─────────────────────────────────────┘ │
│                                         │
│ Pricing Plan                            │
│ ┌─────────────────────────────────────┐ │
│ │ ● Free ($0/month)                   │ │ ← Free 선택
│ │ ○ Pro ($25/month)                   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**중요 사항:**
- **Database Password**: 반드시 안전한 곳에 복사해서 저장하세요!
  - 예: 메모장, 비밀번호 관리 앱 등
  - 나중에 다시 확인할 수 없습니다!
- **Region**: 반드시 "Northeast Asia (Seoul)" 선택
  - 한국 서버로 빠른 속도 보장

### Step 2-3: 프로젝트 생성 대기
1. **"Create new project"** 버튼 클릭
2. 프로젝트 생성 중... (약 2분 소요)
   ```
   Setting up project...
   ████████████░░░░░░░░ 60%
   ```
3. 완료되면 자동으로 프로젝트 대시보드로 이동

---

## 3. 연결 정보 확인

### Step 3-1: API 설정 페이지 접근
1. 좌측 메뉴에서 **⚙️ Settings** (톱니바퀴 아이콘) 클릭
2. **API** 탭 선택

### Step 3-2: 필요한 정보 복사

화면에서 다음 정보를 찾아 복사하세요:

```
┌─────────────────────────────────────────────────────────┐
│ Project API                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Project URL                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ https://abcdefghijk.supabase.co                     │ │ ← 복사!
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ API Keys                                                │
│                                                         │
│ anon public                                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ service_role secret                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...            │ │ ← 복사!
│ └─────────────────────────────────────────────────────┘ │
│ ⚠️ Never expose this key in client-side code           │
└─────────────────────────────────────────────────────────┘
```

**복사할 정보:**
1. **Project URL**: `https://xxxxx.supabase.co` 형식
2. **service_role key**: `eyJhbGc...` 로 시작하는 긴 문자열
   - ⚠️ **service_role** 키를 복사하세요 (anon 키 아님!)
   - 서버에서만 사용하므로 더 많은 권한 보유

### Step 3-3: 정보 임시 저장
메모장에 다음과 같이 저장하세요:

```
=== Supabase 연결 정보 ===
Project URL: https://abcdefghijk.supabase.co
Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Database Password: (프로젝트 생성 시 저장한 비밀번호)
```

---

## 4. 환경 변수 설정

### Step 4-1: .env 파일 열기
1. VS Code에서 `server/.env` 파일 열기
2. 파일 끝에 다음 내용 추가:

```bash
# ==================== Supabase Configuration ====================
# Supabase 프로젝트 URL (Settings > API에서 확인)
SUPABASE_URL=https://abcdefghijk.supabase.co

# Supabase Service Role Key (Settings > API에서 확인)
# ⚠️ 주의: service_role 키를 사용하세요 (anon 키 아님!)
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Feature Flags - 데이터베이스 사용 여부 (true/false)
# 초기에는 모두 false로 설정 (구글 시트 계속 사용)
USE_DB_DIRECT_STORE=false
USE_DB_POLICY=false
USE_DB_CUSTOMER=false
USE_DB_ONSALE=false
USE_DB_BUDGET=false
```

### Step 4-2: 실제 값으로 교체
위에서 복사한 정보로 교체하세요:

**교체 전:**
```bash
SUPABASE_URL=https://abcdefghijk.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**교체 후 (예시):**
```bash
SUPABASE_URL=https://xyzproject123.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5enByb2plY3QxMjMiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzA2MTg0MDAwLCJleHAiOjIwMjE3NjAwMDB9.실제키값이여기에들어갑니다
```

### Step 4-3: 파일 저장
- `Ctrl + S` (Windows) 또는 `Cmd + S` (Mac)으로 저장

---

## 5. 라이브러리 설치

### Step 5-1: 터미널 열기
VS Code에서:
1. 상단 메뉴 **Terminal** > **New Terminal** 클릭
2. 또는 단축키: `Ctrl + `` (백틱)

### Step 5-2: server 폴더로 이동
```bash
cd server
```

### Step 5-3: Supabase 라이브러리 설치
```bash
npm install @supabase/supabase-js
```

설치 진행 화면:
```
npm install @supabase/supabase-js
⠹ reify:@supabase/supabase-js: timing reifyNode:node_modules/@supabase/supabase-js
added 15 packages, and audited 1234 packages in 5s
```

### Step 5-4: 설치 확인
```bash
npm list @supabase/supabase-js
```

출력 예시:
```
server@1.0.0 C:\Users\...\vipmobile\server
└── @supabase/supabase-js@2.39.0
```

---

## 6. 연결 테스트

### Step 6-1: 테스트 파일 생성
다음 파일이 자동으로 생성됩니다:
- `server/supabaseClient.js` - Supabase 클라이언트
- `server/testSupabaseConnection.js` - 연결 테스트 스크립트

### Step 6-2: 연결 테스트 실행
터미널에서 실행:
```bash
node testSupabaseConnection.js
```

### Step 6-3: 결과 확인

**✅ 성공 시:**
```
🔍 Supabase 연결 테스트 시작...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 연결 정보:
  URL: https://xyzproject123.supabase.co
  Key: eyJhbGc... (처음 20자만 표시)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Supabase 연결 성공!
✅ 데이터베이스 접근 가능!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 모든 테스트 통과! Supabase 사용 준비 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**❌ 실패 시:**
```
❌ Supabase 연결 실패!
에러: Invalid API key

해결 방법:
1. .env 파일의 SUPABASE_KEY 확인
2. service_role 키를 사용했는지 확인
3. Supabase 대시보드에서 키 재확인
```

---

## 🎯 다음 단계

연결 테스트가 성공하면:

1. ✅ **Supabase 가입 완료**
2. ✅ **프로젝트 생성 완료**
3. ✅ **연결 설정 완료**
4. ✅ **라이브러리 설치 완료**
5. ✅ **연결 테스트 통과**

이제 다음 작업을 진행할 수 있습니다:
- 데이터베이스 스키마 설계
- 마이그레이션 스크립트 작성
- DAL (Data Access Layer) 구현

---

## ❓ 문제 해결 (Troubleshooting)

### 문제 1: "Invalid API key" 에러
**원인**: 잘못된 API 키 사용

**해결:**
1. Supabase 대시보드 > Settings > API 확인
2. **service_role** 키를 복사했는지 확인 (anon 키 아님!)
3. `.env` 파일에 올바르게 붙여넣었는지 확인
4. 키 앞뒤에 공백이 없는지 확인

### 문제 2: "Connection timeout" 에러
**원인**: 네트워크 연결 문제

**해결:**
1. 인터넷 연결 확인
2. 방화벽 설정 확인
3. VPN 사용 중이면 잠시 끄기

### 문제 3: "Project not found" 에러
**원인**: 잘못된 Project URL

**해결:**
1. Supabase 대시보드에서 Project URL 재확인
2. `.env` 파일의 SUPABASE_URL 수정
3. `https://` 포함 여부 확인

### 문제 4: 환경 변수가 로드되지 않음
**원인**: .env 파일 경로 문제

**해결:**
1. `.env` 파일이 `server/` 폴더에 있는지 확인
2. 파일 이름이 정확히 `.env`인지 확인 (`.env.txt` 아님!)
3. 서버 재시작

---

## 📞 추가 도움이 필요하면

1. Supabase 공식 문서: https://supabase.com/docs
2. Supabase Discord: https://discord.supabase.com
3. 이 가이드의 각 단계 스크린샷이 필요하면 요청하세요!
