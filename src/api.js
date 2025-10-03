// API 기본 URL 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://port-0-jegomap2-md0ol3n075a69e78.sel5.cloudtype.app';

// API 호출 함수들
export const api = {
  // 월간시상 데이터 가져오기
  getMonthlyAwardData: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monthly-award/data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('월간시상 데이터 로드 오류:', error);
      throw error;
    }
  },

  // 월간시상 셋팅 저장
  saveMonthlyAwardSettings: async (type, data) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/monthly-award/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({ type, data })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('월간시상 셋팅 저장 오류:', error);
      throw error;
    }
  }
};

// 프론트엔드 캐싱 시스템
const clientCache = new Map();
const CLIENT_CACHE_TTL = 5 * 60 * 1000; // 5분

const clientCacheUtils = {
  // 캐시에 데이터 저장
  set: (key, data, ttl = CLIENT_CACHE_TTL) => {
    const now = Date.now();
    clientCache.set(key, {
      data,
      timestamp: now,
      ttl: now + ttl
    });
    
    // localStorage에도 저장 (브라우저 새로고침 시에도 유지)
    try {
      // localStorage 용량 제한 확인 및 정리
      const dataSize = JSON.stringify(data).length;
      const maxSize = 5 * 1024 * 1024; // 5MB 제한
      
      if (dataSize > maxSize) {
        console.warn(`캐시 데이터가 너무 큽니다 (${(dataSize / 1024 / 1024).toFixed(2)}MB). localStorage 저장을 건너뜁니다.`);
        return;
      }
      
      // 기존 캐시 정리 (용량 부족 시)
      if (localStorage.length > 100) { // 100개 이상이면 정리
        clientCacheUtils.cleanup();
      }
      
      localStorage.setItem(`cache_${key}`, JSON.stringify({
        data,
        timestamp: now,
        ttl: now + ttl
      }));
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage 용량 초과. 캐시를 정리합니다.');
        clientCacheUtils.cleanup();
        // 다시 시도
        try {
          localStorage.setItem(`cache_${key}`, JSON.stringify({
            data,
            timestamp: now,
            ttl: now + ttl
          }));
        } catch (retryError) {
          console.warn('localStorage 저장 재시도 실패:', retryError);
        }
      } else {
      console.warn('localStorage 저장 실패:', error);
      }
    }
  },
  
  // 캐시에서 데이터 가져오기
  get: (key) => {
    // 메모리 캐시에서 먼저 확인
    const memoryItem = clientCache.get(key);
    if (memoryItem) {
      const now = Date.now();
      if (now <= memoryItem.ttl) {
        return memoryItem.data;
      } else {
        clientCache.delete(key);
      }
    }
    
    // localStorage에서 확인
    try {
      const storedItem = localStorage.getItem(`cache_${key}`);
      if (storedItem) {
        const item = JSON.parse(storedItem);
        const now = Date.now();
        if (now <= item.ttl) {
          // 메모리 캐시에도 저장
          clientCache.set(key, item);
          return item.data;
        } else {
          localStorage.removeItem(`cache_${key}`);
        }
      }
    } catch (error) {
      console.warn('localStorage 읽기 실패:', error);
    }
    
    return null;
  },
  
  // 캐시 삭제
  delete: (key) => {
    clientCache.delete(key);
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn('localStorage 삭제 실패:', error);
    }
  },
  
  // 캐시 정리
  cleanup: () => {
    const now = Date.now();
    
    // 메모리 캐시 정리
    for (const [key, item] of clientCache.entries()) {
      if (now > item.ttl) {
        clientCache.delete(key);
      }
    }
    
    // localStorage 정리
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          const storedItem = localStorage.getItem(key);
          if (storedItem) {
            const item = JSON.parse(storedItem);
            if (now > item.ttl) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      console.warn('localStorage 정리 실패:', error);
    }
  }
};

// 주기적 캐시 정리 (5분마다)
setInterval(() => {
  clientCacheUtils.cleanup();
}, 5 * 60 * 1000);

// 전역 객체로 노출 (디버깅용)
if (typeof window !== 'undefined') {
  window.clientCacheUtils = clientCacheUtils;
}

