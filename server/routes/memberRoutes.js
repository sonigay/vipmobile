/**
 * Member Routes
 * 
 * 고객(회원) 관련 엔드포인트를 제공합니다.
 * - 고객 로그인
 * - 구매 대기 목록 관리 (CRUD)
 * - 게시판 관리 (CRUD)
 * 
 * Endpoints:
 * - POST /api/member/login - 고객 로그인
 * - GET /api/member/queue/all - 모든 구매 대기 목록 조회
 * - GET /api/member/queue - 고객별 구매 대기 목록 조회
 * - POST /api/member/queue - 구매 대기 등록
 * - PUT /api/member/queue/:id - 구매 대기 수정
 * - DELETE /api/member/queue/:id - 구매 대기 삭제
 * - GET /api/member/board - 게시판 목록 조회
 * - GET /api/member/board/:id - 게시판 상세 조회
 * - POST /api/member/board - 게시판 글 작성
 * - PUT /api/member/board/:id - 게시판 글 수정
 * - DELETE /api/member/board/:id - 게시판 글 삭제
 * 
 * Requirements: 1.1, 1.2, 7.14
 */

const express = require('express');

/**
 * Member Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createMemberRoutes(context) {
  const router = express.Router();
  const { sheetsClient, rateLimiter } = context;

  // 시트 이름 상수
  const MEMBER_SHEET_NAME = '고객정보';
  const QUEUE_SHEET_NAME = '직영점_구매대기';
  const BOARD_SHEET_NAME = '직영점_게시판';

  // POST /api/member/login - 고객 로그인
  router.post('/api/member/login', async (req, res) => {
    const { ctn, password } = req.body;

    if (!ctn || !password) {
      return res.status(400).json({
        success: false,
        error: 'CTN과 비밀번호가 필요합니다.'
      });
    }

    try {
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${MEMBER_SHEET_NAME}!A:Z`
        })
      );

      const memberValues = response.data.values || [];
      const memberRows = memberValues.slice(1);

      const member = memberRows.find(row => {
        const rowCtn = (row[0] || '').toString().trim();
        const rowPassword = (row[1] || '').toString().trim();
        return rowCtn === ctn && rowPassword === password;
      });

      if (!member) {
        return res.status(401).json({
          success: false,
          error: '로그인 정보가 일치하지 않습니다.'
        });
      }

      res.json({
        success: true,
        ctn,
        name: member[2] || '',
        message: '로그인 성공'
      });
    } catch (error) {
      console.error('고객 로그인 오류:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process login',
        message: error.message
      });
    }
  });

  // GET /api/member/queue/all - 모든 구매 대기 목록 조회
  router.get('/api/member/queue/all', async (req, res) => {
    const { posCode } = req.query;

    try {
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A:AG`
        })
      );

      const values = response.data.values || [];
      if (values.length <= 1) return res.json([]);

      const rows = values.slice(1);

      // POS코드 필터링이 필요한 경우, 폰클출고처데이터에서 매장명->POS코드 매핑 생성
      let storeNameToPosCodeMap = null;
      if (posCode) {
        try {
          const storeDataResponse = await rateLimiter.execute(() =>
            sheetsClient.sheets.spreadsheets.values.get({
              spreadsheetId: sheetsClient.SPREADSHEET_ID,
              range: '폰클출고처데이터!A:AM'
            })
          );
          const storeData = storeDataResponse.data.values || [];
          storeNameToPosCodeMap = new Map();
          if (storeData && storeData.length > 1) {
            storeData.slice(1).forEach(row => {
              if (row && row.length > 15) {
                const storeName = (row[14] || '').toString().trim();
                const storePosCode = (row[15] || '').toString().trim();
                if (storeName && storePosCode) {
                  storeNameToPosCodeMap.set(storeName, storePosCode);
                }
              }
            });
          }
        } catch (err) {
          console.error('폰클출고처데이터 조회 오류:', err);
        }
      }

      let filteredRows = rows;
      if (posCode && storeNameToPosCodeMap) {
        filteredRows = rows.filter(row => {
          const storeName = (row[22] || '').toString().trim();
          const itemPosCode = storeNameToPosCodeMap.get(storeName);
          return itemPosCode === posCode;
        });
      }

      const queue = filteredRows
        .filter(row => (row[27] || '').toString().trim() !== '삭제됨')
        .map(row => ({
          id: row[0],
          ctn: row[1],
          name: row[2],
          carrier: row[3],
          model: row[4],
          color: row[5],
          deviceSerial: row[6],
          usimModel: row[7],
          usimSerial: row[8],
          activationType: row[9],
          oldCarrier: row[10],
          installmentType: row[11],
          installmentMonths: row[12],
          contractType: row[13],
          plan: row[14],
          additionalServices: row[15],
          factoryPrice: row[16],
          carrierSupport: row[17],
          dealerSupportWithAdd: row[18],
          dealerSupportWithoutAdd: row[19],
          installmentPrincipal: Number(row[20] || 0),
          할부원금: Number(row[20] || 0),
          lgPremier: (row[21] || '') === 'Y',
          프리미어약정: (row[21] || '') === 'Y',
          storeName: row[22],
          storePhone: row[23],
          storeAddress: row[24],
          storeBankInfo: row[25],
          createdAt: row[26],
          status: row[27],
          processedBy: row[28],
          processedAt: row[29],
          ip: row[30],
          deviceInfo: row[31],
          isAnonymous: row[32] === 'Y'
        }));

      // 최신순 정렬
      queue.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      res.json(queue);
    } catch (error) {
      console.error('전체 구매 대기 목록 조회 오류:', error);
      res.status(500).json({ error: '목록을 불러오는데 실패했습니다.' });
    }
  });

  // GET /api/member/queue - 고객별 구매 대기 목록 조회
  router.get('/api/member/queue', async (req, res) => {
    const { ctn } = req.query;
    if (!ctn) return res.status(400).json({ error: 'CTN이 필요합니다.' });

    try {
      // 하이픈 제거된 CTN
      const cleanCtn = ctn.replace(/[^0-9]/g, '');

      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A:AD`
        })
      );

      const values = response.data.values || [];
      if (values.length <= 1) return res.json([]);

      const rows = values.slice(1);
      const queue = rows
        .filter(row => {
          const rowCtn = (row[1] || '').replace(/[^0-9]/g, '');
          return rowCtn === cleanCtn;
        })
        .map(row => ({
          id: row[0],
          ctn: row[1],
          name: row[2],
          carrier: row[3],
          model: row[4],
          color: row[5],
          deviceSerial: row[6],
          usimModel: row[7],
          usimSerial: row[8],
          activationType: row[9],
          oldCarrier: row[10],
          installmentType: row[11],
          installmentMonths: row[12],
          contractType: row[13],
          plan: row[14],
          additionalServices: row[15],
          factoryPrice: row[16],
          carrierSupport: row[17],
          대리점추가지원금: row[18],
          dealerSupportWithAdd: row[18],
          대리점추가지원금직접입력: row[19],
          dealerSupportWithoutAdd: row[19],
          additionalStoreSupport: row[19],
          installmentPrincipal: Number(row[20] || 0),
          할부원금: Number(row[20] || 0),
          lgPremier: (row[21] || '') === 'Y',
          프리미어약정: (row[21] || '') === 'Y',
          storeName: row[22],
          storePhone: row[23],
          storeAddress: row[24],
          storeBankInfo: row[25],
          createdAt: row[26],
          status: row[27],
          processedBy: row[28],
          processedAt: row[29]
        }));

      res.json(queue);
    } catch (error) {
      console.error('고객 구매 대기 목록 조회 오류:', error);
      res.status(500).json({ error: '목록을 불러오는데 실패했습니다.' });
    }
  });

  // POST /api/member/queue - 구매 대기 등록
  router.post('/api/member/queue', async (req, res) => {
    const data = req.body;

    try {
      // 시트 존재 및 헤더 확인
      const checkResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A1:AB1`
        })
      ).catch(() => null);

      if (!checkResponse || !checkResponse.data.values) {
        const CUSTOMER_QUEUE_HEADERS = ['ID', 'CTN', '이름', '통신사', '모델명', '색상', '기기일련번호', 'USIM모델', 'USIM일련번호', '개통유형', '기존통신사', '할부유형', '할부개월', '약정유형', '요금제', '부가서비스', '출고가', '통신사지원금', '대리점지원금', '대리점추가지원금', '할부원금', 'LG프리미어약정', '선택매장업체명', '선택매장전화', '선택매장주소', '선택매장계좌정보', '등록일시', '상태', '처리자', '처리일시', '아이피', '기기정보', '첫구매어드민여부'];
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${QUEUE_SHEET_NAME}!A1:AB1`,
            valueInputOption: 'RAW',
            resource: { values: [CUSTOMER_QUEUE_HEADERS] }
          })
        );
      }

      const id = `pending-${Date.now()}`;
      const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const newRow = new Array(30).fill('');
      newRow[0] = id;
      newRow[1] = data.ctn || '';
      newRow[2] = data.name || '';
      newRow[3] = data.carrier || '';
      newRow[4] = data.model || '';
      newRow[5] = data.color || '';
      newRow[6] = data.deviceSerial || '';
      newRow[7] = data.usimModel || '';
      newRow[8] = data.usimSerial || '';
      newRow[9] = data.activationType || '';
      newRow[10] = data.oldCarrier || '';
      newRow[11] = data.installmentType || '';
      newRow[12] = data.installmentMonths || '';
      newRow[13] = data.contractType || '';
      newRow[14] = data.plan || '';
      newRow[15] = data.additionalServices || '';
      newRow[16] = data.factoryPrice || '';
      newRow[17] = data.carrierSupport || '';
      newRow[18] = data.dealerSupport || data.dealerSupportWithAdd || '';
      newRow[19] = data.additionalStoreSupport || '';
      newRow[20] = data.installmentPrincipal || 0;
      newRow[21] = data.lgPremier ? 'Y' : 'N';
      newRow[22] = data.storeName || '';
      newRow[23] = data.storePhone || '';
      newRow[24] = data.storeAddress || '';
      newRow[25] = data.storeBankInfo || '';
      newRow[26] = createdAt;
      newRow[27] = '구매대기';

      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      newRow[30] = clientIp;
      newRow[31] = data.deviceInfo || '';
      newRow[32] = data.isAnonymous ? 'Y' : 'N';

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A:AG`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] }
        })
      );

      res.json({ success: true, id });
    } catch (error) {
      console.error('구매 대기 등록 오류:', error);
      res.status(500).json({ error: '등록에 실패했습니다.' });
    }
  });

  // PUT /api/member/queue/:id - 구매 대기 수정
  router.put('/api/member/queue/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    try {
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A:AD`
        })
      );

      const values = response.data.values || [];
      const rowIndex = values.findIndex(row => row[0] === id);

      if (rowIndex === -1) return res.status(404).json({ error: '대상을 찾을 수 없습니다.' });

      const updatedRow = [...values[rowIndex]];
      if (data.name !== undefined) updatedRow[2] = data.name;
      if (data.carrier !== undefined) updatedRow[3] = data.carrier;
      if (data.model !== undefined) updatedRow[4] = data.model;
      if (data.color !== undefined) updatedRow[5] = data.color;
      if (data.deviceSerial !== undefined) updatedRow[6] = data.deviceSerial;
      if (data.usimModel !== undefined) updatedRow[7] = data.usimModel;
      if (data.usimSerial !== undefined) updatedRow[8] = data.usimSerial;
      if (data.activationType !== undefined) updatedRow[9] = data.activationType;
      if (data.oldCarrier !== undefined) updatedRow[10] = data.oldCarrier;
      if (data.installmentType !== undefined) updatedRow[11] = data.installmentType;
      if (data.installmentMonths !== undefined) updatedRow[12] = data.installmentMonths;
      if (data.contractType !== undefined) updatedRow[13] = data.contractType;
      if (data.plan !== undefined) updatedRow[14] = data.plan;
      if (data.additionalServices !== undefined) updatedRow[15] = data.additionalServices;
      if (data.factoryPrice !== undefined) updatedRow[16] = data.factoryPrice;
      if (data.carrierSupport !== undefined) updatedRow[17] = data.carrierSupport;
      if (data.dealerSupport !== undefined) updatedRow[18] = data.dealerSupport;
      if (data.additionalStoreSupport !== undefined) updatedRow[19] = data.additionalStoreSupport;
      if (data.dealerSupportWithAdd !== undefined) updatedRow[18] = data.dealerSupportWithAdd;
      if (data.dealerSupportWithoutAdd !== undefined) updatedRow[19] = data.dealerSupportWithoutAdd;
      if (data.installmentPrincipal !== undefined) updatedRow[20] = data.installmentPrincipal;
      if (data.lgPremier !== undefined) updatedRow[21] = data.lgPremier ? 'Y' : 'N';
      if (data.storeName !== undefined) updatedRow[22] = data.storeName;
      if (data.storePhone !== undefined) updatedRow[23] = data.storePhone;
      if (data.storeAddress !== undefined) updatedRow[24] = data.storeAddress;
      if (data.storeBankInfo !== undefined) updatedRow[25] = data.storeBankInfo;
      if (data.status !== undefined) updatedRow[27] = data.status;
      if (data.processedBy !== undefined) updatedRow[28] = data.processedBy;
      if (data.processedAt !== undefined) updatedRow[29] = data.processedAt;

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A${rowIndex + 1}:AD${rowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [updatedRow] }
        })
      );

      res.json({ success: true });
    } catch (error) {
      console.error('구매 대기 수정 오류:', error);
      res.status(500).json({ error: '수정에 실패했습니다.' });
    }
  });

  // DELETE /api/member/queue/:id - 구매 대기 삭제
  router.delete('/api/member/queue/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!A:AB`
        })
      );

      const values = response.data.values || [];
      const rowIndex = values.findIndex(row => row[0] === id);

      if (rowIndex === -1) return res.status(404).json({ error: '대상을 찾을 수 없습니다.' });

      // 상태를 '삭제됨'으로 변경 (AB열 = 27번 인덱스 = 상태)
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${QUEUE_SHEET_NAME}!AB${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [['삭제됨']] }
        })
      );

      res.json({ success: true });
    } catch (error) {
      console.error('구매 대기 삭제 오류:', error);
      res.status(500).json({ error: '삭제에 실패했습니다.' });
    }
  });

  // GET /api/member/board - 게시판 목록 조회
  router.get('/api/member/board', async (req, res) => {
    const { storeName, posCode } = req.query;

    try {
      // 시트 존재 확인 및 생성
      let response;
      try {
        response = await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.get({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${BOARD_SHEET_NAME}!A:L`
          })
        );
      } catch (error) {
        // 시트가 존재하지 않으면 헤더만 생성하고 빈 배열 반환
        if (error.code === 400 || error.message?.includes('Unable to parse range')) {
          console.log('게시판 시트가 존재하지 않아 헤더를 생성합니다.');
          try {
            await rateLimiter.execute(() =>
              sheetsClient.sheets.spreadsheets.values.update({
                spreadsheetId: sheetsClient.SPREADSHEET_ID,
                range: `${BOARD_SHEET_NAME}!A1:L1`,
                valueInputOption: 'RAW',
                resource: { values: [['ID', '카테고리', '제목', '내용', '고객명', '고객CTN', '매장명', '매장전화', '매장주소', '작성일', '수정일', '상태']] }
              })
            );
          } catch (createError) {
            // 시트 자체가 없으면 시트 생성 시도
            try {
              await rateLimiter.execute(() =>
                sheetsClient.sheets.spreadsheets.batchUpdate({
                  spreadsheetId: sheetsClient.SPREADSHEET_ID,
                  resource: {
                    requests: [{
                      addSheet: {
                        properties: {
                          title: BOARD_SHEET_NAME,
                          gridProperties: {
                            rowCount: 1000,
                            columnCount: 12
                          }
                        }
                      }
                    }]
                  }
                })
              );
              // 시트 생성 후 헤더 추가
              await rateLimiter.execute(() =>
                sheetsClient.sheets.spreadsheets.values.update({
                  spreadsheetId: sheetsClient.SPREADSHEET_ID,
                  range: `${BOARD_SHEET_NAME}!A1:L1`,
                  valueInputOption: 'RAW',
                  resource: { values: [['ID', '카테고리', '제목', '내용', '고객명', '고객CTN', '매장명', '매장전화', '매장주소', '작성일', '수정일', '상태']] }
                })
              );
            } catch (sheetCreateError) {
              console.error('게시판 시트 생성 오류:', sheetCreateError);
            }
          }
          return res.json([]);
        }
        throw error;
      }

      const values = response.data.values || [];
      if (values.length <= 1) return res.json([]);

      const rows = values.slice(1);

      // POS코드 필터링이 필요한 경우, 폰클출고처데이터에서 매장명->POS코드 매핑 생성
      let storeNameToPosCodeMap = null;
      if (posCode) {
        try {
          const storeDataResponse = await rateLimiter.execute(() =>
            sheetsClient.sheets.spreadsheets.values.get({
              spreadsheetId: sheetsClient.SPREADSHEET_ID,
              range: '폰클출고처데이터!A:AM'
            })
          );
          const storeData = storeDataResponse.data.values || [];
          storeNameToPosCodeMap = new Map();
          if (storeData && storeData.length > 1) {
            storeData.slice(1).forEach(row => {
              if (row && row.length > 15) {
                const storeNameFromData = (row[14] || '').toString().trim();
                const storePosCode = (row[15] || '').toString().trim();
                if (storeNameFromData && storePosCode) {
                  storeNameToPosCodeMap.set(storeNameFromData, storePosCode);
                }
              }
            });
          }
        } catch (err) {
          console.error('매장 데이터 조회 오류:', err);
        }
      }

      let queue = rows
        .filter(row => {
          // 삭제된 항목 제외
          const status = (row[11] || '').toString().trim();
          if (status === '삭제됨') return false;

          // 매장명 필터링
          if (storeName) {
            const rowStoreName = (row[6] || '').toString().trim();
            return rowStoreName === storeName;
          }

          // POS코드 필터링
          if (posCode && storeNameToPosCodeMap) {
            const rowStoreName = (row[6] || '').toString().trim();
            const itemPosCode = storeNameToPosCodeMap.get(rowStoreName);
            return itemPosCode === posCode;
          }

          return true;
        })
        .map(row => ({
          id: row[0],
          category: row[1] || '',
          title: row[2] || '',
          content: row[3] || '',
          customerName: row[4] || '',
          customerCtn: row[5] || '',
          storeName: row[6] || '',
          storePhone: row[7] || '',
          storeAddress: row[8] || '',
          createdAt: row[9] || '',
          updatedAt: row[10] || '',
          status: row[11] || '활성'
        }));

      // 최신순 정렬
      queue.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      res.json(queue);
    } catch (error) {
      console.error('게시판 목록 조회 오류:', error);
      res.status(500).json({ error: '목록을 불러오는데 실패했습니다.' });
    }
  });

  // GET /api/member/board/:id - 게시판 상세 조회
  router.get('/api/member/board/:id', async (req, res) => {
    const { id } = req.params;

    try {
      let response;
      try {
        response = await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.get({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${BOARD_SHEET_NAME}!A:L`
          })
        );
      } catch (error) {
        // 시트가 존재하지 않으면 404 반환
        if (error.code === 400 || error.message?.includes('Unable to parse range')) {
          return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }
        throw error;
      }

      const values = response.data.values || [];
      const row = values.find(r => r[0] === id);

      if (!row) {
        return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
      }

      const post = {
        id: row[0],
        category: row[1] || '',
        title: row[2] || '',
        content: row[3] || '',
        customerName: row[4] || '',
        customerCtn: row[5] || '',
        storeName: row[6] || '',
        storePhone: row[7] || '',
        storeAddress: row[8] || '',
        createdAt: row[9] || '',
        updatedAt: row[10] || '',
        status: row[11] || '활성'
      };

      res.json(post);
    } catch (error) {
      console.error('게시판 상세 조회 오류:', error);
      res.status(500).json({ error: '게시글을 불러오는데 실패했습니다.' });
    }
  });

  // POST /api/member/board - 게시판 글 작성
  router.post('/api/member/board', async (req, res) => {
    const data = req.body;

    try {
      // 시트 존재 및 헤더 확인
      let checkResponse;
      try {
        checkResponse = await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.get({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${BOARD_SHEET_NAME}!A1:L1`
          })
        );
      } catch (error) {
        // 시트가 존재하지 않으면 시트 생성
        if (error.code === 400 || error.message?.includes('Unable to parse range')) {
          console.log('게시판 시트가 존재하지 않아 새로 생성합니다.');
          try {
            await rateLimiter.execute(() =>
              sheetsClient.sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetsClient.SPREADSHEET_ID,
                resource: {
                  requests: [{
                    addSheet: {
                      properties: {
                        title: BOARD_SHEET_NAME,
                        gridProperties: {
                          rowCount: 1000,
                          columnCount: 12
                        }
                      }
                    }
                  }]
                }
              })
            );
          } catch (sheetCreateError) {
            // 시트가 이미 존재하는 경우 무시
            if (!sheetCreateError.message?.includes('already exists')) {
              console.error('게시판 시트 생성 오류:', sheetCreateError);
              throw sheetCreateError;
            }
          }
        } else {
          throw error;
        }
      }

      // 헤더가 없으면 헤더 추가
      if (!checkResponse || !checkResponse.data.values) {
        try {
          await rateLimiter.execute(() =>
            sheetsClient.sheets.spreadsheets.values.update({
              spreadsheetId: sheetsClient.SPREADSHEET_ID,
              range: `${BOARD_SHEET_NAME}!A1:L1`,
              valueInputOption: 'RAW',
              resource: { values: [['ID', '카테고리', '제목', '내용', '고객명', '고객CTN', '매장명', '매장전화', '매장주소', '작성일', '수정일', '상태']] }
            })
          );
        } catch (headerError) {
          console.error('게시판 헤더 생성 오류:', headerError);
        }
      }

      const id = `board-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const updatedAt = createdAt;

      const newRow = [
        id,
        data.category || '사용후기',
        data.title || '',
        data.content || '',
        data.customerName || '',
        data.customerCtn || '',
        data.storeName || '',
        data.storePhone || '',
        data.storeAddress || '',
        createdAt,
        updatedAt,
        '활성'
      ];

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.append({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${BOARD_SHEET_NAME}!A:L`,
          valueInputOption: 'RAW',
          resource: { values: [newRow] }
        })
      );

      res.json({ success: true, id });
    } catch (error) {
      console.error('게시판 글 작성 오류:', error);
      res.status(500).json({ error: '글 작성에 실패했습니다.' });
    }
  });

  // PUT /api/member/board/:id - 게시판 글 수정
  router.put('/api/member/board/:id', async (req, res) => {
    const { id } = req.params;
    const data = req.body;

    try {
      let response;
      try {
        response = await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.get({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${BOARD_SHEET_NAME}!A:L`
          })
        );
      } catch (error) {
        // 시트가 존재하지 않으면 404 반환
        if (error.code === 400 || error.message?.includes('Unable to parse range')) {
          return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }
        throw error;
      }

      const values = response.data.values || [];
      const rowIndex = values.findIndex(row => row[0] === id);

      if (rowIndex === -1) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

      const updatedRow = [...values[rowIndex]];
      const updatedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // 매핑된 필드 업데이트
      if (data.category !== undefined) updatedRow[1] = data.category;
      if (data.title !== undefined) updatedRow[2] = data.title;
      if (data.content !== undefined) updatedRow[3] = data.content;
      if (data.storeName !== undefined) updatedRow[6] = data.storeName;
      if (data.storePhone !== undefined) updatedRow[7] = data.storePhone;
      if (data.storeAddress !== undefined) updatedRow[8] = data.storeAddress;
      updatedRow[10] = updatedAt; // 수정일시

      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${BOARD_SHEET_NAME}!A${rowIndex + 1}:L${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [updatedRow] }
        })
      );

      res.json({ success: true });
    } catch (error) {
      console.error('게시판 글 수정 오류:', error);
      res.status(500).json({ error: '글 수정에 실패했습니다.' });
    }
  });

  // DELETE /api/member/board/:id - 게시판 글 삭제
  router.delete('/api/member/board/:id', async (req, res) => {
    const { id } = req.params;

    try {
      let response;
      try {
        response = await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.get({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${BOARD_SHEET_NAME}!A:L`
          })
        );
      } catch (error) {
        // 시트가 존재하지 않으면 404 반환
        if (error.code === 400 || error.message?.includes('Unable to parse range')) {
          return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }
        throw error;
      }

      const values = response.data.values || [];
      const rowIndex = values.findIndex(row => row[0] === id);

      if (rowIndex === -1) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

      // 상태를 '삭제됨'으로 변경 (L열 = 11번 인덱스 = 상태)
      await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.update({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${BOARD_SHEET_NAME}!L${rowIndex + 1}`,
          valueInputOption: 'RAW',
          resource: { values: [['삭제됨']] }
        })
      );

      res.json({ success: true });
    } catch (error) {
      console.error('게시판 글 삭제 오류:', error);
      res.status(500).json({ error: '글 삭제에 실패했습니다.' });
    }
  });

  return router;
}

module.exports = createMemberRoutes;
