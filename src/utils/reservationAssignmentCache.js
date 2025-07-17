// 사전예약 배정 캐시 시스템
class ReservationAssignmentCache {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultExpiry = 5 * 60 * 1000; // 5분
    this.maxCacheSize = 100; // 최대 캐시 항목 수
  }

  // 캐시 키 생성
  generateKey(type, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}:${JSON.stringify(params[key])}`)
      .join('|');
    return `${type}:${paramString}`;
  }

  // 캐시에 데이터 저장
  set(key, data, expiry = this.defaultExpiry) {
    // 캐시 크기 제한 확인
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + expiry);
  }

  // 캐시에서 데이터 조회
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const expiry = this.cacheExpiry.get(key);
    if (Date.now() > expiry) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  // 캐시에서 데이터 삭제
  delete(key) {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  // 가장 오래된 캐시 항목 제거
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (expiry < oldestTime) {
        oldestTime = expiry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  // 만료된 캐시 정리
  cleanup() {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.delete(key);
      }
    }
  }

  // 특정 타입의 캐시만 삭제
  clearByType(type) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${type}:`)) {
        this.delete(key);
      }
    }
  }

  // 전체 캐시 클리어
  clear() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  // 캐시 상태 정보
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 전역 캐시 인스턴스
const reservationCache = new ReservationAssignmentCache();

// 캐시된 API 호출 함수들
export const cachedApiCall = async (url, options = {}, cacheKey, expiry = 5 * 60 * 1000) => {
  const key = reservationCache.generateKey('api', { url, cacheKey });
  
  // 캐시에서 확인
  const cached = reservationCache.get(key);
  if (cached) {
    console.log(`✅ 캐시에서 데이터 로드: ${cacheKey}`);
    return cached;
  }

  // API 호출
  console.log(`🔄 API 호출: ${cacheKey}`);
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 캐시에 저장
    reservationCache.set(key, data, expiry);
    console.log(`💾 캐시에 데이터 저장: ${cacheKey}`);
    
    return data;
  } catch (error) {
    console.error(`❌ API 호출 실패: ${cacheKey}`, error);
    throw error;
  }
};

// 캐시된 데이터 처리 함수들
export const cachedDataProcessor = (processor, cacheKey, expiry = 10 * 60 * 1000) => {
  return async (...args) => {
    const key = reservationCache.generateKey('processor', { cacheKey, args: JSON.stringify(args) });
    
    // 캐시에서 확인
    const cached = reservationCache.get(key);
    if (cached) {
      console.log(`✅ 캐시에서 처리된 데이터 로드: ${cacheKey}`);
      return cached;
    }

    // 데이터 처리
    console.log(`🔄 데이터 처리 중: ${cacheKey}`);
    try {
      const result = await processor(...args);
      
      // 캐시에 저장
      reservationCache.set(key, result, expiry);
      console.log(`💾 캐시에 처리된 데이터 저장: ${cacheKey}`);
      
      return result;
    } catch (error) {
      console.error(`❌ 데이터 처리 실패: ${cacheKey}`, error);
      throw error;
    }
  };
};

