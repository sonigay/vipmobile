/**
 * Activation Routes
 * 
 * 개통 실적 데이터 조회 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/activation-data/current-month - 당월 개통실적 조회
 * - GET /api/activation-data/previous-month - 전월 개통실적 조회
 * - GET /api/activation-data/by-date - 날짜별 개통실적 조회
 * - GET /api/activation-data/date-comparison/:date - 날짜 비교 개통실적 조회
 * 
 * Requirements: 1.1, 1.2, 7.12
 */

const express = require('express');
const router = express.Router();

/**
 * Activation Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createActivationRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // 시트 이름 상수
  const CURRENT_MONTH_ACTIVATION_SHEET_NAME = '당월개통실적';
  const PREVIOUS_MONTH_ACTIVATION_SHEET_NAME = '전월개통실적';

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
  async function getSheetValues(sheetName) {
    const response = await rateLimiter.execute(() =>
      sheetsClient.sheets.spreadsheets.values.get({
        spreadsheetId: sheetsClient.SPREADSHEET_ID,
        range: `${sheetName}!A:Z`
      })
    );
    
    return response.data.values || [];
  }

  // GET /api/activation-data/current-month - 당월 개통실적 조회
  router.get('/api/activation-data/current-month', async (req, res) => {
    const cacheKey = 'current_month_activation_data';

    // 캐시에서 먼저 확인
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      if (!requireSheetsClient(res)) return;

      const activationValues = await getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME);

      if (!activationValues) {
        throw new Error('Failed to fetch data from current month activation sheet');
      }

      // 헤더 제거
      const activationRows = activationValues.slice(1);

      // 개통실적 데이터 구성 (선불개통 제외)
      const activationData = activationRows
        .filter(row => row[14] !== '선불개통') // O열: 개통 (선불개통 제외)
        .map(row => {
          return {
            '담당자': row[8] || '',        // I열: 담당자
            '개통일': row[9] || '',        // J열: 개통일
            '개통시': row[10] || '',       // K열: 개통시
            '개통분': row[11] || '',       // L열: 개통분
            '출고처': row[14] || '',       // O열: 출고처
            '개통': row[19] || '',         // T열: 개통
            '모델명': row[21] || '',       // V열: 모델명
            '색상': row[22] || '',         // W열: 색상
            '일련번호': row[23] || ''      // X열: 일련번호
          };
        });

      // 캐시에 저장 (5분 TTL)
      cacheManager.set(cacheKey, activationData);

      res.json(activationData);
    } catch (error) {
      console.error('Error fetching current month activation data:', error);
      res.status(500).json({
        error: 'Failed to fetch current month activation data',
        message: error.message
      });
    }
  });

  // GET /api/activation-data/previous-month - 전월 개통실적 조회
  router.get('/api/activation-data/previous-month', async (req, res) => {
    const cacheKey = 'previous_month_activation_data';

    // 캐시에서 먼저 확인
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      if (!requireSheetsClient(res)) return;

      const activationValues = await getSheetValues(PREVIOUS_MONTH_ACTIVATION_SHEET_NAME);

      if (!activationValues) {
        throw new Error('Failed to fetch data from previous month activation sheet');
      }

      // 헤더 제거
      const activationRows = activationValues.slice(1);

      // 개통실적 데이터 구성 (선불개통 제외)
      const activationData = activationRows
        .filter(row => row[14] !== '선불개통') // O열: 개통 (선불개통 제외)
        .map(row => {
          return {
            '담당자': row[8] || '',        // I열: 담당자
            '개통일': row[9] || '',        // J열: 개통일
            '개통시': row[10] || '',       // K열: 개통시
            '개통분': row[11] || '',       // L열: 개통분
            '출고처': row[14] || '',       // O열: 출고처
            '개통': row[19] || '',         // T열: 개통
            '모델명': row[21] || '',       // V열: 모델명
            '색상': row[22] || '',         // W열: 색상
            '일련번호': row[23] || ''      // X열: 일련번호
          };
        });

      // 캐시에 저장 (5분 TTL)
      cacheManager.set(cacheKey, activationData);

      res.json(activationData);
    } catch (error) {
      console.error('Error fetching previous month activation data:', error);
      res.status(500).json({
        error: 'Failed to fetch previous month activation data',
        message: error.message
      });
    }
  });

  // GET /api/activation-data/by-date - 날짜별 개통실적 조회
  router.get('/api/activation-data/by-date', async (req, res) => {
    const cacheKey = 'activation_data_by_date';

    // 캐시에서 먼저 확인
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      if (!requireSheetsClient(res)) return;

      // 당월과 전월 데이터를 모두 가져와서 날짜별로 그룹화
      const [currentMonthValues, previousMonthValues] = await Promise.all([
        getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME),
        getSheetValues(PREVIOUS_MONTH_ACTIVATION_SHEET_NAME)
      ]);

      const allRows = [
        ...(currentMonthValues ? currentMonthValues.slice(1) : []),
        ...(previousMonthValues ? previousMonthValues.slice(1) : [])
      ];

      // 날짜별로 그룹화
      const byDate = {};
      allRows
        .filter(row => row[14] !== '선불개통')
        .forEach(row => {
          const date = row[9] || ''; // J열: 개통일
          if (!date) return;

          if (!byDate[date]) {
            byDate[date] = [];
          }

          byDate[date].push({
            '담당자': row[8] || '',
            '개통일': row[9] || '',
            '개통시': row[10] || '',
            '개통분': row[11] || '',
            '출고처': row[14] || '',
            '개통': row[19] || '',
            '모델명': row[21] || '',
            '색상': row[22] || '',
            '일련번호': row[23] || ''
          });
        });

      // 캐시에 저장 (5분 TTL)
      cacheManager.set(cacheKey, byDate);

      res.json(byDate);
    } catch (error) {
      console.error('Error fetching activation data by date:', error);
      res.status(500).json({
        error: 'Failed to fetch activation data by date',
        message: error.message
      });
    }
  });

  // GET /api/activation-data/date-comparison/:date - 날짜 비교 개통실적 조회
  router.get('/api/activation-data/date-comparison/:date', async (req, res) => {
    const { date } = req.params;
    const cacheKey = `activation_date_comparison_${date}`;

    // 캐시에서 먼저 확인
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    try {
      if (!requireSheetsClient(res)) return;

      const [currentMonthValues, previousMonthValues] = await Promise.all([
        getSheetValues(CURRENT_MONTH_ACTIVATION_SHEET_NAME),
        getSheetValues(PREVIOUS_MONTH_ACTIVATION_SHEET_NAME)
      ]);

      const currentMonthData = (currentMonthValues ? currentMonthValues.slice(1) : [])
        .filter(row => row[14] !== '선불개통' && row[9] === date)
        .map(row => ({
          '담당자': row[8] || '',
          '개통일': row[9] || '',
          '출고처': row[14] || '',
          '개통': row[19] || '',
          '모델명': row[21] || '',
          '색상': row[22] || ''
        }));

      const previousMonthData = (previousMonthValues ? previousMonthValues.slice(1) : [])
        .filter(row => row[14] !== '선불개통' && row[9] === date)
        .map(row => ({
          '담당자': row[8] || '',
          '개통일': row[9] || '',
          '출고처': row[14] || '',
          '개통': row[19] || '',
          '모델명': row[21] || '',
          '색상': row[22] || ''
        }));

      const result = {
        date,
        currentMonth: currentMonthData,
        previousMonth: previousMonthData,
        comparison: {
          currentCount: currentMonthData.length,
          previousCount: previousMonthData.length,
          difference: currentMonthData.length - previousMonthData.length
        }
      };

      // 캐시에 저장 (5분 TTL)
      cacheManager.set(cacheKey, result);

      res.json(result);
    } catch (error) {
      console.error('Error fetching activation date comparison:', error);
      res.status(500).json({
        error: 'Failed to fetch activation date comparison',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createActivationRoutes;
