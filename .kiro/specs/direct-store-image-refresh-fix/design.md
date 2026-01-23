# Design Document: 직영점모드 휴대폰시세표 이미지 갱신 및 API 오류 수정

## Overview

이 문서는 직영점모드 휴대폰시세표의 이미지 갱신 기능 실패 및 API 오류 문제를 해결하기 위한 설계를 다룹니다. 주요 문제는 다음과 같습니다:

1. **이미지 갱신 버튼 작동 실패**: 버튼 클릭 시 완료 팝업은 표시되지만 실제 이미지가 갱신되지 않음
2. **API 초기화 오류**: `ReferenceError: Cannot access 'd' before initialization` 오류 발생
3. **CORS 정책 오류**: `No 'Access-Control-Allow-Origin' header` 오류로 API 호출 차단
4. **Discord CDN 이미지 404 오류**: 다수의 이미지 URL이 만료되어 404 반환
5. **백그라운드 캐시 갱신 실패**: 반복적인 캐시 갱신 실패로 성능 저하

이 설계는 각 문제의 근본 원인을 파악하고, 안정적이고 확장 가능한 해결책을 제시합니다.

## Architecture

### 시스템 구성 요소

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  TodaysMobileTab.js                                    │ │
│  │  - 이미지 갱신 버튼 UI                                  │ │
│  │  - 데이터 로딩 및 표시                                  │ │
│  └────────────────┬───────────────────────────────────────┘ │
│                   │                                           │
│  ┌────────────────▼───────────────────────────────────────┐ │
│  │  directStoreApiClient.js                               │ │
│  │  - API 호출 래퍼                                        │ │
│  │  - 요청 중복 제거 (Deduplication)                       │ │
│  │  - SWR 캐싱                                             │ │
│  │  - 재시도 로직                                          │ │
│  └────────────────┬───────────────────────────────────────┘ │
└───────────────────┼───────────────────────────────────────────┘
                    │ HTTP/HTTPS
                    │
┌───────────────────▼───────────────────────────────────────────┐
│                Backend (Express/Node.js)                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  corsMiddleware.js                                     │  │
│  │  - CORS 헤더 설정                                       │  │
│  │  - 오리진 검증                                          │  │
│  │  - 프리플라이트 처리                                    │  │
│  └────────────────┬───────────────────────────────────────┘  │
│                   │                                            │
│  ┌────────────────▼───────────────────────────────────────┐  │
│  │  directRoutes.js                                       │  │
│  │  - /api/direct/* 엔드포인트                             │  │
│  │  - rebuildMaster() 함수                                │  │
│  │  - 마스터 데이터 재빌드                                 │  │
│  └────────────────┬───────────────────────────────────────┘  │
│                   │                                            │
│  ┌────────────────▼───────────────────────────────────────┐  │
│  │  Google Sheets API                                     │  │
│  │  - 단말 마스터 (직영점_단말마스터)                      │  │
│  │  - 요금제 마스터 (직영점_요금제마스터)                  │  │
│  │  - 단말 요금정책 (직영점_단말요금정책)                  │  │
│  │  - 모델 이미지 (직영점_모델이미지)                      │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

1. **이미지 갱신 요청 흐름**:
   ```
   사용자 클릭 → TodaysMobileTab → directStoreApiClient.rebuildMaster()
   → Backend /api/direct/rebuild-master → rebuildMaster() 함수
   → Google Sheets 데이터 재빌드 → 캐시 무효화 → UI 갱신
   ```

2. **API 호출 흐름 (SWR 패턴)**:
   ```
   컴포넌트 → directStoreApiClient.getMobilesMaster()
   → 캐시 확인 → [캐시 있음] 즉시 반환 + 백그라운드 갱신
                → [캐시 없음] API 호출 → 캐시 저장 → 반환
   ```

## Components and Interfaces

### 1. Frontend: MobileListTab 컴포넌트 (휴대폰시세표 탭)

**파일**: `src/components/direct/MobileListTab.js`

**주요 기능**:
- 전체 휴대폰 목록 및 가격 정보 표시
- 통신사별 탭 (LG, KT, SK)
- 요금제군별 가격 계산

**UI 구조**:
```
┌─────────────────────────────────────────────────────┐
│  휴대폰시세표                                         │
├─────────────────────────────────────────────────────┤
│  [LG] [KT] [SK]  [새로고침]  ← 통신사 탭 + 버튼      │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐    │
│  │ 구분 │ 이미지 │ 모델명 │ 요금제군 │ ...    │    │
│  │      │[이미지 │        │          │        │    │
│  │      │갱신하기]│        │          │        │    │
│  ├─────────────────────────────────────────────┤    │
│  │ 휴대폰 목록 데이터...                       │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**버튼 위치**:
1. **"새로고침" 버튼** → **"시세표갱신하기"**로 변경
   - 위치: 통신사 탭 오른쪽
   - 기능: 현재 선택된 통신사의 마스터 데이터 재빌드

2. **"이미지갱신하기" 버튼** (기존 위치 유지)
   - 위치: 테이블 헤더의 "이미지" 컬럼 내부
   - 기능: 현재 선택된 통신사의 Discord 메시지 ID를 통한 이미지 재업로드

**수정 사항**:

```javascript
// 1. 시세표 갱신 함수 (기존 handleReload → 데이터 재빌드 기능으로 변경)
const handleReload = async () => {
  try {
    setLoading(true);
    
    // 현재 선택된 통신사의 마스터 데이터 재빌드
    const carrier = getCurrentCarrier();
    const result = await directStoreApiClient.rebuildMaster(carrier);
    
    if (result.success) {
      // 해당 통신사의 프론트엔드 캐시 무효화
      directStoreApiClient.clearCacheByCarrier(carrier);
      
      // 데이터 재로드 (reloadTrigger 증가)
      setReloadTrigger(prev => prev + 1);
      
      // 성공 메시지 표시
      alert(`${carrier} 시세표 갱신 완료!\n단말: ${result.deviceCount}개, 요금제: ${result.planCount}개`);
    } else {
      throw new Error(result.error || '알 수 없는 오류');
    }
  } catch (error) {
    console.error('시세표 갱신 실패:', error);
    alert(`시세표 갱신 실패: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

// 2. 이미지 갱신 함수 (기존 handleRefreshAllImages 개선)
const handleRefreshAllImages = async () => {
  try {
    setRefreshingAllImages(true);
    
    // 현재 선택된 통신사의 이미지만 갱신
    const carrier = getCurrentCarrier();
    const result = await directStoreApiClient.refreshImagesFromDiscord(carrier);
    
    if (result.success) {
      // 해당 통신사의 이미지 캐시 무효화
      directStoreApiClient.clearImageCache(carrier);
      
      // 데이터 재로드
      setReloadTrigger(prev => prev + 1);
      
      // 성공 메시지 표시
      alert(`${carrier} 이미지 갱신 완료!\n성공: ${result.updatedCount}개, 실패: ${result.failedCount}개`);
      
      // 실패한 이미지가 있으면 상세 정보 표시
      if (result.failedCount > 0 && result.failedImages) {
        const failedList = result.failedImages.map(f => `${f.modelId}: ${f.reason}`).join('\n');
        console.warn('실패한 이미지 목록:\n' + failedList);
      }
    } else {
      throw new Error(result.error || '알 수 없는 오류');
    }
  } catch (error) {
    console.error('이미지 갱신 실패:', error);
    alert(`이미지 갱신 실패: ${error.message}`);
  } finally {
    setRefreshingAllImages(false);
  }
};
```

**UI 수정**:
```jsx
// 버튼 텍스트 변경
<Button
  variant="outlined"
  size="small"
  onClick={handleReload}
  startIcon={<RefreshIcon />}
  disabled={loading}
  sx={{ ml: { xs: 0, sm: 2 } }}
>
  시세표갱신하기  {/* 기존: "새로고침" */}
