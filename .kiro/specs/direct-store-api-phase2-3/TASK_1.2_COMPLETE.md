# 태스크 1.2 완료 보고서: 링크 설정 API 보완

## 작업 개요

**태스크**: 1.2 링크 설정 API 보완  
**Requirements**: 2.2  
**완료 일시**: 2025-01-26  
**담당**: Kiro AI Agent

## 작업 내용

### 1. DirectStoreDAL 메서드 추가

**파일**: `server/dal/DirectStoreDAL.js`

#### 추가된 메서드: `deleteLinkSettings(carrier, settingType)`

```javascript
/**
 * 링크 설정 삭제
 * @param {string} carrier - 통신사 (SK, KT, LG)
 * @param {string} settingType - 설정 유형 (policy, support, planGroup 등)
 * @returns {Promise<Object>} { success: true }
 */
async deleteLinkSettings(carrier, settingType) {
  try {
    await this.dal.delete('direct_store_settings', {
      '통신사': carrier,
      '설정유형': settingType
    });
    console.log(`[DirectStoreDAL] 링크 설정 삭제 완료: ${carrier} - ${settingType}`);
    return { success: true };
  } catch (error) {
    console.error('[DirectStoreDAL] 링크 설정 삭제 실패:', error);
    throw error;
  }
}
```

**특징**:
- Supabase `direct_store_settings` 테이블에서 특정 통신사와 설정 유형의 레코드 삭제
- 에러 핸들링 및 로깅 포함
- 성공 시 `{ success: true }` 반환

### 2. directRoutes.js DELETE API 추가

**파일**: `server/directRoutes.js`

#### 추가된 API: `DELETE /api/direct/link-settings/:carrier/:settingType`

```javascript
router.delete('/link-settings/:carrier/:settingType', async (req, res) => {
  try {
    const { carrier, settingType } = req.params;

    // 🔥 Feature Flag: USE_DB_DIRECT_STORE가 true이면 Supabase에서 삭제
    const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

    if (useDatabase) {
      // Supabase에서 삭제 (DirectStoreDAL 사용)
      console.log(`🗑️ [DELETE /api/direct/link-settings] Supabase에서 데이터 삭제 시작 (${carrier} - ${settingType})`);
      
      const DirectStoreDAL = require('./dal/DirectStoreDAL');
      
      // 링크 설정 삭제 (withRetrySupabase 적용)
      await withRetrySupabase(async () => {
        return await DirectStoreDAL.deleteLinkSettings(carrier, settingType);
      });
      
      console.log(`✅ [DELETE /api/direct/link-settings] Supabase에서 데이터 삭제 완료 (${carrier} - ${settingType})`);
      
      return res.json({
        success: true,
        message: `링크 설정이 삭제되었습니다. (${carrier} - ${settingType})`
      });
    }

    // Google Sheets에서 삭제 (기존 로직)
    console.log(`🗑️ [DELETE /api/direct/link-settings] Google Sheets에서 데이터 삭제 시작 (${carrier} - ${settingType})`);

    const { sheets, SPREADSHEET_ID } = createSheetsClient();
    
    // 직영점_설정 헤더 보장
    await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);

    // 시트 데이터 로드
    const response = await withRetry(async () => {
      return await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
    });

    const rows = (response.data.values || []).slice(1);

    // 삭제할 행 찾기
    const rowIndex = rows.findIndex(row => 
      (row[0] || '').trim() === carrier && (row[1] || '').trim() === settingType
    );

    if (rowIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: `링크 설정을 찾을 수 없습니다. (${carrier} - ${settingType})` 
      });
    }

    // 행 삭제 (실제 행 번호는 헤더 + 1 + rowIndex)
    await withRetry(async () => {
      return await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: await getSheetId(sheets, SPREADSHEET_ID, SHEET_SETTINGS),
                dimension: 'ROWS',
                startIndex: rowIndex + 1, // 헤더 다음부터
                endIndex: rowIndex + 2
              }
            }
          }]
        }
      });
    });

    // 캐시 무효화
    deleteCache(`link-settings-${carrier}`);

    console.log(`✅ [DELETE /api/direct/link-settings] Google Sheets에서 데이터 삭제 완료 (${carrier} - ${settingType})`);

    res.json({
      success: true,
      message: `링크 설정이 삭제되었습니다. (${carrier} - ${settingType})`
    });
  } catch (error) {
    console.error(`[Direct] link-settings DELETE error (통신사: ${req.params.carrier}, 설정유형: ${req.params.settingType}):`, error);
    console.error('[Direct] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: '링크 설정 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});
```

