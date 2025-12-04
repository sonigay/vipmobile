const express = require('express');
const { google } = require('googleapis');

// 직영점 모드 시트 이름
const SHEET_POLICY_MARGIN = '직영점_정책_마진';
const SHEET_POLICY_ADDON = '직영점_정책_부가서비스';
const SHEET_POLICY_SPECIAL = '직영점_정책_별도';
const SHEET_SETTINGS = '직영점_설정';

// 시트 헤더 정의
const HEADERS_POLICY_MARGIN = ['통신사', '마진'];
const HEADERS_POLICY_ADDON = ['통신사', '서비스명', '월요금', '유치추가금액', '미유치차감금액'];
const HEADERS_POLICY_SPECIAL = ['통신사', '정책명', '추가금액', '차감금액', '적용여부'];
const HEADERS_SETTINGS = ['통신사', '설정유형', '시트ID', '시트URL', '설정값JSON'];

function createSheetsClient() {
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  const SPREADSHEET_ID = process.env.SHEET_ID;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !SPREADSHEET_ID) {
    throw new Error('Missing Google Sheets environment variables');
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.includes('\\n') ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const sheets = google.sheets({ version: 'v4', auth });
  return { sheets, SPREADSHEET_ID };
}

// 시트 ID 조회 헬퍼 함수
async function getSheetId(sheets, spreadsheetId, sheetName) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
  return sheet ? sheet.properties.sheetId : null;
}

