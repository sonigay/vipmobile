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
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `오늘의 휴대폰 조회 실패 (${response.status})`);
            }
            const data = await response.json();
            // 백엔드에서 { premium: [], budget: [] } 형식으로 반환
            const result = data.premium && data.budget ? data : { premium: data.premium || [], budget: data.budget || [] };
            // 빈 배열이어도 반환 (에러가 아님)
            return result;
        } catch (err) {
            console.error('오늘의 휴대폰 API 호출 실패:', err);
            // API 실패 시 getMobileList를 사용하여 Mock 데이터 생성 시도
            try {
                const skList = await directStoreApi.getMobileList('SK');
                if (skList && skList.length > 0) {
                    const premium = skList
                        .filter(p => p.isPremium || p.isPopular || p.isRecommended)
                        .slice(0, 3)
                        .map(p => ({
                            ...p,
                            purchasePrice: p.purchasePriceWithAddon,
                            addons: p.requiredAddons
                        }));
                    const budget = skList
                        .filter(p => p.isBudget || p.isCheap)
                        .slice(0, 2)
                        .map(p => ({
                            ...p,
                            purchasePrice: p.purchasePriceWithAddon,
                            addons: p.requiredAddons
                        }));
                    return { premium, budget };
                }
            } catch (fallbackErr) {
                console.error('Mock 데이터 생성도 실패:', fallbackErr);
            }
            // 모든 시도 실패 시 빈 배열 반환
            return { premium: [], budget: [] };
        }
    },

    // 휴대폰 목록 조회 (필터링 포함)
    getMobileList: async (carrier, options = {}) => {
        try {
            const params = new URLSearchParams();
            if (carrier) params.append('carrier', carrier);
            if (options.withMeta) params.append('meta', '1');

            const response = await fetch(`${BASE_URL}/mobiles?${params.toString()}`);
            if (!response.ok) {
                throw new Error('휴대폰 목록 조회 실패');
            }
            const data = await response.json();
            if (options.withMeta) {
                const list = Array.isArray(data) ? data : (data.data || data.mobileList || []);
                const meta = data.meta || {};
                return { list, meta };
            }
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
    calculateMobilePrice: async (modelId, planGroup, openingType, carrier, modelName = null) => {
        try {
            const params = new URLSearchParams();
            params.append('planGroup', planGroup);
            params.append('openingType', openingType || '010신규');
            params.append('carrier', carrier);
            if (modelName) {
                params.append('modelName', modelName);
            }
            const response = await fetch(`${BASE_URL}/mobiles/${modelId}/calculate?${params.toString()}`);
            if (!response.ok) {
                // 404 에러는 모델을 찾을 수 없는 것이므로 재시도하지 않음
                if (response.status === 404) {
                    const errorData = await response.json().catch(() => ({}));
                    return { success: false, error: errorData.error || '모델을 찾을 수 없습니다.', status: 404 };
                }
                throw new Error('가격 계산 실패');
            }
            return response.json();
        } catch (err) {
            console.warn('가격 계산 API 호출 실패:', err);
            return { success: false, error: err.message };
        }
    },

    // === 메인페이지 문구 설정 ===

    // 메인페이지 문구 조회
    getMainPageTexts: async () => {
        try {
            const response = await fetch(`${BASE_URL}/main-page-texts`);
            if (!response.ok) throw new Error('문구 조회 실패');
            return response.json();
        } catch (err) {
            console.error('문구 조회 실패:', err);
            return { success: false, error: err.message };
        }
    },

    // 메인헤더 문구만 조회
    getMainHeaderText: async () => {
        try {
            const response = await fetch(`${BASE_URL}/main-page-texts`);
            if (!response.ok) throw new Error('메인헤더 문구 조회 실패');
            const data = await response.json();
            return { success: true, data: data.data?.mainHeader || null };
        } catch (err) {
            console.error('메인헤더 문구 조회 실패:', err);
            return { success: false, error: err.message };
        }
    },

    // 연결페이지 문구 조회
    getTransitionPageText: async (carrier, category) => {
        try {
            const response = await fetch(`${BASE_URL}/main-page-texts`);
            if (!response.ok) throw new Error('연결페이지 문구 조회 실패');
            const data = await response.json();
            const text = data.data?.transitionPages?.[carrier]?.[category] || null;
            return { success: true, data: text };
        } catch (err) {
            console.error('연결페이지 문구 조회 실패:', err);
            return { success: false, error: err.message };
        }
    },

    // 문구 저장
    saveMainPageText: async (carrier, category, textType, content, imageUrl = '') => {
        try {
            const response = await fetch(`${BASE_URL}/main-page-texts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carrier, category, textType, content, imageUrl })
            });
            if (!response.ok) throw new Error('문구 저장 실패');
            return response.json();
        } catch (err) {
            console.error('문구 저장 실패:', err);
            return { success: false, error: err.message };
        }
    },

    // 연결페이지 이미지 업로드
    uploadTransitionPageImage: async (file, carrier, category) => {
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('carrier', carrier);
            formData.append('category', category);

            const response = await fetch(`${BASE_URL}/upload-transition-page-image`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '이미지 업로드 실패');
            }

            return response.json();
        } catch (err) {
            console.error('연결페이지 이미지 업로드 실패:', err);
            return { success: false, error: err.message };
        }
    },

};
