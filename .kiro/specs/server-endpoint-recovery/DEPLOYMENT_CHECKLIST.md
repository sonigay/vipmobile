# 배포 체크리스트

## 생성 일시
2025-01-25

---

## 배포 전 체크리스트

### 1. 코드 검증
- [x] 13개 라우터 파일 검증 완료
- [x] 2개 라우터 수정 완료 (authRoutes, teamRoutes)
- [x] 중복 엔드포인트 제거 (2개)
- [x] 에러 처리 표준화
- [x] 캐싱 및 Rate Limiting 적용

### 2. 환경변수 설정
- [ ] `NODE_ENV=production`
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` 설정
- [ ] `GOOGLE_PRIVATE_KEY` 설정 (줄바꿈 `\n` 확인)
- [ ] `SHEET_ID` 설정
- [ ] `PORT` 설정 (기본값: 4000)
- [ ] `ALLOWED_ORIGINS` 프로덕션 도메인 설정
- [ ] `DISCORD_LOGGING_ENABLED` 설정 (선택적)
- [ ] `LOG_LEVEL=info` 또는 `warn`

### 3. 보안 체크
- [x] `.env` 파일이 `.gitignore`에 포함됨
- [ ] 민감한 정보가 코드에 하드코딩되지 않음
- [ ] CORS 설정이 프로덕션 도메인만 허용
- [ ] Rate Limiting 활성화 확인
- [ ] 에러 메시지에 민감한 정보 노출 없음

### 4. 로컬 테스트
- [ ] 서버 시작 성공
- [ ] Health 엔드포인트 정상 응답
- [ ] 로그인 기능 정상 작동
- [ ] 주요 엔드포인트 정상 응답
- [ ] 캐싱 정상 작동
- [ ] 프론트엔드 통합 테스트 통과

### 5. 성능 테스트
- [ ] 응답 시간 < 2초 (첫 요청)
- [ ] 응답 시간 < 100ms (캐시된 요청)
- [ ] 메모리 사용량 < 500MB
- [ ] 동시 요청 처리 정상

### 6. 문서화
- [x] 로컬 설정 가이드 작성
- [x] 에러 처리 가이드 작성
- [x] 캐싱 가이드 작성
- [x] 수동 검증 가이드 작성
- [x] 배포 체크리스트 작성 (이 문서)

---

## 배포 중 체크리스트

### 1. 백업
- [ ] 현재 프로덕션 코드 백업
- [ ] 데이터베이스 백업 (해당 시)
- [ ] 환경변수 백업

### 2. 배포 실행
- [ ] Git에서 최신 코드 pull
- [ ] `npm install` 실행 (의존성 업데이트)
- [ ] 환경변수 설정 확인
- [ ] 서버 재시작

### 3. 배포 로그
- [ ] 배포 시작 시간 기록
- [ ] 배포 버전 기록
- [ ] 배포 담당자 기록
- [ ] 배포 내용 요약

---

## 배포 후 체크리스트

### 1. 즉시 확인 (5분 이내)
- [ ] 서버 정상 시작 확인
- [ ] Health 엔드포인트 응답 확인
  ```bash
  curl https://your-domain.com/health
  ```
- [ ] 콘솔 로그에 에러 없음 확인
- [ ] 모든 라우터 정상 등록 확인

### 2. 기능 테스트 (15분 이내)
- [ ] 로그인 기능 테스트
  - 대리점 관리자 로그인
  - 일반 사용자 로그인
- [ ] 주요 엔드포인트 테스트
  - GET /api/stores
  - GET /api/agents
  - GET /api/teams
- [ ] 프론트엔드 연결 확인
  - 로그인 화면 정상
  - 매장 목록 조회 정상
  - 지도 표시 정상

### 3. 성능 모니터링 (1시간)
- [ ] 응답 시간 모니터링
- [ ] 메모리 사용량 모니터링
- [ ] CPU 사용량 모니터링
- [ ] 에러 로그 모니터링

### 4. 사용자 피드백 (24시간)
- [ ] 사용자 로그인 성공률 확인
- [ ] 주요 기능 사용 현황 확인
- [ ] 에러 리포트 수집
- [ ] 성능 이슈 확인

---

## 롤백 체크리스트

### 롤백 조건
다음 중 하나라도 발생 시 즉시 롤백:
- [ ] 서버 시작 실패
- [ ] 로그인 기능 오작동
- [ ] 주요 엔드포인트 500 에러
- [ ] 응답 시간 > 5초
- [ ] 메모리 사용량 > 1GB
- [ ] 사용자 로그인 실패율 > 10%

### 롤백 절차
1. **즉시 조치**
   - [ ] 이전 버전으로 Git 체크아웃
   - [ ] 서버 재시작
   - [ ] Health 체크 확인

2. **검증**
   - [ ] 로그인 기능 정상 확인
   - [ ] 주요 엔드포인트 정상 확인
   - [ ] 사용자에게 공지

3. **원인 분석**
   - [ ] 에러 로그 분석
   - [ ] 문제 원인 파악
   - [ ] 수정 방안 수립

---

## 환경별 체크리스트

### 개발 환경 (Development)
- [ ] `NODE_ENV=development`
- [ ] `LOG_LEVEL=debug`
- [ ] `DISCORD_LOGGING_ENABLED=false`
- [ ] `ALLOWED_ORIGINS=http://localhost:3000`

