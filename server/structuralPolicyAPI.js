const express = require('express');
const { google } = require('googleapis');

// 시트 이름 설정
const MANUAL_DATA_SHEET_NAME = '수기초';
const STORE_SHEET_NAME = '폰클출고처데이터';
const STRUCTURAL_POLICY_SETTINGS_SHEET_NAME = '구조정책셋팅메뉴'; // 전용 시트 사용

const createStructuralPolicyRoutes = (context) => {
    const router = express.Router();
    const { sheetsClient, cacheManager } = context;
    const { sheets, SPREADSHEET_ID } = sheetsClient;

    // 공통 시트 데이터 가져오기 (MonthlyAwardAPI와 유사)
    const getSheetValues = async (sheetName) => {
        const cacheKey = `sheet_${sheetName}`;
        const cachedData = cacheManager.get(cacheKey);
        if (cachedData) return cachedData;

        // 적절한 범위 설정 (너무 넓으면 grid limit 에러 발생 가능)
        // 수기초 데이터는 컬럼이 많을 수 있으므로 유동적으로 처리
        let targetRange = `${sheetName}!A1:AZ10000`; // 52개 컬럼
        if (sheetName === MANUAL_DATA_SHEET_NAME) targetRange = `${sheetName}!A1:DB10000`; // Extended for CV column (Index 99)

        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: targetRange,
            });
            const data = response.data.values;
            cacheManager.set(cacheKey, data, 60 * 5); // 5분 캐시
            return data;
        } catch (error) {
            if (error.message.includes('exceeds grid limits')) {
                console.log(`⚠️ [StructuralPolicy] Sheet '${sheetName}' too small, expanding...`);
                try {
                    const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
                    const targetSheet = sheetInfo.data.sheets.find(s => s.properties.title === sheetName);
                    if (targetSheet) {
                        await sheets.spreadsheets.batchUpdate({
                            spreadsheetId: SPREADSHEET_ID,
                            resource: {
                                requests: [{
                                    appendDimension: {
                                        sheetId: targetSheet.properties.sheetId,
                                        dimension: 'COLUMNS',
                                        length: 10
                                    }
                                }]
                            }
                        });
                        // 확장 후 재시도
                        const retryRes = await sheets.spreadsheets.values.get({
                            spreadsheetId: SPREADSHEET_ID,
                            range: targetRange,
                        });
                        const data = retryRes.data.values;
                        cacheManager.set(cacheKey, data, 60 * 5);
                        return data;
                    }
                } catch (expandErr) {
                    console.error(`[StructuralPolicy] Expansion failed for ${sheetName}:`, expandErr.message);
                }
            }
            console.error(`[StructuralPolicy] Error fetching sheet ${sheetName}:`, error.message);
            return null;
        }
    };

    // 설정 시트 존재 여부 확인 및 자동 생성
    const ensureSettingsSheet = async () => {
        try {
            const response = await sheets.spreadsheets.get({
                spreadsheetId: SPREADSHEET_ID
            });
            const sheetsList = response.data.sheets || [];
            const exists = sheetsList.some(s => s.properties.title === STRUCTURAL_POLICY_SETTINGS_SHEET_NAME);

            if (!exists) {
                console.log(`[StructuralPolicy] Creating ${STRUCTURAL_POLICY_SETTINGS_SHEET_NAME} sheet...`);
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: { title: STRUCTURAL_POLICY_SETTINGS_SHEET_NAME }
                            }
                        }]
                    }
                });

                // 초기 헤더 및 기본 데이터 작성
                const initialValues = [
                    ['지표명', '점수', '기준비중(%)', '비고'],
                    ['MNP 비중', 5, 40, '이상'],
                    ['MNP 비중', 4, 35, '이상'],
                    ['MNP 비중', 3, 30, '이상'],
                    ['MNP 비중', 2, 25, '이상'],
                    ['MNP 비중', 1, 20, '이상'],
                    ['고가치 비중', 5, 80, '이상'],
                    ['고가치 비중', 4, 75, '이상'],
                    ['고가치 비중', 3, 70, '이상'],
                    ['고가치 비중', 2, 65, '이상'],
                    ['고가치 비중', 1, 60, '이상']
                ];

                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${STRUCTURAL_POLICY_SETTINGS_SHEET_NAME}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: initialValues }
                });
                console.log(`[StructuralPolicy] ${STRUCTURAL_POLICY_SETTINGS_SHEET_NAME} created with initial data.`);
            }
        } catch (error) {
            console.error('[StructuralPolicy] Error ensuring settings sheet:', error.message);
        }
    };

    router.get('/structural-policy/data', async (req, res) => {
        try {
            await ensureSettingsSheet(); // 데이터 로드 전 시트 확인

            const [manualData, storeData, settingsData, officeData] = await Promise.all([
                getSheetValues(MANUAL_DATA_SHEET_NAME),
                getSheetValues(STORE_SHEET_NAME),
                getSheetValues(STRUCTURAL_POLICY_SETTINGS_SHEET_NAME),
                getSheetValues('대리점아이디관리')
            ]);

            if (!manualData || !storeData) {
                return res.status(500).json({ error: '필요한 시트 데이터를 불러올 수 없습니다.' });
            }

            // 담당자-사무실 매핑 (MonthlyAward 로직 재사용)
            const managerOfficeMapping = new Map();
            const manualRows = manualData.slice(1);
            const manualHeaders = manualData[0] || [];

            // 다이나믹 헤더 인덱스 찾기
            const getIdx = (name) => manualHeaders.findIndex(h => h && h.toString().trim() === name);

            const idx = {
                manager: getIdx('담당자'),
                office: getIdx('사무실'),
                department: getIdx('소속'), // User confirmed '부서' is '소속' (Col H, Index 7)
                joinType: getIdx('가입구분'),
                prevCarrier: getIdx('이전사업자'),
                modelType: getIdx('모델유형') !== -1 ? getIdx('모델유형') : 98, // Fallback to index 98 (Col CU)
                policy: getIdx('최종영업정책'),
                planGroup: getIdx('요금제유형명') !== -1 ? getIdx('요금제유형명') : 99, // Fallback to index 99 (Col CV)
                model: getIdx('개통모델'),
                posCode: getIdx('코드별')
            };
            console.log('[StructuralPolicy] IDX Mapping (Updated):', idx);

            manualRows.forEach(row => {
                const mgr = (row[idx.manager] || '').toString().trim();
                const off = (row[idx.office] || '').toString().trim();
                const dept = (row[idx.department] || '').toString().trim();
                if (mgr) {
                    managerOfficeMapping.set(mgr, { office: off || '미분류', department: dept || '미분류' });
                }
            });

            // Matrix 기준값 로드
            const matrixCriteria = [];
            console.log(`[StructuralPolicy] Parsing settingsData. Rows: ${settingsData ? settingsData.length : 0}`);
            if (settingsData && settingsData.length > 1) {
                settingsData.slice(1).forEach((row, i) => {
                    console.log(`[StructuralPolicy] Row ${i + 1}:`, row);
                    if (row.length >= 3) {
                        const name = (row[0] || '').toString().trim();
                        const score = parseInt(row[1]);
                        const percentage = parseFloat(row[2]);
                        const type = name.includes('MNP') ? 'mnp' : name.includes('고가치') ? 'highValue' : '';
                        if (type && !isNaN(score) && !isNaN(percentage)) {
                            matrixCriteria.push({
                                score,
                                percentage,
                                indicator: type,
                                description: row[3] || ''
                            });
                        }
                    }
                });
            }
            console.log(`[StructuralPolicy] Final matrixCriteria count: ${matrixCriteria.length}`);

            // 기본값 (매트릭스 비어있을 경우 대비)
            const finalMatrix = matrixCriteria.length > 0 ? matrixCriteria : [
                { score: 5, percentage: 40, indicator: 'mnp' },
                { score: 5, percentage: 80, indicator: 'highValue' }
            ];

            // MNP 비중 계산 로직
            const calculateMNP = (manager) => {
                let numerator = 0;
                let denominator = 0;

                manualRows.forEach(row => {
                    const curMgr = (row[idx.manager] || '').toString().trim();
                    if (manager !== 'TOTAL' && curMgr !== manager) return;

                    const join = (row[idx.joinType] || '').toString().trim();
                    const policy = (row[idx.policy] || '').toString().trim();
                    const modelT = (row[idx.modelType] || '').toString().trim();
                    const prevC = (row[idx.prevCarrier] || '').toString().trim();

                    // 모수/자수 공통 제외
                    if (policy === 'BLANK' || modelT === 'LTE_2nd모델' || modelT === '5G_2nd모델') return;

                    // 모수: 신규 + 재가입
                    if (join === '신규' || join === '재가입') {
                        denominator++;
                        // 자수: 신규 중 일반개통 아닌 것 (MNP)
                        if (join === '신규' && prevC !== '일반개통') {
                            numerator++;
                        }
                    }
                });

                const percentage = denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0;
                return { numerator, denominator, percentage };
            };

            // 고가치 비중 계산 로직
            const calculateHighValue = (manager) => {
                let numerator = 0;
                let denominator = 0;

                const lowCostModels = ['LM-Y110L', 'LM-Y120L', 'SM-G160N', 'AT-M120', 'AT-M120B', 'AT-M140L'];
                const excludedPlanKeywords = ["키즈", "청소년", "시니어", "태블릿", "스마트기기", "Wearable", "현역병사"];
                let debugCount = 0;

                manualRows.forEach(row => {
                    if (debugCount < 5) {
                        console.log(`[Row DEBUG] Length: ${row.length}, Index 99 (PlanGroup): '${row[99]}', Index 98 (ModelType): '${row[98]}'`);
                    }
                    const curMgr = (row[idx.manager] || '').toString().trim();
                    if (manager !== 'TOTAL' && curMgr !== manager) return;

                    const join = (row[idx.joinType] || '').toString().trim();
                    const policy = (row[idx.policy] || '').toString().trim();
                    const modelT = (row[idx.modelType] || '').toString().trim();
                    const modelNam = (row[idx.model] || '').toString().trim();
                    const planGrp = (row[idx.planGroup] || '').toString().trim();

                    // 공통 제외
                    if (policy === 'BLANK' || modelT === 'LTE_2nd모델' || modelT === '5G_2nd모델') return;
                    if (lowCostModels.includes(modelNam)) return;

                    let isExcluded = false;
                    if (excludedPlanKeywords.some(k => planGrp.includes(k))) {
                        // 단, "신규"의 경우 "청소년 Ⅲ군"은 포함되어야 하므로 예외 처리 필요
                        if (!(join === '신규' && planGrp === '청소년 Ⅲ군')) {
                            isExcluded = true;
                            return;
                        }
                    }

                    if (join === '신규' || join === '재가입') {
                        denominator++;

                        // 자수 (Numerator) 로직 - More robust string matching
                        const pg = planGrp.toLowerCase();
                        let isHighValue = false;
                        if (join === '신규') {
                            if (pg.includes('75군') || pg.includes('85군') || pg.includes('95군') || pg.includes('105군') || pg.includes('115군') || pg.includes('청소년 ⅲ군')) {
                                numerator++;
                                isHighValue = true;
                            }
                        } else if (join === '재가입') {
                            if (pg.includes('95군') || pg.includes('105군') || pg.includes('115군')) {
                                numerator++;
                                isHighValue = true;
                            }
                        }

                        if (debugCount < 50 && manager === 'TOTAL') {
                            console.log(`[HV DEBUG] Join:${join}, Plan:${planGrp}, Excluded:${isExcluded}, HighValue:${isHighValue}`);
                            debugCount++;
                        }
                    }
                });

                const percentage = denominator > 0 ? (numerator / denominator * 100).toFixed(2) : 0;
                return { numerator, denominator, percentage };
            };

            // 점수 계산 유틸
            const calculateScore = (percentage, criteria) => {
                const sorted = [...criteria].sort((a, b) => b.percentage - a.percentage);
                for (let c of sorted) {
                    if (percentage >= c.percentage) return c.score;
                }
                return 0;
            };

            // 코드별 계산을 위한 헬퍼 함수
            const calculateByCode = (code) => {
                let mnpNum = 0, mnpDen = 0;
                let hvNum = 0, hvDen = 0;

                const lowCostModels = ['LM-Y110L', 'LM-Y120L', 'SM-G160N', 'AT-M120', 'AT-M120B', 'AT-M140L'];
                const excludedPlanKeywords = ["키즈", "청소년", "시니어", "태블릿", "스마트기기", "Wearable", "현역병사"];

                manualRows.forEach(row => {
                    const curCode = (row[idx.posCode] || '').toString().trim();
                    if (curCode !== code) return;

                    const join = (row[idx.joinType] || '').toString().trim();
                    const policy = (row[idx.policy] || '').toString().trim();
                    const modelT = (row[idx.modelType] || '').toString().trim();
                    const prevC = (row[idx.prevCarrier] || '').toString().trim();
                    const modelNam = (row[idx.model] || '').toString().trim();
                    const planGrp = (row[idx.planGroup] || '').toString().trim();

                    // --- MNP 계산 ---
                    if (!(policy === 'BLANK' || modelT === 'LTE_2nd모델' || modelT === '5G_2nd모델')) {
                        if (join === '신규' || join === '재가입') {
                            mnpDen++;
                            if (join === '신규' && prevC !== '일반개통') mnpNum++;
                        }
                    }

                    // --- 고가치 계산 ---
                    let skipHV = false;
                    if (policy === 'BLANK' || modelT === 'LTE_2nd모델' || modelT === '5G_2nd모델') skipHV = true;
                    if (lowCostModels.includes(modelNam)) skipHV = true;
                    if (excludedPlanKeywords.some(k => planGrp.includes(k))) {
                        if (!(join === '신규' && planGrp === '청소년 Ⅲ군')) skipHV = true;
                    }

                    if (!skipHV) {
                        if (join === '신규' || join === '재가입') {
                            hvDen++;
                            const pg = planGrp.toLowerCase();
                            if (join === '신규') {
                                if (pg.includes('75군') || pg.includes('85군') || pg.includes('95군') || pg.includes('105군') || pg.includes('115군') || pg.includes('청소년 ⅲ군')) hvNum++;
                            } else if (join === '재가입') {
                                if (pg.includes('95군') || pg.includes('105군') || pg.includes('115군')) hvNum++;
                            }
                        }
                    }
                });

                return {
                    mnp: { numerator: mnpNum, denominator: mnpDen, percentage: mnpDen > 0 ? (mnpNum / mnpDen * 100).toFixed(2) : 0 },
                    highValue: { numerator: hvNum, denominator: hvDen, percentage: hvDen > 0 ? (hvNum / hvDen * 100).toFixed(2) : 0 }
                };
            };

            const agentMap = new Map();
            const codeMap = new Map();

            manualRows.forEach(row => {
                const mgr = (row[idx.manager] || '').toString().trim();
                const code = (row[idx.posCode] || '').toString().trim();

                if (mgr && !agentMap.has(mgr)) {
                    const info = managerOfficeMapping.get(mgr) || { office: '미분류', department: '미분류' };
                    const mnp = calculateMNP(mgr);
                    const hv = calculateHighValue(mgr);

                    const mnpScore = calculateScore(parseFloat(mnp.percentage), finalMatrix.filter(c => c.indicator === 'mnp'));
                    const hvScore = calculateScore(parseFloat(hv.percentage), finalMatrix.filter(c => c.indicator === 'highValue'));
                    const totalScore = mnpScore + hvScore;

                    agentMap.set(mgr, {
                        manager: mgr,
                        ...info,
                        mnp, mnpScore,
                        highValue: hv, hvScore,
                        totalScore
                    });
                }

                if (code && !codeMap.has(code)) {
                    const stats = calculateByCode(code);
                    codeMap.set(code, {
                        code,
                        mnp: stats.mnp,
                        highValue: stats.highValue
                    });
                }
            });

            const totalData = calculateMNP('TOTAL');
            const totalHV = calculateHighValue('TOTAL');
            const companySummary = {
                mnp: totalData,
                highValue: totalHV,
                totalScore: (calculateScore(parseFloat(totalData.percentage), finalMatrix.filter(c => c.indicator === 'mnp')) +
                    calculateScore(parseFloat(totalHV.percentage), finalMatrix.filter(c => c.indicator === 'highValue')))
            };

            const sortedAgents = Array.from(agentMap.values()).sort((a, b) => b.totalScore - a.totalScore);

            res.json({
                companySummary,
                matrixCriteria: finalMatrix,
                agents: sortedAgents,
                codes: Array.from(codeMap.values()),
                lastUpdate: new Date().toISOString()
            });

        } catch (error) {
            console.error('[StructuralPolicy] API Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // 설정 저장 API
    router.post('/structural-policy/settings', async (req, res) => {
        try {
            const { criteria } = req.body;
            if (!criteria || !Array.isArray(criteria)) {
                return res.status(400).json({ error: '잘못된 요청 데이터입니다.' });
            }

            const values = [['지표명', '점수', '기준비중(%)', '비고']];
            criteria.forEach(c => {
                const name = c.indicator === 'mnp' ? 'MNP 비중' : '고가치 비중';
                values.push([name, c.score, c.percentage, c.description || '']);
            });

            // 시트 데이터 업데이트
            try {
                await sheets.spreadsheets.values.clear({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${STRUCTURAL_POLICY_SETTINGS_SHEET_NAME}!A:D`
                });
            } catch (clearError) {
                console.error('[StructuralPolicy] Error clearing settings sheet:', clearError.message);
                // 시트가 방금 생성되었거나 비어있으면 clear가 실패할 수 있음. 무시하고 진행 가능할 수도 있음.
            }

            try {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${STRUCTURAL_POLICY_SETTINGS_SHEET_NAME}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
            } catch (updateError) {
                console.error('[StructuralPolicy] Error updating settings values:', updateError.message);
                throw updateError;
            }

            cacheManager.delete(`sheet_${STRUCTURAL_POLICY_SETTINGS_SHEET_NAME}`);
            res.json({ success: true, message: '설정이 저장되었습니다.' });
        } catch (error) {
            console.error('[StructuralPolicy] Settings Save Error:', error);
            res.status(500).json({ error: error.message || '설정 저장 중 서버 오류가 발생했습니다.' });
        }
    });

    return router;
};

module.exports = createStructuralPolicyRoutes;