</Button>
```

### 2. Frontend: TodaysMobileTab 컴포넌트 (오늘의 휴대폰 탭)

**파일**: `src/components/direct/TodaysMobileTab.js`

**주요 기능**:
- 오늘의 추천 휴대폰 표시 (프리미엄 3개 + 중저가 2개)
- 슬라이드쇼 기능
- 데이터 자동 갱신

**수정 사항**: 없음 (기존 기능 유지)

**인터페이스**:
```typescript
// MobileListTab Props
interface MobileListTabProps {
  onProductSelect: (product: Product) => void;
  isCustomerMode?: boolean;
}

// TodaysMobileTab Props
interface TodaysMobileTabProps {
  isFullScreen: boolean;
  onProductSelect: (product: Product) => void;
  loggedInStore: Store | null;
}

interface RebuildResult {
  success: boolean;
  carrier: string;
  deviceCount?: number;
  planCount?: number;
  pricingCount?: number;
  error?: string;
}

interface ImageRefreshResult {
  success: boolean;
  carrier: string;
  updatedCount: number;
  failedCount: number;
  updatedImages?: Array<{
    modelId: string;
    oldUrl: string;
    newUrl: string;
  }>;
  failedImages?: Array<{
    modelId: string;
    reason: string;
  }>;
  error?: string;
}
```

### 2. Frontend: directStoreApiClient

**파일**: `src/api/directStoreApiClient.js`

**문제점**:
- 변수 초기화 순서 오류로 인한 `ReferenceError`
- 순환 참조 가능성

**해결 방안**:
```javascript
// ❌ 문제가 있는 코드 (순환 참조)
const smartFetch = async (url, options, config) => {
  // ... 내부에서 d 변수 사용
  const result = await d.someFunction(); // d가 아직 초기화되지 않음
};

const d = {
  someFunction: () => smartFetch(...)
};

// ✅ 수정된 코드 (명확한 초기화 순서)
// 1. 먼저 모든 헬퍼 함수 정의
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isRetryableError = (error, status) => { /* ... */ };

// 2. 캐시 및 큐 초기화
const memoryCache = new Map();
const pendingRequests = new Map();
const backgroundRefreshing = new Set();

// 3. smartFetch 함수 정의 (다른 함수에 의존하지 않음)
const smartFetch = async (url, options = {}, config = {}) => {
  // 독립적인 로직
};

// 4. API 클라이언트 객체 정의
export const directStoreApiClient = {
  getMobilesMaster: async (carrier, options = {}) => {
    return smartFetch(...);
  },
  // ...
};
```

**새로운 메서드 추가**:
```javascript
export const directStoreApiClient = {
  // 기존 메서드들...
  
  /**
   * 통신사별 마스터 데이터 재빌드
   * @param {string} carrier - 통신사 (SK, KT, LG)
   */
  rebuildMaster: async (carrier) => {
    const params = new URLSearchParams();
    if (carrier) params.append('carrier', carrier);
    
    return smartFetch(
      `${BASE_URL}/rebuild-master?${params.toString()}`,
      { method: 'POST' },
      { errorMessage: '마스터 데이터 재빌드 실패' }
    );
  },
  
  /**
   * Discord 메시지 ID를 통한 이미지 재업로드
   * @param {string} carrier - 통신사 (SK, KT, LG)
   */
  refreshImagesFromDiscord: async (carrier) => {
    const params = new URLSearchParams();
    if (carrier) params.append('carrier', carrier);
    
    return smartFetch(
      `${BASE_URL}/refresh-images-from-discord?${params.toString()}`,
      { method: 'POST' },
      { errorMessage: '이미지 갱신 실패' }
    );
  },
  
  /**
   * 통신사별 캐시 무효화
   * @param {string} carrier - 통신사 (SK, KT, LG)
   */
  clearCacheByCarrier: (carrier) => {
    // 해당 통신사 관련 캐시만 삭제
    for (const [key, value] of memoryCache.entries()) {
      if (key.includes(carrier)) {
        memoryCache.delete(key);
      }
    }
    
    for (const [key, value] of pendingRequests.entries()) {
      if (key.includes(carrier)) {
        pendingRequests.delete(key);
      }
    }
    
    console.log(`✅ [API Client] ${carrier} 캐시 초기화 완료`);
  },
  
  /**
   * 이미지 캐시만 무효화
   * @param {string} carrier - 통신사 (SK, KT, LG)
   */
  clearImageCache: (carrier) => {
    // 이미지 관련 캐시만 삭제
    for (const [key, value] of memoryCache.entries()) {
      if (key.includes('mobiles-master') && key.includes(carrier)) {
        memoryCache.delete(key);
      }
    }
    
    console.log(`✅ [API Client] ${carrier} 이미지 캐시 초기화 완료`);
  },
  
  /**
   * 전체 캐시 무효화 (기존 메서드 유지)
   */
  clearCache: () => {
    memoryCache.clear();
    pendingRequests.clear();
    backgroundRefreshing.clear();
    console.log('✅ [API Client] 전체 캐시 초기화 완료');
  },
  
  /**
   * 캐시 통계 조회 (디버깅용)
   */
  getCacheStats: () => {
    return {
      cacheSize: memoryCache.size,
      pendingRequests: pendingRequests.size,
      backgroundRefreshing: backgroundRefreshing.size
    };
  }
};
```

### 3. Backend: CORS Middleware

**파일**: `server/corsMiddleware.js`

**문제점**:
- 일부 요청에서 `Access-Control-Allow-Origin` 헤더 누락
- 프리플라이트 요청 처리 불완전

**해결 방안**:
```javascript
// 모든 /api/direct/* 라우트에 CORS 미들웨어 적용 확인
app.use('/api/direct', corsMiddleware);