export async function fetchData(includeShipped = true, timestamp = null) {
  // 타임스탬프가 있으면 캐시 무효화
  const cacheKey = timestamp ? `stores_data_${includeShipped}_${timestamp}` : `stores_data_${includeShipped}`;
  
  // 타임스탬프가 없는 경우에만 캐시 확인
  if (!timestamp) {
    const cachedData = clientCacheUtils.get(cacheKey);
    if (cachedData) {
      // console.log('캐시된 매장 데이터 사용');
      return { success: true, data: cachedData };
    }
  }
  
  try {
    // console.log(`서버에서 매장 데이터 요청 중... (includeShipped: ${includeShipped})`);
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/api/stores?includeShipped=${includeShipped}`);
    const data = await response.json();
    
    const fetchTime = Date.now() - startTime;
    // console.log(`매장 데이터 요청 완료: ${fetchTime}ms, 받은 매장 수: ${data.length}개`);

    // inventory 필드를 phoneData로 변환
    const processedData = data.map(store => {
      // inventory 데이터를 phoneData 배열로 변환
      let phoneData = [];
      
      if (store.inventory && typeof store.inventory === 'object') {
        // 각 모델에 대해
        Object.entries(store.inventory).forEach(([model, colorData]) => {
          // 각 색상에 대해
          if (typeof colorData === 'object' && colorData !== null) {
            Object.entries(colorData).forEach(([color, quantity]) => {
              // quantity가 있는 경우에만 추가
              if (quantity && quantity > 0) {
                phoneData.push({
                  N: store.name,    // 매장명
                  F: model,         // 모델명
                  G: color,         // 색상
                  quantity: Number(quantity)  // 수량
                });
              }
            });
          }
        });
      }

      // phoneCount 계산 (모든 모델의 수량 합계)
      const phoneCount = phoneData.reduce((sum, item) => sum + (item.quantity || 0), 0);

      return {
        ...store,
        phoneData,
        phoneCount,
        hasInventory: phoneCount > 0
      };
    });

    // 캐시에 저장
    clientCacheUtils.set(cacheKey, processedData);
    
    const totalTime = Date.now() - startTime;
    // console.log(`전체 처리 완료: ${totalTime}ms`);

    return { success: true, data: processedData };
  } catch (error) {
    console.error('데이터 가져오기 오류:', error);
    return { success: false, error };
  }
}

export async function fetchModels() {
  const cacheKey = 'models_data';
  
  // 캐시에서 먼저 확인
  const cachedData = clientCacheUtils.get(cacheKey);
  if (cachedData) {
    // console.log('캐시된 모델 데이터 사용');
    return { success: true, data: cachedData };
  }
  
  try {
    // console.log('서버에서 모델 데이터 요청 중...');
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/api/models`);
    const data = await response.json();
    
    const fetchTime = Date.now() - startTime;
    // console.log(`모델 데이터 요청 완료: ${fetchTime}ms`);
    // console.log('서버로부터 받은 모델 데이터:', data);

    // 캐시에 저장
    clientCacheUtils.set(cacheKey, data);
    
    const totalTime = Date.now() - startTime;
    // console.log(`전체 처리 완료: ${totalTime}ms`);

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching models:', error);
    return { success: false, error };
  }
}

/**
 * 대리점 정보를 가져오는 함수
 * @returns {Promise<Array>} 대리점 정보 배열
 */
