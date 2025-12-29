# Discord 이미지 URL 모니터링 및 데이터재빌드 기능 진단 보고서

**작성일**: 2024년  
**대상 기능**: 
1. Discord 이미지 URL 모니터링 스케줄 기능
2. 데이터재빌드 스케줄 기능

---

## 📋 실행 요약

현재 두 기능 모두 기본적인 스케줄 작동은 구현되어 있으나, **실제 상태 검증 및 에러 처리 부족**으로 인해 사용자가 언급한 문제(만료된 URL이 정상으로 표시됨)가 발생하고 있습니다.

---

## 🔍 1. Discord 이미지 URL 모니터링 기능 진단

### 1.1 현재 구현 상태

**스케줄 설정**:
- 서버 시작 시 10분 후 1회 실행
- 매일 11:30, 17:30 정기 실행

**주요 코드 위치**:
- `server/index.js` (14354-14503줄): `refreshAllDiscordImages()` 함수
- `server/index.js` (6968-7130줄): `/api/discord/image-monitoring` API 엔드포인트
- `src/components/direct/management/DriveMonitoringTab.js`: 프론트엔드 UI

### 1.2 발견된 문제점

#### ❌ **문제 1: 실제 URL 유효성 검증 부재 (Critical)**

**현상**:
- 모니터링 탭에서 모든 이미지가 "정상" 상태로 표시됨
- 실제로 Discord 이미지 URL이 만료되었는지 확인하지 않음

**원인 분석**:
```javascript
// DriveMonitoringTab.js 464-470줄
<TableCell>
  <Chip 
    icon={<CheckCircleIcon />} 
    label="정상" 
    color="success" 
    size="small" 
  />
</TableCell>
```
- 상태가 하드코딩되어 항상 "정상"으로 표시됨
- `/api/discord/image-monitoring` API는 시트 데이터만 읽어서 반환하며, 실제 URL 유효성 검증을 수행하지 않음

**영향**:
- 사용자가 언급한 문제: 만료된 URL도 정상으로 표시됨
- 실제 문제를 발견하기 어려움

#### ❌ **문제 2: 스케줄 갱신 로직의 한계**

**현상**:
- `refreshAllDiscordImages()` 함수는 모든 이미지 URL을 무조건 갱신 시도
- 만료 여부를 확인하지 않고 일괄 갱신

**원인 분석**:
```javascript
// server/index.js 14480-14495줄
const allItems = [
  ...monitoringData.direct.mobileImages.map(item => ({ type: 'mobile-image', ...item })),
  ...monitoringData.direct.masterImages.map(item => ({ type: 'master-image', ...item })),
  ...monitoringData.direct.storePhotos.map(item => ({ type: 'store-photo', ...item }))
];
// 모든 항목을 무조건 갱신 시도
const results = await processBatchRefreshItems(allItems);
```

**영향**:
- 불필요한 API 호출 증가 (Discord Rate Limit 위험)
- 정상 URL도 갱신하여 리소스 낭비

#### ⚠️ **문제 3: 에러 처리 부족**

**현상**:
- 스케줄 실행 중 에러가 발생해도 다음 스케줄은 계속 실행됨
- 에러 로그만 남기고 복구 메커니즘 없음

**원인 분석**:
```javascript
// server/index.js 14500-14502줄
} catch (error) {
  console.error('❌ [스케줄러] Discord 이미지 자동 갱신 오류:', error);
}
```

**영향**:
- 연속 실패 시 문제 파악 어려움
- 알림/모니터링 부재

#### ⚠️ **문제 4: 배치 처리 최적화 부족**

**현상**:
- 배치 크기(5개)와 지연 시간(2초/5초)이 고정값
- 대량 데이터 처리 시 시간이 오래 걸림

**원인 분석**:
```javascript
// server/index.js 7136-7139줄
const BATCH_SIZE = 5;
const ITEM_DELAY_MS = 2000;
const BATCH_DELAY_MS = 5000;
```

**영향**:
- 대량 이미지 처리 시 스케줄 실행 시간 초과 가능성
- 다음 스케줄과 겹칠 수 있음

---

## 🔍 2. 데이터재빌드 기능 진단

### 2.1 현재 구현 상태

**스케줄 설정**:
- 서버 시작 시 5분 후 1회 실행
- 매일 11:10-19:10 매시간 10분에 실행 (총 9회)

