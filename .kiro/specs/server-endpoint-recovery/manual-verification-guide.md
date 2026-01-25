# 수동 검증 및 프로덕션 준비 가이드

## 생성 일시
2025-01-25

---

## 개요
서버를 수동으로 검증하고 프로덕션 배포를 준비하는 가이드입니다.

---

## 1. 서버 시작 및 기본 동작 확인

### 1.1 환경변수 확인
```bash
# server/.env 파일 확인
cat server/.env

# 필수 환경변수 확인
# - GOOGLE_SERVICE_ACCOUNT_EMAIL
# - GOOGLE_PRIVATE_KEY
# - SHEET_ID
```

### 1.2 서버 시작
```bash
cd server
npm start
```

### 1.3 예상 출력
```
🚀 [서버] VIP Plus Server 시작 중...
✅ [Phase 1] Health routes mounted
✅ [Phase 2] Auth routes mounted
✅ [Phase 3] Store routes mounted
✅ [Phase 4] Agent routes mounted
✅ [Phase 5] Team routes mounted
...
✅ [서버] 서버가 포트 4000에서 실행 중입니다
```

### 1.4 에러 확인
콘솔에서 다음 에러가 없는지 확인:
- ❌ Missing required environment variables
- ❌ Failed to mount routes
- ❌ EADDRINUSE (포트 충돌)

---

## 2. Health 엔드포인트 테스트

### 2.1 브라우저 테스트
```
http://localhost:4000/health
```

**예상 응답**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-25T12:00:00.000Z",
  "uptime": 123.456
}
```

### 2.2 curl 테스트
```bash
curl http://localhost:4000/health
```

### 2.3 버전 확인
```
http://localhost:4000/api/version
```

**예상 응답**:
```json
{
  "version": "1.0.0",
  "environment": "development"
}
```

---

## 3. 주요 엔드포인트 수동 테스트

### 3.1 로그인 테스트 (대리점 관리자)

#### curl 명령어
```bash
curl -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" \
  -d '{"storeId":"010-1234-5678"}'
```

#### 예상 응답
```json
{
  "success": true,
  "isAgent": true,
  "modePermissions": {
    "inventory": true,
    "settlement": true,
    ...
  },
  "agentInfo": {
    "target": "대리점명",
    "qualification": "정규",
    ...
  }
}
```

#### 실패 케이스
```bash
curl -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" \
  -d '{"storeId":"non-existent"}'
```

**예상 응답**: 404 Not Found

### 3.2 매장 목록 조회

#### curl 명령어
```bash
curl http://localhost:4000/api/stores
```

#### 예상 응답
```json
{
  "success": true,
  "stores": [
    {
      "id": "STORE001",
      "name": "매장1",
      "address": "주소1",
      ...
    }
  ]
}
```

#### 캐싱 확인
```bash
# 첫 번째 요청 (느림)
time curl http://localhost:4000/api/stores

# 두 번째 요청 (빠름 - 캐시 사용)
time curl http://localhost:4000/api/stores
```

### 3.3 대리점 목록 조회
```bash
curl http://localhost:4000/api/agents
```

### 3.4 팀 목록 조회
```bash
curl http://localhost:4000/api/teams
```

### 3.5 팀장 목록 조회
```bash
curl http://localhost:4000/api/team-leaders
```

---

## 4. Postman 테스트 컬렉션

### 4.1 컬렉션 생성
Postman에서 다음 요청들을 컬렉션으로 저장:

#### Health Check
- **GET** `http://localhost:4000/health`
- **GET** `http://localhost:4000/api/version`

#### Authentication
- **POST** `http://localhost:4000/api/login`
  ```json
  {
    "storeId": "010-1234-5678"
  }
  ```

- **POST** `http://localhost:4000/api/verify-password`
  ```json
  {
    "userId": "010-1234-5678",
    "password": "test123"
  }
  ```

#### Core Data
- **GET** `http://localhost:4000/api/stores`
- **GET** `http://localhost:4000/api/agents`
- **GET** `http://localhost:4000/api/teams`
- **GET** `http://localhost:4000/api/team-leaders`
- **GET** `http://localhost:4000/api/models`

