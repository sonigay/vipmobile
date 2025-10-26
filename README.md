# (주)브이아이피플러스

매장별 재고 현황을 지도에서 확인할 수 있는 웹 애플리케이션입니다.

<!-- Vercel 자동 재배포를 위한 변경사항 -->

## 주요 기능

- 🗺️ **OpenStreetMap 기반 지도**: 무료로 사용 가능한 오픈소스 지도
- 📍 **매장 위치 표시**: 재고 현황에 따른 색상 구분 마커
- 🔍 **재고 검색**: 모델별, 색상별 재고 필터링
- 📊 **반경 검색**: 지정된 반경 내 매장만 표시
- 👤 **매장별 로그인**: 개별 매장 계정으로 로그인
- 👨‍💼 **관리자 모드**: 전체 매장 현황 조회

## 기술 스택

### 프론트엔드
- **React 18** - 사용자 인터페이스
- **Material-UI** - UI 컴포넌트
- **Leaflet** - 지도 라이브러리 (OpenStreetMap)
- **React-Leaflet** - React용 Leaflet 래퍼

### 백엔드
- **Node.js** - 서버 런타임
- **Express** - 웹 프레임워크
- **Google Sheets API** - 데이터 저장소
- **OpenStreetMap Nominatim** - 주소-좌표 변환

## 환경 설정

### API 서버 URL 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# API 서버 URL 설정
REACT_APP_API_URL=your-api-server-url

# 기타 환경변수들
REACT_APP_ENV=production
```

### 개발 환경 설정

로컬 개발 시에는 다음과 같이 설정하세요:

```env
REACT_APP_API_URL=http://localhost:4000
REACT_APP_ENV=development
```

## 설치 및 실행

### 1. 저장소 클론
```bash
git clone [repository-url]
cd jegomap
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경변수 설정
`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Google Sheets API
SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key

# Discord Bot (선택사항)
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id
DISCORD_LOGGING_ENABLED=true

# 서버 설정
PORT=4000
```

### 4. 개발 서버 실행
```bash
# 프론트엔드와 백엔드 동시 실행
npm run both

# 또는 개별 실행
npm run start    # 백엔드만
npm run dev      # 백엔드 (개발 모드)
npm run build    # 프론트엔드 빌드
```

## 주요 변경사항 (v2.0)

### Google Maps → OpenStreetMap 마이그레이션
- **비용 절감**: Google Maps API 비용 완전 제거
- **무료 사용**: OpenStreetMap은 완전 무료
- **성능 향상**: 더 빠른 지도 로딩
- **커스터마이징**: 더 자유로운 지도 스타일링

### 변경된 기능
- ✅ 지도 표시 (OpenStreetMap)
- ✅ 마커 표시 (커스텀 디자인)
- ✅ 반경 원 표시
- ✅ 주소-좌표 변환 (Nominatim API)
- ✅ 팝업 정보 표시

## 데이터 구조

### Google Sheets 시트 구조
1. **폰클재고데이터** - 재고 정보
2. **폰클출고처데이터** - 매장 정보
3. **대리점아이디관리** - 관리자 계정

## 배포

### Netlify 배포
```bash
npm run build
```

빌드된 파일이 `build/` 폴더에 생성됩니다.

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 기여

버그 리포트나 기능 제안은 이슈를 통해 제출해 주세요. 