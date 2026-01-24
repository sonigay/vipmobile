# Cloudtype 환경 변수 설정 가이드

## 작업 개요

이 가이드는 **작업 7.2: Cloudtype 환경 변수 설정**을 완료하기 위한 단계별 지침입니다. Cloudtype 대시보드에서 `ALLOWED_ORIGINS` 환경 변수를 설정하여 CORS 오류를 해결합니다.

## 🎯 목표

백엔드 서버가 다음 프론트엔드 URL들로부터의 요청을 허용하도록 CORS 설정을 업데이트합니다:
- `https://vipmobile.vercel.app` (Vercel 프로덕션 배포)
- `https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app` (실제 Cloudtype 서버 URL)
- `https://vipmobile-backend.cloudtype.app` (Cloudtype 커스텀 도메인)
- `http://localhost:3000` (로컬 개발 환경)

---

## 📋 단계별 설정 방법

### 1단계: Cloudtype 대시보드 접속

1. 브라우저에서 [Cloudtype](https://cloudtype.io/) 접속
2. 로그인
3. VIP Mobile Backend 프로젝트 선택

### 2단계: 환경 변수 설정 페이지로 이동

1. 프로젝트 대시보드에서 **설정** 또는 **환경 변수** 메뉴 클릭
2. 환경 변수 관리 섹션 찾기

### 3단계: ALLOWED_ORIGINS 환경 변수 추가

#### 새 환경 변수 추가

다음 정보를 입력합니다:

**키(Key)**:
```
ALLOWED_ORIGINS
```

**값(Value)** - 다음 내용을 **정확히** 복사하여 붙여넣기:
```
https://vipmobile.vercel.app,https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app,https://vipmobile-backend.cloudtype.app,http://localhost:3000
```

⚠️ **중요 주의사항**:
- 쉼표(`,`) 사이에 **공백이 없어야** 합니다
- 각 URL은 프로토콜(`https://` 또는 `http://`)을 포함해야 합니다
- URL 끝에 슬래시(`/`)가 없어야 합니다
- 정확히 위의 값을 복사하여 사용하세요

#### 환경 변수 저장

1. **저장** 또는 **적용** 버튼 클릭
2. 변경사항이 저장되었는지 확인

### 4단계: 서버 재시작

환경 변수 변경사항을 적용하려면 서버를 재시작해야 합니다:

1. Cloudtype 대시보드에서 **재시작** 또는 **재배포** 버튼 클릭
2. 서버가 재시작될 때까지 대기 (보통 1-2분 소요)
3. 서버 상태가 **실행 중(Running)**으로 변경되는지 확인

### 5단계: 로그 확인

서버가 재시작된 후 로그를 확인하여 CORS 설정이 올바르게 로드되었는지 검증합니다:

1. Cloudtype 대시보드에서 **로그** 또는 **콘솔** 메뉴 클릭
2. 최근 로그에서 다음과 같은 메시지를 찾습니다:

**성공적인 로그 예시**:
```
✅ [CORS] 설정 로드 완료
📋 [CORS] 허용된 오리진 목록:
  - https://vipmobile.vercel.app
  - https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app
  - https://vipmobile-backend.cloudtype.app
  - http://localhost:3000
🔧 [CORS] 설정 출처: environment
```

✅ 위와 같은 로그가 보이면 설정이 성공적으로 완료된 것입니다!

---

## ✅ 검증 방법

### 방법 1: 브라우저에서 테스트

1. 브라우저에서 프론트엔드 애플리케이션 열기:
   - Vercel 배포: `https://vipmobile.vercel.app`
   - 로컬 개발: `http://localhost:3000`

2. 브라우저 개발자 도구 열기 (F12)

3. **Console** 탭에서 CORS 오류가 없는지 확인

4. **Network** 탭에서 API 요청 확인:
   - 요청이 성공적으로 완료되는지 확인 (Status: 200)
   - Response Headers에 `Access-Control-Allow-Origin`이 포함되어 있는지 확인

### 방법 2: curl 명령어로 테스트

터미널에서 다음 명령어를 실행하여 CORS 헤더를 확인합니다:

```bash
curl -H "Origin: https://vipmobile.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     --verbose \
     https://vipmobile-backend.cloudtype.app/api/stores
```

**성공적인 응답 예시**:
```
< HTTP/1.1 204 No Content
< Access-Control-Allow-Origin: https://vipmobile.vercel.app
< Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
< Access-Control-Allow-Credentials: true
```

---

## 🔧 문제 해결

### 문제 1: 환경 변수가 로그에 나타나지 않음

**증상**: 서버 로그에 CORS 설정 메시지가 없거나 기본값을 사용한다고 표시됨

**해결 방법**:
1. 환경 변수 키 이름이 정확히 `ALLOWED_ORIGINS`인지 확인 (대소문자 구분)
2. 환경 변수 값에 불필요한 공백이나 줄바꿈이 없는지 확인
3. 서버를 다시 재시작
4. 여전히 문제가 있으면 Cloudtype 지원팀에 문의

### 문제 2: CORS 오류가 여전히 발생함

**증상**: 브라우저 콘솔에 여전히 CORS 오류 메시지가 표시됨

**해결 방법**:
1. 브라우저 캐시 삭제 (Ctrl+Shift+Delete 또는 Cmd+Shift+Delete)
2. 브라우저를 완전히 종료하고 다시 시작
3. 시크릿/프라이빗 모드에서 테스트
4. 서버 로그에서 실제 요청 오리진을 확인하고 `ALLOWED_ORIGINS`에 포함되어 있는지 확인

### 문제 3: 특정 URL에서만 CORS 오류 발생

**증상**: 일부 URL에서는 작동하지만 다른 URL에서는 CORS 오류 발생

**해결 방법**:
1. 서버 로그에서 거부된 오리진 확인:
   ```
   ❌ [CORS] 허용되지 않은 오리진: {
     요청오리진: 'https://new-url.vercel.app',
     ...
   }
   ```
2. 해당 오리진을 `ALLOWED_ORIGINS`에 추가
3. 서버 재시작

### 문제 4: 환경 변수 값이 너무 길다는 오류

**증상**: Cloudtype에서 환경 변수 값이 너무 길다고 표시됨

**해결 방법**:
1. 불필요한 URL 제거 (예: 더 이상 사용하지 않는 배포 URL)
2. 또는 서버 코드에서 환경 변수를 여러 개로 분리:
   ```bash
   ALLOWED_ORIGINS_1=https://vipmobile.vercel.app,https://port-0-vipmobile-mh7msgrz3167a0bf.sel3.cloudtype.app
   ALLOWED_ORIGINS_2=https://vipmobile-backend.cloudtype.app,http://localhost:3000
   ```
   (이 경우 `server/corsConfigManager.js` 코드 수정 필요)

---

## 📸 스크린샷 가이드 (참고용)

### Cloudtype 환경 변수 설정 화면 예시

```
┌─────────────────────────────────────────────────────────┐
│  환경 변수 관리                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  키(Key)          값(Value)                              │
│  ┌─────────────┐  ┌────────────────────────────────┐   │
│  │ALLOWED_ORIGINS│  │https://vipmobile.vercel.app,...│   │
│  └─────────────┘  └────────────────────────────────┘   │
│                                                          │
│  [+ 환경 변수 추가]                    [저장] [취소]    │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 체크리스트

작업 완료 전에 다음 항목을 확인하세요:

- [ ] Cloudtype 대시보드에 로그인함
- [ ] 환경 변수 `ALLOWED_ORIGINS` 추가함
- [ ] 값에 4개의 URL이 모두 포함되어 있음 (쉼표로 구분, 공백 없음)
- [ ] 환경 변수를 저장함
- [ ] 서버를 재시작함
- [ ] 서버 로그에서 CORS 설정 로드 확인함
- [ ] 브라우저에서 CORS 오류 없이 API 요청이 성공함
- [ ] Vercel 배포 URL에서 테스트 완료
- [ ] 로컬 개발 환경에서 테스트 완료 (선택사항)

---

## 🎉 완료 후 다음 단계

이 작업을 완료한 후:

1. **작업 8 (Checkpoint - Backend CORS 검증)**으로 진행
2. Vercel 배포된 프론트엔드에서 전체 기능 테스트
3. 모든 API 요청이 정상 작동하는지 확인

---

## 📞 도움이 필요하신가요?

문제가 해결되지 않으면 다음 정보를 포함하여 문의하세요:

1. Cloudtype 서버 로그 (최근 50줄)
2. 브라우저 콘솔 오류 메시지
3. 브라우저 Network 탭의 실패한 요청 상세 정보
4. 설정한 환경 변수 값 (스크린샷)

---

**작성일**: 2024-01-XX  
**작업 ID**: 7.2  
**관련 요구사항**: 3.1, 3.2, 3.3