export const fetchAgentData = async () => {
  const cacheKey = 'agents_data';
  
  // 캐시에서 먼저 확인
  const cachedData = clientCacheUtils.get(cacheKey);
  if (cachedData) {
    // console.log('캐시된 대리점 데이터 사용');
    return cachedData;
  }
  
  try {
    // console.log('서버에서 대리점 데이터 요청 중...');
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/api/agents`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch agent data');
    }
    
    const data = await response.json();
    
    const fetchTime = Date.now() - startTime;
    // console.log(`대리점 데이터 요청 완료: ${fetchTime}ms`);
    
    // 캐시에 저장
    clientCacheUtils.set(cacheKey, data);
    
    const totalTime = Date.now() - startTime;
    // console.log(`전체 처리 완료: ${totalTime}ms`);
    
    return data;
  } catch (error) {
    console.error('Error fetching agent data:', error);
    return [];
  }
};

// 재고장표 API
export const inventoryAPI = {
  // 모델별 재고 현황
  getInventoryStatus: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.agent) params.append('agent', filters.agent);
    if (filters.office) params.append('office', filters.office);
    if (filters.department) params.append('department', filters.department);
    
    const response = await fetch(`${API_BASE_URL}/api/inventory/status?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },
  
  // 색상별 재고 현황
  getInventoryStatusByColor: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.agent) params.append('agent', filters.agent);
    if (filters.office) params.append('office', filters.office);
    if (filters.department) params.append('department', filters.department);
    
    const response = await fetch(`${API_BASE_URL}/api/inventory/status-by-color?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },
  
  // 운영모델 순서 가져오기
  getOperationModels: async () => {
    const response = await fetch(`${API_BASE_URL}/api/operation-models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  },
  
  // 재고장표 담당자 필터 옵션 가져오기 (실제 재고가 있는 담당자만)
  getAgentFilters: async () => {
    const response = await fetch(`${API_BASE_URL}/api/inventory/agent-filters`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  }
};

// 캐시 관리 함수들
export const cacheManager = {
  // 캐시 상태 확인
  getStatus: () => {
    const now = Date.now();
    const validItems = Array.from(clientCache.entries()).filter(([key, item]) => now <= item.ttl);
    return {
      memory: {
        total: clientCache.size,
        valid: validItems.length,
        expired: clientCache.size - validItems.length
      },
      localStorage: (() => {
        try {
          let cacheCount = 0;
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('cache_')) {
              cacheCount++;
            }
          }
          return { total: cacheCount };
        } catch (error) {
          return { total: 0, error: error.message };
        }
      })()
    };
  },
  
  // 캐시 정리
  cleanup: () => {
    clientCacheUtils.cleanup();
    console.log('클라이언트 캐시 정리 완료');
  },
  
  // 특정 캐시 삭제
  delete: (key) => {
    clientCacheUtils.delete(key);
    console.log(`캐시 삭제 완료: ${key}`);
  },
  
  // 전체 캐시 삭제
  clearAll: () => {
    clientCache.clear();
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.warn('localStorage 전체 삭제 실패:', error);
    }
    console.log('전체 캐시 삭제 완료');
  }
}; 