#### Sales & Activation
- **GET** `http://localhost:4000/api/sales-data`
- **GET** `http://localhost:4000/api/activation-data/current-month`
- **GET** `http://localhost:4000/api/activation-data/previous-month`

---

## 5. 프론트엔드 통합 테스트

### 5.1 프론트엔드 환경변수 설정
```bash
# 프로젝트 루트/.env
REACT_APP_API_URL=http://localhost:4000
REACT_APP_ENV=development
REACT_APP_LOGGING_ENABLED=true
```

### 5.2 프론트엔드 시작
```bash
# 프로젝트 루트에서
npm start
```

### 5.3 로그인 테스트
1. 브라우저에서 http://localhost:3000 접속
2. 대리점 관리자 ID 입력 (예: 010-1234-5678)
3. 로그인 버튼 클릭
4. 권한에 따른 모드 선택 화면 확인

### 5.4 주요 기능 테스트

#### 재고 모드
- [ ] 지도에 매장 마커 표시
- [ ] 매장 목록 조회
- [ ] 필터링 기능
- [ ] 재고 정보 표시

#### 영업 모드
- [ ] 영업 데이터 조회
- [ ] 날짜별 필터링
- [ ] 차트 표시

#### 정산 모드
- [ ] 정산 데이터 조회
- [ ] 엑셀 다운로드

#### 직영점 모드
- [ ] 고객 대기열 조회
- [ ] 게시판 조회
- [ ] 매장 사진 업로드

---

## 6. 성능 및 안정성 확인

### 6.1 응답 시간 측정
```bash
# 평균 응답 시간 확인
for i in {1..10}; do
  time curl -s http://localhost:4000/api/stores > /dev/null
done
```

**목표**: 첫 요청 < 2초, 캐시된 요청 < 100ms

### 6.2 메모리 사용량 확인
```bash
# 서버 프로세스 메모리 확인 (Windows)
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE

# 또는 Task Manager에서 확인
```

**목표**: < 500MB (정상 범위)

### 6.3 동시 요청 처리
```bash
# 10개 동시 요청
for i in {1..10}; do
  curl http://localhost:4000/api/stores &
done
wait
```

**확인**: 모든 요청이 정상 응답

### 6.4 Discord 로깅 확인 (설정된 경우)
- Discord 채널에서 로그 메시지 확인
- 에러 알림 정상 작동 확인

---

## 7. 에러 시나리오 테스트

### 7.1 잘못된 요청
```bash
# 필수 파라미터 누락
curl -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" \
  -d '{}'
```

**예상**: 400 Bad Request

### 7.2 존재하지 않는 엔드포인트
```bash
curl http://localhost:4000/api/non-existent
```

**예상**: 404 Not Found

### 7.3 서버 에러 시뮬레이션
```bash
# 잘못된 시트 이름으로 요청 (환경변수 임시 변경)
```

**예상**: 500 Internal Server Error

---

## 8. 체크리스트

### 서버 시작
- [ ] 환경변수 설정 완료
- [ ] 서버가 에러 없이 시작됨
- [ ] 모든 라우터가 정상 등록됨
- [ ] 콘솔에 에러 메시지 없음

### Health 엔드포인트
- [ ] GET /health 정상 응답
- [ ] GET / 정상 응답
- [ ] GET /api/version 정상 응답

### Authentication
- [ ] POST /api/login (대리점 관리자) 성공
- [ ] POST /api/login (일반 사용자) 성공
- [ ] POST /api/login (실패 케이스) 404 응답
- [ ] POST /api/verify-password 정상 작동

### Core Data
- [ ] GET /api/stores 정상 응답
- [ ] GET /api/agents 정상 응답
- [ ] GET /api/teams 정상 응답
- [ ] GET /api/team-leaders 정상 응답
- [ ] GET /api/models 정상 응답

### 캐싱
- [ ] 첫 요청 후 캐시 저장 확인
- [ ] 두 번째 요청이 빠름 (캐시 사용)
- [ ] 캐시 TTL 후 재조회 확인