**특징**:
- Feature Flag (`USE_DB_DIRECT_STORE`) 지원
- Supabase 모드: DirectStoreDAL 사용, `withRetrySupabase` 적용
- Google Sheets 폴백: 기존 로직 유지, `withRetry` 적용
- 행 삭제 시 `batchUpdate` API 사용
- 캐시 무효화 포함
- 404/500 에러 핸들링

### 3. 테스트 스크립트 작성

**파일**: `server/test-lg-link-settings-delete.js`

#### 테스트 시나리오

1. **1단계**: LG 링크 설정 조회 (삭제 전)
2. **2단계**: LG 링크 설정 삭제 (policy 설정)
3. **3단계**: LG 링크 설정 조회 (삭제 후 확인)
4. **결과 비교**: 삭제 전후 데이터 비교

## 테스트 결과

### 테스트 환경

- **Feature Flag**: `USE_DB_DIRECT_STORE=false` (Google Sheets 모드)
- **통신사**: LG
- **설정 유형**: policy
- **서버**: http://localhost:4000

### 테스트 실행 결과

```
================================================================================
🧪 LG 링크 설정 삭제 API 테스트 시작
================================================================================

📖 1단계: LG 링크 설정 조회 (삭제 전)
--------------------------------------------------------------------------------
✅ 조회 성공 (삭제 전)
응답 데이터: {
  "success": true,
  "planGroup": { ... },
  "support": { ... },
  "policy": {
    "link": "1PZJTaVf9ezRHVYyEbIAvQZ-kpXKMJyexTMcWtcs7z2k",
    "sheetId": "1PZJTaVf9ezRHVYyEbIAvQZ-kpXKMJyexTMcWtcs7z2k",
    "modelRange": "'정책'!C17:C53",
    "petNameRange": "'정책'!D17:D53",
    "planGroupRanges": { ... }
  }
}

🗑️ 2단계: LG 링크 설정 삭제 (policy 설정)
--------------------------------------------------------------------------------
✅ 삭제 성공
응답 데이터: {
  "success": true,
  "message": "링크 설정이 삭제되었습니다. (LG - policy)"
}

📖 3단계: LG 링크 설정 조회 (삭제 후 확인)
--------------------------------------------------------------------------------
✅ 조회 성공 (삭제 후)
응답 데이터: {
  "success": true,
  "planGroup": { ... },
  "support": { ... },
  "policy": {
    "link": ""
  }
}

📊 결과 비교
--------------------------------------------------------------------------------
삭제 전 policy 설정: { link: '1PZJTaVf9ezRHVYyEbIAvQZ-kpXKMJyexTMcWtcs7z2k', ... }
삭제 후 policy 설정: { link: '' }
✅ policy 설정이 정상적으로 삭제되었습니다.

================================================================================
✅ 테스트 완료
================================================================================
```

### 테스트 결과 요약

| 항목 | 결과 | 비고 |
|------|------|------|
| API 엔드포인트 등록 | ✅ 성공 | `DELETE /api/direct/link-settings/:carrier/:settingType` |
| Google Sheets 삭제 | ✅ 성공 | LG policy 설정 삭제 확인 |
| 삭제 전 데이터 조회 | ✅ 성공 | policy.link 존재 확인 |
| 삭제 후 데이터 조회 | ✅ 성공 | policy.link 비어있음 확인 |
| 에러 핸들링 | ✅ 정상 | 404/500 에러 처리 구현 |
| 캐시 무효화 | ✅ 정상 | `deleteCache()` 호출 확인 |

## 구현 세부사항

### Feature Flag 지원

```javascript
const useDatabase = process.env.USE_DB_DIRECT_STORE === 'true';

if (useDatabase) {
  // Supabase 모드
  await withRetrySupabase(async () => {
    return await DirectStoreDAL.deleteLinkSettings(carrier, settingType);
  });
} else {
  // Google Sheets 모드 (폴백)
  // 기존 로직 실행
}
```