// 예산 대상월 관리 API
export const budgetSummaryAPI = {
  // 액면예산 종합 계산
  getSummary: async (targetMonth, userId) => {
    const url = userId 
      ? `${API_BASE_URL}/api/budget/summary/${targetMonth}?userId=${userId}`
      : `${API_BASE_URL}/api/budget/summary/${targetMonth}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('액면예산 종합 계산에 실패했습니다.');
    }
    return response.json();
  },
};

export const budgetMonthSheetAPI = {
  // 월별 시트 ID 목록 조회
  getMonthSheets: async () => {
    const response = await fetch(`${API_BASE_URL}/api/budget/month-sheets`);
    if (!response.ok) {
      throw new Error('월별 시트 ID 조회에 실패했습니다.');
    }
    return response.json();
  },

  // 월별 시트 ID 저장/수정
  saveMonthSheet: async (month, sheetId, updatedBy) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/month-sheets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ month, sheetId, updatedBy }),
    });
    if (!response.ok) {
      throw new Error('월별 시트 ID 저장에 실패했습니다.');
    }
    return response.json();
  },

  // 월별 시트 ID 삭제
  deleteMonthSheet: async (month) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/month-sheets/${month}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('월별 시트 ID 삭제에 실패했습니다.');
    }
    return response.json();
  },
};

export const budgetUserSheetAPI = {
  // 사용자별 시트 목록 조회 (새 API 사용)
  getUserSheets: async (userId, targetMonth, showAllUsers = false, budgetType = null) => {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (targetMonth) params.append('targetMonth', targetMonth);
    if (showAllUsers) params.append('showAllUsers', 'true');
    if (budgetType && budgetType !== '종합') params.append('budgetType', budgetType); // '종합'은 모든 타입 표시
    
    const url = `${API_BASE_URL}/api/budget/user-sheets-v2?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('사용자 시트 조회에 실패했습니다.');
    }
    return response.json();
  },

  // 사용자별 시트 목록 조회 (레거시)
  getUserSheetsLegacy: async (userId, targetMonth, showAllUsers = false) => {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (targetMonth) params.append('targetMonth', targetMonth);
    if (showAllUsers) params.append('showAllUsers', 'true');
    
    const url = `${API_BASE_URL}/api/budget/user-sheets?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('사용자 시트 조회에 실패했습니다.');
    }
    return response.json();
  },

  // 사용자 시트 삭제 (새로 추가)
  deleteUserSheet: async (uuid, userId) => {
    const params = new URLSearchParams();
    params.append('userId', userId);
    
    const response = await fetch(`${API_BASE_URL}/api/budget/user-sheets-v2/${uuid}?${params.toString()}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error('사용자 시트 삭제에 실패했습니다.');
    }
    return response.json();
  },

  // 사용자별 시트 생성 (새 API 사용)
  createUserSheet: async (userId, userName, targetMonth, selectedPolicyGroups, budgetType, dateRange) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/user-sheets-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, userName, targetMonth, selectedPolicyGroups, budgetType, dateRange }),
    });
    if (!response.ok) {
      throw new Error('사용자 시트 생성에 실패했습니다.');
    }
    return response.json();
  },

  // 사용자별 시트 생성 (레거시)
  createUserSheetLegacy: async (userId, userName, targetMonth, selectedPolicyGroups, budgetType) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/user-sheets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, userName, targetMonth, selectedPolicyGroups, budgetType }),
    });
    if (!response.ok) {
      throw new Error('사용자 시트 생성에 실패했습니다.');
    }
    return response.json();
  },

  // 예산 데이터 저장 (userLevel, budgetAmounts, budgetType 파라미터 추가)
  saveBudgetData: async (sheetId, data, dateRange, userName, userLevel, budgetAmounts, budgetType) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/user-sheets/${sheetId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data, dateRange, userName, userLevel, budgetAmounts, budgetType }),
    });
    if (!response.ok) {
      throw new Error('예산 데이터 저장에 실패했습니다.');
    }
    return response.json();
  },

  // 예산 데이터 불러오기
  loadBudgetData: async (sheetId, userName, currentUserId, budgetType) => {
    const params = new URLSearchParams();
    params.append('userName', userName);
    if (currentUserId) params.append('currentUserId', currentUserId);
    if (budgetType) params.append('budgetType', budgetType);
    
    const response = await fetch(`${API_BASE_URL}/api/budget/user-sheets/${sheetId}/data?${params.toString()}`);
    if (!response.ok) {
      throw new Error('예산 데이터 불러오기에 실패했습니다.');
    }
    return response.json();
  },

  // 사용자 시트의 사용예산을 액면예산에서 안전하게 업데이트
  updateUserSheetUsage: async (sheetId, selectedPolicyGroups, dateRange, userName, budgetType) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/user-sheets/${sheetId}/update-usage-safe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ selectedPolicyGroups, dateRange, userName, budgetType }),
    });
    if (!response.ok) {
      throw new Error(`사용예산 업데이트 실패: ${response.status}`);
    }
    return response.json();
  },

  // 레거시 사용예산 업데이트 (필요시 사용)
  updateUserSheetUsageLegacy: async (sheetId, selectedPolicyGroups, dateRange, userName, budgetType) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/user-sheets/${sheetId}/update-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ selectedPolicyGroups, dateRange, userName, budgetType }),
    });
    if (!response.ok) {
      throw new Error('사용자 시트 사용예산 업데이트에 실패했습니다.');
    }
    return response.json();
  },
}; 

