/**
 * Onsale Routes
 * 
 * 온세일(개통정보) 관련 엔드포인트를 제공합니다.
 * - 개통정보 관리 (CRUD, 상태 변경)
 * - 온세일 링크 관리
 * - 정책 게시판 관리
 * - U+ 제출 데이터 처리
 * 
 * Endpoints:
 * - POST /api/onsale/activation-info/:sheetId/:rowIndex/complete - 개통완료
 * - POST /api/onsale/activation-info/:sheetId/:rowIndex/pending - 개통보류
 * - POST /api/onsale/activation-info/:sheetId/:rowIndex/unpending - 보류해제
 * - POST /api/onsale/activation-info/:sheetId/:rowIndex/cancel - 개통취소
 * - GET /api/onsale/activation-list - 개통정보 목록
 * - GET /api/onsale/activation-info/:sheetId/:rowIndex - 개통정보 조회
 * - PUT /api/onsale/activation-info/:sheetId/:rowIndex - 개통정보 수정
 * - POST /api/onsale/activation-info - 개통정보 저장
 * - POST /api/onsale/uplus-submission - U+ 제출 데이터 저장
 * - GET /api/onsale/links - 온세일 링크 목록 (관리자)
 * - GET /api/onsale/active-links - 활성화된 링크 (일반)
 * - POST /api/onsale/links - 링크 추가
 * - PUT /api/onsale/links/:rowIndex - 링크 수정
 * - DELETE /api/onsale/links/:rowIndex - 링크 삭제
 * - GET /api/onsale/policies/groups - 정책 그룹 목록
 * - GET /api/onsale/policies - 정책 목록
 * - GET /api/onsale/policies/:id - 정책 상세
 * - POST /api/onsale/policies - 정책 등록
 * - PUT /api/onsale/policies/:id - 정책 수정
 * - DELETE /api/onsale/policies/:id - 정책 삭제
 * - POST /api/onsale/policies/:id/view - 정책 확인 이력
 * - POST /api/onsale-proxy - 온세일 프록시
 * 
 * Requirements: 1.1, 1.2, 7.15
 */

const express = require('express');
const router = express.Router();

/**
 * Onsale Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @param {Object} context.discordBot - Discord 봇
 * @returns {express.Router} Express 라우터
 */
function createOnsaleRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter, discordBot } = context;

  // Google Sheets 클라이언트가 없으면 에러 응답 반환하는 헬퍼 함수
  const requireSheetsClient = (res) => {
    if (!sheetsClient) {
      res.status(503).json({
        success: false,
        error: 'Google Sheets client not available. Please check environment variables.'
      });
      return false;
    }
    return true;
  };

  // 시트 데이터 가져오기 헬퍼 함수
  async function getSheetValues(sheetName, spreadsheetId = null) {
    const targetSpreadsheetId = spreadsheetId || sheetsClient.SPREADSHEET_ID;
    
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: targetSpreadsheetId,
        range: `${sheetName}!A:Z`
      })
    );
    
    return response.data.values || [];
  }

  // POST /api/onsale/activation-info/:sheetId/:rowIndex/complete - 개통완료
  router.post('/api/onsale/activation-info/:sheetId/:rowIndex/complete', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId, rowIndex } = req.params;
      const { completedBy, completedAt } = req.body;

      console.log(`✅ [개통완료] 시트: ${sheetId}, 행: ${rowIndex}`);

      // 개통완료 상태로 업데이트
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `개통정보!M${rowIndex}:N${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [['완료', completedAt || new Date().toLocaleString('ko-KR')]]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('onsale_activation');

      res.json({
        success: true,
        message: '개통완료 처리되었습니다.'
      });
    } catch (error) {
      console.error('Error completing activation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete activation',
        message: error.message
      });
    }
  });

  // POST /api/onsale/activation-info/:sheetId/:rowIndex/pending - 개통보류
  router.post('/api/onsale/activation-info/:sheetId/:rowIndex/pending', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId, rowIndex } = req.params;
      const { reason } = req.body;

      console.log(`⏸️ [개통보류] 시트: ${sheetId}, 행: ${rowIndex}, 사유: ${reason}`);

      // 보류 상태로 업데이트
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `개통정보!M${rowIndex}:N${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [['보류', reason || '']]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('onsale_activation');

      res.json({
        success: true,
        message: '개통보류 처리되었습니다.'
      });
    } catch (error) {
      console.error('Error pending activation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to pend activation',
        message: error.message
      });
    }
  });

  // POST /api/onsale/activation-info/:sheetId/:rowIndex/unpending - 보류해제
  router.post('/api/onsale/activation-info/:sheetId/:rowIndex/unpending', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId, rowIndex } = req.params;

      console.log(`▶️ [보류해제] 시트: ${sheetId}, 행: ${rowIndex}`);

      // 대기 상태로 복원
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `개통정보!M${rowIndex}:N${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [['대기', '']]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('onsale_activation');

      res.json({
        success: true,
        message: '보류가 해제되었습니다.'
      });
    } catch (error) {
      console.error('Error unpending activation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unpend activation',
        message: error.message
      });
    }
  });

  // POST /api/onsale/activation-info/:sheetId/:rowIndex/cancel - 개통취소
  router.post('/api/onsale/activation-info/:sheetId/:rowIndex/cancel', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId, rowIndex } = req.params;
      const { reason } = req.body;

      console.log(`❌ [개통취소] 시트: ${sheetId}, 행: ${rowIndex}, 사유: ${reason}`);

      // 취소 상태로 업데이트
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `개통정보!M${rowIndex}:N${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [['취소', reason || '']]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('onsale_activation');

      res.json({
        success: true,
        message: '개통취소 처리되었습니다.'
      });
    } catch (error) {
      console.error('Error canceling activation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel activation',
        message: error.message
      });
    }
  });


  // GET /api/onsale/activation-list - 개통정보 목록
  router.get('/api/onsale/activation-list', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📋 [개통정보목록] 개통정보 목록 조회 시작');

      const { status, startDate, endDate, agentCode } = req.query;

      // 캐시 키 생성
      const cacheKey = `onsale_activation_list_${status}_${startDate}_${endDate}_${agentCode}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        console.log('✅ [캐시] 개통정보 목록 캐시 히트');
        return res.json({ success: true, data: cached, cached: true });
      }

      const values = await getSheetValues('개통정보');
      const headers = values[0] || [];
      const rows = values.slice(1);

      let activationList = rows.map((row, index) => {
        const item = {};
        headers.forEach((header, i) => {
          item[header] = row[i] || '';
        });
        item.rowIndex = index + 2; // 헤더 제외
        return item;
      });

      // 필터링
      if (status) {
        activationList = activationList.filter(item => item['상태'] === status);
      }
      if (startDate) {
        activationList = activationList.filter(item => item['등록일'] >= startDate);
      }
      if (endDate) {
        activationList = activationList.filter(item => item['등록일'] <= endDate);
      }
      if (agentCode) {
        activationList = activationList.filter(item => item['대리점코드'] === agentCode);
      }

      // 캐시 저장 (5분)
      cacheManager.set(cacheKey, activationList, 5 * 60 * 1000);

      res.json({
        success: true,
        data: activationList
      });
    } catch (error) {
      console.error('Error fetching activation list:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch activation list',
        message: error.message
      });
    }
  });

  // GET /api/onsale/activation-info/:sheetId/:rowIndex - 개통정보 조회
  router.get('/api/onsale/activation-info/:sheetId/:rowIndex', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId, rowIndex } = req.params;

      console.log(`📄 [개통정보조회] 시트: ${sheetId}, 행: ${rowIndex}`);

      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `개통정보!A${rowIndex}:Z${rowIndex}`
        })
      );

      const row = response.data.values?.[0] || [];
      
      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: '개통정보!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      const activationInfo = {};
      headers.forEach((header, i) => {
        activationInfo[header] = row[i] || '';
      });

      res.json({
        success: true,
        data: activationInfo
      });
    } catch (error) {
      console.error('Error fetching activation info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch activation info',
        message: error.message
      });
    }
  });

  // PUT /api/onsale/activation-info/:sheetId/:rowIndex - 개통정보 수정
  router.put('/api/onsale/activation-info/:sheetId/:rowIndex', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { sheetId, rowIndex } = req.params;
      const data = req.body;

      console.log(`✏️ [개통정보수정] 시트: ${sheetId}, 행: ${rowIndex}`);

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: '개통정보!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 데이터 배열 생성
      const updatedRow = headers.map(header => data[header] || '');

      // 업데이트
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `개통정보!A${rowIndex}:Z${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [updatedRow]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('onsale_activation');

      res.json({
        success: true,
        message: '개통정보가 수정되었습니다.'
      });
    } catch (error) {
      console.error('Error updating activation info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update activation info',
        message: error.message
      });
    }
  });

  // POST /api/onsale/activation-info - 개통정보 저장
  router.post('/api/onsale/activation-info', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📝 [개통정보] 개통정보 저장 시작');

      const data = req.body;
      const now = new Date().toLocaleString('ko-KR');

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '개통정보!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 데이터 배열 생성
      const newRow = headers.map(header => {
        if (header === '등록일') return now;
        if (header === '상태') return '대기';
        return data[header] || '';
      });

      // 추가
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '개통정보!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [newRow]
          }
        })
      );

      // 캐시 무효화
      cacheManager.deletePattern('onsale_activation');

      res.json({
        success: true,
        message: '개통정보가 저장되었습니다.'
      });
    } catch (error) {
      console.error('Error saving activation info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save activation info',
        message: error.message
      });
    }
  });

  // POST /api/onsale/uplus-submission - U+ 제출 데이터 저장
  router.post('/api/onsale/uplus-submission', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📤 [U+제출] U+ 제출 데이터 저장 시작');

      const data = req.body;
      const now = new Date().toLocaleString('ko-KR');

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'U+제출!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 데이터 배열 생성
      const newRow = headers.map(header => {
        if (header === '제출일') return now;
        return data[header] || '';
      });

      // 추가
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: 'U+제출!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [newRow]
          }
        })
      );

      res.json({
        success: true,
        message: 'U+ 제출 데이터가 저장되었습니다.'
      });
    } catch (error) {
      console.error('Error saving U+ submission:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save U+ submission',
        message: error.message
      });
    }
  });


  // GET /api/onsale/links - 온세일 링크 목록 (관리자)
  router.get('/api/onsale/links', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📋 [온세일] 전체 링크 목록 조회 시작');

      const values = await getSheetValues('온세일링크');
      const headers = values[0] || [];
      const rows = values.slice(1);

      const linkList = rows.map((row, index) => {
        const item = {};
        headers.forEach((header, i) => {
          item[header] = row[i] || '';
        });
        item.rowIndex = index + 2;
        return item;
      });

      res.json({
        success: true,
        data: linkList
      });
    } catch (error) {
      console.error('Error fetching links:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch links',
        message: error.message
      });
    }
  });

  // GET /api/onsale/active-links - 활성화된 링크 (일반)
  router.get('/api/onsale/active-links', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📋 [온세일] 활성화 링크 목록 조회 시작');

      const values = await getSheetValues('온세일링크');
      const headers = values[0] || [];
      const rows = values.slice(1);

      const linkList = rows
        .filter(row => row[headers.indexOf('활성화')] === 'Y')
        .map((row, index) => {
          const item = {};
          headers.forEach((header, i) => {
            item[header] = row[i] || '';
          });
          return item;
        });

      res.json({
        success: true,
        data: linkList
      });
    } catch (error) {
      console.error('Error fetching active links:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active links',
        message: error.message
      });
    }
  });

  // POST /api/onsale/links - 링크 추가
  router.post('/api/onsale/links', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('➕ [온세일] 새 링크 추가 시작');

      const data = req.body;
      const now = new Date().toLocaleString('ko-KR');

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '온세일링크!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 데이터 배열 생성
      const newRow = headers.map(header => {
        if (header === '등록일') return now;
        return data[header] || '';
      });

      // 추가
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '온세일링크!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [newRow]
          }
        })
      );

      res.json({
        success: true,
        message: '링크가 추가되었습니다.'
      });
    } catch (error) {
      console.error('Error adding link:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add link',
        message: error.message
      });
    }
  });

  // PUT /api/onsale/links/:rowIndex - 링크 수정
  router.put('/api/onsale/links/:rowIndex', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { rowIndex } = req.params;
      const data = req.body;

      console.log(`✏️ [온세일] 링크 수정: 행 ${rowIndex}`);

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '온세일링크!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 데이터 배열 생성
      const updatedRow = headers.map(header => data[header] || '');

      // 업데이트
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `온세일링크!A${rowIndex}:Z${rowIndex}`,
          valueInputOption: 'RAW',
          resource: {
            values: [updatedRow]
          }
        })
      );

      res.json({
        success: true,
        message: '링크가 수정되었습니다.'
      });
    } catch (error) {
      console.error('Error updating link:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update link',
        message: error.message
      });
    }
  });

  // DELETE /api/onsale/links/:rowIndex - 링크 삭제
  router.delete('/api/onsale/links/:rowIndex', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { rowIndex } = req.params;

      console.log(`🗑️ [온세일] 링크 삭제: 행 ${rowIndex}`);

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: parseInt(rowIndex) - 1,
                  endIndex: parseInt(rowIndex)
                }
              }
            }]
          }
        })
      );

      res.json({
        success: true,
        message: '링크가 삭제되었습니다.'
      });
    } catch (error) {
      console.error('Error deleting link:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete link',
        message: error.message
      });
    }
  });


  // GET /api/onsale/policies/groups - 정책 그룹 목록
  router.get('/api/onsale/policies/groups', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📋 [정책게시판] 그룹 목록 조회 시작');

      const values = await getSheetValues('일반모드권한관리');
      const rows = values.slice(1);

      // 그룹 목록 추출 (중복 제거)
      const groups = [...new Set(rows.map(row => row[1]).filter(Boolean))];

      res.json({
        success: true,
        data: groups
      });
    } catch (error) {
      console.error('Error fetching policy groups:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch policy groups',
        message: error.message
      });
    }
  });

  // GET /api/onsale/policies - 정책 목록
  router.get('/api/onsale/policies', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      console.log('📋 [정책게시판] 정책 목록 조회 시작');

      const { group, companyId } = req.query;

      const values = await getSheetValues('정책게시판');
      const headers = values[0] || [];
      const rows = values.slice(1);

      let policyList = rows.map((row, index) => {
        const item = {};
        headers.forEach((header, i) => {
          item[header] = row[i] || '';
        });
        item.id = index + 2;
        return item;
      });

      // 필터링
      if (group) {
        policyList = policyList.filter(item => {
          const groups = (item['그룹'] || '').split(',').map(g => g.trim());
          return groups.includes(group);
        });
      }
      if (companyId) {
        policyList = policyList.filter(item => {
          const companyIds = (item['대리점코드'] || '').split(',').map(c => c.trim());
          return companyIds.includes(companyId);
        });
      }

      // 고정글 우선 정렬
      policyList.sort((a, b) => {
        if (a['고정'] === 'Y' && b['고정'] !== 'Y') return -1;
        if (a['고정'] !== 'Y' && b['고정'] === 'Y') return 1;
        return 0;
      });

      res.json({
        success: true,
        data: policyList
      });
    } catch (error) {
      console.error('Error fetching policies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch policies',
        message: error.message
      });
    }
  });

  // GET /api/onsale/policies/:id - 정책 상세
  router.get('/api/onsale/policies/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;

      console.log(`📄 [정책게시판] 정책 상세 조회: ID ${id}`);

      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `정책게시판!A${id}:Z${id}`
        })
      );

      const row = response.data.values?.[0] || [];
      
      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책게시판!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      const policy = {};
      headers.forEach((header, i) => {
        policy[header] = row[i] || '';
      });

      res.json({
        success: true,
        data: policy
      });
    } catch (error) {
      console.error('Error fetching policy detail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch policy detail',
        message: error.message
      });
    }
  });

  // POST /api/onsale/policies - 정책 등록
  router.post('/api/onsale/policies', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { title, groups, companyIds, content, isPinned, createdBy } = req.body;

      console.log('➕ [정책게시판] 정책 등록 시작');

      const now = new Date().toLocaleString('ko-KR');

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책게시판!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 데이터 배열 생성
      const newRow = headers.map(header => {
        if (header === '제목') return title || '';
        if (header === '그룹') return Array.isArray(groups) ? groups.join(',') : groups || '';
        if (header === '대리점코드') return Array.isArray(companyIds) ? companyIds.join(',') : companyIds || '';
        if (header === '내용') return content || '';
        if (header === '고정') return isPinned ? 'Y' : 'N';
        if (header === '작성자') return createdBy || '';
        if (header === '작성일') return now;
        if (header === '조회수') return '0';
        return '';
      });

      // 추가
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책게시판!A:Z',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [newRow]
          }
        })
      );

      res.json({
        success: true,
        message: '정책이 등록되었습니다.'
      });
    } catch (error) {
      console.error('Error creating policy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create policy',
        message: error.message
      });
    }
  });

  // PUT /api/onsale/policies/:id - 정책 수정
  router.put('/api/onsale/policies/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;
      const { title, groups, companyIds, content, isPinned } = req.body;

      console.log(`✏️ [정책게시판] 정책 수정: ID ${id}`);

      // 헤더 가져오기
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책게시판!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];

      // 기존 데이터 가져오기
      const existingResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `정책게시판!A${id}:Z${id}`
        })
      );
      const existingRow = existingResponse.data.values?.[0] || [];

      // 데이터 배열 생성 (기존 값 유지)
      const updatedRow = headers.map((header, i) => {
        if (header === '제목' && title !== undefined) return title;
        if (header === '그룹' && groups !== undefined) return Array.isArray(groups) ? groups.join(',') : groups;
        if (header === '대리점코드' && companyIds !== undefined) return Array.isArray(companyIds) ? companyIds.join(',') : companyIds;
        if (header === '내용' && content !== undefined) return content;
        if (header === '고정' && isPinned !== undefined) return isPinned ? 'Y' : 'N';
        return existingRow[i] || '';
      });

      // 업데이트
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `정책게시판!A${id}:Z${id}`,
          valueInputOption: 'RAW',
          resource: {
            values: [updatedRow]
          }
        })
      );

      res.json({
        success: true,
        message: '정책이 수정되었습니다.'
      });
    } catch (error) {
      console.error('Error updating policy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update policy',
        message: error.message
      });
    }
  });

  // DELETE /api/onsale/policies/:id - 정책 삭제
  router.delete('/api/onsale/policies/:id', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;

      console.log(`🗑️ [정책게시판] 정책 삭제: ID ${id}`);

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          resource: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: 'ROWS',
                  startIndex: parseInt(id) - 1,
                  endIndex: parseInt(id)
                }
              }
            }]
          }
        })
      );

      res.json({
        success: true,
        message: '정책이 삭제되었습니다.'
      });
    } catch (error) {
      console.error('Error deleting policy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete policy',
        message: error.message
      });
    }
  });

  // POST /api/onsale/policies/:id/view - 정책 확인 이력
  router.post('/api/onsale/policies/:id/view', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { id } = req.params;
      const { userId, userName } = req.body;

      console.log(`👁️ [정책게시판] 정책 확인 이력: ID ${id}, 사용자: ${userName}`);

      const now = new Date().toLocaleString('ko-KR');

      // 확인 이력 시트에 추가
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책확인이력!A:D',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          resource: {
            values: [[id, userId, userName, now]]
          }
        })
      );

      // 조회수 증가
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `정책게시판!A${id}:Z${id}`
        })
      );
      const row = response.data.values?.[0] || [];
      
      const headerResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '정책게시판!A1:Z1'
        })
      );
      const headers = headerResponse.data.values?.[0] || [];
      
      const viewCountIndex = headers.indexOf('조회수');
      if (viewCountIndex !== -1) {
        const currentViews = parseInt(row[viewCountIndex]) || 0;
        const newViews = currentViews + 1;
        
        const columnLetter = String.fromCharCode(65 + viewCountIndex);
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `정책게시판!${columnLetter}${id}`,
            valueInputOption: 'RAW',
            resource: {
              values: [[newViews]]
            }
          })
        );
      }

      res.json({
        success: true,
        message: '확인 이력이 기록되었습니다.'
      });
    } catch (error) {
      console.error('Error recording policy view:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record policy view',
        message: error.message
      });
    }
  });

  // POST /api/onsale-proxy - 온세일 프록시
  router.post('/api/onsale-proxy', async (req, res) => {
    try {
      const { url, agentCode } = req.body;

      if (!url || !agentCode) {
        return res.status(400).json({
          success: false,
          error: 'URL과 대리점코드가 필요합니다.'
        });
      }

      console.log(`🔗 [온세일프록시] URL: ${url}, 대리점: ${agentCode}`);

      // 프록시 URL 생성 (실제 구현은 환경에 따라 다를 수 있음)
      const proxyUrl = `${process.env.PROXY_BASE_URL || 'https://proxy.example.com'}?url=${encodeURIComponent(url)}&agent=${agentCode}`;

      res.json({
        success: true,
        proxyUrl
      });
    } catch (error) {
      console.error('Error creating proxy URL:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create proxy URL',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createOnsaleRoutes;