### 스테이징 환경 (Staging)
- [ ] `NODE_ENV=staging`
- [ ] `LOG_LEVEL=info`
- [ ] `DISCORD_LOGGING_ENABLED=true`
- [ ] `ALLOWED_ORIGINS=https://staging.yourdomain.com`
- [ ] 프로덕션과 동일한 데이터로 테스트

### 프로덕션 환경 (Production)
- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=warn`
- [ ] `DISCORD_LOGGING_ENABLED=true`
- [ ] `ALLOWED_ORIGINS=https://yourdomain.com`
- [ ] 모든 테스트 통과 확인

---

## 주요 엔드포인트 테스트 스크립트

### Health Check
```bash
curl https://your-domain.com/health
# 예상: {"status":"healthy","timestamp":"...","uptime":...}
```

### Login Test
```bash
curl -X POST https://your-domain.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"storeId":"TEST_ID"}'
# 예상: {"success":true,"isAgent":true,...}
```

### Stores Test
```bash
curl https://your-domain.com/api/stores
# 예상: {"success":true,"stores":[...]}
```

### Agents Test
```bash
curl https://your-domain.com/api/agents
# 예상: {"success":true,"agents":[...]}
```

### Teams Test
```bash
curl https://your-domain.com/api/teams
# 예상: {"success":true,"teams":[...]}
```

---

## 모니터링 설정

### 1. 서버 상태 모니터링
- [ ] Health 엔드포인트 주기적 체크 (1분마다)
- [ ] 응답 시간 모니터링
- [ ] 에러율 모니터링

### 2. 리소스 모니터링
- [ ] CPU 사용률 모니터링
- [ ] 메모리 사용량 모니터링
- [ ] 디스크 사용량 모니터링

### 3. 로그 모니터링
- [ ] 에러 로그 수집
- [ ] Discord 알림 설정 (선택적)
- [ ] 로그 분석 도구 설정

### 4. 알림 설정
- [ ] 서버 다운 시 알림
- [ ] 에러율 임계값 초과 시 알림
- [ ] 응답 시간 임계값 초과 시 알림

---

## 긴급 연락처

### 기술 담당자
- **이름**: [담당자 이름]
- **전화**: [전화번호]
- **이메일**: [이메일]

### 백업 담당자
- **이름**: [백업 담당자 이름]
- **전화**: [전화번호]
- **이메일**: [이메일]

### 에스컬레이션
- **레벨 1**: 기술 담당자 (즉시)
- **레벨 2**: 백업 담당자 (15분 이내)
- **레벨 3**: 팀 리더 (30분 이내)

---

## 배포 기록

### 배포 정보
- **배포 일시**: 2025-01-25
- **배포 버전**: v1.0.0
- **배포 담당자**: [담당자 이름]
- **배포 내용**: 서버 엔드포인트 복구 및 최적화

### 주요 변경 사항
1. 13개 라우터 파일 검증 및 수정
2. authRoutes.js 완전 재작성 (로그인 로직 수정)
3. teamRoutes.js 컬럼 인덱스 수정
4. 중복 엔드포인트 2개 제거
5. 에러 처리 표준화
6. 캐싱 및 Rate Limiting 최적화

### 알려진 이슈
- 없음

### 다음 배포 계획
- 통합 테스트 추가
- 성능 최적화
- 추가 기능 개발

---

## 참고 문서

### 설정 가이드
- `server/LOCAL_SETUP_GUIDE.md` - 로컬 환경 설정
- `server/.env.example` - 환경변수 예시

### 개발 가이드
- `.kiro/specs/server-endpoint-recovery/error-handling-guide.md` - 에러 처리
- `.kiro/specs/server-endpoint-recovery/caching-ratelimit-guide.md` - 캐싱
- `.kiro/specs/server-endpoint-recovery/router-order.md` - 라우터 순서

### 검증 가이드
- `.kiro/specs/server-endpoint-recovery/manual-verification-guide.md` - 수동 검증
- `.kiro/specs/server-endpoint-recovery/integration-test-guide.md` - 통합 테스트

### 요약 문서
- `.kiro/specs/server-endpoint-recovery/COMPLETE_SUMMARY.md` - 전체 작업 요약
- `.kiro/specs/server-endpoint-recovery/VERIFICATION-SUMMARY.md` - 라우터 검증 요약

---

## 최종 승인

### 배포 승인자
- **이름**: [승인자 이름]
- **직책**: [직책]
- **승인 일시**: [일시]
- **서명**: [서명]

### 배포 실행자
- **이름**: [실행자 이름]
- **직책**: [직책]
- **실행 일시**: [일시]
- **서명**: [서명]

---

**배포 완료 후 이 체크리스트를 보관하여 다음 배포 시 참고하세요.**
