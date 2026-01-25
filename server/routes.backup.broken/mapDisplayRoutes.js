/**
 * Map Display Routes
 * 
 * 지도 재고 노출 옵션 관리 엔드포인트를 제공합니다.
 * 
 * Endpoints:
 * - GET /api/map-display-option - 지도 재고 노출 옵션 조회
 * - POST /api/map-display-option - 지도 재고 노출 옵션 저장
 * - POST /api/map-display-option/batch - 지도 재고 노출 옵션 배치 저장
 * - GET /api/map-display-option/values - 선택값 목록 조회
 * - GET /api/map-display-option/users - O 사용자 목록 조회
 * 
 * Requirements: 1.1, 1.2, 7.7
 */

const express = require('express');
const router = express.Router();

/**
 * Map Display Routes Factory
 * 
 * @param {Object} context - 공통 컨텍스트 객체
 * @param {Object} context.sheetsClient - Google Sheets 클라이언트
 * @param {Object} context.rateLimiter - Rate Limiter
 * @returns {express.Router} Express 라우터
 */
function createMapDisplayRoutes(context) {
  const { sheetsClient, rateLimiter } = context;

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
        range: `${sheetName}!A:AF`
      })
    );
    
    return response.data.values || [];
  }

  // GET /api/map-display-option - 지도 재고 노출 옵션 조회
  router.get('/api/map-display-option', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { userId, mode } = req.query; // mode: '관리자모드' 또는 '일반모드'

      const sheetName = '지도재고노출옵션';
      const values = await getSheetValues(sheetName);

      if (values.length <= 1) {
        // 헤더만 있거나 데이터가 없으면 기본값 반환
        return res.json({
          success: true,
          option: '전체',
          value: '',
          mode: mode || '관리자모드'
        });
      }

      // 헤더 제외하고 데이터 검색
      const rows = values.slice(1);
      const foundRow = rows.find(row => {
        const rowUserId = (row[0] || '').toString().trim();
        const rowMode = (row[1] || '').toString().trim();
        return rowUserId === userId && rowMode === mode;
      });

      if (foundRow) {
        return res.json({
          success: true,
          option: foundRow[2] || '전체', // C열: 노출옵션
          value: foundRow[3] || '',      // D열: 선택값
          mode: foundRow[1] || mode,     // B열: 모드구분
          updatedAt: foundRow[4] || '',  // E열: 수정일시
          updatedBy: foundRow[5] || ''   // F열: 수정자
        });
      }

      // 옵션이 없으면 기본값 반환
      return res.json({
        success: true,
        option: '전체',
        value: '',
        mode: mode || '관리자모드'
      });
    } catch (error) {
      console.error('지도 재고 노출 옵션 조회 오류:', error);
      return res.status(500).json({
        success: false,
        error: '옵션 조회에 실패했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/map-display-option - 지도 재고 노출 옵션 저장
  router.post('/api/map-display-option', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { userId, mode, option, value, updatedBy } = req.body;

      // 권한 체크: "M" 권한자만 저장 가능
      const userRole = req.headers['x-user-role'];
      if (userRole !== 'M') {
        return res.status(403).json({
          success: false,
          error: '권한이 없습니다. "M" 권한자만 옵션을 설정할 수 있습니다.'
        });
      }

      if (!userId || !mode || !option) {
        return res.status(400).json({
          success: false,
          error: '필수 파라미터가 누락되었습니다.'
        });
      }

      const sheetName = '지도재고노출옵션';
      const now = new Date().toLocaleString('ko-KR');

      // 기존 데이터 조회
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${sheetName}!A:F`,
        })
      );

      const values = response.data.values || [];

      // 헤더 확인 및 추가
      if (values.length === 0 || !values[0] || values[0].length === 0 || values[0][0] !== '사용자ID') {
        // 헤더가 없으면 추가
        const headerRow = ['사용자ID', '모드구분', '노출옵션', '선택값', '수정일시', '수정자'];
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${sheetName}!A1:F1`,
            valueInputOption: 'RAW',
            resource: {
              values: [headerRow]
            }
          })
        );
      }

      // 헤더 제외하고 데이터만
      const rows = values.length > 1 ? values.slice(1) : [];

      // 기존 행 찾기
      const existingRowIndex = rows.findIndex(row => {
        const rowUserId = (row[0] || '').toString().trim();
        const rowMode = (row[1] || '').toString().trim();
        return rowUserId === userId && rowMode === mode;
      });

      const newRow = [
        userId,           // A열: 사용자ID
        mode,             // B열: 모드구분
        option,           // C열: 노출옵션
        value || '',      // D열: 선택값
        now,              // E열: 수정일시
        updatedBy || ''   // F열: 수정자
      ];

      if (existingRowIndex !== -1) {
        // 기존 행 업데이트 (헤더 + 인덱스 + 1)
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${sheetName}!A${existingRowIndex + 2}:F${existingRowIndex + 2}`,
            valueInputOption: 'RAW',
            resource: {
              values: [newRow]
            }
          })
        );
      } else {
        // 새 행 추가 (A열부터)
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.append({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${sheetName}!A:F`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [newRow]
            }
          })
        );
      }

      return res.json({
        success: true,
        message: '옵션이 저장되었습니다.'
      });
    } catch (error) {
      console.error('지도 재고 노출 옵션 저장 오류:', error);
      return res.status(500).json({
        success: false,
        error: '옵션 저장에 실패했습니다.',
        message: error.message
      });
    }
  });

  // POST /api/map-display-option/batch - 지도 재고 노출 옵션 배치 저장
  router.post('/api/map-display-option/batch', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { settings, updatedBy } = req.body; // settings: [{ userId, mode, option, value }, ...]

      // 권한 체크: "M" 권한자만 저장 가능
      const userRole = req.headers['x-user-role'];
      if (userRole !== 'M') {
        return res.status(403).json({
          success: false,
          error: '권한이 없습니다. "M" 권한자만 옵션을 설정할 수 있습니다.'
        });
      }

      if (!settings || !Array.isArray(settings) || settings.length === 0) {
        return res.status(400).json({
          success: false,
          error: '저장할 설정이 없습니다.'
        });
      }

      const sheetName = '지도재고노출옵션';
      const now = new Date().toLocaleString('ko-KR');

      // 기존 데이터 조회
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${sheetName}!A:F`,
        })
      );

      const values = response.data.values || [];

      // 헤더 확인 및 추가
      if (values.length === 0 || !values[0] || values[0].length === 0 || values[0][0] !== '사용자ID') {
        // 헤더가 없으면 추가
        const headerRow = ['사용자ID', '모드구분', '노출옵션', '선택값', '수정일시', '수정자'];
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${sheetName}!A1:F1`,
            valueInputOption: 'RAW',
            resource: {
              values: [headerRow]
            }
          })
        );
      }

      // 헤더 제외하고 데이터만
      const rows = values.length > 1 ? values.slice(1) : [];

      // 업데이트할 행과 추가할 행 분리
      const updates = [];
      const inserts = [];

      settings.forEach(setting => {
        const { userId, mode, option, value } = setting;

        if (!userId || !mode || !option) {
          return; // 필수 파라미터 누락 시 스킵
        }

        const existingRowIndex = rows.findIndex(row => {
          const rowUserId = (row[0] || '').toString().trim();
          const rowMode = (row[1] || '').toString().trim();
          return rowUserId === userId && rowMode === mode;
        });

        const newRow = [
          userId,
          mode,
          option,
          value || '',
          now,
          updatedBy || ''
        ];

        if (existingRowIndex !== -1) {
          updates.push({
            range: `${sheetName}!A${existingRowIndex + 2}:F${existingRowIndex + 2}`,
            values: [newRow]
          });
        } else {
          inserts.push(newRow);
        }
      });

      // 업데이트 작업 수행
      for (const update of updates) {
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.update({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: update.range,
            valueInputOption: 'RAW',
            resource: {
              values: update.values
            }
          })
        );
      }

      // 추가 작업 수행 (배치로 한 번에)
      if (inserts.length > 0) {
        await rateLimiter.execute(() =>
          sheetsClient.sheets.spreadsheets.values.append({
            spreadsheetId: sheetsClient.SPREADSHEET_ID,
            range: `${sheetName}!A:F`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: inserts
            }
          })
        );
      }

      return res.json({
        success: true,
        message: `${updates.length}개 업데이트, ${inserts.length}개 추가 완료`
      });
    } catch (error) {
      console.error('지도 재고 노출 옵션 배치 저장 오류:', error);
      return res.status(500).json({
        success: false,
        error: '옵션 저장에 실패했습니다.',
        message: error.message
      });
    }
  });

  // GET /api/map-display-option/values - 선택값 목록 조회
  router.get('/api/map-display-option/values', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      const { option } = req.query; // option: '코드별', '사무실별', '소속별', '담당자별'

      if (!option || !['코드별', '사무실별', '소속별', '담당자별'].includes(option)) {
        return res.status(400).json({
          success: false,
          error: '올바른 옵션을 선택해주세요.'
        });
      }

      const sheetName = '폰클출고처데이터';
      const response = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${sheetName}!A:AF`,
        })
      );

      const values = response.data.values || [];
      if (values.length <= 1) {
        return res.json({
          success: true,
          values: []
        });
      }

      const rows = values.slice(1); // 헤더 제외
      const uniqueValues = new Set();

      rows.forEach(row => {
        let value = '';
        switch (option) {
          case '코드별':
            value = (row[7] || '').toString().trim(); // H열(7인덱스): 코드
            break;
          case '사무실별':
            value = (row[3] || '').toString().trim(); // D열(3인덱스): 사무실
            break;
          case '소속별':
            value = (row[4] || '').toString().trim(); // E열(4인덱스): 소속
            break;
          case '담당자별':
            value = (row[5] || '').toString().trim(); // F열(5인덱스): 담당자
            break;
        }

        if (value) {
          uniqueValues.add(value);
        }
      });

      const sortedValues = Array.from(uniqueValues).sort();

      return res.json({
        success: true,
        values: sortedValues
      });
    } catch (error) {
      console.error('선택값 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        error: '선택값 목록 조회에 실패했습니다.',
        message: error.message
      });
    }
  });

  // GET /api/map-display-option/users - O 사용자 목록 조회
  router.get('/api/map-display-option/users', async (req, res) => {
    try {
      if (!requireSheetsClient(res)) return;

      // 권한 체크: "M" 권한자만 조회 가능
      const userRole = (req.headers['x-user-role'] || '').toString().trim().toUpperCase();
      console.log('🔍 [지도옵션] 사용자 목록 조회 요청:', { userRole, userId: req.headers['x-user-id'] });

      if (userRole !== 'M') {
        console.log('🔍 [지도옵션] 권한 없음:', userRole);
        return res.status(403).json({
          success: false,
          error: '권한이 없습니다. "M" 권한자만 조회 가능합니다.'
        });
      }

      // 일반모드권한관리 시트에서 "O" 사용자 목록 가져오기
      const generalModeSheetName = '일반모드권한관리';
      const generalModeResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${generalModeSheetName}!A:K`,
        })
      );

      const generalModeValues = generalModeResponse.data.values || [];
      const generalModeRows = generalModeValues.length > 3 ? generalModeValues.slice(3) : [];

      // 기본모드 권한이 있는 사용자만 필터링 (D열이 'O')
      const users = generalModeRows
        .filter(row => row[3] === 'O') // D열: 기본 모드 권한
        .map(row => ({
          userId: row[0] || '',      // A열: 사용자ID
          name: row[1] || '',        // B열: 업체명
          group: row[2] || ''        // C열: 그룹
        }));

      // 관리자모드 사용자도 추가 (대리점아이디관리 시트에서 Z열이 'O' 또는 'M'인 사용자)
      const agentSheetName = '대리점아이디관리';
      const agentResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${agentSheetName}!A:AF`,
        })
      );

      const agentValues = agentResponse.data.values || [];
      const agentRows = agentValues.length > 1 ? agentValues.slice(1) : [];

      const agentUsers = agentRows
        .filter(row => {
          const agentModePermission = (row[25] || '').toString().trim().toUpperCase();
          return agentModePermission === 'O' || agentModePermission === 'M';
        })
        .map(row => ({
          userId: row[2] || '',      // C열: 연락처(아이디)
          name: `${row[0] || ''} (${row[1] || ''})`, // A열: 대상, B열: 자격
          group: row[5] || '',       // F열: 사무실
          isAgent: true
        }));

      // 모든 사용자의 옵션 설정을 한 번에 조회
      const sheetName = '지도재고노출옵션';
      const optionResponse = await rateLimiter.execute(() =>
        sheetsClient.sheets.spreadsheets.values.get({
          spreadsheetId: sheetsClient.SPREADSHEET_ID,
          range: `${sheetName}!A:F`,
        })
      );

      const optionValues = optionResponse.data.values || [];
      const optionRows = optionValues.length > 1 ? optionValues.slice(1) : [];

      // 옵션 설정을 맵으로 변환 { userId_mode: { option, value, ... } }
      const optionsMap = {};
      optionRows.forEach(row => {
        const rowUserId = (row[0] || '').toString().trim();
        const rowMode = (row[1] || '').toString().trim();
        const key = `${rowUserId}_${rowMode}`;
        optionsMap[key] = {
          option: row[2] || '전체',
          value: row[3] || '',
          updatedAt: row[4] || '',
          updatedBy: row[5] || ''
        };
      });

      // 관리자모드 사용자에 옵션 설정 추가
      const agentUsersWithOptions = agentUsers.map(user => {
        const adminKey = `${user.userId}_관리자모드`;
        const generalKey = `${user.userId}_일반모드`;

        return {
          ...user,
          type: 'agent',
          options: {
            관리자모드: optionsMap[adminKey] || { option: '전체', value: '', updatedAt: '', updatedBy: '' },
            일반모드: optionsMap[generalKey] || { option: '전체', value: '', updatedAt: '', updatedBy: '' }
          }
        };
      });

      // 일반모드 사용자에 옵션 설정 추가
      const generalUsersWithOptions = users.map(user => {
        const adminKey = `${user.userId}_관리자모드`;
        const generalKey = `${user.userId}_일반모드`;

        return {
          ...user,
          type: 'general',
          options: {
            관리자모드: optionsMap[adminKey] || { option: '전체', value: '', updatedAt: '', updatedBy: '' },
            일반모드: optionsMap[generalKey] || { option: '전체', value: '', updatedAt: '', updatedBy: '' }
          }
        };
      });

      console.log('🔍 [지도옵션] 사용자 목록 조회 결과:', {
        일반모드사용자수: generalUsersWithOptions.length,
        관리자모드사용자수: agentUsersWithOptions.length,
        옵션설정수: optionRows.length
      });

      return res.json({
        success: true,
        agentUsers: agentUsersWithOptions,  // 관리자모드 사용자
        generalUsers: generalUsersWithOptions  // 일반모드 사용자
      });
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error);
      return res.status(500).json({
        success: false,
        error: '사용자 목록 조회에 실패했습니다.',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createMapDisplayRoutes;
