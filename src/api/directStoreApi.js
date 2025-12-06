import { API_BASE_URL } from '../api';

const BASE_URL = `${API_BASE_URL}/api/direct`;

export const directStoreApi = {
    // === 설정 및 기초 데이터 ===

    // 설정 조회 (링크, 범위 등)
    getSettings: async () => {
        const response = await fetch(`${BASE_URL}/settings`);
        if (!response.ok) throw new Error('설정 조회 실패');
        return response.json();
    },

    // 설정 저장
    saveSettings: async (settings) => {
        const response = await fetch(`${BASE_URL}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (!response.ok) throw new Error('설정 저장 실패');
        return response.json();
    },

    // === 상품 데이터 ===

    // 오늘의 휴대폰 조회
    getTodaysMobiles: async () => {
        try {
            const response = await fetch(`${BASE_URL}/todays-mobiles`);
            if (!response.ok) {
                throw new Error('오늘의 휴대폰 조회 실패');
            }
            const data = await response.json();
            // 백엔드에서 { premium: [], budget: [] } 형식으로 반환
            return data.premium && data.budget ? data : { premium: data.premium || [], budget: data.budget || [] };
        } catch (err) {
            console.warn('오늘의 휴대폰 API 호출 실패, Mock 데이터 사용:', err);
            // API 실패 시 getMobileList를 사용하여 Mock 데이터 생성
            const skList = await directStoreApi.getMobileList('SK');
            const premium = skList
                .filter(p => p.isPopular || p.isRecommended)
                .slice(0, 6)
                .map(p => ({
                    ...p,
                    purchasePrice: p.purchasePriceWithAddon,
                    addons: p.requiredAddons
                }));
            const cheap = skList.filter(p => p.isCheap);
            const fallback = skList
                .filter(p => !p.isPopular && !p.isRecommended)
                .sort((a, b) => (a.purchasePriceWithAddon || 0) - (b.purchasePriceWithAddon || 0));
            const budgetSource = cheap.length > 0 ? cheap : fallback;
            const budget = budgetSource.slice(0, 2).map(p => ({
                ...p,
                purchasePrice: p.purchasePriceWithAddon,
                addons: p.requiredAddons
            }));
            return { premium, budget };
        }
    },

    // 휴대폰 목록 조회 (필터링 포함)
    getMobileList: async (carrier) => {
        try {
            const params = new URLSearchParams();
            if (carrier) params.append('carrier', carrier);

            const response = await fetch(`${BASE_URL}/mobiles?${params.toString()}`);
            if (!response.ok) {
                throw new Error('휴대폰 목록 조회 실패');
            }
            const data = await response.json();
            // 백엔드에서 배열을 직접 반환하거나, { success: true, data: [...] } 형식일 수 있음
            return Array.isArray(data) ? data : (data.data || data.mobileList || []);
        } catch (err) {
            console.warn('휴대폰 목록 API 호출 실패, Mock 데이터 사용:', err);
            // API 실패 시 Mock 데이터 반환 (fallback)
            const effectiveCarrier = carrier || 'SK';
            const baseData = [
                {
                    id: '1',
                    model: 'SM-S918N',
                    petName: '갤럭시 S23 울트라',
                    carrier: effectiveCarrier,
                    factoryPrice: 1_599_400,
                    support: 500_000,
                    publicSupport: 500_000,
                    storeSupport: 300_000,
                    storeSupportNoAddon: 200_000,
                    purchasePriceWithAddon: 1_599_400 - 500_000 - 300_000,
                    purchasePriceWithoutAddon: 1_599_400 - 500_000 - 200_000,
                    image: 'https://via.placeholder.com/300x300?text=S23U',
                    tags: ['popular', 'recommend'],
                    requiredAddons: '우주패스, 보험',
                    isPopular: true,
                    isRecommended: true,
                    isCheap: false
                }
            ];
            return baseData;
        }
    },

    // === 판매일보 ===

    // 판매일보 조회
    getSalesReports: async (filters = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });

        const response = await fetch(`${BASE_URL}/sales?${params.toString()}`);
        if (!response.ok) throw new Error('판매일보 조회 실패');
        return response.json();
    },

    // 판매일보 등록 (개통정보 저장)
    createSalesReport: async (data) => {
        const response = await fetch(`${BASE_URL}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('판매일보 등록 실패');
        return response.json();
    },

    // 판매일보 수정 (상태 변경 등)
    updateSalesReport: async (id, data) => {
        const response = await fetch(`${BASE_URL}/sales/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('판매일보 수정 실패');
        return response.json();
    },

    // === 구분 태그 업데이트 ===

    // 구분(인기/추천/저렴) 태그 업데이트
    updateMobileTags: async (modelId, payload) => {
        try {
            const response = await fetch(`${BASE_URL}/mobiles/${modelId}/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('구분 태그 업데이트 실패');
            return response.json();
        } catch (err) {
            console.warn('구분 태그 업데이트 API 호출 실패:', err);
            return { success: false, error: err.message };
        }
    },

    // === 이미지 업로드 (Discord) ===

    // 이미지 업로드
    uploadImage: async (file, modelId, carrier, modelName, petName) => {
        const formData = new FormData();
        formData.append('image', file);
        if (modelId) formData.append('modelId', modelId);
        if (carrier) formData.append('carrier', carrier);
        if (modelName) formData.append('modelName', modelName);
        if (petName) formData.append('petName', petName);

        try {
            const response = await fetch(`${BASE_URL}/upload-image`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                // 서버에서 반환한 에러 메시지 사용
                const errorMessage = data?.error || `이미지 업로드 실패 (${response.status})`;
                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            // 네트워크 오류 등
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
            }
            throw error;
        }
    },

    // === 직영점 관리 모드 API (Mock Data 포함) ===

    // 정책 설정 조회
    getPolicySettings: async (carrier) => {
        try {
            const response = await fetch(`${BASE_URL}/policy-settings?carrier=${carrier}`);
            if (!response.ok) throw new Error('정책 설정 조회 실패');
            return response.json();
        } catch (err) {
            console.warn('정책 설정 API 호출 실패, Mock 데이터 사용:', err);
            // 백엔드 미구현 시 Mock Data 반환
            return {
                success: true,
                margin: { baseMargin: 50000 },
                addon: {
                    list: [
                        { id: 1, name: 'V컬러링', fee: 3300, incentive: 1000, deduction: 0 },
                        { id: 2, name: '우주패스', fee: 9900, incentive: 5000, deduction: 2000 }
                    ]
                },
                special: {
                    list: [
                        { id: 1, name: '기기반납', addition: 0, deduction: 100000, isActive: true },
                        { id: 2, name: '제휴카드', addition: 50000, deduction: 0, isActive: false }
                    ]
                }
            };
        }
    },

    // 정책 설정 저장
    savePolicySettings: async (carrier, settings) => {
        try {
            const response = await fetch(`${BASE_URL}/policy-settings?carrier=${carrier}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!response.ok) throw new Error('정책 설정 저장 실패');
            return response.json();
        } catch (err) {
            console.warn('정책 설정 저장 API 호출 실패:', err);
            return { success: false, error: err.message };
        }
    },

    // 링크 설정 조회
    getLinkSettings: async (carrier) => {
        try {
            const response = await fetch(`${BASE_URL}/link-settings?carrier=${carrier}`);
            if (!response.ok) throw new Error('링크 설정 조회 실패');
            return response.json();
        } catch (err) {
            console.warn('링크 설정 API 호출 실패, Mock 데이터 사용:', err);
            // 백엔드 미구현 시 Mock Data 반환
            return {
                success: true,
                planGroup: {
                    link: 'https://docs.google.com/spreadsheets/d/mock',
                    planGroups: ['5GX 프라임', '5GX 플래티넘', 'T플랜 에센스']
                },
                support: {
                    link: 'https://docs.google.com/spreadsheets/d/mock',
                },
                policy: {
                    link: 'https://docs.google.com/spreadsheets/d/mock',
                }
            };
        }
    },

    // 링크 설정 저장
    saveLinkSettings: async (carrier, settings) => {
        try {
            const response = await fetch(`${BASE_URL}/link-settings?carrier=${carrier}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!response.ok) throw new Error('링크 설정 저장 실패');
            return response.json();
        } catch (err) {
            console.warn('링크 설정 저장 API 호출 실패:', err);
            return { success: false, error: err.message };
        }
    },

    // 범위에서 데이터 가져오기 (범용 함수)
    fetchRangeData: async (sheetId, range, unique = false) => {
        try {
            const params = new URLSearchParams();
            params.append('sheetId', sheetId);
            params.append('range', range);
            if (unique) params.append('unique', 'true');
            const response = await fetch(`${BASE_URL}/link-settings/fetch-range?${params.toString()}`);
            if (!response.ok) throw new Error('범위 데이터 조회 실패');
            return response.json();
        } catch (err) {
            console.warn('범위 데이터 조회 API 호출 실패:', err);
            return { success: false, error: err.message, data: [] };
        }
    },

    // 요금제군 자동 가져오기 (시트에서 유니크한 값 추출) - 하위 호환성
    fetchPlanGroups: async (sheetId, range) => {
        try {
            const params = new URLSearchParams();
            params.append('sheetId', sheetId);
            params.append('range', range);
            const response = await fetch(`${BASE_URL}/link-settings/plan-groups?${params.toString()}`);
            if (!response.ok) throw new Error('요금제군 조회 실패');
            return response.json();
        } catch (err) {
            console.warn('요금제군 조회 API 호출 실패:', err);
            return { success: false, error: err.message, planGroups: [] };
        }
    },

    // 요금제군별 대리점지원금 및 구매가 계산
    calculateMobilePrice: async (modelId, planGroup, openingType, carrier) => {
        try {
            const params = new URLSearchParams();
            params.append('planGroup', planGroup);
            params.append('openingType', openingType || '010신규');
            params.append('carrier', carrier);
            const response = await fetch(`${BASE_URL}/mobiles/${modelId}/calculate?${params.toString()}`);
            if (!response.ok) throw new Error('가격 계산 실패');
            return response.json();
        } catch (err) {
            console.warn('가격 계산 API 호출 실패:', err);
            return { success: false, error: err.message };
        }
    },

};