// 계층 구조 캐시
export const getCachedHierarchicalStructure = cachedDataProcessor(
  async (agents, data) => {
    const structure = {
      offices: {},
      departments: {},
      agents: {},
      stores: {}
    };

    // 유효한 담당자만 필터링
    const validAgents = agents.filter(agent => 
      agent.office && agent.office.trim() !== '' && 
      agent.department && agent.department.trim() !== ''
    );

    validAgents.forEach(agent => {
      const office = agent.office.trim();
      const department = agent.department.trim();
      const agentId = agent.contactId;

      // 사무실별 구조
      if (!structure.offices[office]) {
        structure.offices[office] = {
          departments: new Set(),
          agents: new Set(),
          stores: new Set()
        };
      }
      structure.offices[office].departments.add(department);
      structure.offices[office].agents.add(agentId);

      // 소속별 구조
      if (!structure.departments[department]) {
        structure.departments[department] = {
          office: office,
          agents: new Set(),
          stores: new Set()
        };
      }
      structure.departments[department].agents.add(agentId);

      // 영업사원별 구조
      structure.agents[agentId] = {
        name: agent.target,
        office: office,
        department: department,
        stores: new Set()
      };
    });

    // 매장별 구조 (담당자별 정리 데이터에서 가져오기)
    if (data && data.byAgent) {
      Object.entries(data.byAgent).forEach(([agentName, agentData]) => {
        // 담당자 ID 찾기
        const agent = validAgents.find(a => a.target === agentName);
        if (agent) {
          const agentId = agent.contactId;
          
          // 해당 담당자의 매장들 추가
          Object.keys(agentData).forEach(posName => {
            // 매장별 구조에 추가
            if (!structure.stores[posName]) {
              structure.stores[posName] = {
                agents: new Set()
              };
            }
            structure.stores[posName].agents.add(agentId);
            
            // 담당자별 구조에 매장 추가
            if (structure.agents[agentId]) {
              structure.agents[agentId].stores.add(posName);
            }
            
            // 소속별 구조에 매장 추가
            const department = agent.department;
            if (structure.departments[department]) {
              structure.departments[department].stores.add(posName);
            }
            
            // 사무실별 구조에 매장 추가
            const office = agent.office;
            if (structure.offices[office]) {
              structure.offices[office].stores.add(posName);
            }
          });
        }
      });
    }

    return structure;
  },
  'hierarchicalStructure',
  15 * 60 * 1000 // 15분
);

// 모델 데이터 캐시
export const getCachedAvailableModels = cachedDataProcessor(
  async () => {
    const { extractAvailableModels } = await import('./reservationAssignmentUtils');
    return await extractAvailableModels();
  },
  'availableModels',
  10 * 60 * 1000 // 10분
);

// 담당자 데이터 캐시
export const getCachedAgents = cachedDataProcessor(
  async (apiUrl) => {
    const response = await fetch(`${apiUrl}/api/agents`);
    if (!response.ok) {
      throw new Error(`담당자 API 호출 실패: ${response.status}`);
    }
    return await response.json();
  },
  'agents',
  5 * 60 * 1000 // 5분
);

// 매장 데이터 캐시
export const getCachedStores = cachedDataProcessor(
  async (data, apiUrl) => {
    if (data && data.byAgent) {
      // 담당자별 정리 데이터에서 매장 목록 추출
      const storeSet = new Set();
      Object.values(data.byAgent).forEach(agentData => {
        Object.keys(agentData).forEach(posName => {
          if (posName && posName !== '미지정') {
            storeSet.add(posName);
          }
        });
      });
      
      return Array.from(storeSet).map(storeName => ({
        id: storeName,
        name: storeName
      }));
    } else {
      // API에서 직접 가져오기
      const response = await fetch(`${apiUrl}/api/stores`);
      if (!response.ok) {
        throw new Error(`매장 API 호출 실패: ${response.status}`);
      }
      const responseData = await response.json();
      return responseData.stores || [];
    }
  },
  'stores',
  5 * 60 * 1000 // 5분
);

// 배정 계산 결과 캐시
export const getCachedAssignmentCalculation = cachedDataProcessor(
  async (settings, targets, progressCallback) => {
    const { calculateReservationAssignment } = await import('./reservationAssignmentUtils');
    return await calculateReservationAssignment(settings, targets, progressCallback);
  },
  'assignmentCalculation',
  2 * 60 * 1000 // 2분
);

// 캐시 관리 함수들
export const clearReservationCache = (type = null) => {
  if (type) {
    reservationCache.clearByType(type);
    console.log(`🧹 ${type} 타입 캐시 클리어 완료`);
  } else {
    reservationCache.clear();
    console.log('🧹 전체 캐시 클리어 완료');
  }
};

export const getCacheStats = () => {
  return reservationCache.getStats();
};

export const cleanupExpiredCache = () => {
  reservationCache.cleanup();
  console.log('🧹 만료된 캐시 정리 완료');
};

// 주기적 캐시 정리 (5분마다)
setInterval(cleanupExpiredCache, 5 * 60 * 1000);

export default reservationCache; 