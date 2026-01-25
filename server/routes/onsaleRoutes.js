/**
 * Onsale Routes (원본 로직 복사 완료 - 2025-01-25)
 * 
 * 온세일(개통정보) 관련 엔드포인트를 제공합니다.
 * - 개통정보 관리 (CRUD, 상태 변경)
 * - 온세일 링크 관리
 * - 정책 게시판 관리
 * - U+ 제출 데이터 처리
 * 
 * 원본 파일: server/index.js.backup.original (789-14690줄)
 * 
 * Requirements: 1.1, 1.2, 7.15
 */

const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

/**
 * Onsale Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @param {Object} context.discordBot - Discord 봇
 * @param {Object} context.auth - Google Auth 객체
 * @returns {express.Router} Express 라우터
 */
function createOnsaleRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter, discordBot, auth } = context;

  // Google Sheets 클라이언트가 없으면 에러 응답 반환하는 헬퍼 함수
  const requireSheetsClient = (res) => {
    if (!sheetsClient || !sheetsClient.sheets) {
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

  // ==================== 개통완료 API (원본 789-890줄) ====================
  router.post('/api/onsale/activation-info/:sheetId/:rowIndex/complete', async (req, res) => {
    try {
      const { sheetId, rowIndex } = req.params;
      const { completedBy } = req.body;
      console.log(`✅ [개통완료] 시트: ${sheetId}, 행: ${rowIndex}, 완료자: ${completedBy}`);

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetResponse = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const sheetName = sheetResponse.data.sheets[0].properties.title;
      console.log(`✅ [개통완료] 시트명: ${sheetName}`);

      const now = new Date();
      const completedAt = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // 기존 데이터를 읽어서 개통시간을 포함한 새로운 데이터로 업데이트
      const existingData = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${rowIndex}:AL${rowIndex}`,
      });

      const existingRow = existingData.data.values?.[0] || [];

      // 새로운 데이터 구조: A=개통완료, B=개통자, C=개통시간, D=취소여부, E=취소자, F=취소시간, G=수정자, H=수정시간, I=제출일시, J=매장명, ...
      const newRowData = [
        '개통완료',           // A열
        completedBy,          // B열
        completedAt,          // C열
        existingRow[3] || '', // D열 (기존 D열 데이터 - 취소여부)
        existingRow[4] || '', // E열 (기존 E열 데이터 - 취소자)
        existingRow[5] || '', // F열 (기존 F열 데이터 - 취소시간)
        existingRow[6] || '', // G열 (기존 G열 데이터 - 수정자)
        existingRow[7] || '', // H열 (기존 H열 데이터 - 수정시간)
        existingRow[8] || '', // I열 (기존 I열 데이터 - 제출일시)
        existingRow[9] || '', // J열 (기존 J열 데이터 - 매장명)
        existingRow[10] || '', // K열 (기존 K열 데이터 - P코드)
        existingRow[11] || '', // L열 (기존 L열 데이터 - 개통유형)
        existingRow[12] || '', // M열 (기존 M열 데이터 - 전통신사)
        existingRow[13] || '', // N열 (기존 N열 데이터 - 고객명)
        existingRow[14] || '', // O열 (기존 O열 데이터 - 생년월일)
        existingRow[15] || '', // P열 (기존 P열 데이터 - 개통번호)
        existingRow[16] || '', // Q열 (기존 Q열 데이터 - 모델명)
        existingRow[17] || '', // R열 (기존 R열 데이터 - 기기일련번호)
        existingRow[18] || '', // S열 (기존 S열 데이터 - 색상)
        existingRow[19] || '', // T열 (기존 T열 데이터 - 유심모델)
        existingRow[20] || '', // U열 (기존 U열 데이터 - 유심일련번호)
        existingRow[21] || '', // V열 (기존 V열 데이터 - 약정유형)
        existingRow[22] || '', // W열 (기존 W열 데이터 - 전환지원금)
        existingRow[23] || '', // X열 (기존 X열 데이터 - 유통망추가지원금)
        existingRow[24] || '', // Y열 (기존 Y열 데이터 - 할부개월)
        existingRow[25] || '', // Z열 (기존 Z열 데이터 - 할부원금)
        existingRow[26] || '', // AA열 (기존 AA열 데이터 - 프리)
        existingRow[27] || '', // AB열 (기존 AB열 데이터 - 요금제)
        existingRow[28] || '', // AC열 (기존 AC열 데이터 - 미디어서비스)
        existingRow[29] || '', // AD열 (기존 AD열 데이터 - 부가서비스)
        existingRow[30] || '', // AE열 (기존 AE열 데이터 - 프리미어약정)
        existingRow[31] || '', // AF열 (기존 AF열 데이터 - 예약번호)
        existingRow[32] || '', // AG열 (기존 AG열 데이터 - 기타요청사항)
        existingRow[33] || '', // AH열 (기존 AH열 데이터 - U+제출일시)
        existingRow[34] || '', // AI열 (기존 AI열 데이터 - U+제출데이터)
      ];

      // 전체 행을 새로운 데이터로 업데이트
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A${rowIndex}:AL${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [newRowData]
        }
      });

      console.log(`✅ [개통완료] 완료 처리 완료`);
      res.json({ success: true, message: '개통정보가 완료 처리되었습니다.', completedAt });
    } catch (error) {
      console.error('❌ [개통완료] 완료 처리 실패:', error);
      res.status(500).json({ success: false, error: '개통정보 완료 처리에 실패했습니다.', message: error.message });
    }
  });

  // ==================== 개통정보 단건 조회 API (원본 13330-13403줄) ====================
  router.get('/api/onsale/activation-info/:sheetId/:rowIndex', async (req, res) => {
    try {
      const { sheetId, rowIndex } = req.params;
      console.log(`📋 [개통정보조회] 시트: ${sheetId}, 행: ${rowIndex}`);

      const sheets = google.sheets({ version: 'v4', auth });

      // 시트 이름 가져오기
      const sheetResponse = await sheets.spreadsheets.get({
        spreadsheetId: sheetId
      });

      const sheetName = sheetResponse.data.sheets[0].properties.title;
      console.log(`📋 [개통정보조회] 시트명: ${sheetName}`);

      // L~AL열 데이터 읽기 (27개 필드) - 제출일시부터 U+제출데이터까지
      const range = `${sheetName}!L${rowIndex}:AL${rowIndex}`;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range
      });

      const row = response.data.values?.[0] || [];

      if (row.length === 0) {
        return res.status(404).json({
          success: false,
          error: '개통정보를 찾을 수 없습니다.'
        });
      }

      // 27개 필드 매핑 (L열부터 AL열까지)
      const data = {
        submittedAt: row[0] || '', // L열(11): 제출일시
        storeName: row[1] || '', // M열(12): 매장명
        pCode: row[2] || '', // N열(13): P코드
        activationType: row[3] || '', // O열(14): 개통유형
        previousCarrier: row[4] || '', // P열(15): 이전통신사
        customerName: row[5] || '', // Q열(16): 고객명
        birthDate: row[6] || '', // R열(17): 생년월일
        phoneNumber: row[7] || '', // S열(18): 개통번호
        modelName: row[8] || '', // T열(19): 모델명
        deviceSerial: row[9] || '', // U열(20): 기기일련번호
        color: row[10] || '', // V열(21): 색상
        simModel: row[11] || '', // W열(22): 유심모델
        simSerial: row[12] || '', // X열(23): 유심일련번호
        contractType: row[13] || '', // Y열(24): 약정유형
        conversionSubsidy: row[14] || '', // Z열(25): 전환지원금 (이통사지원금)
        additionalSubsidy: row[15] || '', // AA열(26): 유통망추가지원금
        installmentMonths: row[16] || '', // AB열(27): 할부개월
        installmentAmount: row[17] || '', // AC열(28): 할부원금
        free: row[18] || '', // AD열(29): 프리
        plan: row[19] || '', // AE열(30): 요금제
        mediaServices: row[20] ? (typeof row[20] === 'string' && row[20].includes(',') ? row[20].split(',').map(s => s.trim()) : [row[20]]) : [], // AF열(31): 미디어서비스
        additionalServices: row[21] || '', // AG열(32): 부가서비스
        premierContract: row[22] || '', // AH열(33): 프리미어약정
        reservationNumber: row[23] || '', // AI열(34): 예약번호
        otherRequests: row[24] || '', // AJ열(35): 기타요청사항
        uplusSubmittedAt: row[25] || '', // AK열(36): U+제출일시
        uplusSubmissionData: row[26] || '' // AL열(37): U+제출데이터
      };

      console.log(`✅ [개통정보조회] 조회 완료`);
      res.json({ success: true, data });

    } catch (error) {
      console.error('❌ [개통정보조회] 조회 실패:', error);
      res.status(500).json({
        success: false,
        error: '개통정보 조회에 실패했습니다.',
        message: error.message
      });
    }
  });

  // ==================== 개통정보 수정 API (원본 13404-13502줄) ====================
  router.put('/api/onsale/activation-info/:sheetId/:rowIndex', async (req, res) => {
    try {
      const { sheetId, rowIndex } = req.params;
      const { data: formData, editor } = req.body;

      console.log(`📝 [개통정보수정] 시트: ${sheetId}, 행: ${rowIndex}, 수정자: ${editor}`);

      const sheets = google.sheets({ version: 'v4', auth });

      // 시트 이름 가져오기
      const sheetResponse = await sheets.spreadsheets.get({
        spreadsheetId: sheetId
      });

      const sheetName = sheetResponse.data.sheets[0].properties.title;
      console.log(`📝 [개통정보수정] 시트명: ${sheetName}`);

      // 수정자 정보 업데이트 (J열 - 최종수정자)
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!J${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[editor || '']]
        }
      });

      // 수정시간 정보 업데이트 (K열 - 최종수정일시)
      const editedAt = new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!K${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[editedAt]]
        }
      });

      // 26개 필드 데이터 업데이트 (L~AJ열 - 제출일시부터 기타요청사항까지, U+제출 필드는 제외)
      const rowData = [
        formData.submittedAt || new Date().toLocaleString('ko-KR'),
        formData.storeName || '',
        formData.pCode || '',
        formData.activationType || '',
        formData.previousCarrier || '',
        formData.customerName || '',
        formData.birthDate || '',
        formData.phoneNumber || '',
        formData.modelName || '',
        formData.deviceSerial || '',
        formData.color || '',
        formData.simModel || '',
        formData.simSerial || '',
        formData.contractType || '',
        formData.conversionSubsidy || '',
        formData.additionalSubsidy || '',
        formData.installmentMonths || '',
        formData.installmentAmount || '',
        formData.free || '',
        formData.plan || '',
        Array.isArray(formData.mediaServices) ? formData.mediaServices.join(', ') : (formData.mediaServices || formData.mediaService || ''),
        formData.additionalServices || formData.additionalService || '',
        formData.premierContract || '',
        formData.reservationNumber || '',
        formData.otherRequests || ''
      ];

      // L~AJ열만 업데이트 (U+제출일시, U+제출데이터는 U+ 제출 API에서만 업데이트)
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!L${rowIndex}:AJ${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData]
        }
      });

      console.log(`✅ [개통정보수정] 수정 완료`);
      res.json({ success: true, message: '개통정보가 수정되었습니다.' });

    } catch (error) {
      console.error('❌ [개통정보수정] 수정 실패:', error);
      res.status(500).json({
        success: false,
        error: '개통정보 수정에 실패했습니다.',
        message: error.message
      });
    }
  });

  // ==================== 온세일 링크 관리 API (원본 13503-13724줄) ====================
  
  // 전체 링크 조회 (관리자모드용)
  router.get('/api/onsale/links', async (req, res) => {
    try {
      console.log('📋 [온세일] 전체 링크 목록 조회 시작');

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = '온세일링크관리';
      const range = 'A:G'; // A~G열: 링크URL, 버튼명, 대리점정보숨김, 활성화여부, 개통양식사용여부, 개통양식시트ID, 개통양식시트이름

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!${range}`,
      });

      const rows = response.data.values || [];

      if (rows.length <= 1) {
        // 헤더만 있거나 데이터 없음
        return res.json({ success: true, links: [] });
      }

      const links = rows.slice(1).map((row, index) => ({
        rowIndex: index + 2, // 구글 시트의 실제 행 번호 (헤더 제외, 1-based)
        url: row[0] || '',
        buttonName: row[1] || '',
        hideAgentInfo: row[2] === 'O',
        isActive: row[3] === 'O',
        useActivationForm: row[4] === 'O',
        activationSheetId: row[5] || '',
        activationSheetName: row[6] || ''
      }));

      console.log(`✅ [온세일] 링크 조회 완료: ${links.length}개`);
      res.json({ success: true, links });

    } catch (error) {
      console.error('❌ [온세일] 링크 조회 실패:', error);
      res.status(500).json({
        success: false,
        error: '링크 조회에 실패했습니다.',
        message: error.message
      });
    }
  });

  // 활성화된 링크만 조회 (일반모드용)
  router.get('/api/onsale/active-links', async (req, res) => {
    try {
      console.log('📋 [온세일] 활성화 링크 목록 조회 시작');

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = '온세일링크관리';
      const range = 'A:G';

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!${range}`,
      });

      const rows = response.data.values || [];

      if (rows.length <= 1) {
        return res.json({ success: true, links: [] });
      }

      const activeLinks = rows.slice(1)
        .filter(row => row[3] === 'O') // 활성화여부가 'O'인 것만
        .map(row => ({
          url: row[0] || '',
          buttonName: row[1] || '',
          hideAgentInfo: row[2] === 'O',
          useActivationForm: row[4] === 'O',
          activationSheetId: row[5] || '',
          activationSheetName: row[6] || ''
        }));

      console.log(`✅ [온세일] 활성화 링크 조회 완료: ${activeLinks.length}개`);
      res.json({ success: true, links: activeLinks });

    } catch (error) {
      console.error('❌ [온세일] 활성화 링크 조회 실패:', error);
      res.status(500).json({
        success: false,
        error: '링크 조회에 실패했습니다.',
        message: error.message
      });
    }
  });

  // 새 링크 추가
  router.post('/api/onsale/links', async (req, res) => {
    try {
      console.log('➕ [온세일] 새 링크 추가 시작');
      const { url, buttonName, hideAgentInfo, isActive, useActivationForm, activationSheetId, activationSheetName } = req.body;

      if (!url || !buttonName) {
        return res.status(400).json({
          success: false,
          error: 'URL과 버튼명은 필수입니다.'
        });
      }

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = '온세일링크관리';
      const newRow = [
        url,
        buttonName,
        hideAgentInfo ? 'O' : 'X',
        isActive ? 'O' : 'X',
        useActivationForm ? 'O' : 'X',
        activationSheetId || '',
        activationSheetName || ''
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!A:G`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [newRow]
        }
      });

      console.log(`✅ [온세일] 링크 추가 완료: ${buttonName}`);
      res.json({ success: true, message: '링크가 추가되었습니다.' });

    } catch (error) {
      console.error('❌ [온세일] 링크 추가 실패:', error);
      res.status(500).json({
        success: false,
        error: '링크 추가에 실패했습니다.',
        message: error.message
      });
    }
  });

  // 링크 수정
  router.put('/api/onsale/links/:rowIndex', async (req, res) => {
    try {
      const { rowIndex } = req.params;
      const { url, buttonName, hideAgentInfo, isActive, useActivationForm, activationSheetId, activationSheetName } = req.body;

      console.log(`✏️ [온세일] 링크 수정 시작: 행 ${rowIndex}`);

      if (!url || !buttonName) {
        return res.status(400).json({
          success: false,
          error: 'URL과 버튼명은 필수입니다.'
        });
      }

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = '온세일링크관리';
      const updatedRow = [
        url,
        buttonName,
        hideAgentInfo ? 'O' : 'X',
        isActive ? 'O' : 'X',
        useActivationForm ? 'O' : 'X',
        activationSheetId || '',
        activationSheetName || ''
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!A${rowIndex}:G${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [updatedRow]
        }
      });

      console.log(`✅ [온세일] 링크 수정 완료: ${buttonName}`);
      res.json({ success: true, message: '링크가 수정되었습니다.' });

    } catch (error) {
      console.error('❌ [온세일] 링크 수정 실패:', error);
      res.status(500).json({
        success: false,
        error: '링크 수정에 실패했습니다.',
        message: error.message
      });
    }
  });

  // 링크 삭제
  router.delete('/api/onsale/links/:rowIndex', async (req, res) => {
    try {
      const { rowIndex } = req.params;

      console.log(`🗑️ [온세일] 링크 삭제 시작: 행 ${rowIndex}`);

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = '온세일링크관리';

      // Google Sheets API로 행 자체를 삭제
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0, // 첫 번째 시트 (온세일링크관리)
                dimension: 'ROWS',
                startIndex: parseInt(rowIndex) - 1, // 0-based index
                endIndex: parseInt(rowIndex) // 삭제할 행의 끝 인덱스
              }
            }
          }]
        }
      });

      console.log(`✅ [온세일] 링크 삭제 완료: 행 ${rowIndex} 완전 삭제`);
      res.json({ success: true, message: '링크가 완전히 삭제되었습니다.' });

    } catch (error) {
      console.error('❌ [온세일] 링크 삭제 실패:', error);
      res.status(500).json({
        success: false,
        error: '링크 삭제에 실패했습니다.',
        message: error.message
      });
    }
  });

  // ==================== 개통정보 보류 API (원본 12932-12992줄) ====================
  router.post('/api/onsale/activation-info/:sheetId/:rowIndex/pending', async (req, res) => {
    try {
      const { sheetId, rowIndex } = req.params;
      const { pendingBy } = req.body;

      console.log(`⏸️ [개통정보보류] 보류 처리 시작: 시트=${sheetId}, 행=${rowIndex}, 처리자=${pendingBy}`);

      if (!pendingBy) {
        return res.status(400).json({
          success: false,
          error: '보류 처리자 정보가 필요합니다.'
        });
      }

      const sheets = google.sheets({ version: 'v4', auth });

      // 시트 정보 조회
      const linksResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: '온세일링크관리!A:G',
      });

      const links = linksResponse.data.values || [];
      const link = links.slice(1).find(row => row[5] === sheetId);

      if (!link) {
        return res.status(404).json({
          success: false,
          error: '개통양식을 찾을 수 없습니다.'
        });
      }

      const sheetName = link[6];
      const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

      // G열(보류), H열(보류처리자), I열(보류일시) 업데이트
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!G${rowIndex}:I${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['보류', pendingBy, now]]
        }
      });

      console.log(`✅ [개통정보보류] 보류 처리 완료: ${sheetName} ${rowIndex}행`);

      res.json({
        success: true,
        message: '개통정보가 보류되었습니다.'
      });

    } catch (error) {
      console.error('❌ [개통정보보류] 보류 처리 실패:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ==================== 개통정보 보류 해제 API (원본 12993-13043줄) ====================
  router.post('/api/onsale/activation-info/:sheetId/:rowIndex/unpending', async (req, res) => {
    try {
      const { sheetId, rowIndex } = req.params;

      console.log(`▶️ [개통정보보류해제] 보류 해제 시작: 시트=${sheetId}, 행=${rowIndex}`);

      const sheets = google.sheets({ version: 'v4', auth });

      // 시트 정보 조회
      const linksResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: '온세일링크관리!A:G',
      });

      const links = linksResponse.data.values || [];
      const link = links.slice(1).find(row => row[5] === sheetId);

      if (!link) {
        return res.status(404).json({
          success: false,
          error: '개통양식을 찾을 수 없습니다.'
        });
      }

      const sheetName = link[6];

      // G열(보류), H열(보류처리자), I열(보류일시) 초기화
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!G${rowIndex}:I${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['', '', '']]
        }
      });

      console.log(`✅ [개통정보보류해제] 보류 해제 완료: ${sheetName} ${rowIndex}행`);

      res.json({
        success: true,
        message: '보류가 해제되었습니다.'
      });

    } catch (error) {
      console.error('❌ [개통정보보류해제] 보류 해제 실패:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ==================== 개통정보 취소 API (원본 13270-13329줄) ====================
  router.post('/api/onsale/activation-info/:sheetId/:rowIndex/cancel', async (req, res) => {
    try {
      const { sheetId, rowIndex } = req.params;
      const { cancelledBy } = req.body;

      console.log(`🚫 [개통정보취소] 개통정보 취소: ${sheetId}, 행 ${rowIndex}`);

      const sheets = google.sheets({ version: 'v4', auth });

      // 시트 이름 찾기
      const linksResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: '온세일링크관리!A:G',
      });

      const links = linksResponse.data.values || [];
      const link = links.slice(1).find(row => row[5] === sheetId);

      if (!link) {
        return res.status(404).json({
          success: false,
          error: '시트를 찾을 수 없습니다.'
        });
      }

      const sheetName = link[6];

      // 취소 처리 (D열: 취소여부, E열: 취소자, F열: 취소시간)
      const cancelledAt = new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!D${rowIndex}:F${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['취소', cancelledBy || '', cancelledAt]]
        }
      });

      console.log(`✅ [개통정보취소] 취소 완료`);
      res.json({ success: true, message: '개통정보가 취소되었습니다.' });

    } catch (error) {
      console.error('❌ [개통정보취소] 취소 실패:', error);
      res.status(500).json({
        success: false,
        error: '개통정보 취소에 실패했습니다.',
        message: error.message
      });
    }
  });

  // ==================== 개통정보 목록 조회 API (원본 13044-13269줄) ====================
  router.get('/api/onsale/activation-list', async (req, res) => {
    try {
      console.log('📋 [개통정보목록] 개통정보 목록 조회 시작');
      const { storeName, sheetId, allSheets, month } = req.query;

      console.log('📋 [개통정보목록] 요청 파라미터:', { storeName, sheetId, allSheets, month });
      console.log('📋 [개통정보목록] 요청 IP:', req.ip);
      console.log('📋 [개통정보목록] User-Agent:', req.get('User-Agent'));

      const sheets = google.sheets({ version: 'v4', auth });
      let targetSheets = [];

      if (allSheets === 'true') {
        // 모든 개통양식 시트 조회
        console.log('📋 [개통정보목록] 온세일링크관리 시트에서 개통양식 정보 조회');

        const linksResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '온세일링크관리!A:G',
        });

        const links = linksResponse.data.values || [];
        console.log('📋 [개통정보목록] 온세일링크관리 전체 데이터:', links);
        console.log('📋 [개통정보목록] 온세일링크관리 데이터 개수:', links.length);

        if (links.length > 0) {
          console.log('📋 [개통정보목록] 온세일링크관리 헤더:', links[0]);
          console.log('📋 [개통정보목록] 온세일링크관리 데이터 (첫 5개):', links.slice(1, 6));
        }

        const filteredLinks = links.slice(1)
          .filter(row => row[4] === 'O') // 개통양식 사용 여부가 'O'
          .map(row => ({
            sheetId: row[5] || '',
            sheetName: row[6] || ''
          }))
          .filter(sheet => sheet.sheetId && sheet.sheetName);

        console.log('📋 [개통정보목록] 개통양식 사용 설정된 링크들:', filteredLinks);
        console.log('📋 [개통정보목록] 개통양식 링크 개수:', filteredLinks.length);

        targetSheets = filteredLinks;
      } else if (sheetId) {
        // 특정 시트만 조회
        const linksResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: '온세일링크관리!A:G',
        });

        const links = linksResponse.data.values || [];
        const link = links.slice(1).find(row => row[5] === sheetId);
        if (link) {
          targetSheets = [{
            sheetId: link[5],
            sheetName: link[6]
          }];
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'sheetId 또는 allSheets 파라미터가 필요합니다.'
        });
      }

      const allData = [];

      console.log('📋 [개통정보목록] 처리할 시트 개수:', targetSheets.length);

      if (targetSheets.length === 0) {
        console.log('⚠️ [개통정보목록] 처리할 시트가 없습니다');
        return res.json({
          success: true,
          data: [],
          message: '활성화된 개통양식이 없습니다. 온세일관리모드에서 개통양식 사용을 활성화해주세요.'
        });
      }

      for (const sheet of targetSheets) {
        try {
          console.log(`📋 [개통정보목록] 시트 처리 중: ${sheet.sheetName} (ID: ${sheet.sheetId})`);

          const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: sheet.sheetId,
            range: `${sheet.sheetName}!A:AL`,
          });

          const rows = sheetData.data.values || [];
          console.log(`📋 [개통정보목록] ${sheet.sheetName} 시트 데이터 개수:`, rows.length);

          if (rows.length > 0) {
            console.log(`📋 [개통정보목록] ${sheet.sheetName} 시트 헤더:`, rows[0]);
            console.log(`📋 [개통정보목록] ${sheet.sheetName} 시트 첫 번째 데이터:`, rows[1]);
          }

          for (let i = 1; i < rows.length; i++) { // 헤더 제외
            const row = rows[i];
            if (row.length === 0) continue;

            const isCompleted = row[0]?.trim() === '개통완료'; // A열
            const completedBy = row[1] || ''; // B열
            const completedAt = row[2] || ''; // C열
            const isCancelled = row[3]?.trim() === '취소'; // D열
            const cancelledBy = row[4] || ''; // E열
            const cancelledAt = row[5] || ''; // F열
            const isPending = row[6]?.trim() === '보류'; // G열
            const pendingBy = row[7] || ''; // H열
            const pendingAt = row[8] || ''; // I열
            const lastEditor = row[9] || ''; // J열
            const editedAt = row[10] || ''; // K열
            const submittedAt = row[11] || ''; // L열
            const storeNameFromSheet = row[12] || ''; // M열
            const pCode = row[13] || ''; // N열

            // submittedAt 검증 로그
            if (!submittedAt) {
              console.log(`⚠️ [개통정보목록] submittedAt 없음: ${storeNameFromSheet} - ${row[16] || '이름없음'} (행: ${i + 1})`);
            }

            // 완료 상태 로깅
            if (isCompleted) {
              console.log(`✅ [개통정보목록] 완료된 데이터 발견: ${storeNameFromSheet} - ${row[16] || ''} - ${completedBy}`);
            }

            // 보류 상태 로깅
            if (isPending) {
              console.log(`⏸️ [개통정보목록] 보류된 데이터 발견: ${storeNameFromSheet} - ${row[16] || ''} - ${pendingBy}`);
            }

            const activationType = row[14] || ''; // O열
            const previousCarrier = row[15] || ''; // P열
            const customerName = row[16] || ''; // Q열
            const birthDate = row[17] || ''; // R열
            const phoneNumber = row[18] || ''; // S열
            const modelName = row[19] || ''; // T열
            const deviceSerial = row[20] || ''; // U열
            const color = row[21] || ''; // V열
            const simModel = row[22] || ''; // W열
            const simSerial = row[23] || ''; // X열
            const plan = row[30] || ''; // AE열

            // storeName 필터링
            if (storeName && storeNameFromSheet !== storeName) {
              continue;
            }

            allData.push({
              rowIndex: i + 1,
              sheetId: sheet.sheetId,
              sheetName: sheet.sheetName,
              submittedAt,
              lastEditor,
              storeName: storeNameFromSheet,
              activationType,
              customerName,
              phoneNumber,
              birthDate,
              modelName,
              deviceSerial,
              color,
              simModel,
              simSerial,
              plan,
              isCompleted,
              completedBy,
              completedAt,
              isCancelled,
              cancelledBy,
              cancelledAt,
              isPending,
              pendingBy,
              pendingAt,
              editedAt
            });
          }
        } catch (error) {
          console.error(`❌ [개통정보목록] 시트 ${sheet.sheetName} 조회 실패:`, error);
          continue;
        }
      }

      // 월별 필터링 적용
      let filteredData = allData;
      if (month) {
        console.log('📋 [개통정보목록] 월별 필터링 적용:', month);
        filteredData = allData.filter(item => {
          if (!item.submittedAt) return false;

          // submittedAt을 Date 객체로 변환
          const submittedDate = new Date(item.submittedAt);
          const submittedYear = submittedDate.getFullYear();
          const submittedMonth = String(submittedDate.getMonth() + 1).padStart(2, '0');
          const submittedYearMonth = `${submittedYear}-${submittedMonth}`;

          console.log('📋 [개통정보목록] 필터링 비교:', {
            submittedYearMonth,
            filterMonth: month,
            match: submittedYearMonth === month
          });

          return submittedYearMonth === month;
        });
        console.log(`📋 [개통정보목록] 월별 필터링 결과: ${filteredData.length}개 (전체: ${allData.length}개)`);
      }

      // 제출일시 기준 최신순 정렬
      filteredData.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

      console.log(`✅ [개통정보목록] 조회 완료: ${filteredData.length}개`);
      res.json({ success: true, data: filteredData });

    } catch (error) {
      console.error('❌ [개통정보목록] 조회 실패:', error);
      res.status(500).json({
        success: false,
        error: '개통정보 목록 조회에 실패했습니다.',
        message: error.message
      });
    }
  });

  // ==================== 개통정보 저장 API (원본 13725-13919줄) ====================
  router.post('/api/onsale/activation-info', async (req, res) => {
    try {
      console.log('📝 [개통정보] 개통정보 저장 시작');
      const { sheetId, sheetName, data } = req.body;

      if (!sheetId || !sheetName || !data) {
        return res.status(400).json({
          success: false,
          error: '시트 ID, 시트 이름, 데이터는 필수입니다.'
        });
      }

      const sheets = google.sheets({ version: 'v4', auth });

      // Google Sheets API로 스프레드시트 접근
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: sheetId
      });

      // 시트 찾기 또는 생성
      let targetSheet = spreadsheet.data.sheets.find(sheet => sheet.properties.title === sheetName);
      if (!targetSheet) {
        console.log(`📄 [개통정보] 시트 생성: ${sheetName}`);
        const newSheet = await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        });
        targetSheet = newSheet.data.replies[0].addSheet;
      }

      // 시트 데이터 확인
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1:AI1`
      });

      const existingHeaders = sheetData.data.values?.[0] || [];

      // 헤더가 없으면 생성
      if (existingHeaders.length === 0) {
        console.log('📋 [개통정보] 헤더 생성');
        const headers = [
          '개통완료', '완료처리자', '완료일시', '취소', '취소처리자', '취소일시', '보류', '보류처리자', '보류일시', '최종수정자', '최종수정일시', '제출일시', '매장명', 'P코드', '개통유형', '이전통신사', '고객명', '생년월일', '개통번호', '모델명', '기기일련번호', '색상', '유심모델', '유심일련번호', '약정유형', '전환지원금', '유통망추가지원금', '할부개월', '할부원금', '프리', '요금제', '미디어서비스', '부가서비스', '프리미어약정', '예약번호', '기타요청사항', 'U+제출일시', 'U+제출데이터'
        ];

        // 전체 헤더 생성 (A1:AL1)
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetName}!A1:AL1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers]
          }
        });
      }

      // 제출일시 생성
      const submittedAt = new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // 매장명 추출
      const storeName = data.storeName || '';

      // 모든 변수 정의
      const pCode = data.pCode || '';
      const activationType = data.activationType || '';
      const previousCarrier = data.previousCarrier || '';
      const customerName = data.customerName || '';
      const birthDate = data.birthDate || '';
      const phoneNumber = data.phoneNumber || '';
      const modelName = data.modelName || '';
      const deviceSerial = data.deviceSerial || '';
      const color = data.color || '';
      const simModel = data.simModel || '';
      const simSerial = data.simSerial || '';
      const contractType = data.contractType || '';
      const conversionSupport = data.conversionSubsidy || '';
      const distributionSupport = data.additionalSubsidy || '';
      const installmentMonths = data.installmentMonths || '';
      const installmentAmount = data.installmentAmount || '';
      const isFree = data.free || '';
      const plan = data.plan || '';
      const mediaServices = Array.isArray(data.mediaServices) ? data.mediaServices.join(', ') : (data.mediaServices || '');
      const additionalServices = data.additionalServices || '';
      const premierContract = data.premierContract || '';
      const reservationNumber = data.reservationNumber || '';
      const otherRequests = data.otherRequests || '';

      // 데이터 추가 (A열부터 - 개통완료, 완료처리자, 완료일시, 취소, 취소처리자, 취소일시, 보류, 보류처리자, 보류일시, 최종수정자, 최종수정일시, 제출일시, 매장명, ...)
      const fullRowData = [
        '', // A열: 개통완료 여부 (신규 입력 시 빈 값)
        '', // B열: 완료처리자 (신규 입력 시 빈 값)
        '', // C열: 완료일시 (신규 입력 시 빈 값)
        '', // D열: 취소여부 (신규 입력 시 빈 값)
        '', // E열: 취소처리자 (신규 입력 시 빈 값)
        '', // F열: 취소일시 (신규 입력 시 빈 값)
        '', // G열: 보류여부 (신규 입력 시 빈 값)
        '', // H열: 보류처리자 (신규 입력 시 빈 값)
        '', // I열: 보류일시 (신규 입력 시 빈 값)
        '', // J열: 최종수정자 (신규 입력 시 빈 값)
        '', // K열: 최종수정일시 (신규 입력 시 빈 값)
        submittedAt, // L열: 제출일시
        storeName, // M열: 매장명
        pCode, // N열: P코드
        activationType, // O열: 개통유형
        previousCarrier, // P열: 이전통신사
        customerName, // Q열: 고객명
        birthDate, // R열: 생년월일
        phoneNumber, // S열: 개통번호
        modelName, // T열: 모델명
        deviceSerial, // U열: 기기일련번호
        color, // V열: 색상
        simModel, // W열: 유심모델
        simSerial, // X열: 유심일련번호
        contractType, // Y열: 약정유형
        conversionSupport, // Z열: 전환지원금
        distributionSupport, // AA열: 유통망추가지원금
        installmentMonths, // AB열: 할부개월
        installmentAmount, // AC열: 할부원금
        isFree, // AD열: 프리
        plan, // AE열: 요금제
        mediaServices, // AF열: 미디어서비스
        additionalServices, // AG열: 부가서비스
        premierContract, // AH열: 프리미어약정
        reservationNumber, // AI열: 예약번호
        otherRequests, // AJ열: 기타요청사항
        '', // AK열: U+제출일시 (빈 값)
        '' // AL열: U+제출데이터 (빈 값)
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A:AL`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [fullRowData]
        }
      });

      console.log('✅ [개통정보] 개통정보 저장 완료');
      res.json({ success: true, message: '개통정보가 저장되었습니다.' });

    } catch (error) {
      console.error('❌ [개통정보] 개통정보 저장 실패:', error);
      res.status(500).json({
        success: false,
        error: '개통정보 저장에 실패했습니다.',
        message: error.message
      });
    }
  });

  // ==================== U+ 제출 데이터 저장 API (원본 13920-14171줄) ====================
  router.post('/api/onsale/uplus-submission', async (req, res) => {
    try {
      console.log('📤 [U+제출] U+ 제출 데이터 저장 시작');
      const { sheetId, sheetName, phoneNumber, data } = req.body;

      if (!sheetId || !sheetName || !data) {
        return res.status(400).json({
          success: false,
          error: '시트 ID, 시트 이름, 데이터는 필수입니다.'
        });
      }

      const sheets = google.sheets({ version: 'v4', auth });

      // Google Sheets API로 스프레드시트 접근
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: sheetId
      });

      // 시트 찾기
      const targetSheet = spreadsheet.data.sheets.find(sheet => sheet.properties.title === sheetName);
      if (!targetSheet) {
        return res.status(404).json({
          success: false,
          error: '시트를 찾을 수 없습니다.'
        });
      }

      // 전화번호로 개통양식 데이터 행 찾기
      // A열부터 전체 데이터 가져오기 (헤더 포함)
      const searchRange = `${sheetName}!A:AL`;
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: searchRange
      });

      const rows = sheetData.data.values || [];
      let targetRowIndex = -1;

      // 전화번호로 매칭되는 행 찾기 (헤더 제외, 2행부터)
      // S열(개통번호) = A열 기준 19번째 (0-based로 18)
      for (let i = 1; i < rows.length; i++) { // 헤더(1행) 제외
        const row = rows[i];
        if (row[18] === phoneNumber) { // S열: 개통번호 (A열 기준 19번째, 0-based로 18)
          targetRowIndex = i + 1; // 1-based 인덱스 (구글시트 행 번호)
          break;
        }
      }

      if (targetRowIndex === -1) {
        // 매칭되는 행이 없으면 새 행에 AK, AL열에 저장
        console.log('📝 [U+제출] 매칭되는 개통양식 없음, 새 행에 저장');
        const timestamp = new Date().toLocaleString('ko-KR');
        const newRowData = [
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', // A~AJ열 빈 값 (37개)
          timestamp, // AK열: U+제출일시
          JSON.stringify(data) // AL열: U+제출데이터 (JSON)
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: `${sheetName}!A:AL`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [newRowData]
          }
        });
      } else {
        // 매칭되는 행이 있으면 AK, AL열에 U+ 데이터 저장
        console.log(`📝 [U+제출] 매칭되는 개통양식 발견, 행 ${targetRowIndex}에 U+ 데이터 추가`);
        const timestamp = new Date().toLocaleString('ko-KR');
        const uplusData = [
          timestamp, // AK열: U+제출일시
          JSON.stringify(data) // AL열: U+제출데이터 (JSON)
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetName}!AK${targetRowIndex}:AL${targetRowIndex}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [uplusData]
          }
        });
      }

      console.log('✅ [U+제출] U+ 제출 데이터 저장 완료');
      res.json({ success: true, message: 'U+ 제출 데이터가 저장되었습니다.' });

    } catch (error) {
      console.error('❌ [U+제출] U+ 제출 데이터 저장 실패:', error);
      res.status(500).json({
        success: false,
        error: 'U+ 제출 데이터 저장에 실패했습니다.',
        message: error.message
      });
    }
  });

  // ==================== 일반모드 온세일 권한 확인 API (원본 14172-14690줄) ====================
  
  // 일반모드 온세일 권한 확인
  router.post('/api/check-general-policy-permission', async (req, res) => {
    try {
      const { userId, password } = req.body;

      console.log(`🔐 [일반정책모드] 권한 확인 시작: ${userId}`);

      if (!userId || !password) {
        return res.status(400).json({
          success: false,
          hasPermission: false,
          error: '사용자 ID와 비밀번호를 입력해주세요.'
        });
      }

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = '일반모드권한관리';
      const range = 'A:K'; // A~K열: 사용자ID, 업체명, 그룹, 기본모드, 온세일접수모드, 온세일접수비밀번호, 직영점모드, 직영점비밀번호, 일반정책모드, 일반정책모드비밀번호, 담당자아이디

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!${range}`,
      });

      const rows = response.data.values || [];

      // 헤더는 3행(인덱스 2), 데이터는 4행(인덱스 3)부터
      if (rows.length <= 3) {
        console.log('⚠️ [일반정책모드] 일반모드권한관리 시트에 데이터가 없습니다.');
        return res.json({ success: true, hasPermission: false });
      }

      // 4행부터 데이터
      const dataRows = rows.slice(3);
      const normalizedUserId = (userId || '').toString().trim().toUpperCase();
      const userRow = dataRows.find(row => {
        const rowId = (row[0] || '').toString().trim().toUpperCase();
        return rowId === normalizedUserId;
      });

      if (!userRow) {
        console.log(`⚠️ [일반정책모드] 사용자를 찾을 수 없습니다: ${userId}`);
        return res.json({ success: true, hasPermission: false });
      }

      // I열 (인덱스 8): 일반정책모드 권한
      const generalPolicyPermission = (userRow[8] || '').toString().trim().toUpperCase();
      const hasPermission = generalPolicyPermission === 'O';

      if (!hasPermission) {
        console.log(`⚠️ [일반정책모드] 권한이 없습니다: ${userId}`);
        return res.json({ success: true, hasPermission: false });
      }

      // J열 (인덱스 9): 일반정책모드 비밀번호
      const storedPassword = (userRow[9] || '').toString().trim();

      if (storedPassword && password !== storedPassword) {
        console.log(`⚠️ [일반정책모드] 비밀번호가 일치하지 않습니다: ${userId}`);
        return res.json({ success: true, hasPermission: false, error: '비밀번호가 일치하지 않습니다.' });
      }

      console.log(`✅ [일반정책모드] 권한 확인 성공: ${userId}`);
      return res.json({ success: true, hasPermission: true });
    } catch (error) {
      console.error('❌ [일반정책모드] 권한 확인 오류:', error);
      return res.status(500).json({
        success: false,
        hasPermission: false,
        error: '권한 확인 중 오류가 발생했습니다.'
      });
    }
  });

  // 온세일 권한 확인
  router.post('/api/check-onsale-permission', async (req, res) => {
    try {
      const { userId, password } = req.body;

      console.log(`🔐 [온세일권한] 권한 확인 시작: ${userId}`);

      if (!userId || !password) {
        return res.status(400).json({
          success: false,
          hasPermission: false,
          error: '사용자 ID와 비밀번호를 입력해주세요.'
        });
      }

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = '일반모드권한관리';
      const range = 'A:F'; // A~F열: 사용자ID(POS코드), 업체명, 영업담당, 기본모드, 온세일접수모드, 비밀번호

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!${range}`,
      });

      const rows = response.data.values || [];

      // 헤더는 3행(인덱스 2), 데이터는 4행(인덱스 3)부터
      if (rows.length <= 3) {
        console.log('⚠️ [온세일권한] 일반모드권한관리 시트에 데이터가 없습니다.');
        return res.json({ success: true, hasPermission: false });
      }

      // 4행부터 데이터
      const dataRows = rows.slice(3);
      const normalizedUserId = (userId || '').toString().trim().toUpperCase();
      const userRow = dataRows.find(row => {
        const rowId = (row[0] || '').toString().trim().toUpperCase();
        return rowId === normalizedUserId;
      });

      if (!userRow) {
        console.log(`⚠️ [온세일권한] 사용자를 찾을 수 없습니다: ${userId}`);
        return res.json({ success: true, hasPermission: false });
      }

      const storeName = userRow[1] || '';
      // E열(4인덱스): 온세일접수 모드 - 'O' 또는 'M' 모두 허용
      const eColumnValue = (userRow[4] || '').toString().trim().toUpperCase();
      const hasPermission = eColumnValue === 'O' || eColumnValue === 'M';
      const storedPassword = userRow[5] || ''; // F열(5인덱스): 비밀번호

      if (!hasPermission) {
        console.log(`⚠️ [온세일권한] 권한 없음: ${userId}`);
        return res.json({ success: true, hasPermission: false });
      }

      if (storedPassword !== password) {
        console.log(`⚠️ [온세일권한] 비밀번호 불일치: ${userId}`);
        return res.json({ success: true, hasPermission: false, error: '비밀번호가 일치하지 않습니다.' });
      }

      console.log(`✅ [온세일권한] 권한 확인 성공: ${userId} (${storeName})`);
      res.json({
        success: true,
        hasPermission: true,
        storeName
      });

    } catch (error) {
      console.error('❌ [온세일권한] 권한 확인 실패:', error);
      res.status(500).json({
        success: false,
        hasPermission: false,
        error: '권한 확인에 실패했습니다.',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createOnsaleRoutes;
