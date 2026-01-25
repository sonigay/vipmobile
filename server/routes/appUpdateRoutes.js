const express = require('express');
const router = express.Router();

function createAppUpdateRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  const UPDATE_SHEET_NAME = '어플업데이트';
  const SPREADSHEET_ID = sheetsClient?.SPREADSHEET_ID || process.env.SHEET_ID;
  const sheets = sheetsClient?.sheets;

  // 캐시 사용하여 시트 데이터 가져오기
  async function getSheetValues(sheetName) {
    const cacheKey = `sheet_${sheetName}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;

    const response = await rateLimiter.execute(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      })
    );
    const values = response.data.values || [];
    cacheManager.set(cacheKey, values, 5 * 60 * 1000); // 5분 캐시
    return values;
  }

  // 어플업데이트 데이터 조회 API
  router.get('/app-updates', async (req, res) => {
  try {
    console.log('어플업데이트 데이터 요청');

    const values = await getSheetValues(UPDATE_SHEET_NAME);

    if (!values || values.length === 0) {
      console.log('어플업데이트 데이터가 없습니다.');
      return res.json({ success: true, data: [] });
    }

    // 헤더 2행 제거하고 데이터 반환 (3행부터 시작)
    const dataRows = values.slice(2);

    // 빈 행 제거
    const filteredData = dataRows.filter(row =>
      row.length > 0 && row.some(cell => cell && cell.toString().trim() !== '')
    );

    console.log(`어플업데이트 데이터 처리 완료: ${filteredData.length}건`);

    res.json({ success: true, data: filteredData });

  } catch (error) {
    console.error('어플업데이트 데이터 가져오기 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 어플업데이트 추가 API
router.post('/app-updates', async (req, res) => {
  try {
    console.log('새 어플업데이트 추가 요청:', req.body);

    // 환경 변수 체크
    if (!SPREADSHEET_ID) {
      console.error('❌ [어플업데이트] SHEET_ID 환경 변수가 설정되지 않음');
      return res.status(500).json({
        success: false,
        error: '서버 설정 오류: SHEET_ID가 설정되지 않았습니다.'
      });
    }

    const { mode, date, content } = req.body;

    if (!mode || !date || !content) {
      return res.status(400).json({
        success: false,
        error: '모드, 날짜, 내용이 모두 필요합니다.'
      });
    }

    // 모드별 컬럼 매핑
    const modeColumnMap = {
      'general': 2,              // C열: 일반모드
      'basicMode': 2,            // C열: 기본 모드 (별칭)
      'basic': 2,                // C열: 기본 모드 (별칭)
      'agent': 3,                // D열: 관리자모드
      'inventory': 4,            // E열: 재고관리모드
      'settlement': 5,           // F열: 정산모드
      'inspection': 6,           // G열: 검수모드
      'policy': 7,               // H열: 정책모드
      'meeting': 8,              // I열: 회의모드
      'reservation': 9,          // J열: 사전예약모드
      'chart': 10,               // K열: 장표모드
      'budget': 11,              // L열: 예산모드
      'sales': 12,               // M열: 영업모드
      'inventoryRecovery': 13,   // N열: 재고회수모드
      'inventory-recovery': 13,  // 별칭
      'dataCollection': 14,      // O열: 정보수집모드
      'data-collection': 14,     // 별칭
      'smsManagement': 15,       // P열: SMS 관리모드
      'sms-management': 15,      // 별칭
      'obManagement': 16,        // Q열: OB 관리모드
      'ob-management': 16,       // 별칭
      'onSaleManagement': 17,    // R열: 온세일관리모드
      'onsale-management': 17,   // 별칭
      'onSaleReception': 18,     // S열: 온세일접수모드
      'onsale-reception': 18,    // 별칭
      'mealAllowance': 19,       // T열: 식대 모드
      'attendance': 20,          // U열: 근퇴 모드
      'riskManagement': 21,      // V열: 리스크 관리 모드
      'directStoreManagement': 22, // W열: 직영점 관리 모드
      'directStore': 23,         // X열: 직영점 모드 (일반)
      'quickServiceManagement': 24 // Y열: 퀵서비스 관리 모드
    };

    const columnIndex = modeColumnMap[mode];
    if (columnIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 모드입니다.'
      });
    }

    // 새 행 데이터 생성
    const newRow = new Array(25).fill(''); // A~Y열 (25개 컬럼)
    newRow[0] = date;  // A열: 날짜
    newRow[columnIndex] = content;  // 해당 모드 컬럼에 내용

    // Google Sheets에 새 행 추가
    const response = await rateLimiter.execute(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${UPDATE_SHEET_NAME}!A:Y`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [newRow]
        }
      })
    );

    console.log('어플업데이트 추가 완료:', response.data);

    res.json({
      success: true,
      message: '업데이트가 성공적으로 추가되었습니다.',
      data: response.data
    });

  } catch (error) {
    console.error('어플업데이트 추가 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

  return router;
}

module.exports = createAppUpdateRoutes;
