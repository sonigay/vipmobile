/**
 * Direct Store Additional Routes
 * 직영점 추가 엔드포인트 (누락된 엔드포인트 복구)
 */

module.exports = function createDirectStoreAdditionalRoutes(context) {
  const express = require('express');
  const router = express.Router();
  const multer = require('multer');

  const { sheetsClient, rateLimiter, discordBot } = context;
  const { sheets, SPREADSHEET_ID } = sheetsClient;
  const dal = require('../dal/DirectStoreDAL');

  // 시트 이름 상수
  const CUSTOMER_PRE_APPROVAL_SHEET_NAME = '직영점_사전승낙서마크';
  const CUSTOMER_STORE_PHOTO_SHEET_NAME = '직영점_매장사진';
  const DIRECT_SALES_SHEET_NAME = '직영점_판매일보';
  const DIRECT_SETTINGS_SHEET_NAME = '직영점_설정';
  const POLICY_MARGIN_SHEET = '직영점_정책_마진';
  const POLICY_ADDON_SHEET = '직영점_정책_부가서비스';
  const POLICY_SPECIAL_SHEET = '직영점_정책_별도';

  // 시트 값 조회 헬퍼 (기본 시트)
  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      })
    );
    return response.data.values || [];
  }

  // 외부 시트 값 조회 헬퍼
  async function getExternalSheetValues(spreadsheetId, range) {
    const response = await rateLimiter.execute(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range
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

  // GET /api/direct/store-image/:storeName: 매장 사진 조회 (레거시 규격 지원)
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

      // 레거시 컬럼 인덱스 (A:업체명, B:전면사진URL, F:내부사진URL, J:외부사진URL, N:외부2사진URL, R:점장사진URL, V:직원1사진URL, Z:직원2사진URL, AD:직원3사진URL, AH:수정일시)
      res.json({
        storeName: storeData[0] || '',
        frontUrl: storeData[1] || '',
        insideUrl: storeData[5] || '',
        outsideUrl: storeData[9] || '',
        outside2Url: storeData[13] || '',
        managerUrl: storeData[17] || '',
        staff1Url: storeData[21] || '',
        staff2Url: storeData[25] || '',
        staff3Url: storeData[29] || '',
        updatedAt: storeData[33] || ''
      });
    } catch (error) {
      console.error('매장 사진 조회 오류:', error);
      res.status(500).json({ error: '조회에 실패했습니다.' });
    }
  });

  // POST /api/direct/store-image: 매장 사진 정보 저장 (레거시 규격 지원)
  router.post('/store-image', async (req, res) => {
    const data = req.body;
    const storeName = data.storeName;

    try {
      const values = await getSheetValues(CUSTOMER_STORE_PHOTO_SHEET_NAME);
      const updatedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

      if (!values || values.length === 0) {
        const headers = ['업체명',
          '전면사진URL', '전면_msgId', '전면_chId', '전면_thId',
          '내부사진URL', '내부_msgId', '내부_chId', '내부_thId',
          '외부사진URL', '외부_msgId', '외부_chId', '외부_thId',
          '외부2사진URL', '외부2_msgId', '외부2_chId', '외부2_thId',
          '점장사진URL', '점장_msgId', '점장_chId', '점장_thId',
          '직원1사진URL', '직원1_msgId', '직원1_chId', '직원1_thId',
          '직원2사진URL', '직원2_msgId', '직원2_chId', '직원2_thId',
          '직원3사진URL', '직원3_msgId', '직원3_chId', '직원3_thId',
          '수정일시', '버스터미널ID목록', '지하철역ID목록'
        ];
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_STORE_PHOTO_SHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            resource: { values: [headers] }
          })
        );
      }

      const rowIndex = values ? values.findIndex(row => row[0] === storeName) : -1;
      const existingRow = rowIndex !== -1 ? values[rowIndex] : [];

      // 기존 Discord 정보 보존용 헬퍼
      const getDiscordMeta = (oldIdx, newUrl) => {
        if (!newUrl) return ['', '', ''];
        if (existingRow[oldIdx] === newUrl) {
          return [existingRow[oldIdx + 1] || '', existingRow[oldIdx + 2] || '', existingRow[oldIdx + 3] || ''];
        }
        return ['', '', ''];
      };

      const newRow = [
        storeName,
        data.frontUrl || data.exteriorUrl || '', ...getDiscordMeta(1, data.frontUrl || data.exteriorUrl),
        data.insideUrl || data.interiorUrl || '', ...getDiscordMeta(5, data.insideUrl || data.interiorUrl),
        data.outsideUrl || '', ...getDiscordMeta(9, data.outsideUrl),
        data.outside2Url || '', ...getDiscordMeta(13, data.outside2Url),
        data.managerUrl || '', ...getDiscordMeta(17, data.managerUrl),
        data.staff1Url || '', ...getDiscordMeta(21, data.staff1Url),
        data.staff2Url || '', ...getDiscordMeta(25, data.staff2Url),
        data.staff3Url || '', ...getDiscordMeta(29, data.staff3Url),
        updatedAt,
        existingRow[34] || '[]',
        existingRow[35] || '[]'
      ];

      if (rowIndex === -1) {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_STORE_PHOTO_SHEET_NAME}!A:AJ`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] }
          })
        );
      } else {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${CUSTOMER_STORE_PHOTO_SHEET_NAME}!A${rowIndex + 1}:AJ${rowIndex + 1}`,
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

  // === 링크 설정 API ===

  // GET /api/direct/link-settings: 링크 설정 조회
  router.get('/link-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const values = await getSheetValues(DIRECT_SETTINGS_SHEET_NAME);

      if (!values || values.length <= 1) {
        return res.json({ success: true, carrier });
      }

      const rows = values.slice(1);

      // 설정 데이터 파싱 (JSON 데이터는 '범위' 컬럼에 저장됨)
      const parseSetting = (type) => {
        const row = rows.find(r => r[0] === carrier && r[1] === type);
        if (!row) return null;

        try {
          // JSON 데이터인지 확인
          if (row[3] && (row[3].startsWith('{') || row[3].startsWith('['))) {
            return JSON.parse(row[3]);
          }
        } catch (e) {
          console.warn(`설정 파싱 오류 (${type}):`, e.message);
        }

        // 레거시 형식 대비 (link, range만 있는 경우)
        return {
          link: row[2] || '',
          sheetId: row[2] || '',
          range: row[3] || ''
        };
      };

      res.json({
        success: true,
        carrier,
        planGroup: parseSetting('요금제그룹'),
        support: parseSetting('이통사지원금'),
        policy: parseSetting('정책표')
      });
    } catch (error) {
      console.error('링크 설정 조회 오류:', error);
      res.status(500).json({ success: false, error: '링크 설정 조회 실패' });
    }
  });

  // POST /api/direct/link-settings: 링크 설정 저장
  router.post('/link-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier;
      const settings = req.body; // { planGroup: {...}, support: {...}, policy: {...} }

      if (!carrier) return res.status(400).json({ success: false, error: '통신사 정보가 누락되었습니다.' });

      const values = await getSheetValues(DIRECT_SETTINGS_SHEET_NAME);

      // 헤더 생성
      if (!values || values.length === 0) {
        await rateLimiter.execute(() =>
          sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${DIRECT_SETTINGS_SHEET_NAME}!A1:D1`,
            valueInputOption: 'RAW',
            resource: { values: [['통신사', '구분', '링크', '데이터(JSON)']] }
          })
        );
      }

      const rows = values || [];
      const types = ['planGroup', 'support', 'policy'];
      const typeLabelMap = {
        'planGroup': '요금제그룹',
        'support': '이통사지원금',
        'policy': '정책표'
      };

      for (const typeKey of types) {
        if (!settings[typeKey]) continue;

        const typeLabel = typeLabelMap[typeKey];
        const rowIndex = rows.findIndex(r => r[0] === carrier && r[1] === typeLabel);

        const settingData = settings[typeKey];
        const rowData = [
          carrier,
          typeLabel,
          settingData.link || settingData.sheetId || '',
          JSON.stringify(settingData)
        ];

        if (rowIndex === -1) {
          await rateLimiter.execute(() =>
            sheets.spreadsheets.values.append({
              spreadsheetId: SPREADSHEET_ID,
              range: `${DIRECT_SETTINGS_SHEET_NAME}!A:D`,
              valueInputOption: 'USER_ENTERED',
              resource: { values: [rowData] }
            })
          );
        } else {
          await rateLimiter.execute(() =>
            sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${DIRECT_SETTINGS_SHEET_NAME}!A${rowIndex + 1}:D${rowIndex + 1}`,
              valueInputOption: 'USER_ENTERED',
              resource: { values: [rowData] }
            })
          );
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('링크 설정 저장 오류:', error);
      res.status(500).json({ success: false, error: '링크 설정 저장 실패' });
    }
  });

  // GET /api/direct/link-settings/fetch-range: 범위 데이터 조회
  router.get('/link-settings/fetch-range', async (req, res) => {
    try {
      const { sheetId, range, unique } = req.query;
      if (!sheetId || !range) {
        return res.status(400).json({ success: false, error: 'sheetId와 range가 필요합니다.' });
      }

      const values = await getExternalSheetValues(sheetId, range);
      let data = values.flat().filter(v => v !== undefined && v !== null && v !== '');

      if (unique === 'true') {
        data = [...new Set(data)];
      }

      res.json({
        success: true,
        data: data
      });
    } catch (error) {
      console.error('범위 데이터 조회 오류:', error);
      res.status(500).json({ success: false, error: '시트 데이터를 가져오는데 실패했습니다: ' + error.message });
    }
  });

  // GET /api/direct/link-settings/plan-groups: 요금제군 목록 조회
  router.get('/link-settings/plan-groups', async (req, res) => {
    try {
      const { sheetId, range } = req.query;
      if (!sheetId || !range) {
        return res.status(400).json({ success: false, error: 'sheetId와 range가 필요합니다.' });
      }

      const values = await getExternalSheetValues(sheetId, range);
      const planGroups = [...new Set(values.flat().filter(v => !!v))];

      res.json({
        success: true,
        planGroups: planGroups
      });
    } catch (error) {
      console.error('요금제군 조회 오류:', error);
      res.status(500).json({ success: false, error: '요금제군을 가져오는데 실패했습니다.' });
    }
  });

  // === 정책 설정 API ===

  // 중복 엔드포인트 제거됨:
  // - GET /api/direct/policy-settings → directRoutes.js에서 처리
  // - POST /api/direct/policy-settings → directRoutes.js에서 처리

  // === 추가 상품/이미지 API ===

  // GET /api/direct/todays-mobiles: 오늘의 휴대폰 조회
  router.get('/todays-mobiles', async (req, res) => {
    try {
      const carrier = req.query.carrier;
      const mobiles = await dal.getTodaysMobiles(carrier);

      // 프론트엔드 기대 형식: { premium: [...], budget: [...] }
      const premium = mobiles.filter(m => m.isPremium || m.isPopular || m.isRecommended);
      const budget = mobiles.filter(m => m.isBudget || m.isCheap);

      res.json({
        success: true,
        premium,
        budget
      });
    } catch (error) {
      console.error('오늘의 휴대폰 조회 오류:', error);
      res.status(500).json({ success: false, error: '오늘의 휴대폰 조회 실패' });
    }
  });

  // POST /api/direct/upload-image: 이미지 업로드 (Discord)
  const imageUpload = multer({ storage: multer.memoryStorage() });
  router.post('/upload-image', imageUpload.single('image'), async (req, res) => {
    try {
      const file = req.file;
      const { modelId, carrier, modelName, petName } = req.body;

      if (!file) return res.status(400).json({ success: false, error: '파일이 없습니다.' });
      if (!discordBot || !discordBot.LOGGING_ENABLED) {
        return res.status(503).json({ success: false, error: 'Discord 서비스가 준비되지 않았습니다.' });
      }

      // Discord 채널로 전송
      const channel = await discordBot.bot.channels.fetch(discordBot.CHANNEL_ID);
      if (!channel) throw new Error('채널을 찾을 수 없습니다.');

      const message = await channel.send({
        content: `📸 [이미지 업로드] ${carrier || ''} ${petName || modelName || ''} (${modelId || 'N/A'})`,
        files: [{
          attachment: file.buffer,
          name: file.originalname
        }]
      });

      const attachment = message.attachments.first();
      if (!attachment) throw new Error('Discord 업로드 실패 (첨부파일 없음)');

      res.json({
        success: true,
        url: attachment.url,
        discordInfo: {
          messageId: message.id,
          channelId: message.channelId,
          postId: message.reference?.messageId || '',
          threadId: message.thread?.id || ''
        }
      });
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      res.status(500).json({ success: false, error: '이미지 업로드에 실패했습니다: ' + error.message });
    }
  });

  return router;
};