### 프론트엔드 통합
- [ ] 로그인 기능 정상 작동
- [ ] 매장 목록 조회 정상
- [ ] 지도 표시 정상
- [ ] 필터링 기능 정상
- [ ] 모든 모드 접근 가능

### 성능
- [ ] 응답 시간 < 2초 (첫 요청)
- [ ] 응답 시간 < 100ms (캐시된 요청)
- [ ] 메모리 사용량 < 500MB
- [ ] 동시 요청 처리 정상

---

## 9. 문제 해결

### 9.1 서버 시작 실패
**증상**: Missing required environment variables

**해결**:
1. `server/.env` 파일 확인
2. 필수 환경변수 입력
3. 서버 재시작

### 9.2 Google Sheets 연결 실패
**증상**: Google Sheets client not available

**해결**:
1. `GOOGLE_SERVICE_ACCOUNT_EMAIL` 확인
2. `GOOGLE_PRIVATE_KEY` 형식 확인 (줄바꿈 `\n`)
3. `SHEET_ID` 확인

### 9.3 포트 충돌
**증상**: EADDRINUSE: address already in use

**해결**:
```bash
# 포트 사용 중인 프로세스 종료 (Windows)
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# 또는 .env에서 포트 변경
PORT=4001
```

### 9.4 CORS 에러
**증상**: Access-Control-Allow-Origin 에러

**해결**:
```bash
# server/.env
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 9.5 캐시 문제
**증상**: 오래된 데이터 표시

**해결**:
```bash
# 캐시 초기화 엔드포인트 호출
curl -X POST http://localhost:4000/api/cache-refresh
```

---

## 10. 프로덕션 배포 준비

### 10.1 환경변수 확인
- [ ] `NODE_ENV=production`
- [ ] `DISCORD_LOGGING_ENABLED=true` (선택적)
- [ ] `LOG_LEVEL=info` 또는 `warn`

### 10.2 보안 체크
- [ ] `.env` 파일이 `.gitignore`에 포함됨
- [ ] 민감한 정보가 코드에 하드코딩되지 않음
- [ ] CORS 설정이 프로덕션 도메인만 허용

### 10.3 성능 최적화
- [ ] 캐싱 활성화 확인
- [ ] Rate Limiting 활성화 확인
- [ ] 불필요한 로그 제거

### 10.4 모니터링 설정
- [ ] Discord 로깅 설정 (선택적)
- [ ] 에러 알림 설정
- [ ] 서버 상태 모니터링

---

## 11. 배포 체크리스트

### 배포 전
- [ ] 모든 수동 테스트 통과
- [ ] 프론트엔드 통합 테스트 통과
- [ ] 성능 테스트 통과
- [ ] 환경변수 프로덕션 설정 확인
- [ ] 백업 계획 수립

### 배포 중
- [ ] 서버 중단 시간 최소화
- [ ] 배포 로그 기록
- [ ] 롤백 준비

### 배포 후
- [ ] Health 엔드포인트 확인
- [ ] 주요 기능 테스트
- [ ] 에러 로그 모니터링
- [ ] 사용자 피드백 수집

---

## 12. 롤백 계획

### 롤백 조건
- 서버 시작 실패
- 주요 기능 오작동
- 심각한 성능 저하
- 데이터 손실 위험

### 롤백 절차
1. 이전 버전으로 Git 체크아웃
2. 서버 재시작
3. Health 체크 확인
4. 주요 기능 테스트

---

## 참고사항

### 수동 테스트 우선
- 자동화된 테스트보다 수동 테스트가 더 실용적
- 실제 사용 시나리오 기반 테스트
- 프론트엔드 통합 테스트 필수

### 점진적 배포
- 먼저 개발 환경에서 충분히 테스트
- 스테이징 환경에서 최종 검증
- 프로덕션 배포 후 모니터링

### 문서화
- 발견된 이슈 기록
- 해결 방법 문서화
- 다음 배포 시 참고