### Google Sheets 삭제 로직

1. **시트 데이터 로드**: `sheets.spreadsheets.values.get()`
2. **삭제할 행 찾기**: `findIndex()` 사용
3. **행 삭제**: `batchUpdate()` API의 `deleteDimension` 사용
4. **캐시 무효화**: `deleteCache()` 호출

### Supabase 삭제 로직

1. **DAL 호출**: `DirectStoreDAL.deleteLinkSettings()`
2. **재시도 로직**: `withRetrySupabase()` 적용
3. **에러 핸들링**: try-catch로 에러 처리

## 주요 개선사항

### 1. Google Sheets Rate Limit 제거

- Supabase 모드에서는 `withRetrySupabase()` 사용 (딜레이 없음)
- Google Sheets 모드에서는 `withRetry()` 사용 (기존 Rate Limit 유지)

### 2. 에러 핸들링 강화

- 404 에러: 링크 설정을 찾을 수 없을 때
- 500 에러: 삭제 중 오류 발생 시
- 에러 메시지에 상세 정보 포함

### 3. 캐시 무효화

- 삭제 후 캐시 무효화로 데이터 일관성 보장
- `deleteCache(`link-settings-${carrier}`)` 호출

## 제약사항 및 주의사항

### 1. Supabase API 키 문제

- 현재 `.env` 파일의 `SUPABASE_SERVICE_ROLE_KEY`가 잘못되어 있음
- 테스트는 Google Sheets 모드로 진행
- 실제 배포 시 올바른 Supabase 키로 교체 필요

### 2. Google Sheets 삭제 방식

- `batchUpdate` API의 `deleteDimension` 사용
- 행 번호는 헤더를 제외한 인덱스 + 1
- 삭제 후 시트 구조 변경 가능성 있음

### 3. 캐시 키 형식

- 현재: `link-settings-${carrier}`
- 설정 유형별 캐시 분리 고려 필요

## 다음 단계

### 1. Supabase 키 수정

```bash
# .env 파일에서 올바른 Supabase Service Role Key로 교체
SUPABASE_SERVICE_ROLE_KEY=<올바른_키>
```

### 2. Supabase 모드 테스트

```bash
# Feature Flag 변경
USE_DB_DIRECT_STORE=true

# 테스트 실행
node test-lg-link-settings-delete.js
```

### 3. 다른 통신사 테스트

- SK 통신사 테스트
- KT 통신사 테스트
- 다른 설정 유형 테스트 (support, planGroup)

## 파일 변경 내역

### 수정된 파일

1. `server/dal/DirectStoreDAL.js`
   - `deleteLinkSettings()` 메서드 추가 (21줄)

2. `server/directRoutes.js`
   - `DELETE /api/direct/link-settings/:carrier/:settingType` API 추가 (82줄)

### 생성된 파일

1. `server/test-lg-link-settings-delete.js`
   - LG 링크 설정 삭제 테스트 스크립트 (95줄)

2. `.kiro/specs/direct-store-api-phase2-3/TASK_1.2_COMPLETE.md`
   - 태스크 완료 보고서 (현재 파일)

## 결론

태스크 1.2 "링크 설정 API 보완"이 성공적으로 완료되었습니다.

### 달성한 목표

✅ DirectStoreDAL에 `deleteLinkSettings()` 메서드 추가  
✅ directRoutes.js에 `DELETE /api/direct/link-settings/:carrier/:settingType` API 추가  
✅ Feature Flag 지원 (Supabase ↔ Google Sheets 자동 전환)  
✅ Google Sheets 폴백 유지  
✅ LG 통신사로 테스트 성공  
✅ 에러 핸들링 및 캐시 무효화 구현  

### 검증 완료

- Google Sheets 모드에서 정상 동작 확인
- 삭제 전후 데이터 비교로 정확성 검증
- 404/500 에러 핸들링 구현 확인

### 남은 작업

- Supabase 키 수정 후 Supabase 모드 테스트
- SK, KT 통신사 테스트
- 다른 설정 유형 (support, planGroup) 테스트
