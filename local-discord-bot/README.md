# 로컬 PC 디스코드 스크린샷 봇

Google Sheets를 스크린샷으로 캡처하여 디스코드에 업로드하는 디스코드 봇입니다.

## 설치

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 값을 설정하세요:

```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
DISCORD_BOT_TOKEN_LOCAL=your_local_bot_token_here
DISCORD_CHANNEL_ID=your_channel_id_here  # 선택사항
```

### 3. 디스코드 봇 토큰 발급

#### ⚠️ 중요: 클라우드 서버 봇과 별도의 새 봇을 생성해야 합니다!

1. **Discord Developer Portal 접속**
   - https://discord.com/developers/applications 접속
   - 로그인 (Discord 계정 필요)

2. **새 애플리케이션 생성**
   - 우측 상단 "New Application" 클릭
   - 애플리케이션 이름 입력 (예: "로컬 스크린샷 봇")
   - "Create" 클릭

3. **봇 생성**
   - 왼쪽 메뉴에서 "Bot" 클릭
   - "Add Bot" 또는 "Reset Token" 클릭
   - "Yes, do it!" 확인

4. **토큰 복사**
   - "Reset Token" 또는 "Copy" 버튼 클릭
   - ⚠️ **이 토큰은 한 번만 표시됩니다!** 복사해서 안전한 곳에 보관하세요.
   - 토큰은 긴 문자열로 구성되어 있으며, `.`으로 구분된 3부분으로 이루어져 있습니다.

5. **봇 권한 설정**
   - 왼쪽 메뉴에서 "OAuth2" > "URL Generator" 클릭
   - "Scopes"에서 `bot` 체크
   - "Bot Permissions"에서 다음 권한 체크:
     - ✅ Read Messages/View Channels
     - ✅ Send Messages
     - ✅ Read Message History
     - ✅ Attach Files
   - 하단에 생성된 URL 복사 (예: `https://discord.com/api/oauth2/authorize?client_id=...`)

6. **봇을 서버에 초대**
   - 위에서 복사한 URL을 브라우저에서 열기
   - 서버 선택 후 "Authorize" 클릭
   - "I'm not a robot" 확인 완료

7. **`.env` 파일에 토큰 설정**
   ```bash
   # .env 파일 편집
   DISCORD_BOT_TOKEN_LOCAL=여기에_복사한_토큰_붙여넣기
   ```
   
   예시:
   ```env
   DISCORD_BOT_TOKEN_LOCAL=여기에_실제_토큰_붙여넣기
   ```

#### 🔐 보안 주의사항

- ⚠️ **토큰은 절대 공개하지 마세요!** (GitHub, 공개 채팅 등)
- ⚠️ **`.env` 파일은 `.gitignore`에 포함되어 있어야 합니다.**
- ⚠️ 토큰이 유출되면 "Reset Token"으로 즉시 재발급하세요.

## 실행

### 일시적 실행 (테스트용)

```bash
npm start
```

### PM2로 백그라운드 실행 (프로덕션 권장)

```bash
# PM2 설치 (전역)
npm install -g pm2

# 봇 시작
npm run pm2:start

# 상태 확인
npm run pm2:status

# 로그 확인
npm run pm2:logs
```

### PC 재부팅 후 자동 실행

```bash
# PM2 시작 스크립트 생성
pm2 startup

# 출력된 명령어를 관리자 권한으로 실행
# Windows 예시: pm2-startup.cmd install

# 현재 실행 중인 앱 저장
pm2 save
```

## 사용법

디스코드 채널에서 다음 명령어를 사용하세요:

```
!screenshot <Google_Sheets_URL> [옵션들]
```

### 예시

```
!screenshot https://docs.google.com/spreadsheets/d/1abc123xyz/edit#gid=0 policyTableName=경수일반 userName=홍길동
```

## 명령어 옵션

- `policyTableName`: 정책표 이름 (로깅용)
- `userName`: 생성자 이름 (로깅용)
- `waitTime`: 페이지 로딩 대기 시간 (ms, 기본값: 3000)
- `viewportWidth`: 브라우저 뷰포트 너비 (기본값: 1920)
- `viewportHeight`: 브라우저 뷰포트 높이 (기본값: 1080)

## 트러블슈팅

### 봇이 응답하지 않을 때

1. 봇이 서버에 초대되었는지 확인
2. 채널 ID가 올바른지 확인
3. 봇에 메시지 보내기 권한이 있는지 확인
4. PM2 상태 확인: `pm2 status`

### 스크린샷이 생성되지 않을 때

1. Chrome이 설치되어 있는지 확인
2. ChromeDriver가 설치되어 있는지 확인 (Selenium이 자동으로 다운로드)
3. Google Sheets URL이 공개 링크인지 확인 (`/pubhtml` 포함)
4. 로그 확인: `pm2 logs discord-screenshot-bot`

## 로그 확인

```bash
# 실시간 로그
pm2 logs discord-screenshot-bot

# 최근 50줄
pm2 logs discord-screenshot-bot --lines 50

# 에러만
pm2 logs discord-screenshot-bot --err
```

