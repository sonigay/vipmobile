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
        const response = await fetch(`${BASE_URL}/todays-mobiles`);
        if (!response.ok) throw new Error('오늘의 휴대폰 조회 실패');
        return response.json();
    },

    // 휴대폰 목록 조회 (필터링 포함)
    getMobileList: async (carrier) => {
        const params = new URLSearchParams();
        if (carrier) params.append('carrier', carrier);

        const response = await fetch(`${BASE_URL}/mobiles?${params.toString()}`);
        if (!response.ok) throw new Error('휴대폰 목록 조회 실패');
        return response.json();
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

    // === 이미지 업로드 (Discord) ===

    // 이미지 업로드
    uploadImage: async (file, modelId) => {
        const formData = new FormData();
        formData.append('image', file);
        if (modelId) formData.append('modelId', modelId);

        const response = await fetch(`${BASE_URL}/upload-image`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('이미지 업로드 실패');
        return response.json();
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

    /**
     * === 상품 데이터 Mock 구현 ===
     *
     * 백엔드 / 구글시트 연동이 준비되기 전까지는
     * 프론트에서 사용하는 필드 구조를 명확히 하기 위해
     * getMobileList / getTodaysMobiles 를 아래 Mock 로직으로 덮어씁니다.
     *
     * 실제 연동 시에는 이 블록을 제거하고,
     * 서버 응답을 동일한 필드 구조로 맞춰주면 됩니다.
     */

    // 휴대폰 목록 조회 (Mock Data - 직영점 모드 / 개통정보 입력 테스트용)
    getMobileList: async (carrier) => {
        const effectiveCarrier = carrier || 'SK';

        const baseData = [
            {
                id: '1',
                model: 'SM-S918N',
                petName: '갤럭시 S23 울트라',
                carrier: effectiveCarrier,
                factoryPrice: 1_599_400,
                support: 500_000,              // 이통사지원금
                publicSupport: 500_000,        // OpeningInfoPage 계산용 alias
                storeSupport: 300_000,         // 대리점추가지원금(부가유치)
                storeSupportNoAddon: 200_000,  // 대리점추가지원금(부가미유치)
                purchasePriceWithAddon: 1_599_400 - 500_000 - 300_000,
                purchasePriceWithoutAddon: 1_599_400 - 500_000 - 200_000,
                image: 'https://via.placeholder.com/300x300?text=S23U',
                tags: ['popular', 'recommend'],
                requiredAddons: '우주패스, 보험'
            },
            {
                id: '2',
                model: 'SM-S911N',
                petName: '갤럭시 S23',
                carrier: effectiveCarrier,
                factoryPrice: 1_155_000,
                support: 400_000,
                publicSupport: 400_000,
                storeSupport: 250_000,
                storeSupportNoAddon: 150_000,
                purchasePriceWithAddon: 1_155_000 - 400_000 - 250_000,
                purchasePriceWithoutAddon: 1_155_000 - 400_000 - 150_000,
                image: 'https://via.placeholder.com/300x300?text=S23',
                tags: ['cheap'],
                requiredAddons: '우주패스'
            },
            {
                id: '3',
                model: 'SM-A346N',
                petName: '갤럭시 A34',
                carrier: effectiveCarrier,
                factoryPrice: 499_400,
                support: 300_000,
                publicSupport: 300_000,
                storeSupport: 150_000,
                storeSupportNoAddon: 100_000,
                purchasePriceWithAddon: 499_400 - 300_000 - 150_000,
                purchasePriceWithoutAddon: 499_400 - 300_000 - 100_000,
                image: 'https://via.placeholder.com/300x300?text=A34',
                tags: [],
                requiredAddons: '없음'
            }
        ];

        // 태그를 편하게 쓰기 위한 파생 필드 부여
        return baseData.map(item => ({
            ...item,
            isPopular: item.tags.includes('popular'),
            isRecommended: item.tags.includes('recommend'),
            isCheap: item.tags.includes('cheap')
        }));
    },

    // 오늘의 휴대폰 조회 (Mock Data - 휴대폰목록 Mock을 재활용)
    getTodaysMobiles: async () => {
        const skList = await directStoreApi.getMobileList('SK');

        // 프리미엄: 인기/추천 태그 위주로 상위 6개
        const premium = skList
            .filter(p => p.isPopular || p.isRecommended)
            .slice(0, 6)
            .map(p => ({
                ...p,
                purchasePrice: p.purchasePriceWithAddon,
                addons: p.requiredAddons
            }));

        // 실속형: 저렴(tag) 위주로 상위 2개, 없으면 나머지 중 가격 낮은 순
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
};