**주요 코드 위치**:
- `server/index.js` (14505-14535줄): `rebuildMasterData()` 함수
- `server/directRoutes.js`: `rebuildPlanMaster`, `rebuildDeviceMaster`, `rebuildPricingMaster` 함수

### 2.2 발견된 문제점

#### ❌ **문제 1: 스케줄 충돌 가능성 (Critical)**

**현상**:
- 매시간 실행되는데, 재빌드 작업이 1시간 이상 걸릴 수 있음
- 이전 작업이 끝나지 않은 상태에서 다음 스케줄이 실행될 수 있음

**원인 분석**:
```javascript
// server/index.js 14572-14581줄
for (let hour = 11; hour <= 19; hour++) {
  cron.schedule(`10 ${hour} * * *`, async () => {
    console.log(`⏰ [스케줄러] 정기 스케줄 실행: 데이터 재빌드 (${hour}:10)`);
    await rebuildMasterData();
  }, {
    scheduled: true,
    timezone: 'Asia/Seoul'
  });
}
```
- 실행 중인 작업 여부를 확인하지 않음
- 동시 실행 방지 메커니즘 없음

**영향**:
- 동시 실행으로 인한 데이터 불일치
- Google Sheets API Rate Limit 초과 위험
- 메모리/CPU 리소스 과다 사용

#### ❌ **문제 2: 에러 복구 메커니즘 부재**

**현상**:
- 재빌드 실패 시 다음 스케줄까지 대기
- 실패 원인 파악 및 재시도 로직 없음

**원인 분석**:
```javascript
// server/index.js 14532-14534줄
} catch (error) {
  console.error('❌ [스케줄러] 데이터 재빌드 오류:', error);
}
```

**영향**:
- 일시적 네트워크 오류 등으로 실패 시 다음 시간까지 대기
- 문제 발생 시 수동 개입 필요

#### ⚠️ **문제 3: 실행 시간 모니터링 부재**

**현상**:
- 각 재빌드 작업의 소요 시간을 추적하지 않음
- 성능 최적화를 위한 데이터 부족

**영향**:
- 스케줄 간격 최적화 어려움
- 느린 작업 식별 불가

#### ⚠️ **문제 4: 부분 실패 처리 부족**

**현상**:
- 요금제/단말/요금정책 중 하나라도 실패하면 전체 실패로 처리
- 부분 성공 시에도 다음 단계 진행 여부 불명확

**원인 분석**:
```javascript
// server/index.js 14513-14523줄
await rebuildPlanMaster(carriers);
await rebuildDeviceMaster(carriers);
await rebuildPricingMaster(carriers);
```
- 각 단계의 성공/실패 여부를 확인하지 않음

**영향**:
- 일부 데이터만 업데이트되어 데이터 불일치 가능성

---

## 📊 종합 평가

### 심각도별 문제 분류

| 심각도 | 문제 | 기능 | 영향도 |
|--------|------|------|--------|
| 🔴 **Critical** | URL 유효성 검증 부재 | 모니터링 | 높음 - 사용자 문제의 직접 원인 |
| 🔴 **Critical** | 스케줄 충돌 가능성 | 재빌드 | 높음 - 데이터 무결성 위험 |
| 🟡 **High** | 에러 복구 메커니즘 부재 | 둘 다 | 중간 - 수동 개입 필요 |
| 🟡 **High** | 불필요한 갱신 작업 | 모니터링 | 중간 - 리소스 낭비 |
| 🟢 **Medium** | 실행 시간 모니터링 부재 | 재빌드 | 낮음 - 최적화 어려움 |
| 🟢 **Medium** | 배치 처리 최적화 부족 | 모니터링 | 낮음 - 성능 이슈 |

---

## 🎯 개선 계획

### Phase 1: 긴급 개선 (Critical 문제 해결)

#### 1.1 Discord 이미지 URL 유효성 검증 추가

**목표**: 실제 URL이 만료되었는지 확인하여 상태 표시

**구현 방안**:
1. `/api/discord/image-monitoring` API에 URL 유효성 검증 로직 추가
   - HEAD 요청으로 URL 접근 가능 여부 확인
   - 타임아웃 설정 (5초)
   - 실패 시 상태를 "만료" 또는 "오류"로 표시
2. 프론트엔드에서 상태별 색상/아이콘 표시
   - 정상: 초록색
   - 만료: 빨간색
   - 확인 중: 노란색
3. 배치 검증 기능 추가 (선택적)
   - 사용자가 요청 시에만 전체 검증 수행

**예상 소요 시간**: 4-6시간

#### 1.2 데이터재빌드 스케줄 충돌 방지