// 정책그룹 관련 API
export const budgetPolicyGroupAPI = {
  // 정책그룹 목록 가져오기
  getPolicyGroups: async () => {
    const response = await fetch(`${API_BASE_URL}/api/budget/policy-groups`);
    if (!response.ok) {
      throw new Error('정책그룹 목록 조회에 실패했습니다.');
    }
    return response.json();
  },

  // 정책그룹 설정 저장
  savePolicyGroupSettings: async (name, selectedGroups) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/policy-group-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, selectedGroups }),
    });
    if (!response.ok) {
      throw new Error('정책그룹 설정 저장에 실패했습니다.');
    }
    return response.json();
  },

  // 정책그룹 설정 목록 가져오기
  getPolicyGroupSettings: async () => {
    const response = await fetch(`${API_BASE_URL}/api/budget/policy-group-settings`);
    if (!response.ok) {
      throw new Error('정책그룹 설정 목록 조회에 실패했습니다.');
    }
    return response.json();
  },

  // 정책그룹 설정 삭제
  deletePolicyGroupSettings: async (name) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/policy-group-settings/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('정책그룹 설정 삭제에 실패했습니다.');
    }
    return response.json();
  },

  // 사용예산 계산
  calculateUsage: async (sheetId, selectedPolicyGroups, dateRange, userName, budgetType) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/calculate-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheetId, selectedPolicyGroups, dateRange, userName, budgetType }),
    });
    if (!response.ok) {
      throw new Error('사용예산 계산에 실패했습니다.');
    }
    return response.json();
  },

  // 기본구두 데이터 가져오기
  getBasicShoeData: async (sheetId, policyGroups) => {
    const params = new URLSearchParams();
    if (sheetId) params.append('sheetId', sheetId);
    if (policyGroups && policyGroups.length > 0) params.append('policyGroups', policyGroups.join(','));
    
    const response = await fetch(`${API_BASE_URL}/api/budget/basic-shoe?${params.toString()}`);
    if (!response.ok) {
      throw new Error('기본구두 데이터 조회에 실패했습니다.');
    }
    return response.json();
  },

  // 기본구두 생성 목록 저장
  saveBasicShoeCreationList: async (sheetId, policyGroups, totalAmount, userName) => {
    const response = await fetch(`${API_BASE_URL}/api/budget/basic-shoe/save-creation-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheetId, policyGroups, totalAmount, userName }),
    });
    if (!response.ok) {
      throw new Error('기본구두 생성 목록 저장에 실패했습니다.');
    }
    return response.json();
  },

  // 기본구두 생성 목록 조회
  getBasicShoeCreationList: async (sheetId) => {
    const params = new URLSearchParams();
    if (sheetId) params.append('sheetId', sheetId);
    
    const response = await fetch(`${API_BASE_URL}/api/budget/basic-shoe/creation-list?${params.toString()}`);
    if (!response.ok) {
      throw new Error('기본구두 생성 목록 조회에 실패했습니다.');
    }
    return response.json();
  },
};

// 재고회수모드 API
export const inventoryRecoveryAPI = {
  // 재고회수 데이터 조회
  getData: async () => {
    console.log('🔍 [재고회수 API] 프론트엔드에서 데이터 조회 시작');
    console.log('🔍 [재고회수 API] API URL:', `${API_BASE_URL}/api/inventory-recovery/data`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory-recovery/data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('🔍 [재고회수 API] 응답 상태:', response.status, response.statusText);
      console.log('🔍 [재고회수 API] 응답 헤더:', response.headers);
      
      if (!response.ok) {
        console.error('❌ [재고회수 API] HTTP 에러:', response.status, response.statusText);
        throw new Error('재고회수 데이터 조회에 실패했습니다.');
      }
      
      const data = await response.json();
      console.log('🔍 [재고회수 API] 응답 데이터:', data);
      console.log('🔍 [재고회수 API] 데이터 길이:', data.data?.length || 0);
      
      return data;
    } catch (error) {
      console.error('❌ [재고회수 API] 데이터 조회 오류:', error);
      console.error('❌ [재고회수 API] 에러 스택:', error.stack);
      throw error;
    }
  },

  // 재고회수 상태 업데이트
  updateStatus: async (rowIndex, column, value) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/inventory-recovery/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex,
          column,
          value
        }),
      });
      
      if (!response.ok) {
        throw new Error('재고회수 상태 업데이트에 실패했습니다.');
      }
      
      return await response.json();
    } catch (error) {
      console.error('재고회수 상태 업데이트 오류:', error);
      throw error;
    }
  }
}; 