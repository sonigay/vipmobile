/**
 * Direct Store Additional Routes
 * 직영점 추가 엔드포인트 (누락된 엔드포인트 복구)
 */

module.exports = function createDirectStoreAdditionalRoutes(context) {
  const express = require('express');
  const router = express.Router();
  const multer = require('multer');
  
  const { sheetsClient, rateLimiter } = context;
  const { sheets, SPREADSHEET_ID } = sheetsClient;

  // 시트 이름 상수
  const CUSTOMER_PRE_APPROVAL_SHEET_NAME = '직영점_사전승낙서마크';
  const CUSTOMER_STORE_PHOTO_SHEET_NAME = '직영점_매장사진';
  const DIRECT_SALES_SHEET_NAME = '직영점_판매일보';

  // 시트 값 조회 헬퍼
  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      })
    );
    return response.data.values || [];
  }

  // GET /api/direct/drive-monitoring: Google Drive API 모니터링 데이터 조회
  router.get('/drive-monitoring', async (req, res) => {
    try {
      const days = parseInt(req.query.days) || 7; // 기본 7일
      
      // 간단한 모니터링 데이터 반환 (실제 구현은 필요에 따라 확장)
      const data = {
        period: days,
        status: 'healthy',
        lastUpdate: new Date().toISOString(),
        apiCalls: 0,
        errors: 0
      };

      res.json({
        success: true,
        data: data
      });
    } catch (error) {
      console.error('❌ [모니터링] 데이터 조회 오류:', error);
      res.status(500).json({
        success: false,
        error: '모니터링 데이터 조회에 실패했습니다: ' + error.message
      });
    }
  });

  // GET /api/direct/pre-approval-mark/:storeName: 사전승낙서마크 조회
  router.get('/pre-approval-mark/:storeName', async (req, res) => {
    const { storeName } = req.params;
    try {
      const values = await getSheetValues(CUSTOMER_PRE_APPROVAL_SHEET_NAME);
      if (!values || values.length <= 1) return res.json({ url: '' });

      const rows = values.slice(1);
      const mark = rows.find(row => row[0] === storeName);
      res.json({ url: mark ? mark[1] : '' });
    } catch (error) {
      console.error('사전승낙서마크 조회 오류:', error);
      res.status(500).json({ error: '조회에 실패했습니다.' });
    }
  });

  // POST /api/direct/pre-approval-mark: 사전승낙서마크 저장
  router.post('/pre-approval-mark', async (req, res) => {
    const { storeName, url } = req.body;
    try {
      const values = await getSheetValues(CUSTOMER_PRE_APPROVAL_SHEET_NAME);
      const updatedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (!values || values.length === 0) {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_PRE_APPROVAL_SHEET_NAME}!A1:C1`,
            valueInputOption: 'RAW',
            resource: { values: [['업체명', '사전승낙서마크URL', '수정일시']] }
          })
        );
      }

      const rowIndex = values ? values.findIndex(row => row[0] === storeName) : -1;

      if (rowIndex === -1) {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_PRE_APPROVAL_SHEET_NAME}!A:C`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[storeName, url, updatedAt]] }
          })
        );
      } else {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_PRE_APPROVAL_SHEET_NAME}!A${rowIndex + 1}:C${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[storeName, url, updatedAt]] }
          })
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error('사전승낙서마크 저장 오류:', error);
      res.status(500).json({ error: '저장에 실패했습니다.' });
    }
  });

  // GET /api/direct/store-image/:storeName: 매장 사진 조회
  router.get('/store-image/:storeName', async (req, res) => {
    const { storeName } = req.params;
    try {
      const values = await getSheetValues(CUSTOMER_STORE_PHOTO_SHEET_NAME);
      if (!values || values.length <= 1) return res.json(null);

      const rows = values.slice(1);
      const storeData = rows.find(row => row[0] === storeName);
      
      if (!storeData) {
        return res.json(null);
      }

      res.json({
        storeName: storeData[0] || '',
        exteriorUrl: storeData[1] || '',
        interiorUrl: storeData[2] || '',
        updatedAt: storeData[3] || ''
      });
    } catch (error) {
      console.error('매장 사진 조회 오류:', error);
      res.status(500).json({ error: '조회에 실패했습니다.' });
    }
  });

  // POST /api/direct/store-image: 매장 사진 정보 저장
  router.post('/store-image', async (req, res) => {
    const data = req.body;
    const storeName = data.storeName;
    
    try {
      const values = await getSheetValues(CUSTOMER_STORE_PHOTO_SHEET_NAME);
      const updatedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (!values || values.length === 0) {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_STORE_PHOTO_SHEET_NAME}!A1:D1`,
            valueInputOption: 'RAW',
            resource: { values: [['업체명', '외부사진URL', '내부사진URL', '수정일시']] }
          })
        );
      }

      const rowIndex = values ? values.findIndex(row => row[0] === storeName) : -1;
      const newRow = [
        storeName,
        data.exteriorUrl || '',
        data.interiorUrl || '',
        updatedAt
      ];

      if (rowIndex === -1) {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_STORE_PHOTO_SHEET_NAME}!A:D`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] }
          })
        );
      } else {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_STORE_PHOTO_SHEET_NAME}!A${rowIndex + 1}:D${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] }
          })
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error('매장 사진 저장 오류:', error);
      res.status(500).json({ error: '저장에 실패했습니다.' });
    }
  });

  // GET /api/direct/sales: 판매일보 목록 조회
  router.get('/sales', async (req, res) => {
    try {
      const values = await getSheetValues(DIRECT_SALES_SHEET_NAME);
      
      if (!values || values.length <= 1) {
        return res.json([]);
      }

      const headers = values[0];
      const rows = values.slice(1);
      
      const sales = rows.map((row, index) => {
        const sale = {};
        headers.forEach((header, idx) => {
          sale[header] = row[idx] || '';
        });
        sale.id = row[0] || `SALE_${index}`;
        return sale;
      });

      res.json(sales);
    } catch (error) {
      console.error('판매일보 조회 실패:', error);
      res.status(500).json({ error: '판매일보 조회 실패' });
    }
  });

  // POST /api/direct/sales: 판매일보 생성
  router.post('/sales', async (req, res) => {
    try {
      const data = req.body;
      const values = await getSheetValues(DIRECT_SALES_SHEET_NAME);
      
      // 헤더가 없으면 생성
      if (!values || values.length === 0) {
        const headers = [
          '번호', 'POS코드', '업체명', '매장ID', '판매일시', '고객명', 'CTN', '통신사',
          '단말기모델명', '색상', '단말일련번호', '유심모델명', '유심일련번호',
          '개통유형', '전통신사', '할부구분', '할부개월', '약정', '요금제', '부가서비스',
          '출고가', '이통사지원금', '대리점추가지원금', '대리점추가지원금직접입력', '마진', '할부원금', 'LG프리미어약정', '상태'
        ];
        
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${DIRECT_SALES_SHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            resource: { values: [headers] }
          })
        );
      }

      // 새 행 추가
      const newRow = [
        data.번호 || '',
        data.POS코드 || '',
        data.업체명 || '',
        data.매장ID || '',
        data.판매일시 || new Date().toISOString(),
        data.고객명 || '',
        data.CTN || '',
        data.통신사 || '',
        data.단말기모델명 || '',
        data.색상 || '',
        data.단말일련번호 || '',
        data.유심모델명 || '',
        data.유심일련번호 || '',
        data.개통유형 || '',
        data.전통신사 || '',
        data.할부구분 || '',
        data.할부개월 || '',
        data.약정 || '',
        data.요금제 || '',
        data.부가서비스 || '',
        data.출고가 || '',
        data.이통사지원금 || '',
        data.대리점추가지원금 || '',
        data.대리점추가지원금직접입력 || '',
        data.마진 || '',
        data.할부원금 || '',
        data.LG프리미어약정 || '',
        data.상태 || '대기'
      ];

      await rateLimiter.execute(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${DIRECT_SALES_SHEET_NAME}!A:AB`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        })
      );

      res.json({ success: true });
    } catch (error) {
      console.error('판매일보 생성 실패:', error);
      res.status(500).json({ error: '판매일보 생성 실패' });
    }
  });

  // PUT /api/direct/sales/:id: 판매일보 수정
  router.put('/sales/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      const values = await getSheetValues(DIRECT_SALES_SHEET_NAME);
      const rowIndex = values.findIndex(row => row[0] === id);
      
      if (rowIndex === -1) {
        return res.status(404).json({ error: '판매일보를 찾을 수 없습니다.' });
      }

      // 기존 행 업데이트
      const updatedRow = [...values[rowIndex]];
      Object.keys(data).forEach(key => {
        const colIndex = values[0].indexOf(key);
        if (colIndex !== -1) {
          updatedRow[colIndex] = data[key];
        }
      });

      await rateLimiter.execute(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${DIRECT_SALES_SHEET_NAME}!A${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        })
      );

      res.json({ success: true });
    } catch (error) {
      console.error('판매일보 수정 실패:', error);
      res.status(500).json({ error: '판매일보 수정 실패' });
    }
  });

  // 중복 엔드포인트 제거됨:
  // - POST /api/verify-password → authRoutes.js에서 처리
  // - POST /api/verify-direct-store-password → authRoutes.js에서 처리

  return router;
};
