# 배포 체크리스트

## 배포 전 확인 사항

### 1. 환경 변수 설정

- [ ] `.env` 파일이 존재하는가?
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` 설정됨
- [ ] `GOOGLE_PRIVATE_KEY` 설정됨 (줄바꿈 \n 이스케이프 확인)
- [ ] `SHEET_ID` 설정됨
- [ ] `PORT` 설정됨 (기본값: 4000)
- [ ] `NODE_ENV` 설정됨 (production)
- [ ] Discord 설정 (선택적)
  - [ ] `DISCORD_BOT_TOKEN`
  - [ ] `DISCORD_CHANNEL_ID`
  - [ ] `DISCORD_LOGGING_ENABLED`
- [ ] Kakao Maps API 설정 (선택적)
  - [ ] `KAKAO_API_KEY`
- [ ] CORS 설정 (선택적)
  - [ ] `ALLOWED_ORIGINS`
  - [ ] `CORS_CREDENTIALS`

### 2. 코드 검증

- [x] 서버가 정상적으로 시작되는가?
- [x] 모든 라우트 모듈이 마운트되는가?
- [x] API 엔드포인트가 정상 작동하는가?
  - [x] `GET /health`
  - [x] `GET /api/version`
  - [x] `GET /api/cache-status`
- [ ] 문법 오류가 없는가? (`node -c index.js`)
- [ ] ESLint 검사 통과 (선택적)

### 3. 의존성 확인

- [ ] `package.json`의 모든 의존성이 설치되었는가?
- [ ] `npm install` 실행 완료
- [ ] Node.js 버전 확인 (22.x 이상)

### 4. 백업

- [x] 원본 `index.js` 백업 완료 (`index.js.backup.old`)
- [ ] 데이터베이스 백업 (Google Sheets)
- [ ] 환경 변수 백업

### 5. 모니터링 설정

- [ ] Discord 알림 테스트
- [ ] 헬스체크 엔드포인트 확인
- [ ] 로그 수집 설정
- [ ] 에러 추적 설정

### 6. 성능 확인

- [x] 서버 시작 시간 확인
- [ ] 메모리 사용량 확인
- [ ] API 응답 시간 확인
- [ ] 동시 접속 테스트

## 배포 방법

### 방법 1: PM2 배포 (권장)

```bash
# 1. 서버 디렉토리로 이동
cd server

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일 편집

# 4. PM2로 시작
pm2 start ecosystem.config.js

# 5. 상태 확인
pm2 status

# 6. 로그 확인
pm2 logs

# 7. 자동 시작 설정
pm2 startup
pm2 save
```

### 방법 2: Cloudtype 배포

```bash
# 1. Cloudtype CLI 설치
npm install -g @cloudtype/cli

# 2. 로그인
cloudtype login

# 3. 배포
cloudtype deploy

# 4. 상태 확인
cloudtype status
```

### 방법 3: 직접 실행

```bash
# 1. 서버 디렉토리로 이동
cd server

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일 편집

# 4. 프로덕션 모드로 시작
NODE_ENV=production npm start
```

## 배포 후 확인 사항

### 1. 서버 상태 확인

```bash
# 헬스체크
curl http://your-domain:4000/health

# 버전 확인
curl http://your-domain:4000/api/version

# 캐시 상태 확인
curl http://your-domain:4000/api/cache-status
```

### 2. 로그 확인

```bash
# PM2 로그
pm2 logs

# 또는 직접 로그 파일 확인
tail -f logs/server.log
```

### 3. 모니터링

- [ ] Discord 채널에 시작 알림이 왔는가?
- [ ] 헬스체크가 정상인가?
- [ ] API 응답이 정상인가?
- [ ] 에러 로그가 없는가?

### 4. 기능 테스트

주요 기능을 수동으로 테스트:

- [ ] 로그인 기능
- [ ] 재고 조회
- [ ] 개통정보 조회
- [ ] 예산 계산
- [ ] 캐시 동작

## 롤백 절차

문제 발생 시 즉시 롤백:

### PM2 사용 시

```bash
# 1. 서버 중지
pm2 stop all

# 2. 백업 파일로 복구
cd server
cp index.js.backup.old index.js

# 3. 서버 재시작
pm2 restart all

# 4. 상태 확인
pm2 status
curl http://localhost:4000/health
```

### Cloudtype 사용 시

```bash
# 이전 버전으로 롤백
cloudtype rollback
```

### Git 사용 시

```bash
# 이전 커밋으로 되돌리기
git revert HEAD
git push

# 또는 특정 커밋으로
git reset --hard <commit-hash>
git push -f
```

## 모니터링 지표

배포 후 다음 지표를 모니터링:

### 1. 서버 상태

- **Uptime**: 99.9% 이상 유지
- **메모리 사용량**: 500MB 이하
- **CPU 사용량**: 평균 30% 이하

### 2. API 성능

- **응답 시간**: 평균 200ms 이하
- **에러율**: 1% 이하
- **동시 접속**: 100+ 지원

### 3. Google Sheets API

- **Rate Limit**: 500ms 간격 유지
- **재시도 횟수**: 평균 1회 이하
- **API 에러**: 0.1% 이하

### 4. 캐시 효율

- **캐시 히트율**: 80% 이상
- **캐시 크기**: 200개 이하
- **TTL 만료**: 정상 동작

## 긴급 연락처

문제 발생 시 연락:

- **개발팀**: [연락처]
- **시스템 관리자**: [연락처]
- **Discord 채널**: [채널 링크]

## 배포 이력

| 날짜 | 버전 | 변경 사항 | 배포자 |
|------|------|-----------|--------|
| 2025-01-25 | 1.0.1 | 대규모 리팩토링 완료 (43,055줄 → 333줄) | Kiro AI |

## 참고 문서

- `README.md` - 서버 사용 가이드
- `REFACTORING_COMPLETE.md` - 리팩토링 완료 보고서
- `REFACTORING_STATUS.md` - 리팩토링 진행 상황
- `.env.example` - 환경 변수 예시
