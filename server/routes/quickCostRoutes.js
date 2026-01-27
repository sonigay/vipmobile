/**
 * Quick Cost Routes
 * 
 * 퀵비용 관리 라우트 (하이브리드 DAL 지원)
 * - Feature Flag에 따라 Supabase 또는 Google Sheets 사용
 * - 레거시 계산 로직 및 정규화 로직 포함
 */

const express = require('express');
const router = express.Router();
const dalFactory = require('../dal/DALFactory');
const { supabase } = require('../supabaseClient');

function createQuickCostRoutes(context) {
    const { sheetsClient, cacheManager, rateLimiter } = context;

    // DAL 및 Feature Flag
    const featureFlags = dalFactory.getFeatureFlags();
    // FORCE FALSE FOR DEBUGGING
    const useSupabase = () => {
        const enabled = featureFlags.isEnabled('quick-service');
        console.log(`🔍 [Debug] Feature Flag 'quick-service': ${enabled}, Force using Sheets.`);
        return false;
    };

    // ===== 상수 =====
    const QUICK_COST_SHEET_NAME = '퀵비용관리';
    const QUICK_COST_MAX_COMPANIES = 5;

    // ===== 헬퍼 함수 =====
    const normalizeCompanyName = (name) => {
        if (!name) return '';
        return name.replace(/\s+/g, '').toLowerCase().trim();
    };

    const normalizePhoneNumber = (phone) => {
        if (!phone) return '';
        return phone.replace(/[-\s]/g, '').replace(/\D/g, '');
    };

    const formatDateTimeForSheet = (date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    };

    const parseSheetDate = (value) => {
        if (value === null || value === undefined) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
        if (typeof value === 'number' && !Number.isNaN(value)) {
            const excelEpoch = Date.UTC(1899, 11, 30);
            return new Date(excelEpoch + Math.round(value * 24 * 60 * 60 * 1000));
        }
        const stringValue = value.toString().trim();
        if (!stringValue) return null;
        const normalized = stringValue.replace(/년|\.|\//g, '-').replace(/일/g, '').replace(/월/g, '-').trim();
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const createRegisteredAtResolver = () => {
        let lastKnownDate = null;
        return (rawValue) => {
            const parsed = parseSheetDate(rawValue);
            if (parsed) {
                lastKnownDate = parsed;
                return { date: parsed, label: formatDateTimeForSheet(parsed) };
            }
            const fallbackDate = lastKnownDate || new Date();
            return { date: fallbackDate, label: formatDateTimeForSheet(fallbackDate) };
        };
    };

    const invalidateQuickCostCache = (fromStoreId, toStoreId) => {
        if (fromStoreId && toStoreId) {
            cacheManager.delete(`quick-cost-estimate-${fromStoreId}-${toStoreId}`);
            cacheManager.delete(`quick-cost-estimate-${toStoreId}-${fromStoreId}`);
        }
        cacheManager.delete('quick-cost-companies');
        cacheManager.deletePattern('quick-cost-statistics-');
    };

    const normalizeQuickCostCompanies = (companies = []) => {
        return companies.map((c, i) => {
            const name = (c?.name || '').toString().trim();
            const phone = (c?.phone || '').toString().trim();
            const cost = parseInt(c?.cost?.toString().replace(/,/g, '') || '0', 10);
            if (!name || !phone || isNaN(cost)) throw new Error(`업체${i + 1} 정보가 불완전합니다.`);
            return {
                originalName: name,
                normalizedName: normalizeCompanyName(name),
                originalPhone: phone,
                normalizedPhone: normalizePhoneNumber(phone),
                cost,
                dispatchSpeed: c?.dispatchSpeed || '중간',
                pickupSpeed: c?.pickupSpeed || '중간',
                arrivalSpeed: c?.arrivalSpeed || '중간'
            };
        });
    };

    // ===== Supabase 헬퍼 함수 =====
    const saveToSupabase = async (data, companies) => {
        // 1. 견적 기록 저장
        const { data: entry, error: entryError } = await supabase
            .from('quick_cost_entries')
            .insert({
                registrant_store_name: data.registrantStoreName,
                registrant_store_id: data.registrantStoreId,
                from_store_name: data.fromStoreName,
                from_store_id: data.fromStoreId,
                to_store_name: data.toStoreName,
                to_store_id: data.toStoreId,
                mode_type: data.modeType || '관리자모드'
            })
            .select()
            .single();

        if (entryError) throw new Error(`Supabase 저장 실패: ${entryError.message}`);

        // 2. 업체 정보 저장
        const companyRows = companies.map((c, idx) => ({
            entry_id: entry.id,
            company_order: idx + 1,
            company_name: c.originalName,
            normalized_name: c.normalizedName,
            phone: c.originalPhone,
            normalized_phone: c.normalizedPhone,
            cost: c.cost,
            dispatch_speed: c.dispatchSpeed,
            pickup_speed: c.pickupSpeed,
            arrival_speed: c.arrivalSpeed
        }));

        const { error: companiesError } = await supabase
            .from('quick_cost_companies')
            .insert(companyRows);

        if (companiesError) throw new Error(`업체 정보 저장 실패: ${companiesError.message}`);

        return entry;
    };

    const fetchHistoryFromSupabase = async (filters) => {
        let query = supabase
            .from('quick_cost_entries')
            .select(`
                id,
                registered_at,
                registrant_store_name,
                registrant_store_id,
                from_store_name,
                from_store_id,
                to_store_name,
                to_store_id,
                quick_cost_companies (
                    company_order,
                    company_name,
                    phone,
                    cost,
                    dispatch_speed,
                    pickup_speed,
                    arrival_speed
                )
            `)
            .order('registered_at', { ascending: false });

        if (filters.userId) query = query.eq('registrant_store_id', filters.userId);
        if (filters.fromStoreId) query = query.eq('from_store_id', filters.fromStoreId);
        if (filters.toStoreId) query = query.eq('to_store_id', filters.toStoreId);
        if (filters.limit) query = query.limit(parseInt(filters.limit));

        const { data, error } = await query;
        if (error) throw new Error(`Supabase 조회 실패: ${error.message}`);

        return data.map((entry, idx) => ({
            rowIndex: idx + 1,
            id: entry.id,
            registeredAt: entry.registered_at,
            registrantStoreName: entry.registrant_store_name,
            registrantStoreId: entry.registrant_store_id,
            fromStoreName: entry.from_store_name,
            fromStoreId: entry.from_store_id,
            toStoreName: entry.to_store_name,
            toStoreId: entry.to_store_id,
            companies: (entry.quick_cost_companies || [])
                .sort((a, b) => a.company_order - b.company_order)
                .map(c => ({
                    name: c.company_name,
                    phone: c.phone,
                    cost: c.cost
                }))
        }));
    };

    const fetchCompaniesFromSupabase = async () => {
        const { data, error } = await supabase
            .from('quick_cost_companies')
            .select('company_name')
            .order('company_name');

        if (error) throw new Error(`업체 목록 조회 실패: ${error.message}`);

        const uniqueNames = [...new Set(data.map(c => c.company_name))];
        return uniqueNames.sort();
    };

    // ===== Google Sheets 헬퍼 함수 =====
    const buildQuickCostRow = (data) => {
        const row = [data.timestamp, data.registrantStoreName, data.registrantStoreId, data.fromStoreName, data.fromStoreId, data.toStoreName, data.toStoreId, data.modeType];
        for (let i = 0; i < QUICK_COST_MAX_COMPANIES; i++) {
            const c = data.companies[i];
            if (c) row.push(c.originalName, c.originalPhone, c.cost, c.dispatchSpeed, c.pickupSpeed, c.arrivalSpeed);
            else row.push('', '', '', '', '', '');
        }
        return row;
    };

    // ===== 라우트 =====

    // 업체 목록 조회
    router.get('/api/quick-cost/companies', async (req, res) => {
        try {
            const cacheKey = 'quick-cost-companies';
            const cached = cacheManager.get(cacheKey);
            if (cached) return res.json({ success: true, data: cached, source: 'cache' });

            let companies;
            let source;

            if (useSupabase()) {
                // Supabase에서 조회
                companies = await fetchCompaniesFromSupabase();
                source = 'supabase';
            } else {
                // Google Sheets에서 조회
                const response = await rateLimiter.execute(() => sheetsClient.sheets.spreadsheets.values.get({
                    spreadsheetId: sheetsClient.SPREADSHEET_ID,
                    range: `${QUICK_COST_SHEET_NAME}!A:AL`
                }));

                const rows = response.data.values || [];
                const companySet = new Set();
                rows.slice(1).forEach(row => {
                    for (let i = 0; i < 5; i++) {
                        const name = row[8 + i * 6]?.toString().trim();
                        if (name) companySet.add(name);
                    }
                });
                companies = Array.from(companySet).sort();
                source = 'sheets';
            }

            cacheManager.set(cacheKey, companies, 10 * 60 * 1000);
            res.json({ success: true, data: companies, source });
        } catch (e) {
            console.error('[quick-cost/companies] Error:', e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 상세 견적 예상 정보 조회
    router.get('/api/quick-cost/estimate', async (req, res) => {
        try {
            const { fromStoreId, toStoreId } = req.query;
            if (!fromStoreId || !toStoreId) {
                return res.status(400).json({ success: false, error: 'fromStoreId and toStoreId are required' });
            }

            const normFromId = fromStoreId.toString().trim().toUpperCase();
            const normToId = toStoreId.toString().trim().toUpperCase();

            const cacheKey = `quick-cost-estimate-${normFromId}-${normToId}`;
            const cached = cacheManager.get(cacheKey);
            if (cached) return res.json({ success: true, data: cached, source: 'cache' });

            let historyEntries = [];

            if (useSupabase()) {
                // Supabase에서 조회 (양방향)
                console.log(`🔍 [Debug/estimate] Querying Supabase for: ${normFromId} <-> ${normToId}`);
                const { data, error } = await supabase
                    .from('quick_cost_entries')
                    .select(`
                        id,
                        from_store_id,
                        to_store_id,
                        quick_cost_companies (
                            company_name,
                            phone,
                            cost,
                            dispatch_speed,
                            pickup_speed,
                            arrival_speed
                        )
                    `)
                    .or(`and(from_store_id.eq.${normFromId},to_store_id.eq.${normToId}),and(from_store_id.eq.${normToId},to_store_id.eq.${normFromId})`);

                if (error) throw error;
                historyEntries = data.map(entry => ({
                    companies: entry.quick_cost_companies.map(c => ({
                        name: c.company_name,
                        phone: c.phone,
                        cost: c.cost,
                        dispatchSpeed: c.dispatch_speed,
                        pickupSpeed: c.pickup_speed,
                        arrivalSpeed: c.arrival_speed
                    }))
                }));
            } else {
                // Google Sheets에서 조회
                console.log(`🔍 [Debug/estimate] Getting estimate for: ${normFromId} <-> ${normToId}`);

                const response = await rateLimiter.execute(() => sheetsClient.sheets.spreadsheets.values.get({
                    spreadsheetId: sheetsClient.SPREADSHEET_ID,
                    range: `${QUICK_COST_SHEET_NAME}!A:AL`
                }));

                const rows = response.data.values || [];
                console.log(`🔍 [Debug/estimate] Total rows in sheet: ${rows.length}`);

                historyEntries = rows.slice(1).filter((row, idx) => {
                    const sheetFId = row[4]?.toString().trim().toUpperCase();
                    const sheetTId = row[6]?.toString().trim().toUpperCase();
                    const isMatch = (sheetFId === normFromId && sheetTId === normToId) || (sheetFId === normToId && sheetTId === normFromId);

                    if (isMatch) {
                        console.log(`✅ [Debug/estimate] Found Match at Row ${idx + 2}: [${sheetFId}] <-> [${sheetTId}]`);
                    }
                    return isMatch;
                }).map(row => {
                    const companies = [];
                    for (let i = 0; i < QUICK_COST_MAX_COMPANIES; i++) {
                        const base = 8 + i * 6;
                        const name = row[base]?.toString().trim();
                        const phone = row[base + 1]?.toString().trim();
                        const cost = parseInt(row[base + 2]?.toString().replace(/,/g, '')) || 0;
                        const dSpeed = row[base + 3]?.toString().trim();
                        const pSpeed = row[base + 4]?.toString().trim();
                        const aSpeed = row[base + 5]?.toString().trim();

                        if (name && cost > 0) {
                            companies.push({
                                name,
                                phone,
                                cost,
                                dispatchSpeed: dSpeed || '중간',
                                pickupSpeed: pSpeed || '중간',
                                arrivalSpeed: aSpeed || '중간'
                            });
                        }
                    }
                    return { companies };
                });

                console.log(`🔍 [Debug/estimate] Found ${historyEntries.length} matching entries.`);
            }

            // 업체별 데이터 집계 (평균 비용 및 속도 통계)
            const companyMap = new Map();
            historyEntries.forEach(entry => {
                entry.companies.forEach(c => {
                    const key = `${normalizeCompanyName(c.name)}-${normalizePhoneNumber(c.phone)}`;
                    if (!companyMap.has(key)) {
                        companyMap.set(key, {
                            companyName: c.name,
                            phoneNumber: c.phone,
                            totalCost: 0,
                            count: 0,
                            dispatchSpeeds: [],
                            pickupSpeeds: [],
                            arrivalSpeeds: []
                        });
                    }
                    const stats = companyMap.get(key);
                    stats.totalCost += c.cost;
                    stats.count += 1;
                    if (c.dispatchSpeed) stats.dispatchSpeeds.push(c.dispatchSpeed);
                    if (c.pickupSpeed) stats.pickupSpeeds.push(c.pickupSpeed);
                    if (c.arrivalSpeed) stats.arrivalSpeeds.push(c.arrivalSpeed);
                });
            });

            // 가장 빈번한 속도 값을 가져오는 함수
            const getMode = (arr) => {
                if (!arr || arr.length === 0) return '중간';
                const counts = {};
                let max = 0;
                let mode = '중간';
                arr.forEach(val => {
                    counts[val] = (counts[val] || 0) + 1;
                    if (counts[val] > max) {
                        max = counts[val];
                        mode = val;
                    }
                });
                return mode;
            };

            const data = Array.from(companyMap.values()).map(stats => ({
                companyName: stats.companyName,
                phoneNumber: stats.phoneNumber,
                averageCost: Math.round(stats.totalCost / stats.count),
                entryCount: stats.count,
                dispatchSpeed: getMode(stats.dispatchSpeeds),
                pickupSpeed: getMode(stats.pickupSpeeds),
                arrivalSpeed: getMode(stats.arrivalSpeeds)
            }));

            // 결과 캐싱 (5분)
            cacheManager.set(cacheKey, data, 5 * 60 * 1000);

            res.json({ success: true, data });
        } catch (e) {
            console.error('[quick-cost/estimate] Error:', e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 견적 이력 조회
    router.get('/api/quick-cost/history', async (req, res) => {
        try {
            const { userId, fromStoreId, toStoreId, limit } = req.query;
            let history;
            let source;

            if (useSupabase()) {
                // Supabase에서 조회
                history = await fetchHistoryFromSupabase({ userId, fromStoreId, toStoreId, limit });
                source = 'supabase';
            } else {
                // Google Sheets에서 조회
                console.log(`🔍 [Debug] Fetching Sheet Data...`);
                console.log(`🔍 [Debug] Spreadsheet ID: ${sheetsClient.SPREADSHEET_ID}`);
                console.log(`🔍 [Debug] Range: ${QUICK_COST_SHEET_NAME}!A:AL`);

                const response = await rateLimiter.execute(() => sheetsClient.sheets.spreadsheets.values.get({
                    spreadsheetId: sheetsClient.SPREADSHEET_ID,
                    range: `${QUICK_COST_SHEET_NAME}!A:AL`
                }));

                const rows = response.data.values || [];
                console.log(`🔍 [Debug] Fetched ${rows.length} rows from Google Sheets.`);
                if (rows.length > 0) {
                    console.log(`🔍 [Debug] First row (Header):`, rows[0]);
                    console.log(`🔍 [Debug] Second row (Data Sample):`, rows[1]);
                }
                const resolver = createRegisteredAtResolver();
                const normFromId = fromStoreId?.toString().trim().toUpperCase();
                const normToId = toStoreId?.toString().trim().toUpperCase();
                const normUserId = userId?.toString().trim().toUpperCase();

                history = rows.slice(1).map((row, idx) => {
                    const companies = [];
                    for (let i = 0; i < QUICK_COST_MAX_COMPANIES; i++) {
                        const base = 8 + i * 6;
                        if (row[base]) {
                            companies.push({
                                name: row[base],
                                phone: row[base + 1],
                                cost: parseInt(row[base + 2]?.toString().replace(/,/g, '')) || 0
                            });
                        }
                    }
                    return {
                        rowIndex: idx + 2,
                        registeredAt: resolver(row[0]).label,
                        registrantStoreName: row[1]?.toString().trim(),
                        registrantStoreId: row[2]?.toString().trim(),
                        fromStoreName: row[3]?.toString().trim(),
                        fromStoreId: row[4]?.toString().trim(),
                        toStoreName: row[5]?.toString().trim(),
                        toStoreId: row[6]?.toString().trim(),
                        companies
                    };
                }).filter(h => {
                    const hFrom = h.fromStoreId?.toUpperCase();
                    const hTo = h.toStoreId?.toUpperCase();
                    const hReg = h.registrantStoreId?.toUpperCase();

                    // 1. 등록자 필터
                    if (normUserId && hReg !== normUserId) return false;

                    // 2. 매장 필터
                    if (normFromId && normToId) {
                        // 양방향 매칭
                        return (hFrom === normFromId && hTo === normToId) || (hFrom === normToId && hTo === normFromId);
                    } else if (normFromId) {
                        return hFrom === normFromId || hTo === normFromId;
                    } else if (normToId) {
                        return hFrom === normToId || hTo === normToId;
                    }
                    return true;
                });

                history.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));
                if (limit) history = history.slice(0, parseInt(limit));
                source = 'sheets';
            }

            res.json({ success: true, data: history, source });
        } catch (e) {
            console.error('[quick-cost/history] Error:', e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 견적 저장
    router.post('/api/quick-cost/save', async (req, res) => {
        try {
            const data = req.body;
            const normalized = normalizeQuickCostCompanies(data.companies);
            let source;

            if (useSupabase()) {
                // Supabase에 저장
                await saveToSupabase(data, normalized);
                source = 'supabase';
            } else {
                // Google Sheets에 저장
                const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
                const row = buildQuickCostRow({ ...data, timestamp: now, companies: normalized });

                await rateLimiter.execute(() => sheetsClient.sheets.spreadsheets.values.append({
                    spreadsheetId: sheetsClient.SPREADSHEET_ID,
                    range: `${QUICK_COST_SHEET_NAME}!A:AL`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [row] }
                }));
                source = 'sheets';
            }

            invalidateQuickCostCache(data.fromStoreId, data.toStoreId);
            res.json({ success: true, message: '저장되었습니다.', source });
        } catch (e) {
            console.error('[quick-cost/save] Error:', e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 업체명 정규화 비교
    router.post('/api/quick-cost/normalize', async (req, res) => {
        try {
            const { companyName1, companyName2 } = req.body;
            const n1 = normalizeCompanyName(companyName1);
            const n2 = normalizeCompanyName(companyName2);
            res.json({
                success: true,
                data: {
                    companyName1, companyName2,
                    normalized1: n1, normalized2: n2,
                    similarity: n1 === n2 ? 100 : 0,
                    shouldMerge: n1 === n2
                }
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 통계 데이터 조회
    router.get('/api/quick-cost/statistics', async (req, res) => {
        try {
            const { region, forceRefresh } = req.query;
            const cacheKey = `quick-cost-statistics-${region || 'all'}`;

            if (!forceRefresh) {
                const cached = cacheManager.get(cacheKey);
                if (cached) return res.json({ success: true, data: cached, source: 'cache' });
            }

            // 데이터 조회 (history 로직 재사용)
            let history = [];
            if (useSupabase()) {
                const { data, error } = await supabase
                    .from('quick_cost_entries')
                    .select(`
                        registered_at,
                        quick_cost_companies (
                            company_name,
                            cost,
                            dispatch_speed,
                            pickup_speed,
                            arrival_speed
                        )
                    `);
                if (!error && data) {
                    history = data.map(entry => ({
                        registeredAt: entry.registered_at,
                        companies: entry.quick_cost_companies?.map(c => ({
                            name: c.company_name,
                            cost: c.cost
                        })) || []
                    }));
                }
            } else {
                const response = await rateLimiter.execute(() => sheetsClient.sheets.spreadsheets.values.get({
                    spreadsheetId: sheetsClient.SPREADSHEET_ID,
                    range: `${QUICK_COST_SHEET_NAME}!A:AL`
                }));
                const rows = response.data.values || [];
                const resolver = createRegisteredAtResolver();
                history = rows.slice(1).map(row => {
                    const companies = [];
                    for (let i = 0; i < QUICK_COST_MAX_COMPANIES; i++) {
                        const base = 8 + i * 6;
                        if (row[base]) {
                            companies.push({
                                name: row[base],
                                cost: parseInt(row[base + 2]) || 0
                            });
                        }
                    }
                    return {
                        registeredAt: resolver(row[0]).date,
                        fromStoreName: row[3]?.toString().trim(), // Required for region extraction
                        toStoreName: row[5]?.toString().trim(),   // Required for region extraction
                        companies
                    };
                });
            }

            console.log(`🔍 [Debug-Stats] Processed ${history.length} history entries for statistics.`);

            // 통계 계산 (간소화된 로직)
            const companyStatsMap = new Map();
            const monthlyTrend = {};

            history.forEach((entry, idx) => {
                // 월별 트렌드
                if (entry.registeredAt) {
                    const date = new Date(entry.registeredAt);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    if (!monthlyTrend[monthKey]) monthlyTrend[monthKey] = { entryCount: 0, averageCost: 0, totalCost: 0, count: 0 };
                    monthlyTrend[monthKey].entryCount++;

                    if (entry.companies.length > 0) {
                        const avgEntryCost = entry.companies.reduce((sum, c) => sum + c.cost, 0) / entry.companies.length;
                        monthlyTrend[monthKey].totalCost += avgEntryCost;
                        monthlyTrend[monthKey].count++;
                    }
                }

                // (Helper) Extract region from store name e.g. "넘버원모바일2호(시흥대야)" -> "시흥"
                const getRegionFromStoreName = (storeName) => {
                    if (!storeName) return '기타';
                    const match = storeName.match(/\((.*?)\)/);
                    if (match && match[1]) {
                        // "시흥대야" -> "시흥" (first 2 chars usually)
                        // "서울마곡" -> "서울"
                        return match[1].substring(0, 2);
                    }
                    return '기타';
                };

                // 업체별 통계
                entry.companies.forEach(c => {
                    const name = c.name;
                    if (!companyStatsMap.has(name)) {
                        const region = getRegionFromStoreName(entry.fromStoreName);
                        if (idx < 5) console.log(`🔍 [Debug-Stats] Extracted region '${region}' from '${entry.fromStoreName}'`);

                        companyStatsMap.set(name, {
                            companyName: name,
                            entryCount: 0,
                            averageCost: 0,
                            totalCost: 0,
                            reliabilityScore: 80, // 기본값
                            region: region // Add region field
                        });
                    }
                    const stat = companyStatsMap.get(name);
                    stat.entryCount++;
                    stat.totalCost += c.cost;
                    stat.averageCost = Math.round(stat.totalCost / stat.entryCount);
                });
            });

            // 포맷팅
            const companyStats = Array.from(companyStatsMap.values());
            const timeTrends = Object.entries(monthlyTrend).map(([key, val]) => ({
                label: key,
                entryCount: val.entryCount,
                averageCost: val.count > 0 ? Math.round(val.totalCost / val.count) : 0
            })).sort((a, b) => a.label.localeCompare(b.label));

            // (Helper) Extract region from store name e.g. "넘버원모바일2호(시흥대야)" -> "시흥"
            const getRegionFromStoreName = (storeName) => {
                if (!storeName) return '기타';
                const match = storeName.match(/\((.*?)\)/);
                if (match && match[1]) {
                    // "시흥대야" -> "시흥" (first 2 chars usually)
                    // "서울마곡" -> "서울"
                    return match[1].substring(0, 2);
                }
                return '기타';
            };

            // Collect distinct regions from history
            const distinctRegions = new Set();
            history.forEach(entry => {
                const fromRegion = getRegionFromStoreName(entry.fromStoreName);
                if (fromRegion) distinctRegions.add(fromRegion);

                // Also include 'toStoreName' region effectively
                const toRegion = getRegionFromStoreName(entry.toStoreName);
                if (toRegion) distinctRegions.add(toRegion);
            });
            const availableRegions = Array.from(distinctRegions).sort();
            console.log(`🔍 [Debug-Stats] Available Regions: ${availableRegions.join(', ')}`);

            const statsData = {
                companyStats,
                popularCompanies: companyStats.sort((a, b) => b.entryCount - a.entryCount).slice(0, 10),
                excellentCompanies: companyStats.sort((a, b) => b.entryCount - a.entryCount).slice(0, 10), // 임시로 인기순 사용
                regionAggregates: [], // 지역 데이터 부족으로 빈 배열
                distanceCostAnalysis: [],
                timeTrends: {
                    monthly: timeTrends,
                    weekly: []
                },
                availableRegions // NEW: Explicit list of all regions found in history
            };

            cacheManager.set(cacheKey, statsData, 30 * 60 * 1000);
            res.json({ success: true, data: statsData, source: 'computed' });

        } catch (e) {
            console.error('[quick-cost/statistics] Error:', e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 데이터 품질 조회 (기본 구현)
    router.get('/api/quick-cost/quality', async (req, res) => {
        try {
            res.json({
                success: true,
                data: {
                    outliers: [],
                    normalizationStatus: { total: 0, normalized: 0, rate: 0 },
                    duplicateRate: 0,
                    reliabilityScores: [],
                    duplicateGroups: [],
                    mergeSuggestions: []
                }
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    // 데이터 소스 상태 확인
    router.get('/api/quick-cost/source-status', async (req, res) => {
        try {
            const isSupabaseEnabled = useSupabase();
            res.json({
                success: true,
                data: {
                    currentSource: isSupabaseEnabled ? 'supabase' : 'sheets',
                    supabaseAvailable: !!supabase,
                    featureFlagEnabled: featureFlags.isEnabled('quick-service')
                }
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    });

    return router;
}

module.exports = createQuickCostRoutes;

