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
    }
};
