// 마커 색상 설정 유틸리티 함수
import { API_BASE_URL } from '../api';

// 유니크 값 목록 조회
export const getUniqueValues = async (type) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stores/unique-values?type=${type}`);
    if (response.ok) {
      const data = await response.json();
      return data.values || [];
    }
    return [];
  } catch (error) {
    console.error('유니크 값 목록 조회 오류:', error);
    return [];
  }
};

// 색상 설정 조회 (옵션별로 그룹화)
export const getMarkerColorSettings = async (userId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/marker-color-settings`, {
      headers: {
        'x-user-id': userId
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // 디버깅 로그
      console.log('[마커 색상 설정 조회] 서버 응답:', data);
      
      // 서버에서 받은 데이터를 옵션별로 그룹화
      const settings = {
        selectedOption: 'default',
        colorSettings: {
          code: {},
          office: {},
          department: {},
          manager: {}
        }
      };
      
      // 선택된 옵션 처리
      if (data.settings && data.settings.selectedOption) {
        settings.selectedOption = data.settings.selectedOption;
        console.log('[마커 색상 설정 조회] 선택된 옵션:', settings.selectedOption);
      } else {
        console.warn('[마커 색상 설정 조회] 선택된 옵션이 없습니다. 기본값 사용:', data);
      }
      
      // 색상 설정 처리
      if (data.settings && data.settings.colorSettings) {
        settings.colorSettings = data.settings.colorSettings;
      }
      
      return settings;
    }
    return {
      selectedOption: 'default',
      colorSettings: { code: {}, office: {}, department: {}, manager: {} }
    };
  } catch (error) {
    console.error('색상 설정 조회 오류:', error);
    return {
      selectedOption: 'default',
      colorSettings: { code: {}, office: {}, department: {}, manager: {} }
    };
  }
};

// 색상 설정 저장
export const saveMarkerColorSettings = async (userId, selectedOption, colorSettings) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/marker-color-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify({
        selectedOption,
        colorSettings
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, message: data.message };
    }
    
    const errorData = await response.json();
    return { success: false, error: errorData.error };
  } catch (error) {
    console.error('색상 설정 저장 오류:', error);
    return { success: false, error: error.message };
  }
};
