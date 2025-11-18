# 실제 구현 상태 및 동작 흐름

## ⚠️ 현재 상황

### 문제점 발견

**통합 캡처 로직(`unifiedCapture`)이 실제로는 fallback으로만 사용되고 있습니다.**

현재 코드 흐름 (5270-5293번 라인):

```javascript
// 통합 캡처 로직 사용
let blob = null;

// 기존 composite blob이 있으면 우선 사용
if (monthlyAwardCompositeBlob || subscriberIncreaseCompositeBlob || inventoryCompositeBlob || compositeBlob) {
  blob = monthlyAwardCompositeBlob || subscriberIncreaseCompositeBlob || inventoryCompositeBlob || compositeBlob;
} else {
  // 통합 캡처 로직으로 시도
  try {
    const unifiedBlob = await unifiedCapture(slideElement, currentSlide, captureTargetElement);
    if (unifiedBlob) {
      blob = unifiedBlob;
    } else {
      // 통합 로직 실패 시 기본 캡처 사용
      blob = await captureElement(captureTargetElement, captureOptions);
    }
  } catch (e) {
    // 통합 로직 실패 시 기본 캡처 사용
    blob = await captureElement(captureTargetElement, captureOptions);
  }
}
```

### 실제 동작 흐름

1. **월간시상 슬라이드** (2639-2956번 라인)
   - 기존 로직으로 `monthlyAwardCompositeBlob` 생성
   - 통합 로직은 사용되지 않음 ❌

2. **가입자증감 슬라이드** (2960-3665번 라인)
   - 기존 로직으로 `subscriberIncreaseCompositeBlob` 생성
   - 통합 로직은 사용되지 않음 ❌

3. **재고장표 슬라이드** (1357-1976번 라인)
   - 기존 로직으로 `inventoryCompositeBlob` 생성
   - 통합 로직은 사용되지 않음 ❌

4. **전체총마감 슬라이드** (274-603번 라인)
   - 기존 로직으로 처리
   - 통합 로직은 사용되지 않음 ❌

5. **재초담초채권 슬라이드** (1972-2314번 라인)
   - 기존 로직으로 처리
   - 통합 로직은 사용되지 않음 ❌

6. **기본 슬라이드 (main, toc, ending)**
   - 기존 로직으로 처리 (4366-4599번 라인)
   - 통합 로직은 사용되지 않음 ❌

### 결론

**현재는 통합 로직이 거의 사용되지 않고, 기존 로직이 계속 실행되고 있습니다.**

## 해결 방안

### 옵션 1: 기존 로직 제거하고 통합 로직만 사용 (권장)

장점:
- 코드 중복 제거
- 일관된 처리
- 유지보수 용이

단점:
- 기존 로직이 잘 작동하는 경우 문제 발생 가능
- 테스트 필요

### 옵션 2: 통합 로직을 우선 사용하고 기존 로직을 fallback으로

장점:
- 안전한 전환
- 기존 로직이 백업 역할

단점:
- 코드 중복 유지
- 복잡도 증가

### 옵션 3: 점진적 마이그레이션

각 슬라이드 타입별로:
1. 통합 로직으로 먼저 시도
2. 실패 시 기존 로직 사용
3. 통합 로직이 안정화되면 기존 로직 제거

## 현재 실제로 작동하는 로직

### 월간시상
- 기존 로직: 2639-2956번 라인
- 확대 버튼 클릭 → 5개 테이블 찾기 → commonAncestor 찾기 → 캡처

### 가입자증감
- 기존 로직: 2960-3665번 라인
- 데이터 로딩 대기 → commonAncestor 찾기 → 박스 크기 조정 → 캡처

### 재고장표
- 기존 로직: 1357-1976번 라인
- 로딩 대기 → 펼치기 → 헤더 찾기 → 테이블 캡처 → 합성

### 전체총마감
- 기존 로직: 274-603번 라인
- 데이터 로딩 대기 → 모든 섹션 펼치기 → 박스 크기 조정 → 캡처

### 재초담초채권
- 기존 로직: 1972-2314번 라인
- 박스 크기 조정 → 헤더 크기 조정 → 오른쪽 여백 제거 → 캡처

### 기본 슬라이드
- 기존 로직: 4366-4599번 라인
- 스크롤 제약 제거 → 너비 조정 (1280px) → 캡처

## 권장 사항

1. **통합 로직을 우선 사용하도록 변경**
2. **기존 로직을 주석 처리하거나 제거**
3. **각 슬라이드 타입별로 테스트 후 배포**

## 다음 단계

사용자에게 다음 중 선택 요청:
1. 통합 로직을 우선 사용하도록 변경
2. 기존 로직 유지하고 통합 로직은 보조로 사용
3. 현재 상태 유지 (기존 로직 우선)


