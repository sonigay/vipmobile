/**
 * Sales Routes
 * 
 * 영업 모드 데이터 및 접근 권한 관리 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/sales-data - 영업 데이터 조회
 * - GET /api/sales-mode-access - 영업 모드 접근 권한 확인
 * 
 * Requirements: 1.1, 1.2, 7.8
 */

const express = require('express');
const router = express.Router();

/**
 * Sales Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.cacheManager - 캐시 매니저
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createSalesRoutes(context) {
  const { sheetsClient, cacheManager, rateLimiter } = context;

  // 시트 이름 상수
  const AGENT_SHEET_NAME = '대리점아이디관리';

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
        range: `${sheetName}!A:AF`
      })
    );
    
    return response.data.values || [];
  }

  // 영업 데이터 처리 함수
  async function processSalesData(spreadsheetId) {
    const startTime = Date.now();

    if (!spreadsheetId) {
      throw new Error('SALES_SHEET_ID 환경변수가 설정되어 있지 않습니다.');
    }

    const RAW_DATA_SHEET_NAME = 'raw데이터';
    const rawDataValues = await getSheetValues(RAW_DATA_SHEET_NAME, spreadsheetId);

    if (!rawDataValues) {
      throw new Error('Failed to fetch data from raw data sheet');
    }

    // 헤더 제거 (3행이 헤더, 4행부터 데이터)
    const rawDataRows = rawDataValues.slice(3);

    // 필터링된 데이터 처리
    const salesData = [];
    const posCodeMap = new Map();
    const regionMap = new Map();

    // 유효한 데이터만 먼저 필터링
    const validRows = rawDataRows.filter(row => {
      if (!row || row.length < 28) return false;

      const latitude = parseFloat(row[10]) || 0;
      const longitude = parseFloat(row[11]) || 0;
      const performance = parseInt(row[27]) || 0;

      return latitude && longitude && performance > 0;
    });

    validRows.forEach((row) => {
      const latitude = parseFloat(row[10]);
      const longitude = parseFloat(row[11]);
      const address = (row[12] || '').toString();
      const agentCode = (row[16] || '').toString();
      const agentName = (row[17] || '').toString();
      const posCode = (row[21] || '').toString();
      const storeName = (row[22] || '').toString();
      const region = (row[24] || '').toString();
      const subRegion = (row[25] || '').toString();
      const performance = parseInt(row[27]);
      const manager = (row[14] || '').toString();
      const branch = (row[15] || '').toString();
      const province = (row[4] || '').toString();
      const city = (row[5] || '').toString();
      const district = (row[6] || '').toString();
      const detailArea = (row[7] || '').toString();

      const salesItem = {
        latitude,
        longitude,
        address,
        agentCode,
        agentName,
        posCode,
        storeName,
        region,
        subRegion,
        performance,
        manager,
        branch,
        province,
        city,
        district,
        detailArea
      };

      salesData.push(salesItem);

      // POS코드별 실적 합계
      if (!posCodeMap.has(posCode)) {
        posCodeMap.set(posCode, {
          latitude,
          longitude,
          address,
          posCode,
          storeName,
          region,
          subRegion,
          manager,
          branch,
          province,
          city,
          district,
          detailArea,
          totalPerformance: 0,
          agents: new Map()
        });
      }

      const posCodeData = posCodeMap.get(posCode);
      posCodeData.totalPerformance += performance;

      if (!posCodeData.agents.has(agentCode)) {
        posCodeData.agents.set(agentCode, {
          agentCode,
          agentName,
          performance
        });
      } else {
        posCodeData.agents.get(agentCode).performance += performance;
      }

      // 지역별 실적 합계
      const regionKey = `${region}_${subRegion}`;
      if (!regionMap.has(regionKey)) {
        regionMap.set(regionKey, {
          region,
          subRegion,
          totalPerformance: 0,
          posCodes: new Set()
        });
      }

      const regionData = regionMap.get(regionKey);
      regionData.totalPerformance += performance;
      regionData.posCodes.add(posCode);
    });

    // Map을 Object로 변환
    const posCodeMapObj = {};
    posCodeMap.forEach((value, key) => {
      posCodeMapObj[key] = {
        ...value,
        agents: Array.from(value.agents.values())
      };
    });

    const regionMapObj = {};
    regionMap.forEach((value, key) => {
      regionMapObj[key] = {
        ...value,
        posCodes: Array.from(value.posCodes)
      };
    });

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: {
        salesData,
        posCodeMap: posCodeMapObj,
        regionMap: regionMapObj,
        summary: {
          totalRecords: salesData.length,
          totalPosCodes: posCodeMap.size,
          totalRegions: regionMap.size,
          totalPerformance: Array.from(posCodeMap.values()).reduce((sum, item) => sum + item.totalPerformance, 0)
        }
      },
      processingTime
    };
  }

  // GET /api/sales-data - 영업 데이터 조회
  router.get('/api/sales-data', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const cacheKey = 'sales_data';

      // 캐시에서 먼저 확인
      const cachedSalesData = cacheManager.get(cacheKey);
      if (cachedSalesData) {
        return res.json(cachedSalesData);
      }

      const spreadsheetId = process.env.SALES_SHEET_ID;
      const result = await processSalesData(spreadsheetId);

      // 결과 검증
      if (!result || !result.success) {
        throw new Error('영업 데이터 처리 결과가 유효하지 않습니다.');
      }

      // 캐시에 저장 (6시간 TTL)
      cacheManager.set(cacheKey, result, 6 * 60 * 60 * 1000);

      res.json(result);
    } catch (error) {
      console.error('Error fetching sales data:', error);

      const errorResponse = {
        success: false,
        error: 'Failed to fetch sales data',
        message: error.message,
        timestamp: new Date().toISOString(),
        details: {
          hasSalesSheetId: !!process.env.SALES_SHEET_ID,
          salesSheetId: process.env.SALES_SHEET_ID ? 'SET' : 'NOT_SET'
        }
      };

      res.status(500).json(errorResponse);
    }
  });

  // GET /api/sales-mode-access - 영업 모드 접근 권한 확인
  router.get('/api/sales-mode-access', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      // 대리점아이디관리 시트에서 U열 권한 확인
      const agentResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${AGENT_SHEET_NAME}!A:U`
        })
      );

      if (!agentResponse.data.values || agentResponse.data.values.length === 0) {
        throw new Error('Failed to fetch agent data');
      }

      // 헤더 제거
      const agentRows = agentResponse.data.values.slice(1);

      // U열에서 "O" 권한이 있는 대리점 찾기
      const authorizedAgents = agentRows
        .filter(row => row && row.length > 20 && row[20] === 'O')
        .map(row => ({
          agentCode: row[0] || '',
          agentName: row[1] || '',
          accessLevel: row[20] || ''
        }));

      res.json({
        success: true,
        hasAccess: authorizedAgents.length > 0,
        authorizedAgents,
        totalAgents: agentRows.length,
        authorizedCount: authorizedAgents.length
      });
    } catch (error) {
      console.error('Error checking sales mode access:', error);
      res.status(500).json({
        success: false,
        hasAccess: false,
        error: 'Failed to check sales mode access',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createSalesRoutes;
