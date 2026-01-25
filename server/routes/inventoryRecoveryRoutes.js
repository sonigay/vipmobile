/**
 * 재고회수 모드 라우터
 * 
 * 원본: server/index.js.backup.original (36286-36670줄)
 * 
 * API 목록:
 * - GET /api/inventory-recovery/data - 재고회수 데이터 조회
 * - POST /api/inventory-recovery/update-status - 재고회수 상태 업데이트
 * - POST /api/inventory-recovery/priority-models - 우선순위 모델 저장
 * - GET /api/inventory-recovery/priority-models - 우선순위 모델 로드
 */

const express = require('express');
const { google } = require('googleapis');

function createInventoryRecoveryRoutes() {
  const router = express.Router();

  // Google Sheets 클라이언트 생성
  function createSheetsClient() {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return google.sheets({ version: 'v4', auth });
  }

  // Rate limit 헬퍼 함수
  async function rateLimitedSheetsCall(fn) {
    // 간단한 재시도 로직
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  /**
   * GET /api/inventory-recovery/data
   * 재고회수 데이터 조회
   * 
   * 원본: server/index.js.backup.original (36286-36424줄)
   */
  router.get('/data', async (req, res) => {
    console.log('🔍 [재고회수 API] 요청 받음 - 시작');
    console.log('🔍 [재고회수 API] 요청 헤더:', req.headers);
    console.log('🔍 [재고회수 API] 요청 URL:', req.url);
    console.log('🔍 [재고회수 API] 요청 메서드:', req.method);

    try {
      console.log('🔄 [재고회수] 데이터 조회 시작');

      const sheets = createSheetsClient();

      // 회수목록 시트만 가져오기 (좌표는 "회수목록" 시트에서 직접 읽기)
      console.log('🔍 [재고회수 API] Google Sheets API 호출 시작');
      console.log('🔍 [재고회수 API] Spreadsheet ID:', process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY');
      console.log('🔍 [재고회수 API] Sheet Name:', process.env.INVENTORY_RECOVERY_SHEET_NAME || '회수목록');

      const recoveryListResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY',
        range: (process.env.INVENTORY_RECOVERY_SHEET_NAME || '회수목록') + '!A:AA'
      });

      console.log('🔍 [재고회수 API] Google Sheets API 응답 받음');
      console.log('🔍 [재고회수 API] 응답 데이터 존재 여부:', !!recoveryListResponse.data.values);
      console.log('🔍 [재고회수 API] 응답 데이터 길이:', recoveryListResponse.data.values?.length || 0);

      if (!recoveryListResponse.data.values) {
        console.error('❌ [재고회수 API] 데이터를 가져올 수 없습니다.');
        throw new Error('데이터를 가져올 수 없습니다.');
      }

      // 헤더 제거
      const recoveryData = recoveryListResponse.data.values.slice(1);

      // 회수 데이터 처리
      console.log(`🔍 [재고회수] 원본 데이터: ${recoveryData.length}행`);

      const processedData = recoveryData
        .filter(row => {
          const hasEnoughColumns = row.length > 25;
          if (!hasEnoughColumns) {
            console.log(`⚠️ [재고회수] 컬럼 부족: ${row.length}개 (필요: 26개)`);
          }
          return hasEnoughColumns;
        })
        .map((row, index) => {
          const storeName = (row[25] || '').toString().trim(); // Z열(25번인덱스): 출고처(업체명)
          const latitude = parseFloat(row[8] || '0'); // I열(8번인덱스): 위도
          const longitude = parseFloat(row[9] || '0'); // J열(9번인덱스): 경도

          const item = {
            recoveryCompleted: row[10] || '', // K열(10번인덱스): 회수완료
            recoveryTargetSelected: row[11] || '', // L열(11번인덱스): 회수대상선정
            manager: row[12] || '', // M열(12번인덱스): 담당자
            address: row[7] || '', // H열(7번인덱스): 주소
            entryDate: row[13] || '', // N열(13번인덱스): 입고일
            status: row[14] || '', // O열(14번인덱스): 현황
            serialNumber: row[15] || '', // P열(15번인덱스): 일련번호
            category: row[16] || '', // Q열(16번인덱스): 종류
            modelName: row[17] || '', // R열(17번인덱스): 모델명
            color: row[18] || '', // S열(18번인덱스): 색상
            deviceStatus: row[19] || '', // T열(19번인덱스): 상태
            payment: row[20] || '', // U열(20번인덱스): 결제
            entryPrice: row[21] || '', // V열(21번인덱스): 입고가
            entrySource: row[22] || '', // W열(22번인덱스): 입고처
            carrier: row[23] || '', // X열(23번인덱스): 통신사
            employee: row[24] || '', // Y열(24번인덱스): 담당사원
            storeName, // Z열(25번인덱스): 출고처(업체명)
            recentShipmentDate: row[26] || '', // AA열(26번인덱스): 최근출고일
            latitude: latitude,
            longitude: longitude,
            hasCoordinates: latitude !== 0 && longitude !== 0,
            rowIndex: recoveryData.indexOf(row) + 2 // 실제 시트 행 번호 (헤더 제외)
          };

          console.log(`🔍 [재고회수] 행${index + 1}: ${storeName} (${latitude}, ${longitude})`);
          return item;
        })
        .filter(item => {
          const hasStoreName = item.storeName && item.storeName.length > 0;

          if (!hasStoreName) {
            console.log(`⚠️ [재고회수] 업체명 누락: ${JSON.stringify(item)}`);
          }

          return hasStoreName; // 좌표가 없어도 업체명만 있으면 포함
        });

      console.log(`✅ [재고회수] 데이터 조회 완료: ${processedData.length}개 항목`);
      console.log('🔍 [재고회수 API] 응답 데이터 샘플:', processedData.slice(0, 2));

      res.json({
        success: true,
        data: processedData
      });

      console.log('🔍 [재고회수 API] 응답 전송 완료');

    } catch (error) {
      console.error('❌ [재고회수] 데이터 조회 오류:', error);
      console.error('❌ [재고회수 API] 에러 스택:', error.stack);
      console.error('❌ [재고회수 API] 에러 메시지:', error.message);

      res.status(500).json({
        success: false,
        error: '재고회수 데이터 조회에 실패했습니다.',
        message: error.message
      });
    }
  });

  /**
   * POST /api/inventory-recovery/update-status
   * 재고회수 상태 업데이트
   * 
   * 원본: server/index.js.backup.original (36425-36513줄)
   */
  router.post('/update-status', async (req, res) => {
    try {
      const { rowIndex, column, value } = req.body;

      if (!rowIndex || !column || value === undefined) {
        return res.status(400).json({
          success: false,
          error: '필수 파라미터가 누락되었습니다. (rowIndex, column, value)'
        });
      }

      console.log(`🔄 [재고회수] 상태 업데이트: 행${rowIndex}, 열${column}, 값=${value}`);

      const sheets = createSheetsClient();

      // 구글시트 업데이트
      let ranges = [];
      let values = [];

      if (column === 'recoveryCompleted') {
        ranges.push(`회수목록!K${rowIndex}`); // K열(10번인덱스): 회수완료
        values.push([value]);
      } else if (column === 'recoveryTargetSelected') {
        ranges.push(`회수목록!L${rowIndex}`); // L열(11번인덱스): 회수대상선정
        values.push([value]);

        // 회수대상선정이 취소되면 회수완료도 자동으로 취소
        if (!value || value === '') {
          ranges.push(`회수목록!K${rowIndex}`); // K열(10번인덱스): 회수완료
          values.push(['']); // 빈 값으로 설정하여 취소
          console.log(`🔄 [재고회수] 회수대상선정 취소로 인한 회수완료 자동 취소: 행${rowIndex}`);
        }
      } else {
        throw new Error('유효하지 않은 컬럼입니다.');
      }

      // 각 셀을 개별적으로 업데이트
      for (let i = 0; i < ranges.length; i++) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY',
          range: ranges[i],
          valueInputOption: 'RAW',
          requestBody: {
            values: [values[i]]
          }
        });
      }

      console.log(`✅ [재고회수] 상태 업데이트 완료: 행${rowIndex}, 열${column} = ${value}`);

      res.json({
        success: true,
        message: '상태가 성공적으로 업데이트되었습니다.'
      });

    } catch (error) {
      console.error('❌ [재고회수] 상태 업데이트 오류:', error);
      res.status(500).json({
        success: false,
        error: '상태 업데이트에 실패했습니다.',
        message: error.message
      });
    }
  });

  /**
   * POST /api/inventory-recovery/priority-models
   * 우선순위 모델 저장
   * 
   * 원본: server/index.js.backup.original (36514-36592줄)
   */
  router.post('/priority-models', async (req, res) => {
    try {
      const { priorityModels } = req.body;

      if (!priorityModels || typeof priorityModels !== 'object') {
        return res.status(400).json({
          success: false,
          error: '우선순위 모델 데이터가 필요합니다.'
        });
      }

      console.log('🔄 [우선순위 모델] 저장 요청:', priorityModels);

      const sheets = createSheetsClient();

      // 구글시트에 우선순위 모델 저장 (회수목록 시트의 특정 셀에 저장)
      const ranges = [];
      const values = [];

      // 우선순위 모델을 JSON 형태로 저장할 셀 (우선순위 시트의 A1 셀)
      ranges.push('우선순위!A1');
      values.push([JSON.stringify(priorityModels)]);

      // 배치 업데이트 실행
      await rateLimitedSheetsCall(async () => {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY',
          resource: {
            valueInputOption: 'RAW',
            data: ranges.map((range, index) => ({
              range: range,
              values: [values[index]]
            }))
          }
        });
      });

      console.log('✅ [우선순위 모델] 저장 완료');

      res.json({
        success: true,
        message: '우선순위 모델이 성공적으로 저장되었습니다.',
        data: priorityModels
      });

    } catch (error) {
      console.error('❌ [우선순위 모델] 저장 오류:', error);
      res.status(500).json({
        success: false,
        error: '우선순위 모델 저장에 실패했습니다.',
        message: error.message
      });
    }
  });

  /**
   * GET /api/inventory-recovery/priority-models
   * 우선순위 모델 로드
   * 
   * 원본: server/index.js.backup.original (36593-36670줄)
   */
  router.get('/priority-models', async (req, res) => {
    try {
      console.log('🔄 [우선순위 모델] 로드 요청');

      const sheets = createSheetsClient();

      // 구글시트에서 우선순위 모델 데이터 로드 (우선순위 시트의 A1 셀)
      const response = await rateLimitedSheetsCall(async () => {
        return await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.INVENTORY_RECOVERY_SPREADSHEET_ID || '1soJE2C2svNCfLBSJsZBoXiBQIAglgefQpnehWqDUmuY',
          range: '우선순위!A1'
        });
      });

      let priorityModels = {
        '1순위': null,
        '2순위': null,
        '3순위': null,
        '4순위': null,
        '5순위': null,
        '6순위': null,
        '7순위': null,
        '8순위': null,
        '9순위': null,
        '10순위': null
      };

      // 데이터가 있으면 파싱
      if (response.data.values && response.data.values[0] && response.data.values[0][0]) {
        try {
          const savedData = JSON.parse(response.data.values[0][0]);
          priorityModels = { ...priorityModels, ...savedData };
          console.log('✅ [우선순위 모델] 로드 완료:', priorityModels);
        } catch (parseError) {
          console.warn('⚠️ [우선순위 모델] 파싱 오류, 기본값 사용:', parseError.message);
        }
      } else {
        console.log('ℹ️ [우선순위 모델] 저장된 데이터 없음, 기본값 사용');
      }

      res.json({
        success: true,
        data: priorityModels
      });

    } catch (error) {
      console.error('❌ [우선순위 모델] 로드 오류:', error);
      res.status(500).json({
        success: false,
        error: '우선순위 모델 로드에 실패했습니다.',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createInventoryRecoveryRoutes;
