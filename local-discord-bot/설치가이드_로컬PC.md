# 로컬 PC 설치 가이드 (처음부터)

## 1단계: 프로젝트 폴더 준비

### 방법 A: Git 사용 (권장)

```bash
# 1. 프로젝트를 저장할 폴더 생성
mkdir C:\local-discord-bot
cd C:\local-discord-bot

# 2. Git으로 프로젝트 클론
git clone https://github.com/sonigay/vipmobile.git

# 3. 로컬 봇 폴더로 이동
cd vipmobile\local-discord-bot
```

### 방법 B: 수동 복사

1. 현재 작업 중인 폴더(`C:\Users\82103\vipmobile\local-discord-bot`)의 모든 파일을 복사
2. 로컬 PC의 새 폴더에 붙여넣기 (예: `C:\local-discord-bot`)
3. 복사된 폴더로 이동

필요한 파일들:
- `bot.js`
- `screenshot.js`
- `package.json`
- `ecosystem.config.js`
- `.env.example`
- `README.md`

## 2단계: Node.js 설치 확인

```bash
# Node.js 버전 확인 (18 이상 권장)
node --version

# npm 버전 확인
npm --version
```

Node.js가 없으면: https://nodejs.org/ 에서 다운로드

## 3단계: 패키지 설치

```bash
# 현재 폴더: C:\local-discord-bot (또는 vipmobile\local-discord-bot)

# 패키지 설치
npm install
```

## 4단계: Discord 봇 생성 및 토큰 발급

1. **Discord Developer Portal 접속**
   - https://discord.com/developers/applications
   - 로그인

2. **새 애플리케이션 생성**
   - 우측 상단 "New Application" 클릭
   - 이름 입력 (예: "로컬 스크린샷 봇")
   - "Create" 클릭

3. **봇 생성**
   - 왼쪽 메뉴 "Bot" 클릭
   - "Add Bot" 클릭
   - "Yes, do it!" 확인

4. **토큰 복사**
   - "Reset Token" 또는 "Copy" 클릭
   - ⚠️ **토큰은 한 번만 표시됩니다!** 복사해서 안전한 곳에 보관

5. **봇 권한 설정**
   - 왼쪽 메뉴 "OAuth2" > "URL Generator" 클릭
   - "Scopes"에서 `bot` 체크
   - "Bot Permissions"에서 다음 체크:
     - ✅ Read Messages/View Channels
     - ✅ Send Messages
     - ✅ Read Message History
     - ✅ Attach Files
   - 하단 생성된 URL 복사

6. **봇을 서버에 초대**
   - 복사한 URL을 브라우저에서 열기
   - 서버 선택 후 "Authorize" 클릭
   - "I'm not a robot" 확인

## 5단계: 환경변수 설정

```bash
# 1. .env.example을 .env로 복사
copy .env.example .env

# 2. .env 파일 편집
notepad .env
```

`.env` 파일 내용:
```env
# 4단계에서 복사한 토큰을 붙여넣기
DISCORD_BOT_TOKEN_LOCAL=여기에_복사한_토큰_붙여넣기

# 선택사항: 특정 채널에서만 명령어 받으려면 채널 ID 설정
# Discord 개발자 모드 활성화 후 채널 우클릭 > "ID 복사"
DISCORD_CHANNEL_ID=

# Puppeteer 설정 (기본값 사용 가능)
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox --disable-setuid-sandbox
```

## 6단계: 테스트 실행

```bash
# 봇 실행 (테스트용)
npm start
```

정상 동작 시:
```
✅ 디스코드 봇이 준비되었습니다: 로컬 스크린샷 봇#1234
📡 채널 ID: 모든 채널
```

**Ctrl+C**로 종료

## 7단계: PM2로 백그라운드 실행 (권장)

```bash
# 1. PM2 전역 설치 (처음 한 번만)
npm install -g pm2

# 2. 봇 시작
npm run pm2:start

# 3. 상태 확인
npm run pm2:status
# "online" 상태여야 함

# 4. 로그 확인
npm run pm2:logs
```

## 8단계: PC 재부팅 후 자동 실행 설정 (선택)

```bash
# 1. PM2 시작 스크립트 생성
pm2 startup

# 2. 출력된 명령어를 관리자 권한 PowerShell에서 실행
# 예시: pm2-startup.cmd install

# 3. 현재 실행 중인 앱 저장
pm2 save
```

## 9단계: 동작 확인

1. 디스코드 채널에서 테스트 명령어 전송:
   ```
   !screenshot https://docs.google.com/spreadsheets/d/테스트시트ID/edit#gid=0 policyTableName=테스트 userName=테스트사용자
   ```

2. 봇이 응답하는지 확인:
   - "📸 스크린샷 생성 중..." 메시지
   - 이미지 업로드

3. 로그 확인:
   ```bash
   npm run pm2:logs
   ```

## 유용한 명령어

```bash
# 봇 중지
npm run pm2:stop

# 봇 재시작
npm run pm2:restart

# 봇 상태 확인
npm run pm2:status

# 실시간 로그 보기
npm run pm2:logs

# 에러 로그만 보기
pm2 logs discord-screenshot-bot --err
```

## 문제 해결

### 봇이 응답하지 않을 때
1. 봇이 서버에 초대되었는지 확인
2. `.env` 파일의 토큰이 올바른지 확인
3. `npm run pm2:status`로 실행 상태 확인

### 스크린샷이 생성되지 않을 때
1. Chrome이 설치되어 있는지 확인
2. Google Sheets URL이 공개 링크인지 확인
3. `npm run pm2:logs`로 에러 확인