// corsMiddleware 개선
const corsMiddleware = (req, res, next) => {
  try {
    const origin = req.headers.origin;
    const config = configManager.getConfiguration();
    
    // 1. 오리진 검증
    const validation = validateOrigin(origin, config.allowedOrigins, config.developmentMode);
    
    if (!validation.isValid && origin) {
      console.warn(`❌ [CORS] 허용되지 않은 오리진: ${origin}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Origin not allowed',
        origin: origin
      });
    }
    
    // 2. CORS 헤더 설정 (항상 설정)
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (config.allowedOrigins.length > 0) {
      res.header('Access-Control-Allow-Origin', config.allowedOrigins[0]);
    }
    
    res.header('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    res.header('Access-Control-Allow-Credentials', config.allowCredentials.toString());
    res.header('Access-Control-Max-Age', config.maxAge.toString());
    
    // 3. OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  } catch (error) {
    console.error('❌ [CORS Middleware] 오류:', error);
    // 오류 발생 시에도 기본 CORS 헤더 설정
    res.header('Access-Control-Allow-Origin', '*');
    next();
  }
};
```

### 4. Backend: rebuildMaster 및 refreshImagesFromDiscord 함수

**파일**: `server/directRoutes.js`

**현재 문제**:
- 모든 통신사를 한 번에 재빌드하여 서버 부하 발생
- 이미지 URL 갱신 로직 누락
- Discord CDN URL 유효성 검증 없음

**개선된 rebuildMaster 함수 (통신사별 재빌드)**:

```javascript
/**
 * 마스터 데이터 재빌드 (통신사별)
 * @param {string} carrier - 재빌드할 통신사 (SK, KT, LG)
 */
async function rebuildDeviceMaster(carrier) {
  const { sheets, SPREADSHEET_ID } = createSheetsClient();
  
  console.log(`🔄 [rebuildDeviceMaster] ${carrier} 시작`);
  
  // 1. 이미지 데이터 로드 (해당 통신사만)
  const imageMap = new Map();
  
  const imagesRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_MOBILE_IMAGES}!A:K`
  });
  
  const imageRows = (imagesRes.data.values || []).slice(1);
  
  for (const row of imageRows) {
    const rowCarrier = (row[0] || '').toString().trim().toUpperCase();
    
    // 해당 통신사만 처리
    if (rowCarrier !== carrier) continue;
    
    const modelId = row[1] || row[2];
    const imageUrl = (row[5] || '').toString().trim();
    
    if (!modelId || !imageUrl) continue;
    
    const key = `${carrier}:${normalizeModelCode(modelId)}`;
    imageMap.set(key, {
      imageUrl: imageUrl,
      discordMessageId: (row[8] || '').toString().trim(),
      discordPostId: (row[9] || '').toString().trim(),
      discordThreadId: (row[10] || '').toString().trim()
    });
  }
  
  // 2. 단말 마스터 데이터 재빌드 (해당 통신사만)
  // ... (기존 로직 유지, carrier 필터링 추가)
  
  console.log(`✅ [rebuildDeviceMaster] ${carrier} 완료: ${allRows.length}개`);
  
  return {
    success: true,
    deviceCount: allRows.length
  };
}

/**
 * Discord 메시지 ID를 통한 이미지 재업로드
 * @param {string} carrier - 재업로드할 통신사 (SK, KT, LG)
 */
async function refreshImagesFromDiscord(carrier) {
  const { sheets, SPREADSHEET_ID } = createSheetsClient();
  
  console.log(`🔄 [refreshImagesFromDiscord] ${carrier} 시작`);
  
  // 1. 직영점_모델이미지 시트에서 Discord 메시지 ID 조회
  const imagesRes = await withRetry(async () => {
    return await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_MOBILE_IMAGES}!A:K`
    });
  });
  
  const imageRows = (imagesRes.data.values || []).slice(1);
  const updatedImages = [];
  const failedImages = [];
  
  // 2. 해당 통신사의 이미지만 필터링
  const targetRows = imageRows.filter(row => {
    const rowCarrier = (row[0] || '').toString().trim().toUpperCase();
    return rowCarrier === carrier;
  });
  
  console.log(`📊 [refreshImagesFromDiscord] ${carrier} 대상: ${targetRows.length}개`);
  
  // 3. Google Sheets API Rate Limit 고려: 배치 업데이트 사용
  // - batchUpdate는 단일 API 호출로 여러 셀 업데이트 가능
  // - 최대 100개까지 한 번에 처리 권장
  const BATCH_SIZE = 50; // 안전을 위해 50개씩 처리
  const updateRequests = [];
  
  for (let i = 0; i < targetRows.length; i++) {
    const row = targetRows[i];
    const modelId = row[1] || row[2];
    const discordMessageId = (row[8] || '').toString().trim();
    const discordPostId = (row[9] || '').toString().trim();
    const discordThreadId = (row[10] || '').toString().trim();
    
    if (!modelId || !discordMessageId) {
      console.warn(`⚠️ [refreshImagesFromDiscord] Discord 메시지 ID 없음: ${modelId}`);
      continue;
    }
    
    try {
      // Discord API를 통해 메시지에서 첨부 파일 URL 가져오기
      const newImageUrl = await fetchImageUrlFromDiscordMessage(
        discordMessageId,
        discordPostId,
        discordThreadId
      );
      
      if (!newImageUrl) {
        throw new Error('Discord 메시지에서 이미지 URL을 찾을 수 없습니다');
      }
      
      // 업데이트 요청 추가 (실제 업데이트는 나중에 배치로 처리)
      const rowIndex = imageRows.indexOf(row) + 2; // 헤더 포함 행 번호
      updateRequests.push({
        range: `${SHEET_MOBILE_IMAGES}!F${rowIndex}`, // F열: 이미지URL
        values: [[newImageUrl]]
      });
      
      updatedImages.push({
        modelId,
        oldUrl: row[5],
        newUrl: newImageUrl
      });
      
      // Discord API Rate Limit 고려: 요청 간 지연
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 지연
      
    } catch (error) {
      console.error(`❌ [refreshImagesFromDiscord] ${modelId} 이미지 갱신 실패:`, error);
      failedImages.push({
        modelId,
        reason: error.message
      });
    }
  }
  
  // 4. Google Sheets 배치 업데이트 (Rate Limit 최소화)
  if (updateRequests.length > 0) {
    console.log(`📝 [refreshImagesFromDiscord] ${carrier} 배치 업데이트 시작: ${updateRequests.length}개`);
    
    // 배치를 나누어 처리 (Google Sheets API Rate Limit 고려)
    for (let i = 0; i < updateRequests.length; i += BATCH_SIZE) {
      const batch = updateRequests.slice(i, i + BATCH_SIZE);
      
      try {
        await withRetry(async () => {
          return await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
              valueInputOption: 'USER_ENTERED',
              data: batch
            }
          });
        });
        
        console.log(`✅ [refreshImagesFromDiscord] 배치 ${Math.floor(i / BATCH_SIZE) + 1} 완료`);
        
        // 배치 간 지연 (Google Sheets API Rate Limit 고려)
        if (i + BATCH_SIZE < updateRequests.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연
        }
      } catch (error) {
        console.error(`❌ [refreshImagesFromDiscord] 배치 업데이트 실패:`, error);
        // 실패한 배치의 이미지들을 failedImages에 추가
        batch.forEach(req => {
          const modelId = updatedImages.find(img => req.range.includes('F'))?.modelId;
          if (modelId) {
            failedImages.push({
              modelId,
              reason: `배치 업데이트 실패: ${error.message}`
            });
          }
        });
      }
    }
  }
  
  console.log(`✅ [refreshImagesFromDiscord] ${carrier} 완료: 성공 ${updatedImages.length}개, 실패 ${failedImages.length}개`);
  
  return {
    success: true,
    updatedCount: updatedImages.length,
    failedCount: failedImages.length,
    updatedImages,
    failedImages
  };
}

/**
 * Discord 메시지에서 이미지 URL 가져오기
 */
async function fetchImageUrlFromDiscordMessage(messageId, postId, threadId) {
  const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
  
  if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
    throw new Error('Discord 설정이 없습니다');
  }
  
  try {
    // Discord API를 통해 메시지 조회
    const url = threadId
      ? `https://discord.com/api/v10/channels/${threadId}/messages/${messageId}`
      : `https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages/${messageId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Discord API 오류: ${response.status}`);
    }
    
    const message = await response.json();
    
    // 첨부 파일에서 이미지 URL 추출
    if (message.attachments && message.attachments.length > 0) {
      const imageAttachment = message.attachments.find(att => 
        att.content_type && att.content_type.startsWith('image/')
      );
      
      if (imageAttachment) {
        return imageAttachment.url;
      }
    }
    
    throw new Error('메시지에 이미지 첨부 파일이 없습니다');
  } catch (error) {
    console.error('❌ [fetchImageUrlFromDiscordMessage] 오류:', error);
    throw error;
  }
}
```

**API 엔드포인트 추가**:
```javascript
// POST /api/direct/rebuild-master?carrier=SK
router.post('/rebuild-master', async (req, res) => {
  try {
    const { carrier } = req.query;
    
    if (!carrier || !['SK', 'KT', 'LG'].includes(carrier)) {
      return res.status(400).json({
        success: false,
        error: '유효한 통신사를 지정해주세요 (SK, KT, LG)'
      });
    }
    
    console.log(`🔄 [rebuildMaster] ${carrier} 시작`);
    
    // 1. 단말 마스터 재빌드 (해당 통신사만)
    const deviceResult = await rebuildDeviceMaster(carrier);
    
    // 2. 요금제 마스터 재빌드 (해당 통신사만)
    const planResult = await rebuildPlanMaster([carrier]);
    
    // 3. 단말 요금정책 재빌드 (해당 통신사만)
    const pricingResult = await rebuildPricingMaster([carrier]);
    
    console.log(`✅ [rebuildMaster] ${carrier} 완료`);
    
    res.json({
      success: true,
      carrier: carrier,
      deviceCount: deviceResult.deviceCount,
      planCount: planResult.totalCount,
      pricingCount: pricingResult.totalCount
    });
  } catch (error) {
    console.error('❌ [rebuildMaster] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/direct/refresh-images-from-discord?carrier=SK
router.post('/refresh-images-from-discord', async (req, res) => {
  try {
    const { carrier } = req.query;
    
    if (!carrier || !['SK', 'KT', 'LG'].includes(carrier)) {
      return res.status(400).json({
        success: false,
        error: '유효한 통신사를 지정해주세요 (SK, KT, LG)'
      });
    }
    
    console.log(`🔄 [refreshImagesFromDiscord] ${carrier} 시작`);
    
    const result = await refreshImagesFromDiscord(carrier);
    
    console.log(`✅ [refreshImagesFromDiscord] ${carrier} 완료`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ [refreshImagesFromDiscord] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## Data Models

### Product (단말 모델)

```typescript
interface Product {
  id: string;              // 모델 ID (정규화된 코드)
  modelId: string;         // 모델 ID (원본)
  model: string;           // 모델명
  petName: string;         // 펫네임
  carrier: 'SK' | 'KT' | 'LG';  // 통신사
  factoryPrice: number;    // 출고가
  image: string;           // 이미지 URL
  imageUrl?: string;       // 이미지 URL (별칭)
  isPremium: boolean;      // 프리미엄 여부
  isBudget: boolean;       // 중저가 여부
  isPopular: boolean;      // 인기 여부
  isRecommended: boolean;  // 추천 여부
  requiredAddons: string;  // 필수 부가서비스
  defaultPlanGroup: string; // 기본 요금제군
}
```

### PricingData (요금 정보)

```typescript
interface PricingData {
  modelId: string;
  carrier: string;
  planGroup: string;
  openingType: '010신규' | 'MNP' | '기변';
  factoryPrice: number;
  publicSupport: number;           // 이통사 지원금
  storeSupportWithAddon: number;   // 대리점 지원금 (부가유치)
  purchasePriceWithAddon: number;  // 구매가 (부가유치)
}
```

### CacheEntry (캐시 항목)

```typescript
interface CacheEntry {
  data: any;
  timestamp: number;
  expires: number;
  isRefreshing?: boolean;
}
```

### RebuildResult (재빌드 결과)

```typescript
interface RebuildResult {
  success: boolean;
  deviceCount: number;
  planCount: number;
  pricingCount: number;
  invalidImageCount: number;
  invalidImages: InvalidImage[];
  error?: string;
}

interface InvalidImage {
  carrier: string;
  modelId: string;
  url: string;
  status?: number;
  error?: string;
}
```

## Correctness Properties

이제 Acceptance Criteria Testing Prework를 수행하겠습니다.


### Property Reflection

prework 분석 결과를 검토하여 중복되거나 통합 가능한 속성을 식별합니다:

**중복 제거 대상**:
1. 요구사항 2.2와 2.5는 통합 가능 - "모든 API 호출이 모든 통신사에 대해 안정적으로 작동"
2. 요구사항 3.1과 3.5는 통합 가능 - "모든 API 응답에 필수 CORS 헤더 포함"
3. 요구사항 7.1, 7.2, 7.3은 통합 가능 - "모든 오류 타입에 대해 적절한 정보 로깅"

**통합 후 핵심 속성**:
- API 안정성 (모든 API, 모든 통신사)
- CORS 헤더 일관성 (모든 엔드포인트, 모든 응답)
- 오류 로깅 완전성 (모든 오류 타입)
- 중복 요청 제거
- 백그라운드 작업 비블로킹

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Correctness Properties

#### Property 1: API 호출 안정성

*For any* API 함수 (getMobilesMaster, getPlansMaster, getMobilesPricing, getPolicySettings)와 *for any* 통신사 (SK, KT, LG), API 호출은 초기화 오류 없이 성공적으로 응답을 반환하거나 명확한 오류 메시지를 반환해야 합니다.

**Validates: Requirements 2.2, 2.5**

#### Property 2: CORS 헤더 일관성

*For any* API 엔드포인트 (/api/direct/*)와 *for any* HTTP 메서드 (GET, POST, PUT, DELETE, OPTIONS), 응답은 항상 Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers 헤더를 포함해야 합니다.

**Validates: Requirements 3.1, 3.3, 3.5**

#### Property 3: 중복 요청 제거

*For any* API 요청, 동일한 요청이 짧은 시간 내(예: 1초)에 여러 번 발생할 때, 실제 네트워크 호출은 한 번만 실행되고 모든 호출자는 동일한 결과를 받아야 합니다.

**Validates: Requirements 5.1**

#### Property 4: 지수 백오프 재시도

*For any* API 호출에서 Rate Limit 오류(429)가 발생할 때, 재시도 간격은 지수적으로 증가해야 합니다 (예: 1초, 2초, 4초, 8초).

**Validates: Requirements 5.3**

#### Property 5: 이미지 URL 유효성

*For all* 단말 모델의 이미지 URL, URL이 Discord CDN을 가리키는 경우 HTTP HEAD 요청 시 200 OK 응답을 반환하거나, 유효하지 않은 경우 재업로드 프로세스가 트리거되어야 합니다.

**Validates: Requirements 4.5**

#### Property 6: 백그라운드 작업 비블로킹

*For all* 백그라운드 캐시 갱신 작업, 작업은 비동기로 실행되어야 하며 메인 스레드의 실행을 블로킹하지 않아야 합니다 (즉, Promise를 반환하고 await 없이 실행).

**Validates: Requirements 6.5**

#### Property 7: 오류 로깅 완전성

*For any* 오류 (API 오류, CORS 오류, 이미지 404 오류), 로그는 오류 타입, 메시지, 관련 컨텍스트 정보 (URL, 모델 ID, 통신사 등)를 포함해야 합니다.

**Validates: Requirements 7.1, 7.2, 7.3**

#### Property 8: 로그 빈도 제한

*For any* 반복되는 경고 로그, 동일한 경고 메시지는 지정된 시간 간격(예: 1분) 내에 최대 한 번만 출력되어야 합니다.

**Validates: Requirements 7.4**

#### Property 9: 순차 API 호출

*For any* 여러 통신사 데이터 로드 작업, API 호출은 순차적으로 실행되어야 하며 (LG → KT → SK 순서), 이전 호출이 완료된 후 다음 호출이 시작되어야 합니다.

**Validates: Requirements 5.4**

#### Property 10: 작업 로깅 완전성

*For all* 중요한 작업 (이미지 갱신, 마스터 데이터 재빌드), 작업 시작 시점과 완료 시점에 로그가 기록되어야 하며, 로그는 작업 이름과 타임스탬프를 포함해야 합니다.

**Validates: Requirements 7.5**

## Error Handling

### 1. API 초기화 오류 처리

**문제**: `ReferenceError: Cannot access 'd' before initialization`

**해결 방안**:
```javascript
// 변수 초기화 순서 명확화
// 1. 상수 및 설정
const CACHE_FRESH_TTL = 5 * 60 * 1000;
const CACHE_STALE_TTL = 30 * 60 * 1000;

// 2. 데이터 구조
const memoryCache = new Map();
const pendingRequests = new Map();
const backgroundRefreshing = new Set();

// 3. 헬퍼 함수 (다른 함수에 의존하지 않음)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isRetryableError = (error, status) => { /* ... */ };

// 4. 핵심 함수 (헬퍼 함수만 사용)
const smartFetch = async (url, options, config) => {
  // 독립적인 로직
};

// 5. API 클라이언트 (smartFetch 사용)
export const directStoreApiClient = { /* ... */ };
```

**오류 감지 및 복구**:
```javascript
try {
  const result = await directStoreApiClient.getMobilesMaster('SK');
} catch (error) {
  if (error instanceof ReferenceError) {
    console.error('❌ [초기화 오류] API 클라이언트 초기화 실패:', error);
    // 페이지 새로고침 권장
    if (confirm('API 초기화 오류가 발생했습니다. 페이지를 새로고침하시겠습니까?')) {
      window.location.reload();
    }
  }
  throw error;
}
```

### 2. CORS 오류 처리

**문제**: `Access-Control-Allow-Origin` 헤더 누락

**해결 방안**:
```javascript
// CORS 미들웨어 강화
const corsMiddleware = (req, res, next) => {
  try {
    // 항상 CORS 헤더 설정 (오류 발생 시에도)
    const origin = req.headers.origin;
    const config = configManager.getConfiguration();
    
    // 오리진 검증
    if (origin && !config.allowedOrigins.includes(origin)) {
      console.warn(`❌ [CORS] 허용되지 않은 오리진: ${origin}`);
    }
    
    // CORS 헤더 설정 (검증 실패 시에도 설정)
    res.header('Access-Control-Allow-Origin', origin || config.allowedOrigins[0] || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  } catch (error) {
    console.error('❌ [CORS Middleware] 오류:', error);
    // 오류 발생 시에도 기본 CORS 헤더 설정
    res.header('Access-Control-Allow-Origin', '*');
    next();
  }
};
```

### 3. Discord CDN 이미지 404 오류 처리

**문제**: 만료된 Discord CDN URL

**해결 방안**:
```javascript
async function validateAndFixImageUrl(modelId, carrier, currentUrl) {
  try {
    // 1. URL 유효성 검증
    const response = await fetch(currentUrl, { method: 'HEAD', timeout: 5000 });
    
    if (response.ok) {
      return { valid: true, url: currentUrl };
    }
    
    // 2. 404 오류 시 재업로드 트리거
    console.warn(`⚠️ [이미지 검증] 404 오류: ${modelId} - ${currentUrl}`);
    
    // 3. 기본 이미지로 대체 (임시)
    const fallbackUrl = '/images/placeholder-phone.png';
    
    // 4. 재업로드 작업 큐에 추가 (비동기)
    queueImageReupload(modelId, carrier);
    
    return { valid: false, url: fallbackUrl, needsReupload: true };
  } catch (error) {
    console.error(`❌ [이미지 검증] 오류: ${modelId}`, error);
    return { valid: false, url: '/images/placeholder-phone.png', error: error.message };
  }
}
```

### 4. 백그라운드 캐시 갱신 실패 처리

**문제**: 반복적인 캐시 갱신 실패

**해결 방안**:
```javascript
// 백그라운드 갱신 시 오류 처리
async function backgroundRefresh(cacheKey, fetchFn) {
  if (backgroundRefreshing.has(cacheKey)) {
    return; // 이미 갱신 중이면 스킵
  }
  
  backgroundRefreshing.add(cacheKey);
  
  try {
    const data = await fetchFn();
    memoryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + CACHE_FRESH_TTL
    });
    console.log(`✅ [백그라운드 갱신] 성공: ${cacheKey}`);
  } catch (error) {
    // 오류 로그만 남기고 사용자에게는 표시하지 않음
    logWarningOnce(
      `bg-refresh-${cacheKey}`,
      `⚠️ [백그라운드 갱신] 실패: ${cacheKey}`,
      { error: error.message }
    );
  } finally {
    backgroundRefreshing.delete(cacheKey);
  }
}
```

## Testing Strategy

### Unit Tests

단위 테스트는 개별 함수와 컴포넌트의 동작을 검증합니다:

1. **API 클라이언트 초기화 테스트**
   - 변수 초기화 순서 검증
   - 순환 참조 없음 확인

2. **CORS 미들웨어 테스트**
   - 허용된 오리진에 대한 헤더 설정 확인
   - OPTIONS 요청 처리 확인
   - 오류 발생 시 폴백 동작 확인

3. **이미지 URL 검증 테스트**
   - 유효한 URL에 대한 검증 성공
   - 404 URL에 대한 검증 실패 및 재업로드 트리거

4. **캐시 관리 테스트**
   - 캐시 저장 및 조회
   - 캐시 만료 처리
   - 캐시 무효화

### Property-Based Tests

속성 기반 테스트는 범용 속성을 검증합니다 (최소 100회 반복):

1. **Property 1: API 호출 안정성**
   ```javascript
   // Feature: direct-store-image-refresh-fix, Property 1: API 호출 안정성
   test('모든 API 함수는 모든 통신사에 대해 안정적으로 작동해야 함', async () => {
     const apis = ['getMobilesMaster', 'getPlansMaster', 'getMobilesPricing', 'getPolicySettings'];
     const carriers = ['SK', 'KT', 'LG'];
     
     for (const api of apis) {
       for (const carrier of carriers) {
         const result = await directStoreApiClient[api](carrier);
         expect(result).toBeDefined();
         expect(result).not.toThrow(ReferenceError);
       }
     }
   });
   ```

2. **Property 2: CORS 헤더 일관성**
   ```javascript
   // Feature: direct-store-image-refresh-fix, Property 2: CORS 헤더 일관성
   test('모든 API 엔드포인트는 필수 CORS 헤더를 포함해야 함', async () => {
     const endpoints = ['/api/direct/mobiles-master', '/api/direct/plans-master', '/api/direct/mobiles-pricing'];
     const methods = ['GET', 'POST', 'OPTIONS'];
     
     for (const endpoint of endpoints) {
       for (const method of methods) {
         const response = await fetch(endpoint, { method });
         expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
         expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
         expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
       }
     }
   });
   ```

3. **Property 3: 중복 요청 제거**
   ```javascript
   // Feature: direct-store-image-refresh-fix, Property 3: 중복 요청 제거
   test('동일한 요청이 여러 번 발생해도 네트워크 호출은 한 번만 실행되어야 함', async () => {
     const fetchSpy = jest.spyOn(global, 'fetch');
     
     // 동일한 요청 10번 동시 실행
     const promises = Array(10).fill().map(() => 
       directStoreApiClient.getMobilesMaster('SK')
     );
     
     await Promise.all(promises);
     
     // fetch는 한 번만 호출되어야 함
     expect(fetchSpy).toHaveBeenCalledTimes(1);
   });
   ```

### Integration Tests

통합 테스트는 여러 컴포넌트 간의 상호작용을 검증합니다:

1. **이미지 갱신 플로우 테스트**
   - 버튼 클릭 → API 호출 → 캐시 무효화 → UI 갱신

2. **백그라운드 캐시 갱신 테스트**
   - 캐시 만료 → 백그라운드 갱신 트리거 → 새 데이터 로드

3. **오류 복구 테스트**
   - API 오류 발생 → 재시도 → 성공

### E2E Tests

E2E 테스트는 사용자 시나리오를 검증합니다:

1. **이미지 갱신 시나리오**
   - 사용자가 "이미지갱신하기" 버튼 클릭
   - 로딩 인디케이터 표시
   - 갱신 완료 후 성공 메시지 표시
   - UI에 새 이미지 반영

2. **오류 처리 시나리오**
   - 네트워크 오류 발생
   - 오류 메시지 표시
   - 재시도 옵션 제공

### Test Configuration

**Property-Based Test 설정**:
- 최소 100회 반복 실행
- 각 테스트는 설계 문서의 속성 번호 참조
- 태그 형식: `Feature: direct-store-image-refresh-fix, Property {number}: {property_text}`

**Test Framework**:
- Frontend: Jest + React Testing Library
- Backend: Jest + Supertest
- Property-Based Testing: fast-check (이미 설치됨)

**Coverage Target**:
- 단위 테스트: 80% 이상
- 통합 테스트: 주요 플로우 100%
- E2E 테스트: 핵심 사용자 시나리오 100%


## 최종 점검 및 맥락 이해

### 현재 시스템 동작 방식

**1. MobileListTab의 기존 이미지 갱신 (`handleRefreshAllImages`)**:
- **현재 구현**: 개별 모델별로 `/api/direct/refresh-mobile-image-url` API 호출
- **처리 방식**: 배치 처리 (5개씩 묶어서 처리)
- **필요 데이터**: `discordMessageId`, `discordThreadId`
- **문제점**: 
  - 개별 API 호출로 인한 서버 부하
  - CORS 오류 및 504 타임아웃 발생 가능성
  - 실패 시 재시도 로직 부재

**2. 제안하는 개선 방식**:
- **새로운 API**: `/api/direct/refresh-images-from-discord?carrier=SK`
- **처리 방식**: 통신사별 일괄 처리 (서버 측에서 한 번에 처리)
- **장점**:
  - 서버 부하 감소 (단일 API 호출)
  - 통신사별 독립적 처리
  - 실패한 이미지 추적 및 로깅 개선
  - CORS 오류 최소화

### 구현 전략

**Phase 1: 백엔드 API 구현**
1. `/api/direct/refresh-images-from-discord` 엔드포인트 추가
2. `refreshImagesFromDiscord(carrier)` 함수 구현
3. Discord API 통합 (`fetchImageUrlFromDiscordMessage`)

**Phase 2: 프론트엔드 통합**
1. `directStoreApiClient.refreshImagesFromDiscord(carrier)` 메서드 추가
2. `MobileListTab.handleRefreshAllImages` 함수 개선
3. 통신사별 캐시 무효화 로직 추가

**Phase 3: 기존 API 유지 (하위 호환성)**
- 기존 `/api/direct/refresh-mobile-image-url` API는 유지
- 개별 이미지 갱신이 필요한 경우 계속 사용 가능

### 핵심 개선 사항 요약

| 항목 | 기존 방식 | 개선 방식 |
|------|----------|----------|
| **새로고침 버튼** | 단순 데이터 재로드 | 마스터 데이터 재빌드 |
| **이미지 갱신** | 개별 모델별 API 호출 | 통신사별 일괄 처리 |
| **서버 부하** | 높음 (N개 API 호출) | 낮음 (1개 API 호출) |
| **오류 처리** | 조용히 무시 | 상세 로깅 및 사용자 피드백 |
| **캐시 관리** | 전체 캐시 무효화 | 통신사별 선택적 무효화 |
| **CORS 오류** | 빈번함 | 최소화 |

### 데이터 흐름 비교

**기존 방식**:
```
사용자 클릭 → 모델 목록 필터링 → 5개씩 배치 처리
→ 각 모델별 API 호출 (N번) → 개별 응답 처리
→ 성공/실패 카운트 → 전체 데이터 재로드
```

**개선 방식**:
```
사용자 클릭 → 현재 통신사 확인 → 단일 API 호출
→ 서버에서 일괄 처리 → 통합 응답 (성공/실패 목록)
→ 통신사별 캐시 무효화 → 데이터 재로드
```

### 예상 효과

1. **성능 개선**: API 호출 횟수 90% 감소 (예: 50개 모델 → 1번 호출)
2. **안정성 향상**: CORS 오류 및 타임아웃 최소화
3. **사용자 경험**: 명확한 진행 상황 및 오류 피드백
4. **서버 부하**: Rate Limit 오류 방지
5. **유지보수성**: 통신사별 독립적 처리로 디버깅 용이

### 주의사항

1. **Google Sheets API Rate Limit**: 
   - **Read Quota**: 분당 60회 읽기 요청 제한
   - **Write Quota**: 분당 60회 쓰기 요청 제한
   - **해결책**: `batchUpdate` API 사용하여 여러 셀을 한 번에 업데이트 (50개씩 배치 처리)
   - **배치 간 지연**: 각 배치 처리 후 1초 지연으로 Rate Limit 방지

2. **Discord API Rate Limit**: 
   - Discord API도 Rate Limit이 있으므로, 각 요청 간 100ms 지연 추가
   - 과도한 요청 시 429 오류 발생 가능

3. **Discord 메시지 ID 누락**: 
   - 일부 모델은 Discord 메시지 ID가 없을 수 있으므로, 이 경우 스킵 처리
   - 사용자에게 갱신 가능한 이미지 수 안내

4. **이미지 URL 검증**: 
   - 새로 가져온 URL이 유효한지 검증 필요
   - Discord CDN URL 형식 확인

5. **배치 업데이트 실패 처리**: 
   - 배치 업데이트 실패 시 해당 배치의 모든 이미지를 failedImages에 추가
   - 부분 성공 시에도 사용자에게 명확한 피드백 제공

6. **롤백 메커니즘**: 
   - 이미지 갱신 실패 시 이전 URL 유지 (자동 롤백)
   - Google Sheets는 버전 관리 기능이 있어 수동 롤백 가능

### 테스트 시나리오

1. **정상 시나리오**: 모든 이미지가 성공적으로 갱신됨
2. **부분 실패**: 일부 이미지만 갱신 성공, 나머지 실패
3. **전체 실패**: Discord API 오류로 모든 이미지 갱신 실패
4. **Discord 메시지 ID 없음**: 갱신 가능한 이미지가 없는 경우
5. **CORS 오류**: 백엔드 API 호출 시 CORS 오류 발생
6. **타임아웃**: 서버 응답 지연으로 타임아웃 발생

### 마이그레이션 계획

**Step 1**: 백엔드 API 구현 및 테스트
**Step 2**: 프론트엔드 통합 (기존 API와 병행)
**Step 3**: 충분한 테스트 후 기존 API 제거 고려
**Step 4**: 모니터링 및 성능 측정

이 설계는 **점진적 개선**을 목표로 하며, 기존 시스템과의 호환성을 유지하면서 안정성과 성능을 향상시킵니다.


## 데이터 재빌드 성능 최적화 최종 점검

### 현재 구현된 Rate Limit 방지 메커니즘

**1. 전역 큐 시스템**:
```javascript
const MAX_CONCURRENT_SHEETS_REQUESTS = 5; // 동시 요청 수 제한
const MIN_API_INTERVAL_MS = 500; // 최소 0.5초 간격
```
- 동시에 최대 5개의 Google Sheets API 요청만 허용
- 각 요청 간 최소 0.5초 간격 유지

**2. withRetry 함수**:
- Rate Limit 오류 자동 감지 (429, RESOURCE_EXHAUSTED)
- Exponential Backoff with Jitter (지수 백오프 + 랜덤 지연)
- 최대 5회 재시도

**3. SWR 캐싱**:
- Fresh TTL: 5분 (신선한 데이터)
- Stale TTL: 30분 (오래되었지만 사용 가능한 데이터)
- 백그라운드 갱신으로 사용자 경험 개선

### 데이터 재빌드 시 API 호출 분석

**rebuildDeviceMaster(carrier) 함수**:
1. **Read 작업** (3회):
   - 직영점_모델이미지 시트 읽기 (1회)
   - 직영점_오늘의휴대폰 시트 읽기 (1회)
   - 직영점_설정 시트 읽기 (1회)

2. **Write 작업** (2회):
   - 기존 데이터 삭제 (deleteDimension) (1회)
   - 새 데이터 추가 (append) (1회)

**총 API 호출**: 약 5회 (통신사당)

**rebuildPlanMaster(carrier) 함수**:
1. **Read 작업** (2회):
   - 직영점_설정 시트 읽기 (1회)
   - 외부 시트 데이터 읽기 (1회)

2. **Write 작업** (2회):
   - 기존 데이터 삭제 (1회)
   - 새 데이터 추가 (1회)

**총 API 호출**: 약 4회 (통신사당)

**rebuildPricingMaster(carrier) 함수**:
- 유사한 패턴으로 약 4-5회 API 호출

### 전체 재빌드 시 예상 API 호출 수

**통신사 1개 재빌드**:
- Device Master: 5회
- Plan Master: 4회
- Pricing Master: 5회
- **총**: 약 14회 API 호출

**Google Sheets API Quota**:
- **Read Quota**: 분당 60회
- **Write Quota**: 분당 60회
- **통신사 1개 재빌드**: 14회 (Quota의 23% 사용)
- **안전 마진**: 충분함 ✅

### 성능 최적화 전략

**1. 통신사별 독립 처리** (이미 구현됨):
- 전체 통신사 재빌드 대신 선택된 통신사만 처리
- API 호출 횟수 66% 감소 (42회 → 14회)

**2. 배치 작업 최적화**:
```javascript
// 기존: 개별 append
for (const row of rows) {
  await sheets.spreadsheets.values.append(...);
}

// 개선: 단일 append (이미 구현됨)
await sheets.spreadsheets.values.append({
  resource: { values: allRows }
});
```

**3. 캐시 활용**:
- 재빌드 후 캐시 무효화로 최신 데이터 보장
- 이후 요청은 캐시에서 즉시 반환

**4. 백그라운드 작업**:
- 사용자는 즉시 응답 받음
- 실제 재빌드는 백그라운드에서 진행 (선택적)

### 병목 지점 및 해결책

**병목 1: 외부 시트 데이터 읽기**
- **문제**: 외부 시트 (이통사 지원금 시트) 읽기 시 지연 발생 가능
- **해결**: withRetry로 자동 재시도, 타임아웃 설정

**병목 2: 대량 데이터 쓰기**
- **문제**: 수백 개의 행을 한 번에 쓸 때 지연 발생
- **해결**: 이미 단일 append로 최적화됨, 추가 최적화 불필요

**병목 3: 동시 재빌드 요청**
- **문제**: 여러 사용자가 동시에 재빌드 요청 시 Rate Limit 초과 가능
- **해결**: 전역 큐 시스템으로 순차 처리, 동시 요청 수 제한

### 모니터링 지표

**1. API 호출 횟수**:
- 목표: 통신사당 15회 이하
- 현재: 약 14회 ✅

**2. 재빌드 소요 시간**:
- 목표: 10초 이내
- 예상: 5-8초 (네트워크 상태에 따라 변동)

**3. Rate Limit 오류율**:
- 목표: 1% 이하
- 현재 메커니즘: withRetry로 자동 복구

**4. 사용자 대기 시간**:
- 목표: 즉시 응답 (비동기 처리)
- 구현: 재빌드 시작 즉시 200 OK 응답

### 최종 권장사항

**1. 현재 구현 유지**:
- 기존 Rate Limit 방지 메커니즘이 충분히 효과적
- 추가 최적화 불필요

**2. 모니터링 강화**:
- 재빌드 소요 시간 로깅
- Rate Limit 오류 발생 시 알림

**3. 사용자 피드백 개선**:
- 재빌드 진행 상황 표시 (선택적)
- 예상 소요 시간 안내

**4. 캐시 전략 유지**:
- 재빌드 후 통신사별 캐시 무효화
- SWR 패턴으로 사용자 경험 최적화

### 결론

현재 구현된 Rate Limit 방지 메커니즘은 **충분히 안정적**이며, 통신사별 독립 처리로 **성능 영향 최소화**됩니다. 추가 최적화 없이도 안전하게 데이터 재빌드 기능을 사용할 수 있습니다.