**목표**: 동시 실행 방지 및 실행 상태 관리

**구현 방안**:
1. 실행 중 플래그 추가
   ```javascript
   let isRebuilding = false;
   async function rebuildMasterData() {
     if (isRebuilding) {
       console.log('⚠️ [스케줄러] 이미 재빌드가 진행 중입니다. 건너뜁니다.');
       return;
     }
     isRebuilding = true;
     try {
       // ... 기존 로직
     } finally {
       isRebuilding = false;
     }
   }
   ```
2. 최대 실행 시간 설정 (예: 30분)
   - 타임아웃 시 강제 종료 및 플래그 해제

**예상 소요 시간**: 2-3시간

### Phase 2: 중요 개선 (High 문제 해결)

#### 2.1 에러 복구 및 재시도 메커니즘

**목표**: 일시적 오류 자동 복구

**구현 방안**:
1. 재시도 로직 추가
   - 최대 3회 재시도
   - 지수 백오프 (1초, 2초, 4초)
2. 실패 알림 시스템 (선택적)
   - 연속 실패 시 관리자에게 알림
3. 에러 로그 상세화
   - 실패 원인, 재시도 횟수, 최종 상태 기록

**예상 소요 시간**: 3-4시간

#### 2.2 스마트 갱신 로직 (모니터링)

**목표**: 만료된 URL만 갱신

**구현 방안**:
1. 갱신 전 URL 유효성 검증
   - 정상 URL은 갱신 건너뛰기
   - 만료된 URL만 갱신 시도
2. 마지막 갱신 시간 추적 (선택적)
   - 최근 갱신된 URL은 일정 시간 동안 검증 생략

**예상 소요 시간**: 3-4시간

### Phase 3: 최적화 (Medium 문제 해결)

#### 3.1 실행 시간 모니터링

**목표**: 성능 추적 및 최적화

**구현 방안**:
1. 각 작업의 시작/종료 시간 기록
2. 평균 실행 시간 계산
3. 로그에 실행 시간 포함

**예상 소요 시간**: 1-2시간

#### 3.2 배치 처리 최적화

**목표**: 대량 데이터 처리 효율화

**구현 방안**:
1. 동적 배치 크기 조정
   - API 응답 시간에 따라 배치 크기 조절
2. 병렬 처리 고려 (주의 필요)
   - Rate Limit 고려하여 제한적 병렬 처리

**예상 소요 시간**: 2-3시간

---

## 📝 우선순위별 작업 계획

### 즉시 진행 (1주일 내)

1. ✅ **URL 유효성 검증 추가** (Phase 1.1)
   - 사용자 문제 해결의 핵심
   - 가장 높은 우선순위

2. ✅ **스케줄 충돌 방지** (Phase 1.2)
   - 데이터 무결성 보장

### 단기 개선 (2-3주 내)

3. ✅ **에러 복구 메커니즘** (Phase 2.1)
4. ✅ **스마트 갱신 로직** (Phase 2.2)

### 중장기 최적화 (1-2개월 내)

5. ✅ **실행 시간 모니터링** (Phase 3.1)
6. ✅ **배치 처리 최적화** (Phase 3.2)

---

## ⚠️ 주의사항

1. **Discord API Rate Limit**
   - URL 검증 시 HEAD 요청 사용 권장 (GET보다 가벼움)
   - 배치 처리 시 적절한 지연 시간 유지

2. **Google Sheets API Rate Limit**
   - 데이터재빌드 시 기존 rate limiting 유지
   - 동시 실행 방지로 Rate Limit 초과 방지

3. **성능 영향**
   - URL 검증은 비동기로 처리하여 UI 블로킹 방지
   - 대량 검증 시 백그라운드 작업으로 처리

4. **백워드 호환성**
   - 기존 API 응답 형식 유지
   - 상태 필드 추가는 선택적으로 처리

---

## 📌 결론

현재 구현은 **기본적인 스케줄 작동은 정상**이나, **실제 상태 검증 및 에러 처리**가 부족하여 사용자가 경험한 문제가 발생하고 있습니다.

**가장 시급한 개선 사항**:
1. Discord 이미지 URL 유효성 검증 추가 (사용자 문제 해결)
2. 데이터재빌드 스케줄 충돌 방지 (데이터 무결성 보장)

이 두 가지를 우선적으로 개선하면 현재 문제를 해결하고, 시스템 안정성을 크게 향상시킬 수 있습니다.

---

**보고서 작성 완료**


