const express = require('express');
const router = express.Router();
const dalFactory = require('../dal/DALFactory');

/**
 * GET /api/db/flags
 * 현재 모든 Feature Flags 및 DAL 상태 조회
 */
router.get('/flags', (req, res) => {
    try {
        const flags = dalFactory.getFeatureFlags().getAllFlags();
        const status = dalFactory.getStatus();

        res.json({
            success: true,
            data: {
                flags,
                status: {
                    database: status.database,
                    googleSheets: status.googleSheets
                }
            }
        });
    } catch (error) {
        console.error('[DB Management] Failed to fetch flags:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/db/tables/status
 * Supabase 내 실제 테이블 존재 여부 확인
 */
router.get('/tables/status', async (req, res) => {
    try {
        const dbImpl = dalFactory.getDatabaseImpl();
        if (!dbImpl) {
            return res.json({ success: true, data: {} });
        }

        const { DATA_MAP_CONFIG } = require('../../src/config/dataMapConfig');
        const statusMap = {};

        // 모든 모드의 탭 정보 수집
        const allTables = [];
        Object.values(DATA_MAP_CONFIG).forEach(mode => {
            Object.values(mode.tabs).forEach(tab => {
                if (tab.supabaseTable) allTables.push(tab.supabaseTable);
            });
        });

        // 유니크한 테이블 목록에 대해 존재 여부 확인
        const uniqueTables = [...new Set(allTables)];
        await Promise.all(uniqueTables.map(async (tableName) => {
            statusMap[tableName] = await dbImpl.checkTableExists(tableName);
        }));

        res.json({
            success: true,
            data: statusMap
        });
    } catch (error) {
        console.error('[DB Management] Failed to fetch table status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/db/flags
 * 특정 플래그 설정 토글
 */
router.post('/flags', (req, res) => {
    try {
        const { key, enabled } = req.body;

        if (!key) {
            return res.status(400).json({ success: false, error: 'Key is required' });
        }

        dalFactory.getFeatureFlags().setFlag(key, enabled);

        res.json({
            success: true,
            message: `Flag "${key}" updated to ${enabled}`,
            data: dalFactory.getFeatureFlags().getAllFlags()
        });
    } catch (error) {
        console.error('[DB Management] Failed to update flag:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/db/reload
 * 환경 변수 및 설정 파일에서 플래그 다시 로드
 */
router.post('/reload', (req, res) => {
    try {
        dalFactory.getFeatureFlags().reload();
        res.json({
            success: true,
            message: 'Flags reloaded successfully',
            data: dalFactory.getFeatureFlags().getAllFlags()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/db/sync/smart
 * 지능형 마이그레이션 실행 (변경된 시트만 처리)
 */
router.post('/sync/smart', async (req, res) => {
    try {
        const { DATA_MAP_CONFIG } = require('../../src/config/dataMapConfig'); // 클라이언트 설정 재사용 (서버에서도 활용 가능하도록 구성됨)
        const results = [];
        let totalUpdated = 0;

        for (const [modeKey, modeData] of Object.entries(DATA_MAP_CONFIG)) {
            for (const [tabKey, tabData] of Object.entries(modeData.tabs)) {
                try {
                    const dal = dalFactory.getDAL(modeKey);
                    const gsImpl = dalFactory.getGoogleSheetsImpl();
                    const dbImpl = dalFactory.getDatabaseImpl();

                    if (!gsImpl || !dbImpl) continue;

                    // 1. 양쪽 데이터 가져오기 (비교용)
                    const gsData = await gsImpl.read(tabData.sheet);
                    const dbData = await dbImpl.read(tabData.supabaseTable);

                    // 2. 간단한 내용 비교 (JSON 문자열화 비교)
                    const gsHash = JSON.stringify(gsData);
                    const dbHash = JSON.stringify(dbData);

                    if (gsHash !== dbHash) {
                        // 3. 변경사항이 있으면 업데이트 (기존 데이터 삭제 후 재삽입 - 단순화된 방식)
                        await dbImpl.deleteAll(tabData.supabaseTable);
                        if (gsData.length > 0) {
                            await dbImpl.batchCreate(tabData.supabaseTable, gsData);
                        }

                        results.push({
                            tab: tabData.label,
                            sheet: tabData.sheet,
                            status: 'updated',
                            count: gsData.length
                        });
                        totalUpdated++;
                    } else {
                        results.push({
                            tab: tabData.label,
                            sheet: tabData.sheet,
                            status: 'skipped'
                        });
                    }
                } catch (tabErr) {
                    console.error(`[Smart Sync] Failed for ${tabData.sheet}:`, tabErr);
                    results.push({
                        tab: tabData.label,
                        sheet: tabData.sheet,
                        status: 'error',
                        error: tabErr.message
                    });
                }
            }
        }

        res.json({
            success: true,
            summary: {
                totalUpdated,
                details: results
            }
        });
    } catch (error) {
        console.error('[DB Management] Sync failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
