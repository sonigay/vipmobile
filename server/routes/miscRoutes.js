/**
 * Miscellaneous Routes
 * 기타 API 엔드포인트 (price-discrepancies 등)
 */

module.exports = function createMiscRoutes(context) {
  const express = require('express');
  const router = express.Router();
  const { google } = require('googleapis');

  const { sheetsClient, rateLimiter, cacheManager } = context;
  const { sheets, SPREADSHEET_ID } = sheetsClient;

  // Helper functions
  const requireSheetsClient = (res) => {
    if (!sheetsClient || !sheetsClient.sheets) {
      res.status(503).json({ error: 'Google Sheets client not available' });
      return false;
    }
    return true;
  };

  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      })
    );
    return response.data.values || [];
  }

  // rateLimitedSheetsCall 헬퍼 함수
  const rateLimitedSheetsCall = async (apiCall) => {
    return await rateLimiter.execute(apiCall);
  };

  // 가격 불일치 조회 API
  router.get('/price-discrepancies', async (req, res) => {
    try {
      const response = await rateLimiter.execute(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: '가격불일치!A:Z'
        })
      );

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return res.json({ discrepancies: [] });
      }

      const discrepancies = rows.slice(1).map((row, index) => ({
        id: row[0] || `DISC_${index}`,
        model: row[1] || '',
        carrier: row[2] || '',
        expectedPrice: parseInt(row[3]) || 0,
        actualPrice: parseInt(row[4]) || 0,
        difference: parseInt(row[5]) || 0,
        reportedBy: row[6] || '',
        reportedAt: row[7] || '',
        status: row[8] || 'pending'
      }));

      res.json({ discrepancies });
    } catch (error) {
      console.error('가격 불일치 조회 실패:', error);
      res.status(500).json({ error: '가격 불일치 조회 실패' });
    }
  });

  // 테스트 API
  router.get('/test', (req, res) => {
    console.log('🧪 [테스트] API 호출됨');
    res.json({ success: true, message: '테스트 API 작동 중' });
  });

  // IP 정보 프록시 API (CORS 방지)
  router.get('/ip-info', async (req, res) => {
    const axios = require('axios');
    try {
      // 클라이언트의 실제 IP가 프록시(Cloudtype 등) 뒤에 있을 수 있으므로 확인
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      // ipapi.co에 요청 (JSON 형식)
      // 클라이언트 IP를 붙여서 요청하면 더 정확할 수 있으나, 
      // 그냥 요청하면 ipapi.co가 요청한 서버의 IP를 기준으로 주지만 
      // 프론트엔드에서 필요한 것은 대략적인 성공 응답과 에러 방지임.
      const response = await axios.get('https://ipapi.co/json/', {
        timeout: 5000
      });

      res.json(response.data);
    } catch (error) {
      console.warn('⚠️ [Server] IP 정보 가져오기 실패:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch IP info from server',
        ip: '알 수 없음',
        location: '알 수 없음'
      });
    }
  });

  // GET /stores - 매장 목록
  router.get('/stores', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'stores_list';
      const cached = cacheManager.get(cacheKey);
      if (cached) return res.json(cached);

      const values = await getSheetValues('폰클출고처데이터');
      const data = values.slice(1);

      cacheManager.set(cacheKey, data, 5 * 60 * 1000);
      res.json(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /stores/unique-values - 매장 고유값
  router.get('/stores/unique-values', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('폰클출고처데이터');
      const rows = values.slice(1);

      const uniqueValues = {
        stores: [...new Set(rows.map(r => r[0]))],
        regions: [...new Set(rows.map(r => r[1]))],
        types: [...new Set(rows.map(r => r[2]))]
      };

      res.json(uniqueValues);
    } catch (error) {
      console.error('Error fetching unique values:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /version - 버전 정보
  router.get('/version', (req, res) => {
    res.json({
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Push 알림 관련
  router.get('/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
  });

  router.post('/push/subscribe', async (req, res) => {
    try {
      const { subscription } = req.body;
      console.log('Push 구독:', subscription);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/push/unsubscribe', async (req, res) => {
    try {
      const { endpoint } = req.body;
      console.log('Push 구독 해제:', endpoint);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/push/send', async (req, res) => {
    try {
      const { title, message, userId } = req.body;
      console.log('Push 전송:', title, message, userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/push/send-all', async (req, res) => {
    try {
      const { title, message } = req.body;
      console.log('Push 전체 전송:', title, message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/push/subscriptions', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('Push구독');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 기타 엔드포인트
  router.get('/sales-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('판매데이터');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/sim-duplicates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('유심중복');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/unmatched-customers', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('미매칭고객');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/unmatched-customers/excel', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('미매칭고객');
      res.json({ data: values.slice(1), format: 'excel' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/verify-password', async (req, res) => {
    try {
      const { password } = req.body;
      const isValid = password === process.env.ADMIN_PASSWORD;
      res.json({ success: isValid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/verify-direct-store-password', async (req, res) => {
    try {
      const { password } = req.body;
      const isValid = password === process.env.DIRECT_STORE_PASSWORD;
      res.json({ success: isValid });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/set-password', async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      console.log('비밀번호 변경 요청:', oldPassword ? '***' : 'none', '->', newPassword ? '***' : 'none');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 월간 시상 관련
  router.get('/monthly-award/data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('월간시상데이터');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/monthly-award/settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('월간시상설정');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 재고 관련
  router.get('/master-inventory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('마스터재고');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/office-inventory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('사무소재고');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/phonekl-inventory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('폰클재고');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/phone-duplicates', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('전화번호중복');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/confirmed-unconfirmed-inventory', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const { data } = req.body;
      console.log('확정/미확정 재고 처리:', data);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 권한 체크
  router.get('/check-general-policy-permission', async (req, res) => {
    try {
      const { userId } = req.query;
      console.log('일반 정책 권한 체크:', userId);
      res.json({ hasPermission: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/check-general-policy-permission', async (req, res) => {
    try {
      const { userId } = req.body;
      console.log('일반 정책 권한 체크 (POST):', userId);
      res.json({ hasPermission: true, success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/check-onsale-permission', async (req, res) => {
    try {
      const { userId } = req.query;
      console.log('온세일 권한 체크:', userId);
      res.json({ hasPermission: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/check-onsale-permission', async (req, res) => {
    try {
      const { userId } = req.body;
      console.log('온세일 권한 체크 (POST):', userId);
      res.json({ hasPermission: true, success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 로그인
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      console.log('로그인 시도:', username);
      res.json({ success: true, token: 'dummy-token', username });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 활동 로그
  router.post('/log-activity', async (req, res) => {
    try {
      const { activity } = req.body;
      console.log('활동 로그:', activity);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 지오코딩
  router.get('/geocode-address', async (req, res) => {
    try {
      const { address } = req.query;
      console.log('주소 지오코딩 (GET):', address);
      res.json({ lat: 37.5665, lng: 126.9780, address });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/geocode-address', async (req, res) => {
    try {
      const { address } = req.body;
      console.log('주소 지오코딩:', address);
      res.json({ lat: 37.5665, lng: 126.9780, address });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // 마커 색상 설정 API
  // ========================================
  // 원본: server/index.js.backup.original (42632-43100줄)

  // 시트 헤더 정의
  const HEADERS_MARKER_COLOR_SETTINGS = [
    '사용자ID',      // A열: 사용자 ID (x-user-id)
    '옵션타입',      // B열: 옵션 타입 ('code', 'office', 'department', 'manager', 'selected')
    '값',            // C열: 옵션 값 (코드명, 사무실명, 소속명, 담당자명) 또는 선택된 옵션
    '색상',          // D열: 색상 값 (hex)
    '생성일시',      // E열: 생성일시
    '수정일시'       // F열: 수정일시
  ];

  const MARKER_COLOR_SETTINGS_SHEET_NAME = '관리자모드_마커색상설정';

  // 시트 헤더 확인 및 생성 함수
  async function ensureMarkerColorSheetHeaders(sheets, spreadsheetId) {
    try {
      const spreadsheet = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.get({ spreadsheetId })
      );
      const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === MARKER_COLOR_SETTINGS_SHEET_NAME);

      if (!sheetExists) {
        await rateLimitedSheetsCall(() =>
          sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
              requests: [{
                addSheet: {
                  properties: {
                    title: MARKER_COLOR_SETTINGS_SHEET_NAME
                  }
                }
              }]
            }
          })
        );
      }

      const res = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${MARKER_COLOR_SETTINGS_SHEET_NAME}!1:1`
        })
      );
      const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
      const needsInit = firstRow.length === 0 || HEADERS_MARKER_COLOR_SETTINGS.some((h, i) => (firstRow[i] || '') !== h) || firstRow.length < HEADERS_MARKER_COLOR_SETTINGS.length;

      if (needsInit) {
        await rateLimitedSheetsCall(() => {
          // HEADERS_MARKER_COLOR_SETTINGS.length = 6 (A~F)
          // getColumnLetter는 1-based이므로 6을 전달하면 F열이 됨
          const lastColumn = getColumnLetter(HEADERS_MARKER_COLOR_SETTINGS.length);
          return sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${MARKER_COLOR_SETTINGS_SHEET_NAME}!A1:${lastColumn}1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [HEADERS_MARKER_COLOR_SETTINGS] }
          });
        });
      }

      return HEADERS_MARKER_COLOR_SETTINGS;
    } catch (error) {
      console.error(`[마커색상] Failed to ensure sheet headers for ${MARKER_COLOR_SETTINGS_SHEET_NAME}:`, error);
      throw error;
    }
  }

  // getColumnLetter 헬퍼 함수
  function getColumnLetter(columnNumber) {
    let temp, letter = '';
    while (columnNumber > 0) {
      temp = (columnNumber - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      columnNumber = (columnNumber - temp - 1) / 26;
    }
    return letter;
  }

  // GET /api/marker-color-settings - 현재 사용자의 색상 설정 조회
  router.get('/marker-color-settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const userId = req.headers['x-user-id'] || req.query.userId;
      if (!userId) {
        return res.status(400).json({ success: false, error: '사용자 ID가 필요합니다.' });
      }

      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.includes('\\n') ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : process.env.GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth });

      await ensureMarkerColorSheetHeaders(sheets, process.env.SHEET_ID);

      const response = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SHEET_ID,
          range: `${MARKER_COLOR_SETTINGS_SHEET_NAME}!A:F`
        })
      );

      const rows = response.data.values || [];
      const dataRows = rows.slice(1);

      // userId를 문자열로 정규화 (타입 불일치 방지)
      const normalizedUserId = userId ? userId.toString().trim() : '';

      console.log('[마커 색상 설정 조회] 시작:', {
        원본userId: userId,
        정규화userId: normalizedUserId,
        userId타입: typeof userId,
        dataRowsCount: dataRows.length,
        샘플행: dataRows.slice(0, 5).map(r => ({ userId: r[0], userId타입: typeof r[0], optionType: r[1], value: r[2] }))
      });

      // 현재 사용자의 설정만 필터링 (userId 비교 시 trim 및 타입 변환)
      // Google Sheets에서 작은따옴표로 시작하는 문자열은 그대로 저장되지만, 조회 시에는 작은따옴표가 제거될 수 있음
      // 또한 숫자로 저장된 경우와 문자열로 저장된 경우를 모두 처리
      const userRows = dataRows.filter(row => {
        let rowUserId = (row[0] || '').toString().trim();
        // 작은따옴표로 시작하는 경우 제거 (Google Sheets가 자동으로 제거할 수 있음)
        if (rowUserId.startsWith("'")) {
          rowUserId = rowUserId.substring(1);
        }
        // 숫자로 저장된 경우와 문자열로 저장된 경우 모두 처리
        const matches = rowUserId === normalizedUserId ||
          rowUserId === normalizedUserId.toString() ||
          String(rowUserId) === String(normalizedUserId);
        if (dataRows.indexOf(row) < 5) {
          console.log('[마커 색상 설정 조회] 행 비교:', {
            원본rowUserId: row[0],
            처리된rowUserId: rowUserId,
            normalizedUserId: normalizedUserId,
            matches: matches,
            rowUserId타입: typeof rowUserId
          });
        }
        return matches;
      });

      // 선택된 옵션 추출
      const selectedRow = userRows.find(row => {
        const optionType = (row[1] || '').toString().trim();
        return optionType === 'selected';
      });

      let selectedOption = 'default';
      if (selectedRow) {
        // Google Sheets API는 빈 셀을 배열에서 제거할 수 있으므로
        // 인덱스 2가 없을 수도 있음. 안전하게 처리
        const value = selectedRow[2];
        if (value !== undefined && value !== null && value !== '') {
          selectedOption = value.toString().trim();
          // 유효한 옵션인지 확인
          if (!['default', 'code', 'office', 'department', 'manager'].includes(selectedOption)) {
            console.warn(`[마커 색상 설정 조회] 잘못된 선택값: ${selectedOption}, 기본값 사용`);
            selectedOption = 'default';
          }
        } else {
          console.warn('[마커 색상 설정 조회] selectedRow는 있지만 값이 비어있음:', selectedRow);
        }
      } else {
        console.warn('[마커 색상 설정 조회] selectedRow를 찾을 수 없음. userRows:', userRows.map(r => ({ userId: r[0], optionType: r[1], value: r[2] })));
      }

      // 디버깅 로그
      console.log('[마커 색상 설정 조회]', {
        userId: normalizedUserId,
        userRowsCount: userRows.length,
        selectedRow: selectedRow ? {
          userId: selectedRow[0],
          optionType: selectedRow[1],
          value: selectedRow[2],
          fullRow: selectedRow
        } : null,
        selectedOption,
        allUserRows: userRows.map(r => ({ userId: r[0], optionType: r[1], value: r[2] }))
      });

      // 색상 설정을 옵션별로 그룹화
      const settings = {
        selectedOption,
        colorSettings: {
          code: {},
          office: {},
          department: {},
          manager: {}
        }
      };

      userRows.forEach(row => {
        const optionType = row[1] || '';
        const value = row[2] || '';
        const color = row[3] || '';

        if (optionType !== 'selected' && optionType && value && color) {
          if (settings.colorSettings[optionType]) {
            settings.colorSettings[optionType][value] = color;
          }
        }
      });

      res.json({ success: true, settings });
    } catch (error) {
      console.error('색상 설정 조회 오류:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/marker-color-settings - 색상 설정 저장/업데이트
  router.post('/marker-color-settings', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const userId = req.headers['x-user-id'] || req.body.userId;
      const { selectedOption, colorSettings } = req.body;
      // selectedOption: 'default', 'code', 'office', 'department', 'manager' (단일 선택)
      // colorSettings: { code: {...}, office: {...}, department: {...}, manager: {...} }

      if (!userId) {
        return res.status(400).json({ success: false, error: '사용자 ID가 필요합니다.' });
      }

      if (!selectedOption || !colorSettings) {
        return res.status(400).json({ success: false, error: '옵션 및 색상 설정이 필요합니다.' });
      }

      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.includes('\\n') ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : process.env.GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth });

      await ensureMarkerColorSheetHeaders(sheets, process.env.SHEET_ID);

      // 기존 설정 조회
      const response = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SHEET_ID,
          range: `${MARKER_COLOR_SETTINGS_SHEET_NAME}!A:F`
        })
      );

      const rows = response.data.values || [];
      const dataRows = rows.slice(1);
      const now = new Date().toISOString();

      // userId를 문자열로 정규화 (타입 불일치 방지)
      const normalizedUserId = userId ? userId.toString().trim() : '';

      console.log('[마커 색상 설정 저장] 시작:', {
        원본userId: userId,
        정규화userId: normalizedUserId,
        userId타입: typeof userId,
        selectedOption: selectedOption,
        dataRowsCount: dataRows.length,
        샘플행: dataRows.slice(0, 3).map(r => ({ userId: r[0], userId타입: typeof r[0], optionType: r[1] }))
      });

      // 기존 행에서 현재 사용자의 설정 찾기 (userId 비교 시 trim 및 타입 변환)
      // Google Sheets에서 작은따옴표로 시작하는 문자열은 그대로 저장되지만, 조회 시에는 작은따옴표가 제거될 수 있음
      // 또한 숫자로 저장된 경우와 문자열로 저장된 경우를 모두 처리
      const existingRows = dataRows.filter(row => {
        let rowUserId = (row[0] || '').toString().trim();
        // 작은따옴표로 시작하는 경우 제거 (Google Sheets가 자동으로 제거할 수 있음)
        if (rowUserId.startsWith("'")) {
          rowUserId = rowUserId.substring(1);
        }
        // 숫자로 저장된 경우와 문자열로 저장된 경우 모두 처리
        return rowUserId === normalizedUserId ||
          rowUserId === normalizedUserId.toString() ||
          String(rowUserId) === String(normalizedUserId);
      });

      console.log('[마커 색상 설정 저장] 기존 행 찾기:', {
        normalizedUserId: normalizedUserId,
        existingRowsCount: existingRows.length,
        existingRows: existingRows.map(r => ({ userId: r[0], optionType: r[1], value: r[2] }))
      });

      // 업데이트할 행과 새로 추가할 행 분리
      const rowsToUpdate = [];
      const rowsToAppend = [];

      // 1. 선택된 옵션 저장/업데이트
      const existingSelectedRow = existingRows.find(row => {
        const optionType = (row[1] || '').toString().trim();
        return optionType === 'selected';
      });

      if (existingSelectedRow) {
        const rowIndex = dataRows.findIndex(row => {
          const rowUserId = (row[0] || '').toString().trim();
          const rowOptionType = (row[1] || '').toString().trim();
          return rowUserId === normalizedUserId && rowOptionType === 'selected';
        });

        if (rowIndex !== -1) {
          // Google Sheets에서 숫자를 문자열로 저장하기 위해 작은따옴표 접두사 추가
          // 또는 명시적으로 문자열로 변환 (valueInputOption: 'USER_ENTERED' 사용)
          rowsToUpdate.push({
            rowIndex: rowIndex + 2,
            values: [`'${normalizedUserId}`, 'selected', selectedOption, '', existingSelectedRow[4] || now, now]
          });
          console.log(`[마커 색상 설정 저장] 선택값 업데이트: ${selectedOption} (행 ${rowIndex + 2}, userId: '${normalizedUserId}')`);
        }
      } else {
        // Google Sheets에서 숫자를 문자열로 저장하기 위해 작은따옴표 접두사 추가
        rowsToAppend.push([`'${normalizedUserId}`, 'selected', selectedOption, '', now, now]);
        console.log(`[마커 색상 설정 저장] 선택값 추가: ${selectedOption} (userId: '${normalizedUserId}')`);
      }

      // 2. 각 옵션별 색상 설정 저장/업데이트
      const optionTypes = ['code', 'office', 'department', 'manager'];
      optionTypes.forEach(optionType => {
        const settings = colorSettings[optionType] || {};
        Object.entries(settings).forEach(([value, color]) => {
          // 빈 색상 값은 저장하지 않음
          if (!color || color.trim() === '') {
            return;
          }

          const existingRow = existingRows.find(row => {
            const rowOptionType = (row[1] || '').toString().trim();
            const rowValue = (row[2] || '').toString().trim();
            return rowOptionType === optionType && rowValue === value;
          });
          if (existingRow) {
            // 업데이트
            const rowIndex = dataRows.findIndex(row => {
              const rowUserId = (row[0] || '').toString().trim();
              const rowOptionType = (row[1] || '').toString().trim();
              const rowValue = (row[2] || '').toString().trim();
              return rowUserId === normalizedUserId && rowOptionType === optionType && rowValue === value;
            });
            rowsToUpdate.push({
              rowIndex: rowIndex + 2,
              values: [`'${normalizedUserId}`, optionType, value, color, existingRow[4] || now, now]
            });
          } else {
            // 새로 추가 - userId를 문자열로 저장
            rowsToAppend.push([`'${normalizedUserId}`, optionType, value, color, now, now]);
          }
        });
      });

      // 업데이트 실행
      console.log('[마커 색상 설정 저장] 저장 실행:', {
        rowsToUpdate: rowsToUpdate.length,
        rowsToAppend: rowsToAppend.length,
        normalizedUserId: normalizedUserId
      });

      await Promise.all([
        ...rowsToUpdate.map(({ rowIndex, values }) =>
          rateLimitedSheetsCall(() =>
            sheets.spreadsheets.values.update({
              spreadsheetId: process.env.SHEET_ID,
              range: `${MARKER_COLOR_SETTINGS_SHEET_NAME}!A${rowIndex}:F${rowIndex}`,
              valueInputOption: 'USER_ENTERED',
              resource: { values: [values] }
            })
          )
        ),
        rowsToAppend.length > 0 && rateLimitedSheetsCall(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SHEET_ID,
            range: `${MARKER_COLOR_SETTINGS_SHEET_NAME}!A:F`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: rowsToAppend }
          })
        )
      ]);

      console.log('[마커 색상 설정 저장] 저장 완료:', {
        normalizedUserId: normalizedUserId,
        selectedOption: selectedOption
      });

      res.json({ success: true, message: '색상 설정이 저장되었습니다.' });
    } catch (error) {
      console.error('색상 설정 저장 오류:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/stores/unique-values - 유니크 값 목록 조회
  router.get('/stores/unique-values', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { type } = req.query; // 'code', 'office', 'department', 'manager'

      if (!type || !['code', 'office', 'department', 'manager'].includes(type)) {
        return res.status(400).json({ success: false, error: '올바른 타입이 필요합니다. (code, office, department, manager)' });
      }

      // 타입에 따라 컬럼 인덱스 결정
      const columnIndexMap = {
        'code': 7,        // H열: 코드
        'office': 3,     // D열: 사무실
        'department': 4, // E열: 소속
        'manager': 5    // F열: 담당자
      };

      const columnIndex = columnIndexMap[type];
      const columnLetter = getColumnLetter(columnIndex + 1); // 1-based로 변환 (A=1, B=2, ...)

      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.includes('\\n') ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : process.env.GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      const sheets = google.sheets({ version: 'v4', auth });

      const STORE_SHEET_NAME = '폰클출고처데이터';

      const response = await rateLimitedSheetsCall(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: process.env.SHEET_ID,
          range: `${STORE_SHEET_NAME}!${columnLetter}:${columnLetter}`
        })
      );

      const rows = response.data.values || [];
      const values = new Set();

      // 헤더 제외하고 데이터 처리
      rows.slice(1).forEach(row => {
        const value = (row[0] || '').toString().trim();
        if (value) {
          values.add(value);
        }
      });

      // 배열로 변환 및 정렬
      const uniqueValues = Array.from(values).sort();

      res.json({ success: true, type, values: uniqueValues });
    } catch (error) {
      console.error('유니크 값 목록 조회 오류:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 마커 색상 설정 (기존 단순 구현 - 삭제됨)

  // 지도 표시 옵션
  router.get('/map-display-option', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('지도표시옵션');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/map-display-option/users', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('지도표시옵션사용자');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/map-display-option/values', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('지도표시옵션값');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 매핑 실패 분석
  router.get('/mapping-failure-analysis', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('매핑실패분석');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 마지막 개통일
  router.get('/last-activation-date', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const values = await getSheetValues('마지막개통일').catch(err => {
        console.warn('마지막개통일 시트 로드 실패:', err.message);
        return [];
      });

      res.json(values.length > 0 ? values.slice(1) : []);
    } catch (error) {
      console.error('마지막 개통일 조회 오류:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/last-activation-date/clear-cache', async (req, res) => {
    try {
      cacheManager.deletePattern('last_activation');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 크롬 확장 프로그램
  router.get('/extension-version', (req, res) => {
    res.json({ version: '1.0.0' });
  });

  router.get('/download-chrome-extension', (req, res) => {
    res.json({ downloadUrl: '/extension/vip-extension.zip' });
  });

  // 알림 스트림
  router.get('/notifications/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent({ type: 'connected', timestamp: Date.now() });

    const interval = setInterval(() => {
      sendEvent({ type: 'ping', timestamp: Date.now() });
    }, 30000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  router.put('/notifications/mark-all-read', async (req, res) => {
    try {
      const { userId } = req.body;
      console.log('모든 알림 읽음 처리:', userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/yard-receipt-missing-analysis', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;
      const values = await getSheetValues('야드접수누락분석');
      res.json(values.slice(1));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/test-delete', async (req, res) => {
    try {
      console.log('테스트 삭제 API 호출');
      res.json({ success: true, message: '테스트 삭제 완료' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