async function ensureSheetHeaders(sheets, spreadsheetId, sheetName, headers) {
  try {
    // 시트 존재 여부 확인 및 헤더 확인
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`
    });
    const firstRow = res.data.values && res.data.values[0] ? res.data.values[0] : [];
    const needsInit = firstRow.length === 0 || headers.some((h, i) => (firstRow[i] || '') !== h);
    if (needsInit) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [headers] }
      });
    }
    return headers;
  } catch (error) {
    // 시트가 없으면 생성
    if (error.code === 400) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [{
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }]
          }
        });
        // 헤더 작성
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [headers] }
        });
      } catch (createError) {
        console.error(`[Direct] Failed to create sheet ${sheetName}:`, createError);
        throw createError;
      }
    } else {
      throw error;
    }
    return headers;
  }
}

function setupDirectRoutes(app) {
  const router = express.Router();

  // === 정책 설정 ===

  // GET /api/direct/policy-settings?carrier=SK
  router.get('/policy-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 마진 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_MARGIN, HEADERS_POLICY_MARGIN);
      const marginRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_POLICY_MARGIN
      });
      const marginRows = (marginRes.data.values || []).slice(1);
      const marginRow = marginRows.find(row => (row[0] || '').trim() === carrier);
      const margin = marginRow ? Number(marginRow[1] || 0) : 50000; // 기본값 50000

      // 부가서비스 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_ADDON, HEADERS_POLICY_ADDON);
      const addonRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_POLICY_ADDON
      });
      const addonRows = (addonRes.data.values || []).slice(1);
      const addons = addonRows
        .filter(row => (row[0] || '').trim() === carrier)
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          fee: Number(row[2] || 0),
          incentive: Number(row[3] || 0),
          deduction: Number(row[4] || 0)
        }));

      // 별도 정책 설정 읽기
      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_SPECIAL, HEADERS_POLICY_SPECIAL);
      const specialRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_POLICY_SPECIAL
      });
      const specialRows = (specialRes.data.values || []).slice(1);
      const specialPolicies = specialRows
        .filter(row => (row[0] || '').trim() === carrier)
        .map((row, idx) => ({
          id: idx + 1,
          name: (row[1] || '').trim(),
          addition: Number(row[2] || 0),
          deduction: Number(row[3] || 0),
          isActive: (row[4] || '').toString().toLowerCase() === 'true' || (row[4] || '').toString() === '1'
        }));

      res.json({
        success: true,
        margin: { baseMargin: margin },
        addon: { list: addons },
        special: { list: specialPolicies }
      });
    } catch (error) {
      console.error('[Direct] policy-settings GET error:', error);
      res.status(500).json({ success: false, error: '정책 설정 조회 실패', message: error.message });
    }
  });

  // POST /api/direct/policy-settings?carrier=SK
  router.post('/policy-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const { margin, addon, special } = req.body || {};
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      // 마진 설정 저장
      if (margin && margin.baseMargin !== undefined) {
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_MARGIN, HEADERS_POLICY_MARGIN);
        const marginRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_MARGIN
        });
        const marginRows = (marginRes.data.values || []).slice(1);
        const marginRowIndex = marginRows.findIndex(row => (row[0] || '').trim() === carrier);

        if (marginRowIndex >= 0) {
          // 업데이트
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_POLICY_MARGIN}!A${marginRowIndex + 2}:B${marginRowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[carrier, margin.baseMargin]] }
          });
        } else {
          // 추가
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_MARGIN,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [[carrier, margin.baseMargin]] }
          });
        }
      }

      // 부가서비스 설정 저장
      if (addon && addon.list) {
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_ADDON, HEADERS_POLICY_ADDON);
        // 기존 데이터 읽기
        const addonRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_ADDON
        });
        const addonRows = (addonRes.data.values || []).slice(1);
        // 해당 통신사 데이터 삭제 (인덱스 역순으로 삭제)
        const deleteIndices = [];
        for (let i = addonRows.length - 1; i >= 0; i--) {
          if ((addonRows[i][0] || '').trim() === carrier) {
            deleteIndices.push(i + 2); // 1-based + header row
          }
        }
        if (deleteIndices.length > 0) {
          const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_ADDON);
          // 역순으로 정렬 (높은 인덱스부터 삭제)
          deleteIndices.sort((a, b) => b - a);
          const deleteRequests = deleteIndices.map(idx => ({
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: idx - 1,
                endIndex: idx
              }
            }
          }));
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests: deleteRequests }
          });
        }
        // 새 데이터 추가
        const newAddonRows = addon.list.map(item => [
          carrier,
          item.name || '',
          item.fee || 0,
          item.incentive || 0,
          item.deduction || 0
        ]);
        if (newAddonRows.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_ADDON,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: newAddonRows }
          });
        }
      }

      // 별도 정책 설정 저장
      if (special && special.list) {
        await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_POLICY_SPECIAL, HEADERS_POLICY_SPECIAL);
        // 기존 데이터 읽기
        const specialRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: SHEET_POLICY_SPECIAL
        });
        const specialRows = (specialRes.data.values || []).slice(1);
        // 해당 통신사 데이터 삭제
        const deleteIndices = [];
        for (let i = specialRows.length - 1; i >= 0; i--) {
          if ((specialRows[i][0] || '').trim() === carrier) {
            deleteIndices.push(i + 2);
          }
        }
        if (deleteIndices.length > 0) {
          const sheetId = await getSheetId(sheets, SPREADSHEET_ID, SHEET_POLICY_SPECIAL);
          // 역순으로 정렬 (높은 인덱스부터 삭제)
          deleteIndices.sort((a, b) => b - a);
          const deleteRequests = deleteIndices.map(idx => ({
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: idx - 1,
                endIndex: idx
              }
            }
          }));
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { requests: deleteRequests }
          });
        }
        // 새 데이터 추가
        const newSpecialRows = special.list.map(item => [
          carrier,
          item.name || '',
          item.addition || 0,
          item.deduction || 0,
          item.isActive ? 'TRUE' : 'FALSE'
        ]);
        if (newSpecialRows.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_POLICY_SPECIAL,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: newSpecialRows }
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] policy-settings POST error:', error);
      res.status(500).json({ success: false, error: '정책 설정 저장 실패', message: error.message });
    }
  });

  // === 링크 설정 ===

  // GET /api/direct/link-settings?carrier=SK
  router.get('/link-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);
      const settingsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
      const settingsRows = (settingsRes.data.values || []).slice(1);

      // 통신사별 설정 필터링
      const carrierSettings = settingsRows.filter(row => (row[0] || '').trim() === carrier);

      // 설정 유형별로 그룹화
      const planGroupRow = carrierSettings.find(row => (row[1] || '').trim() === 'planGroup');
      const supportRow = carrierSettings.find(row => (row[1] || '').trim() === 'support');
      const policyRow = carrierSettings.find(row => (row[1] || '').trim() === 'policy');

      let planGroup = { link: '', planGroups: [] };
      let support = { link: '' };
      let policy = { link: '' };

      if (planGroupRow) {
        const settingsJson = planGroupRow[4] ? JSON.parse(planGroupRow[4]) : {};
        planGroup = {
          link: planGroupRow[2] || '', // 시트ID
          sheetId: planGroupRow[2] || '',
          planNameRange: settingsJson.planNameRange || '',
          planGroupRange: settingsJson.planGroupRange || '',
          basicFeeRange: settingsJson.basicFeeRange || '',
          planGroups: settingsJson.planGroups || []
        };
      }

      if (supportRow) {
        const settingsJson = supportRow[4] ? JSON.parse(supportRow[4]) : {};
        support = {
          link: supportRow[2] || '',
          sheetId: supportRow[2] || '',
          modelRange: settingsJson.modelRange || '',
          petNameRange: settingsJson.petNameRange || '',
          factoryPriceRange: settingsJson.factoryPriceRange || '',
          openingTypeRange: settingsJson.openingTypeRange || '',
          planGroupRanges: settingsJson.planGroupRanges || {}
        };
      }

      if (policyRow) {
        const settingsJson = policyRow[4] ? JSON.parse(policyRow[4]) : {};
        policy = {
          link: policyRow[2] || '',
          sheetId: policyRow[2] || '',
          modelRange: settingsJson.modelRange || '',
          petNameRange: settingsJson.petNameRange || '',
          planGroupRanges: settingsJson.planGroupRanges || {}
        };
      }

      res.json({
        success: true,
        planGroup,
        support,
        policy
      });
    } catch (error) {
      console.error('[Direct] link-settings GET error:', error);
      res.status(500).json({ success: false, error: '링크 설정 조회 실패', message: error.message });
    }
  });

  // GET /api/direct/link-settings/fetch-range?sheetId=xxx&range=전체!F5:F500&unique=true
  // 시트에서 범위를 읽어서 데이터 반환 (유니크 옵션 지원)
  // 주의: unique=true는 요금제군 같은 카테고리 데이터에만 사용하고,
  //       금액 범위(기본료, 출고가, 지원금 등)는 unique=false로 모든 값을 가져와야 합니다.
  router.get('/link-settings/fetch-range', async (req, res) => {
    try {
      const { sheetId, range, unique } = req.query;
      if (!sheetId || !range) {
        return res.status(400).json({ success: false, error: 'sheetId와 range가 필요합니다.' });
      }

      const { sheets } = createSheetsClient();
      
      // 시트에서 범위 읽기
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range
      });

      const values = response.data.values || [];
      
      if (unique === 'true') {
        // 유니크한 값 추출 (빈 값 제외, 공백 제거)
        const uniqueValues = [...new Set(
          values
            .flat()
            .map(v => (v || '').toString().trim())
            .filter(v => v.length > 0)
        )].sort();
        
        res.json({
          success: true,
          data: uniqueValues,
          isUnique: true
        });
      } else {
        // 원본 데이터 그대로 반환
        res.json({
          success: true,
          data: values,
          isUnique: false
        });
      }
    } catch (error) {
      console.error('[Direct] fetch-range GET error:', error);
      res.status(500).json({ success: false, error: '범위 데이터 조회 실패', message: error.message });
    }
  });

  // GET /api/direct/link-settings/plan-groups?carrier=SK&sheetId=xxx&range=전체!F5:F500
  // 시트에서 요금제군 범위를 읽어서 유니크한 값들만 반환 (하위 호환성)
  router.get('/link-settings/plan-groups', async (req, res) => {
    try {
      const { sheetId, range } = req.query;
      if (!sheetId || !range) {
        return res.status(400).json({ success: false, error: 'sheetId와 range가 필요합니다.' });
      }

      const { sheets } = createSheetsClient();
      
      // 시트에서 범위 읽기
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: range
      });

      const values = response.data.values || [];
      // 유니크한 값 추출 (빈 값 제외, 공백 제거)
      const uniqueGroups = [...new Set(
        values
          .flat()
          .map(v => (v || '').toString().trim())
          .filter(v => v.length > 0)
      )].sort();

      res.json({
        success: true,
        planGroups: uniqueGroups
      });
    } catch (error) {
      console.error('[Direct] plan-groups GET error:', error);
      res.status(500).json({ success: false, error: '요금제군 조회 실패', message: error.message });
    }
  });

  // POST /api/direct/link-settings?carrier=SK
  router.post('/link-settings', async (req, res) => {
    try {
      const carrier = req.query.carrier || 'SK';
      const { planGroup, support, policy } = req.body || {};
      const { sheets, SPREADSHEET_ID } = createSheetsClient();

      await ensureSheetHeaders(sheets, SPREADSHEET_ID, SHEET_SETTINGS, HEADERS_SETTINGS);

      // planGroup 저장 시, planGroupRange가 있고 planGroups가 비어있으면 자동으로 추출
      if (planGroup && planGroup.planGroupRange && (!planGroup.planGroups || planGroup.planGroups.length === 0)) {
        try {
          const sheetId = planGroup.sheetId || planGroup.link;
          if (sheetId) {
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: planGroup.planGroupRange
            });
            const values = response.data.values || [];
            const uniqueGroups = [...new Set(
              values
                .flat()
                .map(v => (v || '').toString().trim())
                .filter(v => v.length > 0)
            )].sort();
            planGroup.planGroups = uniqueGroups;
          }
        } catch (autoExtractError) {
          console.warn('[Direct] planGroups 자동 추출 실패:', autoExtractError);
          // 자동 추출 실패해도 계속 진행
        }
      }

      // 기존 설정 읽기
      const settingsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEET_SETTINGS
      });
      const settingsRows = (settingsRes.data.values || []).slice(1);

      // 통신사별 설정 필터링 및 업데이트/추가
      const rowsToUpdate = [];

      if (planGroup) {
        const existingRowIndex = settingsRows.findIndex(
          row => (row[0] || '').trim() === carrier && (row[1] || '').trim() === 'planGroup'
        );
        const settingsJson = JSON.stringify({
          planNameRange: planGroup.planNameRange || '',
          planGroupRange: planGroup.planGroupRange || '',
          basicFeeRange: planGroup.basicFeeRange || '',
          planGroups: planGroup.planGroups || []
        });
        if (existingRowIndex >= 0) {
          // 업데이트
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_SETTINGS}!A${existingRowIndex + 2}:E${existingRowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [[carrier, 'planGroup', planGroup.sheetId || planGroup.link || '', '', settingsJson]]
            }
          });
        } else {
          // 추가
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[carrier, 'planGroup', planGroup.sheetId || planGroup.link || '', '', settingsJson]]
            }
          });
        }
      }

      if (support) {
        const existingRowIndex = settingsRows.findIndex(
          row => (row[0] || '').trim() === carrier && (row[1] || '').trim() === 'support'
        );
        const settingsJson = JSON.stringify({
          modelRange: support.modelRange || '',
          petNameRange: support.petNameRange || '',
          factoryPriceRange: support.factoryPriceRange || '',
          openingTypeRange: support.openingTypeRange || '',
          planGroupRanges: support.planGroupRanges || {}
        });
        if (existingRowIndex >= 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_SETTINGS}!A${existingRowIndex + 2}:E${existingRowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [[carrier, 'support', support.sheetId || support.link || '', '', settingsJson]]
            }
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[carrier, 'support', support.sheetId || support.link || '', '', settingsJson]]
            }
          });
        }
      }

      if (policy) {
        const existingRowIndex = settingsRows.findIndex(
          row => (row[0] || '').trim() === carrier && (row[1] || '').trim() === 'policy'
        );
        const settingsJson = JSON.stringify({
          modelRange: policy.modelRange || '',
          petNameRange: policy.petNameRange || '',
          planGroupRanges: policy.planGroupRanges || {}
        });
        if (existingRowIndex >= 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_SETTINGS}!A${existingRowIndex + 2}:E${existingRowIndex + 2}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [[carrier, 'policy', policy.sheetId || policy.link || '', '', settingsJson]]
            }
          });
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_SETTINGS,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: [[carrier, 'policy', policy.sheetId || policy.link || '', '', settingsJson]]
            }
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[Direct] link-settings POST error:', error);
      res.status(500).json({ success: false, error: '링크 설정 저장 실패', message: error.message });
    }
  });

  app.use('/api/direct', router);
}

module.exports = setupDirectRoutes;

