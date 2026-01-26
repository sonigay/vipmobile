# Supabase 비활성화 가이드

## 문제 상황
- 개통정보입력 페이지에서 부가서비스가 10개 이상 표시됨
- 휴대폰시세표에서 정렬, 지원금 계산 오류
- 오늘의휴대폰 페이지 데이터 미표시

→ **Supabase 데이터에 문제가 있을 가능성**

## 해결 방법: Google Sheets만 사용하도록 전환

### 1단계: `.env` 파일 수정

`server/.env` 파일을 열고 다음 3개 라인을 찾아서 수정:

**변경 전:**
```env
USE_DB_DIRECT_STORE=true
USE_DB_POLICY=true
USE_DB_CUSTOMER=true
```

**변경 후:**
```env
USE_DB_DIRECT_STORE=false
USE_DB_POLICY=false
USE_DB_CUSTOMER=false
```

### 2단계: 서버 재시작

```bash
# 서버 중지 (Ctrl+C)
# 서버 재시작
cd server
npm start
```

### 3단계: 확인

서버 시작 시 다음 로그가 표시되어야 합니다:

```
[FeatureFlagManager] Initialized with flags: {
  'direct-store': false,
  'policy': false,
  'customer': false,
  'onsale': false,
  'budget': false
}
```

모든 플래그가 `false`로 표시되면 성공입니다!

### 4단계: 테스트

1. **개통정보입력 페이지**
   - 부가서비스가 정상적으로 표시되는지 확인
   - 10개 이상 표시되는 문제 해결 확인

2. **휴대폰시세표 페이지** (LG 통신사)
   - 모델 정렬이 올바른지 확인
   - 이통사지원금이 0이 아닌 정상 값으로 표시되는지 확인
   - 대리점지원금이 0이 아닌 정상 값으로 표시되는지 확인
   - 할부원금 계산이 올바른지 확인

3. **오늘의휴대폰 페이지**
   - 프리미엄/알뜰 모델이 정상적으로 표시되는지 확인

## 정상 작동 확인 후

만약 Google Sheets만 사용했을 때 정상 작동한다면:
→ **Supabase 데이터에 문제가 있는 것**

다음 단계:
1. Supabase 데이터 검증
2. 데이터 마이그레이션 재실행
3. 데이터 정합성 확인

## 참고

- Feature Flag는 런타임에 변경할 수 없습니다 (환경 변수 기반)
- 서버 재시작이 필수입니다
- 변경 후 캐시가 남아있을 수 있으니, 브라우저 새로고침 (Ctrl+F5) 권장

## 롤백 방법

다시 Supabase를 사용하려면:

```env
USE_DB_DIRECT_STORE=true
USE_DB_POLICY=true
USE_DB_CUSTOMER=true
```

로 변경하고 서버 재시작
