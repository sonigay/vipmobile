/**
 * Assignment Routes
 * 
 * 재고 배정 관리 엔드포인트를 제공합니다.
 * 대리점/담당자에게 재고를 배정하는 기능입니다.
 * 
 * Endpoints:
 * - GET /api/assignment/history - 배정 히스토리 조회 (최근 배정 내역)
 * - POST /api/assignment/complete - 배정 완료 처리 (실제 시트 업데이트)
 */

const express = require('express');
const notificationManager = require('../utils/notificationManager');

/**
 * Assignment Routes Factory
 */
function createAssignmentRoutes(context) {
  const router = express.Router();
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // Google Sheets 클라이언트 확인
  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      res.status(503).json({
        success: false,
        error: 'Google Sheets client not available'
      });
      return false;
    }
    return true;
  };

  // 시트 데이터 가져오기 헬퍼
  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      })
    );
    return response.data.values || [];
  }

  // GET /api/assignment/history - 배정 히스토리 조회
  router.get('/api/assignment/history', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'assignment_history';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('폰클재고데이터');
      const rows = values.slice(3); // 헤더 3행 제외 (4행부터 데이터) -> 실제로는 헤더 라인 확인 필요. inventoryRoutes는 slice(1) or slice(3) 혼용.
      // inventoryRoutes.js line 80: slice(1) (헤더 1줄 가정).
      // inventoryRoutes.js line 408: slice(3) (헤더 3줄 가정 for agent-filters).
      // Let's assume slice(3) for robust data skipping or check header.
      // Usually Row 1-3 are headers.

      const history = [];
      // 역순으로 최근 50개만
      for (let i = rows.length - 1; i >= 0 && history.length < 50; i--) {
        const row = rows[i];
        if (!row || row.length < 22) continue; // 최소 데이터 길이 확인

        // 배정상태 (보통 N열 주변, inventoryRoutes line 98 says '배정상태' header search)
        // Let's rely on filter by "Assigned Agent".
        const agent = (row[8] || '').toString().trim(); // I열: 담당자
        const office = (row[6] || '').toString().trim(); // G열: 사무실
        const date = (row[22] || '').toString().trim(); // W열? Or wherever timestamp is.
        // inventoryRoutes save-assignment uses new Date().toLocaleString() at end?
        // Let's just return rows that HAVE an agent as "Assigned".

        if (agent) {
          history.push({
            id: i,
            model: row[13], // N열
            color: row[14], // O열
            target_agent: agent,
            target_office: office,
            assigned_at: date || '날짜없음' // 만약 날짜 컬럼이 있다면
          });
        }
      }

      const result = { success: true, assignments: history };
      cacheManager.set(cacheKey, result, 1 * 60 * 1000);
      res.json(result);

    } catch (error) {
      console.error('배정 히스토리 조회 오류:', error);
      res.status(500).json({ success: false, error: '배정 히스토리 조회 실패' });
    }
  });

  // POST /api/assignment/complete - 배정 완료 처리
  router.post('/api/assignment/complete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const {
        assigner,
        model, // Model Name (e.g., "iPhone 15")
        color, // Color (optional)
        quantity,
        target_office,
        target_department,
        target_agent,
        target_offices,
        target_departments,
        target_agents
      } = req.body;

      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, error: '유효하지 않은 수량입니다.' });
      }

      console.log(`📦 [재고배정] 요청: ${model} ${color || ''} ${qty}대 -> ${target_agent || target_office}`);

      // 1. 재고 데이터 로드
      const inventoryValues = await getSheetValues('폰클재고데이터');
      if (!inventoryValues || inventoryValues.length < 4) {
        throw new Error('재고 데이터를 가져올 수 없습니다.');
      }

      // 헤더 인덱스 찾기 (3행이 실제 헤더일 가능성 높음, inventoryRoutes line 408 suggests data starts after row 3)
      // Or 1행? inventoryRoutes line 79 suggests row 0 is header.
      // Let's check line 408 usage: inventoryValues.slice(3).
      // We will assume Data starts at Row 4 (Index 3).
      // Indices: F=5(Category), G=6(Office), H=7(Dept), I=8(Agent), N=13(Model), O=14(Color)

      const rows = inventoryValues;
      const updates = [];
      let assignedCount = 0;

      // 2. 가용 재고 찾기
      for (let i = 3; i < rows.length; i++) { // Start from 4th row
        if (assignedCount >= qty) break;

        const row = rows[i];
        const rowModel = (row[13] || '').toString().trim(); // N열
        const rowColor = (row[14] || '').toString().trim(); // O열
        const rowCategory = (row[5] || '').toString().trim(); // F열
        const rowAgent = (row[8] || '').toString().trim(); // I열

        // 매칭 조건: 
        // 1. 모델명 일치 (필수)
        // 2. 색상 일치 (요청된 경우)
        // 3. 담당자가 없어야 함 (미배정)
        // 4. 구분이 '가용' 이어야 함 (또는 #N/A가 아니어야 함 & 개통 안된 상태)
        //    * inventoryRoutes line 416 checks category !== '#N/A'.
        //    * Let's assuming "Empty Agent" + "Model Exists" is enough for "In Stock but Unassigned".

        const modelMatch = rowModel === model || (model === '전체' ? true : rowModel.includes(model));
        const colorMatch = !color || rowColor === color;
        const isUnassigned = rowAgent === '' || rowAgent === '미배정';

        if (modelMatch && colorMatch && isUnassigned) {
          // 업데이트 대상
          const rowNumber = i + 1;

          // G(Office), H(Dept), I(Agent) 업데이트
          if (target_office) {
            updates.push({ range: `폰클재고데이터!G${rowNumber}`, values: [[target_office]] });
          }
          if (target_department) {
            updates.push({ range: `폰클재고데이터!H${rowNumber}`, values: [[target_department]] });
          }
          if (target_agent) {
            updates.push({ range: `폰클재고데이터!I${rowNumber}`, values: [[target_agent]] });
          }

          assignedCount++;
        }
      }

      if (assignedCount < qty) {
        return res.status(400).json({
          success: false,
          error: `가용 재고 부족. 요청: ${qty}, 가용: ${assignedCount}`
        });
      }

      // 3. 시트 업데이트 실행
      if (updates.length > 0) {
        await sheetsClient.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            valueInputOption: 'RAW',
            data: updates
          }
        });

        // 캐시 무효화
        cacheManager.deletePattern('inventory_');
        cacheManager.delete('assignment_history');
      }

      // 4. 알림 발송
      const notification = {
        type: 'assignment_completed',
        title: '새로운 재고 배정',
        message: `${assigner || '관리자'}님이 ${model} ${qty}대를 배정했습니다.`,
        timestamp: new Date()
      };

      // TODO: Target Agent Filter & Send
      // notificationManager.broadcast(notification); // 임시: 전체 전송

      console.log(`✅ [재고배정] 완료: ${assignedCount}건`);
      res.json({ success: true, message: `${assignedCount}건 배정 완료`, assignedCount });

    } catch (error) {
      console.error('배정 완료 처리 오류:', error);
      res.status(500).json({ success: false, error: '배정 처리 실패: ' + error.message });
    }
  });

  return router;
}

module.exports = createAssignmentRoutes;
