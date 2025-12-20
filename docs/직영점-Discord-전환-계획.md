# 직영점 모드 Discord 전환 계획

## 📋 변경 대상 시트

### 1. 직영점_모델이미지
- **기존 컬럼**: 통신사(A) | 모델ID(B) | 모델명(C) | 펫네임(D) | 제조사(E) | 이미지URL(F) | 비고(G) | 색상(H)
- **추가 컬럼**: Discord메시지ID(I) | Discord포스트ID(J) | Discord스레드ID(K)
- **최종 범위**: A:K (기존 A:G → A:K로 변경)

### 2. 직영점_단말마스터
- **기존 컬럼**: 통신사(A) | 모델ID(B) | 모델명(C) | 펫네임(D) | 제조사(E) | 출고가(F) | 기본요금제군(G) | isPremium(H) | isBudget(I) | isPopular(J) | isRecommended(K) | isCheap(L) | 이미지URL(M) | 사용여부(N) | 비고(O)
- **추가 컬럼**: Discord메시지ID(P) | Discord포스트ID(Q) | Discord스레드ID(R)
- **최종 범위**: A:R (기존 A:O → A:R로 변경)

### 3. 직영점_매장사진
- **기존 컬럼**: 업체명(A) | 전면사진URL(B) | 내부사진URL(C) | 외부사진URL(D) | 외부2사진URL(E) | 점장사진URL(F) | 직원1사진URL(G) | 직원2사진URL(H) | 직원3사진URL(I) | 수정일시(J)
- **추가 컬럼**: 각 URL마다 Discord 정보 추가
  - 전면사진Discord메시지ID(K) | 전면사진Discord포스트ID(L) | 전면사진Discord스레드ID(M)
  - 내부사진Discord메시지ID(N) | 내부사진Discord포스트ID(O) | 내부사진Discord스레드ID(P)
  - 외부사진Discord메시지ID(Q) | 외부사진Discord포스트ID(R) | 외부사진Discord스레드ID(S)
  - 외부2사진Discord메시지ID(T) | 외부2사진Discord포스트ID(U) | 외부2사진Discord스레드ID(V)
  - 점장사진Discord메시지ID(W) | 점장사진Discord포스트ID(X) | 점장사진Discord스레드ID(Y)
  - 직원1사진Discord메시지ID(Z) | 직원1사진Discord포스트ID(AA) | 직원1사진Discord스레드ID(AB)
  - 직원2사진Discord메시지ID(AC) | 직원2사진Discord포스트ID(AD) | 직원2사진Discord스레드ID(AE)
  - 직원3사진Discord메시지ID(AF) | 직원3사진Discord포스트ID(AG) | 직원3사진Discord스레드ID(AH)
- **최종 범위**: A:AH (기존 A:J → A:AH로 변경)

## 🔧 구현 계획

### 1. 헤더 정의 추가/수정
- `직영점_모델이미지`: HEADERS_MOBILE_IMAGES 정의 추가
- `직영점_단말마스터`: HEADERS_MOBILE_MASTER에 Discord 컬럼 추가
- `직영점_매장사진`: HEADERS_STORE_PHOTO 정의 추가

### 2. Discord 업로드 함수 생성
- `uploadImageToDiscordForStore`: 직영점 모드용 Discord 이미지 업로드 함수
- Discord 포럼 채널 사용 (DISCORD_STORE_FORUM_CHANNEL_ID: 1445397081333174377)
- 제조사별 포스트/스레드 찾기 또는 생성

### 3. API 엔드포인트 수정
- `/api/direct/upload-image`: Google Drive → Discord로 변경
- `/api/direct/store-image/upload`: Google Drive → Discord로 변경

### 4. 범위 수정
- 모든 시트의 범위를 새로운 컬럼 수에 맞게 수정
