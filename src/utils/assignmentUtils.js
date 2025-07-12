// 배정 로직 유틸리티 함수들

// 캐시 관리
const calculationCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 캐시 키 생성
const generateCacheKey = (agents, settings, modelName) => {
  const agentIds = agents.map(a => a.contactId).sort().join(',');
  const settingsHash = JSON.stringify(settings);
  return `${agentIds}_${settingsHash}_${modelName}`;
};

// 캐시에서 데이터 가져오기
const getFromCache = (key) => {
  const cached = calculationCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

// 캐시에 데이터 저장
const setCache = (key, data) => {
  calculationCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// 배정 설정 가져오기
export const getAssignmentSettings = () => {
  const savedSettings = localStorage.getItem('assignmentSettings');
  return savedSettings ? JSON.parse(savedSettings) : {
    ratios: {
      turnoverRate: 30,
      storeCount: 25,
      remainingInventory: 25,
      salesVolume: 20
    },
    models: {},
    targets: {
      offices: {},
      departments: {},
      agents: {}
    }
  };
};

// 선택된 배정 대상 필터링
export const getSelectedTargets = (agents, settings) => {
  const { targets } = settings;
  
  // 선택된 사무실과 소속
  const selectedOffices = Object.keys(targets.offices).filter(key => targets.offices[key]);
  const selectedDepartments = Object.keys(targets.departments).filter(key => targets.departments[key]);
  const selectedAgentIds = Object.keys(targets.agents).filter(key => targets.agents[key]);
  
  console.log('선택된 사무실:', selectedOffices);
  console.log('선택된 소속:', selectedDepartments);
  console.log('선택된 영업사원 ID:', selectedAgentIds);
  
  // 조건에 맞는 영업사원 필터링
  const eligibleAgents = agents.filter(agent => {
    // 영업사원별 선택이 되어 있는지 확인
    const isAgentSelected = selectedAgentIds.includes(agent.contactId);
    
    // 사무실 또는 소속이 선택되어 있는지 확인
    const isOfficeSelected = selectedOffices.includes(agent.office);
    const isDepartmentSelected = selectedDepartments.includes(agent.department);
    
    // 영업사원이 선택되어 있으면 포함 (사무실/소속 선택 여부와 무관)
    if (isAgentSelected) {
      return true;
    }
    
    // 영업사원이 선택되지 않았지만, 사무실과 소속이 모두 선택된 경우 포함
    return isOfficeSelected && isDepartmentSelected;
  });
  
  console.log('배정 대상 영업사원:', eligibleAgents.length, '명');
  console.log('배정 대상 상세:', eligibleAgents.map(a => ({ name: a.target, office: a.office, department: a.department })));
  
  return {
    selectedOffices,
    selectedDepartments,
    selectedAgentIds,
    eligibleAgents
  };
};

// 담당자명 정규화 함수 (괄호 제거)
function normalizeAgentName(agentName) {
  if (!agentName || typeof agentName !== 'string') return agentName;
  // 괄호와 그 안의 내용 제거 (예: "홍기현(별도)" → "홍기현")
  return agentName.replace(/\s*\([^)]*\)/g, '').trim();
}

// 거래처수 0인 인원을 배정목록에서 제거하는 함수
export const filterAgentsByStoreCount = async (agents, storeData) => {
  const filteredAgents = [];
  
  for (const agent of agents) {
    let storeCount = 0;
    
    // storeData에서 해당 담당자가 관리하는 매장 수 계산 (정규화 적용)
    if (storeData && Array.isArray(storeData)) {
      const normalizedAgentName = normalizeAgentName(agent.target);
      const uniqueStoreIds = new Set();
      
      // 정규화된 이름과 매칭되는 모든 담당자의 매장을 수집
      storeData.forEach(store => {
        const storeManagerNormalized = normalizeAgentName(store.manager);
        const store담당자Normalized = normalizeAgentName(store.담당자);
        
        if (storeManagerNormalized === normalizedAgentName || 
            store담당자Normalized === normalizedAgentName) {
          uniqueStoreIds.add(store.id || store.name);
        }
      });
      
      storeCount = uniqueStoreIds.size;
      
      // 김수빈의 경우 더 상세한 로그
      if (agent.target === '김수빈') {
        const matchingStores = storeData.filter(store => 
          store.manager === agent.target || 
          store.담당자 === agent.target ||
          store.name === agent.target
        );
        console.log('🚨 김수빈 매장 매칭 결과:', {
          totalStores: storeData.length,
          matchingStores: matchingStores.map(store => ({
            name: store.name,
            manager: store.manager,
            담당자: store.담당자,
            matchType: store.manager === agent.target ? 'manager' : 
                      store.담당자 === agent.target ? '담당자' : 
                      store.name === agent.target ? 'name' : 'none'
          })),
          storeCount
        });
      }
    }
    
    // storeData가 없거나 매장 정보가 없는 경우 개통실적 데이터에서 추정 (정규화 적용)
    if (storeCount === 0) {
      try {
        const activationData = await loadActivationDataBatch();
        const normalizedAgentName = normalizeAgentName(agent.target);
        const uniqueStores = new Set();
        
        // 정규화된 이름과 매칭되는 모든 담당자의 개통실적에서 출고처 수집 (Map 객체 처리)
        if (activationData.current instanceof Map) {
          // Map 객체인 경우 entries() 메서드 사용
          for (const [agentName, records] of activationData.current.entries()) {
            const agentNameNormalized = normalizeAgentName(agentName);
            if (agentNameNormalized === normalizedAgentName) {
              records.forEach(record => {
                const storeName = record['출고처'];
                if (
                  storeName &&
                  typeof storeName === 'string' &&
                  storeName.trim() !== '' &&
                  storeName !== '-' &&
                  storeName !== '미지정' &&
                  storeName !== '미정' &&
                  storeName !== '기타' &&
                  storeName !== '없음' &&
                  storeName !== '0' &&
                  storeName.trim() !== '0'
                ) {
                  uniqueStores.add(storeName.trim());
                }
              });
            }
          }
        } else {
          // 일반 객체인 경우 Object.entries() 사용
          Object.entries(activationData.current).forEach(([agentName, records]) => {
            const agentNameNormalized = normalizeAgentName(agentName);
            if (agentNameNormalized === normalizedAgentName) {
              records.forEach(record => {
                const storeName = record['출고처'];
                if (
                  storeName &&
                  typeof storeName === 'string' &&
                  storeName.trim() !== '' &&
                  storeName !== '-' &&
                  storeName !== '미지정' &&
                  storeName !== '미정' &&
                  storeName !== '기타' &&
                  storeName !== '없음' &&
                  storeName !== '0' &&
                  storeName.trim() !== '0'
                ) {
                  uniqueStores.add(storeName.trim());
                }
              });
            }
          });
        }
        storeCount = uniqueStores.size;
        
        console.log(`🔍 ${agent.target} 정규화된 거래처수 계산:`, {
          원본담당자: agent.target,
          정규화된이름: normalizedAgentName,
          고유매장수: storeCount,
          매장목록: Array.from(uniqueStores)
        });
        
        // 김수빈인 경우 더 자세한 정보 출력
        if (agent.target === '김수빈') {
          console.log('🚨 김수빈 정규화된 상세 거래처 정보:', {
            원본담당자: agent.target,
            정규화된이름: normalizedAgentName,
            고유매장수: storeCount,
            매장목록: Array.from(uniqueStores)
          });
        }
      } catch (error) {
        console.error(`거래처수 계산 중 오류 (${agent.target}):`, error);
        storeCount = 0;
      }
    }
    
    // 거래처수가 0보다 큰 경우만 포함
    if (storeCount > 0) {
      filteredAgents.push(agent);
      console.log(`✅ ${agent.target} 정규화된 거래처수 ${storeCount}개로 배정목록에 포함`);
    } else {
      console.log(`❌ 정규화된 거래처수 0으로 배정목록에서 제외: ${agent.target} (${agent.office} ${agent.department})`);
    }
  }
  
  console.log(`정규화된 거래처수 필터링 결과: ${agents.length}명 → ${filteredAgents.length}명`);
  return filteredAgents;
};

// 개통실적 데이터 배치 로드 (성능 최적화)
let activationDataCache = null;
let activationDataTimestamp = 0;

const loadActivationDataBatch = async () => {
  const now = Date.now();
  
  // 캐시가 유효한 경우 캐시된 데이터 반환
  if (activationDataCache && (now - activationDataTimestamp) < CACHE_DURATION) {
    console.log('개통실적 데이터 캐시 사용');
    return activationDataCache;
  }
  
  try {
    const API_URL = process.env.REACT_APP_API_URL;
    console.log('개통실적 데이터 로딩 시작 - API_URL:', API_URL);
    
    // 백엔드에서 제공하는 구글 시트 기반 개통실적 데이터 API 사용
    const [currentMonthResponse, previousMonthResponse] = await Promise.all([
      fetch(`${API_URL}/api/activation-data/current-month`),
      fetch(`${API_URL}/api/activation-data/previous-month`)
    ]);
    
    console.log('개통실적 API 응답 상태:', {
      currentMonth: currentMonthResponse.status,
      previousMonth: previousMonthResponse.status
    });
    
    if (!currentMonthResponse.ok || !previousMonthResponse.ok) {
      throw new Error(`개통실적 데이터 API 호출 실패: ${currentMonthResponse.status} ${previousMonthResponse.status}`);
    }
    
    const currentMonthData = await currentMonthResponse.json();
    const previousMonthData = await previousMonthResponse.json();
    
    console.log('개통실적 데이터 로딩 결과:', {
      currentMonthRecords: currentMonthData.length,
      previousMonthRecords: previousMonthData.length,
      sampleCurrentRecord: currentMonthData[0],
      samplePreviousRecord: previousMonthData[0]
    });
    
    // 데이터를 인덱싱하여 빠른 검색 가능
    const indexedData = {
      current: new Map(),
      previous: new Map()
    };
    
    // 담당자별로 데이터 그룹화 (구글 시트 필드명 사용)
    currentMonthData.forEach(record => {
      const key = record['담당자'];
      if (key) {
        if (!indexedData.current.has(key)) {
          indexedData.current.set(key, []);
        }
        indexedData.current.get(key).push(record);
      }
    });
    
    previousMonthData.forEach(record => {
      const key = record['담당자'];
      if (key) {
        if (!indexedData.previous.has(key)) {
          indexedData.previous.set(key, []);
        }
        indexedData.previous.get(key).push(record);
      }
    });
    
    activationDataCache = indexedData;
    activationDataTimestamp = now;
    
    console.log('✅ 구글 시트 기반 개통실적 데이터 로드 완료:', {
      currentMonth: currentMonthData.length,
      previousMonth: previousMonthData.length,
      currentAgents: indexedData.current.size,
      previousAgents: indexedData.previous.size
    });
    
    return indexedData;
    
  } catch (error) {
    console.error('개통실적 데이터 로드 실패:', error);
    return { current: new Map(), previous: new Map() };
  }
};

// 색상별 원시 점수 계산 (정규화 전)
const calculateColorRawScore = async (agent, model, color, settings, storeData, modelData = null) => {
  const { ratios } = settings;
  
  try {
    // 배치로드된 개통실적 데이터 사용
    const activationData = await loadActivationDataBatch();
    
    // 정규화된 담당자명으로 개통실적 데이터 추출
    const normalizedAgentName = normalizeAgentName(agent.target);
    let agentCurrentData = [];
    let agentPreviousData = [];
    
    // 해당 정규화된 이름을 가진 모든 담당자의 개통실적을 합산 (Map 객체 처리)
    if (activationData.current instanceof Map) {
      // Map 객체인 경우 entries() 메서드 사용
      for (const [agentName, records] of activationData.current.entries()) {
        const agentNameNormalized = normalizeAgentName(agentName);
        if (agentNameNormalized === normalizedAgentName) {
          const filteredRecords = records.filter(record => record['개통'] !== '선불개통');
          agentCurrentData = agentCurrentData.concat(filteredRecords);
        }
      }
    } else {
      // 일반 객체인 경우 Object.entries() 사용
      Object.entries(activationData.current).forEach(([agentName, records]) => {
        const agentNameNormalized = normalizeAgentName(agentName);
        if (agentNameNormalized === normalizedAgentName) {
          const filteredRecords = records.filter(record => record['개통'] !== '선불개통');
          agentCurrentData = agentCurrentData.concat(filteredRecords);
        }
      });
    }
    
    if (activationData.previous instanceof Map) {
      // Map 객체인 경우 entries() 메서드 사용
      for (const [agentName, records] of activationData.previous.entries()) {
        const agentNameNormalized = normalizeAgentName(agentName);
        if (agentNameNormalized === normalizedAgentName) {
          const filteredRecords = records.filter(record => record['개통'] !== '선불개통');
          agentPreviousData = agentPreviousData.concat(filteredRecords);
        }
      }
    } else {
      // 일반 객체인 경우 Object.entries() 사용
      Object.entries(activationData.previous).forEach(([agentName, records]) => {
        const agentNameNormalized = normalizeAgentName(agentName);
        if (agentNameNormalized === normalizedAgentName) {
          const filteredRecords = records.filter(record => record['개통'] !== '선불개통');
          agentPreviousData = agentPreviousData.concat(filteredRecords);
        }
      });
    }
    
    console.log(`🔍 정규화된 담당자 "${normalizedAgentName}" (${agent.target}) 개통실적 데이터 수집:`, {
      원본담당자: agent.target,
      정규화된이름: normalizedAgentName,
      당월개통기록: agentCurrentData.length,
      전월개통기록: agentPreviousData.length
    });
    
    // 디버깅: 실제 데이터 구조 확인 (선불개통 제외 후)
    console.log(`🔍 ${agent.target} 데이터 구조 확인 (선불개통 제외):`, {
      currentMonthRecords: agentCurrentData.length,
      previousMonthRecords: agentPreviousData.length,
      sampleCurrentRecord: agentCurrentData[0],
      samplePreviousRecord: agentPreviousData[0],
      targetModel: model,
      targetColor: color,
      allCurrentRecords: agentCurrentData.slice(0, 3), // 처음 3개 레코드
      allPreviousRecords: agentPreviousData.slice(0, 3), // 처음 3개 레코드
      선불개통제외: '적용됨'
    });
    
    // 구글 시트 필드명 사용 (백엔드에서 이미 매핑됨)
    const modelColorCurrentData = agentCurrentData.filter(record => 
      record['모델명'] === model && 
      (record['색상'] === color || !record['색상']) // 색상 정보가 없으면 모델만으로 필터링
    );
    const modelColorPreviousData = agentPreviousData.filter(record => 
      record['모델명'] === model && 
      (record['색상'] === color || !record['색상'])
    );
    
    // 모델별 데이터 필터링 (색상별 데이터가 없을 경우 모델별로 계산)
    const modelCurrentData = agentCurrentData.filter(record => record['모델명'] === model);
    const modelPreviousData = agentPreviousData.filter(record => record['모델명'] === model);
    
    // 디버깅: 필터링된 데이터 확인
    console.log(`🔍 ${agent.target} 필터링된 데이터 확인:`, {
      modelColorCurrentData: modelColorCurrentData.slice(0, 2), // 처음 2개 레코드
      modelColorPreviousData: modelColorPreviousData.slice(0, 2), // 처음 2개 레코드
      modelCurrentData: modelCurrentData.slice(0, 2), // 처음 2개 레코드
      modelPreviousData: modelPreviousData.slice(0, 2) // 처음 2개 레코드
    });
    
    // 디버깅: 필터링 결과 확인
    console.log(`🔍 ${agent.target} (${model}-${color || '전체'}) 필터링 결과:`, {
      modelColorCurrentCount: modelColorCurrentData.length,
      modelColorPreviousCount: modelColorPreviousData.length,
      modelCurrentCount: modelCurrentData.length,
      modelPreviousCount: modelPreviousData.length,
      sampleModelColorRecord: modelColorCurrentData[0],
      sampleModelRecord: modelCurrentData[0]
    });
    
    // 개통 숫자 계산: 관리자모드와 동일한 구조로 '개통' 필드 합산
    const currentMonthSales = modelColorCurrentData.length > 0
      ? modelColorCurrentData.reduce((sum, record) => {
          // '개통' 필드가 숫자인 경우 그 값을, 아니면 1을 더함
          const activationValue = record['개통'];
          if (activationValue && !isNaN(parseInt(activationValue))) {
            return sum + parseInt(activationValue);
          } else {
            return sum + 1; // 개통 기록이 있으면 1개로 계산
          }
        }, 0)
      : modelCurrentData.reduce((sum, record) => {
          const activationValue = record['개통'];
          if (activationValue && !isNaN(parseInt(activationValue))) {
            return sum + parseInt(activationValue);
          } else {
            return sum + 1;
          }
        }, 0);
    
    const previousMonthSales = modelColorPreviousData.length > 0
      ? modelColorPreviousData.reduce((sum, record) => {
          const activationValue = record['개통'];
          if (activationValue && !isNaN(parseInt(activationValue))) {
            return sum + parseInt(activationValue);
          } else {
            return sum + 1;
          }
        }, 0)
      : modelPreviousData.reduce((sum, record) => {
          const activationValue = record['개통'];
          if (activationValue && !isNaN(parseInt(activationValue))) {
            return sum + parseInt(activationValue);
          } else {
            return sum + 1;
          }
        }, 0);
    
    const totalSales = currentMonthSales + previousMonthSales;
    
    // 디버깅: 개통 데이터 처리 결과 확인
    console.log(`🔍 ${agent.target} (${model}-${color || '전체'}) 개통 데이터 처리 결과:`, {
      currentMonthSales,
      previousMonthSales,
      totalSales,
      sampleCurrentRecord: modelColorCurrentData[0] || modelCurrentData[0],
      samplePreviousRecord: modelColorPreviousData[0] || modelPreviousData[0],
      currentMonthRecords: modelColorCurrentData.length || modelCurrentData.length,
      previousMonthRecords: modelColorPreviousData.length || modelPreviousData.length
    });
    
    // 디버깅: 개통 숫자 계산 결과 확인
    console.log(`🔍 ${agent.target} (${model}-${color || '전체'}) 개통 숫자 계산:`, {
      currentMonthSales,
      previousMonthSales,
      totalSales,
      currentMonthRecords: modelColorCurrentData.length > 0 ? modelColorCurrentData.length : modelCurrentData.length,
      previousMonthRecords: modelColorPreviousData.length > 0 ? modelColorPreviousData.length : modelPreviousData.length,
      calculationMethod: modelColorCurrentData.length > 0 ? '색상별 개통합' : '모델별 개통합'
    });
    
    // 재고 숫자 계산: 백엔드 API를 통해 담당자별 재고 데이터 가져오기
    let remainingInventory = 0;
    
    try {
      const API_URL = process.env.REACT_APP_API_URL;
      
      // 담당재고확인 모드로 매장 데이터 요청 (includeShipped=true)
      console.log(`🏪 ${agent.target} 재고 API 호출 시작:`, `${API_URL}/api/stores?includeShipped=true`);
      const storeResponse = await fetch(`${API_URL}/api/stores?includeShipped=true`);
      console.log(`🏪 ${agent.target} 재고 API 응답 상태:`, storeResponse.status);
      
      if (storeResponse.ok) {
        const allStores = await storeResponse.json();
        
        // 정규화된 담당자명으로 매장 필터링
        const agentStores = allStores.filter(store => {
          const storeManagerNormalized = normalizeAgentName(store.manager);
          const store담당자Normalized = normalizeAgentName(store.담당자);
          return storeManagerNormalized === normalizedAgentName || 
                 store담당자Normalized === normalizedAgentName;
        });
        
        console.log(`🏪 ${agent.target} 정규화된 담당재고확인 API 결과:`, {
          원본담당자: agent.target,
          정규화된이름: normalizedAgentName,
          totalStores: allStores.length,
          agentStoresCount: agentStores.length,
          agentStores: agentStores.map(store => ({
            name: store.name,
            manager: store.manager,
            담당자: store.담당자,
            hasInventory: !!store.inventory
          }))
        });
        
                  // 담당 매장의 재고에서 해당 모델명+색상의 수량을 합산
          let storeInventoryDetails = [];
          
          agentStores.forEach(store => {
            if (store.inventory) {
              let storeInventory = 0;
              
              // 카테고리별로 순회 (phones, wearables, tablets 등)
              Object.values(store.inventory).forEach(category => {
                if (typeof category === 'object' && category !== null) {
                  // 모델별로 순회
                  Object.entries(category).forEach(([categoryModel, modelData]) => {
                    if (categoryModel === model && typeof modelData === 'object' && modelData !== null) {
                      // 상태별로 순회 (정상, 이력, 불량)
                      Object.entries(modelData).forEach(([status, statusData]) => {
                        if (status === '정상' && typeof statusData === 'object' && statusData !== null) {
                          if (color) {
                            // 특정 색상의 재고
                            const colorData = statusData[color];
                            if (typeof colorData === 'object' && colorData && colorData.quantity) {
                              const qty = colorData.quantity || 0;
                              remainingInventory += qty;
                              storeInventory += qty;
                            }
                          } else {
                            // 모든 색상의 재고 합산
                            Object.values(statusData).forEach(colorData => {
                              if (typeof colorData === 'object' && colorData && colorData.quantity) {
                                const qty = colorData.quantity || 0;
                                remainingInventory += qty;
                                storeInventory += qty;
                              }
                            });
                          }
                        }
                      });
                    }
                  });
                }
              });
              
              if (storeInventory > 0) {
                storeInventoryDetails.push({
                  storeName: store.name,
                  inventory: storeInventory
                });
              }
            }
          });
          
                  console.log(`🏪 ${agent.target} (${model}-${color || '전체'}) 정규화된 재고 계산 상세:`, {
          원본담당자: agent.target,
          정규화된이름: normalizedAgentName,
          totalRemainingInventory: remainingInventory,
          storeInventoryDetails,
          targetModel: model,
          targetColor: color
        });
      } else {
        console.error(`재고 데이터 API 호출 실패: ${storeResponse.status}`);
        // API 호출 실패 시 기존 storeData 사용 (정규화 적용)
        if (storeData && Array.isArray(storeData)) {
          const agentStores = storeData.filter(store => {
            const storeManagerNormalized = normalizeAgentName(store.manager);
            const store담당자Normalized = normalizeAgentName(store.담당자);
            return storeManagerNormalized === normalizedAgentName || 
                   store담당자Normalized === normalizedAgentName;
          });
          
          agentStores.forEach(store => {
            if (store.inventory) {
              Object.values(store.inventory).forEach(category => {
                if (typeof category === 'object' && category !== null) {
                  Object.entries(category).forEach(([categoryModel, modelData]) => {
                    if (categoryModel === model && typeof modelData === 'object' && modelData !== null) {
                      Object.entries(modelData).forEach(([status, statusData]) => {
                        if (status === '정상' && typeof statusData === 'object' && statusData !== null) {
                          if (color) {
                            const colorData = statusData[color];
                            if (typeof colorData === 'object' && colorData && colorData.quantity) {
                              remainingInventory += colorData.quantity || 0;
                            }
                          } else {
                            Object.values(statusData).forEach(colorData => {
                              if (typeof colorData === 'object' && colorData && colorData.quantity) {
                                remainingInventory += colorData.quantity || 0;
                              }
                            });
                          }
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      }
    } catch (error) {
      console.error(`재고 데이터 가져오기 오류:`, error);
      // 오류 발생 시 기존 storeData 사용 (정규화 적용)
      if (storeData && Array.isArray(storeData)) {
        const agentStores = storeData.filter(store => {
          const storeManagerNormalized = normalizeAgentName(store.manager);
          const store담당자Normalized = normalizeAgentName(store.담당자);
          return storeManagerNormalized === normalizedAgentName || 
                 store담당자Normalized === normalizedAgentName;
        });
        
        agentStores.forEach(store => {
          if (store.inventory) {
            Object.values(store.inventory).forEach(category => {
              if (typeof category === 'object' && category !== null) {
                Object.entries(category).forEach(([categoryModel, modelData]) => {
                  if (categoryModel === model && typeof modelData === 'object' && modelData !== null) {
                    Object.entries(modelData).forEach(([status, statusData]) => {
                      if (status === '정상' && typeof statusData === 'object' && statusData !== null) {
                        if (color) {
                          const colorData = statusData[color];
                          if (typeof colorData === 'object' && colorData && colorData.quantity) {
                            remainingInventory += colorData.quantity || 0;
                          }
                        } else {
                          Object.values(statusData).forEach(colorData => {
                            if (typeof colorData === 'object' && colorData && colorData.quantity) {
                              remainingInventory += colorData.quantity || 0;
                            }
                          });
                        }
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    }
    
    // 디버깅: 재고 숫자 계산 결과 확인
    console.log(`🔍 ${agent.target} (${model}-${color || '전체'}) 정규화된 재고 숫자 계산:`, {
      원본담당자: agent.target,
      정규화된이름: normalizedAgentName,
      remainingInventory,
      storeDataAvailable: !!storeData,
      storeDataLength: storeData?.length || 0,
      modelDataAvailable: !!modelData,
      colorCount: modelData?.colors?.length,
      calculationMethod: color ? '색상별 합산' : '모델별 균등분배',
      sampleStoreInventory: storeData?.[0]?.inventory?.[model] || 'no inventory',
      allStoresWithModel: storeData?.filter(store => store.inventory?.[model]).length || 0,
      담당매장재고: '정규화된 백엔드 API 사용'
    });
    
    // 회전율 계산: ((전월개통 숫자+당월개통 숫자) / (재고 숫자 + (전월개통 숫자+당월개통 숫자))) * 100
    const turnoverRate = remainingInventory + totalSales > 0 
      ? (totalSales / (remainingInventory + totalSales)) * 100 
      : 0;
    
    // 디버깅: 회전율 계산 결과 확인
    console.log(`🔍 ${agent.target} (${model}-${color || '전체'}) 정규화된 회전율 계산:`, {
      원본담당자: agent.target,
      정규화된이름: normalizedAgentName,
      totalSales,
      remainingInventory,
      denominator: remainingInventory + totalSales,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      calculation: `${totalSales} / (${remainingInventory} + ${totalSales}) * 100 = ${Math.round(turnoverRate * 100) / 100}%`
    });
    
    // 거래처수 계산: 담당자가 관리하는 매장 수 (정규화 적용)
    let storeCount = 0;
    
    // storeData에서 해당 담당자가 관리하는 매장 수 계산 (정규화 적용)
    if (storeData && Array.isArray(storeData)) {
      const normalizedAgentName = normalizeAgentName(agent.target);
      const uniqueStoreIds = new Set();
      
      // 정규화된 이름과 매칭되는 모든 담당자의 매장을 수집
      storeData.forEach(store => {
        const storeManagerNormalized = normalizeAgentName(store.manager);
        const store담당자Normalized = normalizeAgentName(store.담당자);
        
        if (storeManagerNormalized === normalizedAgentName || 
            store담당자Normalized === normalizedAgentName) {
          uniqueStoreIds.add(store.id || store.name);
        }
      });
      
      storeCount = uniqueStoreIds.size;
      
      console.log(`🔍 ${agent.target} 정규화된 거래처수 계산:`, {
        원본담당자: agent.target,
        정규화된이름: normalizedAgentName,
        고유매장수: storeCount,
        매장목록: Array.from(uniqueStoreIds)
      });
    }
    
    // storeData가 없거나 매장 정보가 없는 경우 개통실적 데이터에서 추정
    if (storeCount === 0) {
      // 개통실적 데이터에서 고유한 출고처 수 추정 (빈 값, 의미없는 값, 0 등 제외)
      const uniqueStores = new Set();
      agentCurrentData.forEach(record => {
        const storeName = record['출고처'];
        if (
          storeName &&
          typeof storeName === 'string' &&
          storeName.trim() !== '' &&
          storeName !== '-' &&
          storeName !== '미지정' &&
          storeName !== '미정' &&
          storeName !== '기타' &&
          storeName !== '없음' &&
          storeName !== '0' &&
          storeName.trim() !== '0'
        ) {
          uniqueStores.add(storeName.trim());
        }
      });
      storeCount = uniqueStores.size;
      
      console.log(`🏪 ${agent.target} 거래처수 계산:`, {
        fromStoreData: storeData ? 'storeData에서 계산' : 'storeData 없음',
        fromActivationData: uniqueStores.size,
        uniqueStores: Array.from(uniqueStores),
        finalStoreCount: storeCount
      });
    }
    const salesVolume = totalSales; // 판매량 = 전월개통 숫자+당월개통 숫자
    
    // 잔여재고 점수 계산: (판매량 - 잔여재고) (숫자가 높을수록 배정량 높음)
    const inventoryScore = salesVolume - remainingInventory;
    
    // 디버깅: 잔여재고 점수 계산 결과 확인
    console.log(`🔍 ${agent.target} (${model}-${color || '전체'}) 잔여재고 점수 계산:`, {
      salesVolume,
      remainingInventory,
      inventoryScore,
      calculation: `(${salesVolume} - ${remainingInventory}) = ${inventoryScore}점`
    });
    
    // 김수빈의 경우 더 상세한 로그
    if (agent.target === '김수빈') {
      console.log(`🚨 김수빈 잔여재고 점수 상세:`, {
        salesVolume,
        remainingInventory,
        inventoryScore,
        normalizedInventoryScore: Math.min(Math.max(inventoryScore, -50), 50) + 50,
        calculation: `(${salesVolume} - ${remainingInventory}) = ${inventoryScore}점`
      });
    }
    
    // 원시 점수 계산
    let rawScore = 0;
    
    if (totalSales > 0 || remainingInventory > 0 || storeCount > 0) {
      // 정규화된 값 사용
      const normalizedTurnoverRate = turnoverRate / 100;
      const normalizedInventoryScore = Math.min(Math.max(inventoryScore / 50, -1), 1); // -50~50 범위를 -1~1로 정규화
      const normalizedStoreCount = Math.min(storeCount / 10, 1);
      const normalizedSalesVolume = Math.min(salesVolume / 100, 1);
      
      rawScore = (
        (ratios.turnoverRate / 100) * normalizedTurnoverRate +
        (ratios.remainingInventory / 100) * normalizedInventoryScore +
        (ratios.storeCount / 100) * normalizedStoreCount +
        (ratios.salesVolume / 100) * normalizedSalesVolume
      ) * 100;
    } else {
      // 데이터가 없는 경우 기본 점수 (모든 영업사원이 동일하게 받음)
      rawScore = 50;
      console.log(`⚠️ ${agent.target} (${model}-${color || '전체'}): 데이터 없음, 기본 점수 사용`);
    }
    
    // 각 로직별 정규화된 점수 계산 (0-100 범위) - 더 현실적인 기준으로 조정
    const normalizedTurnoverRate = turnoverRate; // 이미 퍼센트 단위
    const normalizedStoreCount = Math.min(storeCount / 5, 1) * 100; // 거래처수 정규화 (5개 기준으로 조정)
    const normalizedInventoryScore = Math.min(Math.max(inventoryScore, -50), 50) + 50; // -50~50 범위를 0~100으로 변환
    const normalizedSalesVolume = Math.min(salesVolume / 50, 1) * 100; // 판매량 정규화 (50개 기준으로 조정)
    
    console.log(`🔍 상세 점수 계산 - ${agent.target} (${model}-${color || '전체'}):`, {
      dataSource: {
        currentMonthRecords: agentCurrentData.length,
        previousMonthRecords: agentPreviousData.length,
        modelColorCurrentRecords: modelColorCurrentData.length,
        modelColorPreviousRecords: modelColorPreviousData.length
      },
      calculatedValues: {
        turnoverRate: { original: turnoverRate, normalized: normalizedTurnoverRate },
        storeCount: { original: storeCount, normalized: normalizedStoreCount },
        remainingInventory: { original: remainingInventory },
        inventoryScore: { original: inventoryScore, normalized: normalizedInventoryScore },
        salesVolume: { original: salesVolume, normalized: normalizedSalesVolume }
      },
      finalScore: Math.round(rawScore * 100) / 100
    });
    
    return {
      rawScore,
      details: {
        turnoverRate: { value: Math.round(normalizedTurnoverRate), detail: Math.round(turnoverRate) },
        storeCount: { value: Math.round(normalizedStoreCount), detail: storeCount },
        salesVolume: { value: Math.round(normalizedSalesVolume), detail: Math.round(salesVolume) },
        remainingInventory: { value: remainingInventory, detail: remainingInventory },
        inventoryScore: { value: inventoryScore, detail: inventoryScore } // 잔여재고 점수만 표시
      }
    };
  } catch (error) {
    console.error('색상별 원시 점수 계산 중 오류:', error);
    return { rawScore: 50, details: {} };
  }
};

// 모델별 원시 점수 계산 (기존 호환성을 위해 유지)
const calculateRawScore = async (agent, model, settings, storeData) => {
  return await calculateColorRawScore(agent, model, null, settings, storeData);
};

// 점수 정규화 (0-100 범위)
const normalizeScores = (agentScores) => {
  const maxScore = Math.max(...agentScores.map(item => item.rawScore));
  const minScore = Math.min(...agentScores.map(item => item.rawScore));
  const range = maxScore - minScore;
  
  return agentScores.map(item => ({
    ...item,
    normalizedScore: range > 0 ? ((item.rawScore - minScore) / range) * 100 : 50
  }));
};

// 배정 점수 계산 (정규화된 버전)
export const calculateAssignmentScore = async (agent, model, settings, storeData) => {
  try {
    // 캐시 키 생성
    const cacheKey = generateCacheKey([agent], settings, model);
    const cachedScore = getFromCache(cacheKey);
    if (cachedScore !== null) {
      return cachedScore;
    }
    
    const { rawScore, details } = await calculateRawScore(agent, model, settings, storeData);
    
    console.log(`배정 점수 계산 - ${agent.target} (${model}):`, {
      ...details,
      rawScore: Math.round(rawScore * 100) / 100
    });
    
    // 정규화된 점수 계산 (0-100 범위)
    const normalizedScore = Math.max(0, Math.min(100, rawScore));
    
    // 결과 캐싱
    setCache(cacheKey, normalizedScore);
    
    return normalizedScore;
  } catch (error) {
    console.error('배정 점수 계산 중 오류:', error);
    return 50; // 기본값
  }
};

// 색상별 정확한 가중치 계산 (상대적 비교 적용)
const calculateColorAccurateWeights = async (agents, modelName, colorName, settings, storeData, modelData = null) => {
  // 1단계: 모든 영업사원의 원시 점수 계산
  const agentScores = await Promise.all(agents.map(async (agent) => {
    const { rawScore, details } = await calculateColorRawScore(agent, modelName, colorName, settings, storeData, modelData);
    return { agent, rawScore, details };
  }));
  
  // 2단계: 상대적 정규화를 위한 최대/최소값 계산
  const maxSalesVolume = Math.max(...agentScores.map(item => item.details.salesVolume.detail));
  const maxStoreCount = Math.max(...agentScores.map(item => item.details.storeCount.detail));
  // 잔여재고 점수는 (판매량 - 잔여재고) 공식으로 계산된 값으로 비교
  // 원본 inventoryScore 값을 사용하여 상대적 정규화 계산
  const inventoryScores = agentScores.map(item => {
    // 원본 inventoryScore 값이 있으면 사용, 없으면 계산
    if (item.details.inventoryScore && item.details.inventoryScore.value !== undefined) {
      return item.details.inventoryScore.value;
    } else {
      const salesVolume = item.details.salesVolume.detail;
      const remainingInventory = item.details.remainingInventory.detail;
      return salesVolume - remainingInventory;
    }
  });
  const maxInventoryScore = Math.max(...inventoryScores);
  const minInventoryScore = Math.min(...inventoryScores);
  
      console.log(`📊 ${modelName}-${colorName} 상대적 비교 기준:`, {
      maxSalesVolume,
      maxStoreCount,
      maxInventoryScore,
      minInventoryScore,
      agentCount: agents.length,
      inventoryScores: inventoryScores.map((score, i) => ({
        agent: agentScores[i].agent.target,
        salesVolume: agentScores[i].details?.salesVolume?.detail || 0,
        remainingInventory: agentScores[i].details?.remainingInventory?.detail || 0,
        inventoryScore: score
      }))
    });
  
  // 3단계: 상대적 정규화 적용
  const normalizedScores = agentScores.map(({ agent, rawScore, details }, index) => {
    // 상대적 정규화 (최대값 대비 비율)
    const relativeSalesVolume = maxSalesVolume > 0 ? ((details?.salesVolume?.detail || 0) / maxSalesVolume) * 100 : 0;
    const relativeStoreCount = maxStoreCount > 0 ? ((details?.storeCount?.detail || 0) / maxStoreCount) * 100 : 0;
    // 잔여재고 점수는 0-100 범위로 정규화 (최대값과 최소값 기준)
    const currentInventoryScore = inventoryScores[index];
    const relativeInventoryScore = maxInventoryScore !== minInventoryScore 
      ? ((currentInventoryScore - minInventoryScore) / (maxInventoryScore - minInventoryScore)) * 100 
      : 50;
    
    // 새로운 상대적 점수 계산
    const relativeRawScore = (
      (settings.ratios.turnoverRate / 100) * details.turnoverRate.value +
      (settings.ratios.remainingInventory / 100) * relativeInventoryScore +
      (settings.ratios.storeCount / 100) * relativeStoreCount +
      (settings.ratios.salesVolume / 100) * relativeSalesVolume
    );
    
    const finalWeight = relativeRawScore / 100; // 0-1 범위로 변환
    
    // 디버깅: 김수빈의 경우 상세 로그 출력
    if (agent.target === '김수빈') {
      console.log(`🔍 김수빈 상대적 점수 계산 상세:`, {
        agent: agent.target,
        originalScores: {
          turnoverRate: details.turnoverRate.value,
          storeCount: details.storeCount.value,
          remainingInventory: details.remainingInventory.value,
          salesVolume: details.salesVolume.value
        },
        relativeScores: {
          turnoverRate: details.turnoverRate.value,
          storeCount: relativeStoreCount,
          remainingInventory: relativeInventoryScore,
          salesVolume: relativeSalesVolume
        },
        ratios: settings.ratios,
        relativeRawScore,
        finalWeight
      });
    }
    
    console.log(`🔍 상대적 점수 계산 - ${agent.target} (${modelName}-${colorName}):`, {
      originalRawScore: Math.round(rawScore * 100) / 100,
      relativeRawScore: Math.round(relativeRawScore * 100) / 100,
      finalWeight: Math.round(finalWeight * 1000) / 1000,
      relativeScores: {
        salesVolume: Math.round(relativeSalesVolume * 100) / 100,
        storeCount: Math.round(relativeStoreCount * 100) / 100,
        inventoryScore: Math.round(relativeInventoryScore * 100) / 100
      }
    });
    
    return { 
      agent, 
      finalWeight, 
      rawScore: relativeRawScore, 
      details: {
        ...details,
        salesVolume: { value: relativeSalesVolume, detail: details?.salesVolume?.detail || 0 },
        storeCount: { value: relativeStoreCount, detail: details?.storeCount?.detail || 0 },
        inventoryScore: { value: currentInventoryScore, detail: currentInventoryScore } // 잔여재고 점수만 표시
      }
    };
  });
  
  return normalizedScores;
};

// 모델별 정확한 가중치 계산 (기존 호환성을 위해 유지)
const calculateAccurateWeights = async (agents, modelName, settings, storeData) => {
  return await calculateColorAccurateWeights(agents, modelName, null, settings, storeData);
};

// 기본 배정량 계산 (버림 처리)
const calculateBaseAssignments = (weightedAgents, totalQuantity) => {
  const totalWeight = weightedAgents.reduce((sum, item) => sum + item.finalWeight, 0);
  
  return weightedAgents.map(item => {
    const baseQuantity = totalWeight > 0 ? Math.floor((item.finalWeight / totalWeight) * totalQuantity) : 0;
    return { ...item, baseQuantity };
  });
};

// 차이 계산 및 보정 (엑셀 공식 기반)
const adjustAssignments = (baseAssignments, totalQuantity) => {
  const totalAssigned = baseAssignments.reduce((sum, item) => sum + item.baseQuantity, 0);
  const difference = totalQuantity - totalAssigned;
  
  if (difference > 0) {
    // 가중치가 높은 순으로 정렬
    const sortedAssignments = [...baseAssignments].sort((a, b) => b.finalWeight - a.finalWeight);
    
    // 차이만큼 상위 영업사원에게 1씩 추가 배정
    for (let i = 0; i < difference; i++) {
      const targetIndex = i % sortedAssignments.length;
      sortedAssignments[targetIndex].baseQuantity += 1;
      sortedAssignments[targetIndex].adjusted = (sortedAssignments[targetIndex].adjusted || 0) + 1;
    }
    
    return sortedAssignments;
  }
  
  return baseAssignments;
};

// 색상별 배정 수량 계산 (정확한 100% 배정 보장 버전)
export const calculateModelAssignment = async (modelName, modelData, eligibleAgents, settings, storeData) => {
  try {
    console.log(`=== calculateModelAssignment 시작: ${modelName} ===`);
    console.log('입력 파라미터:', {
      modelName,
      modelDataColors: modelData?.colors?.length || 0,
      eligibleAgentsCount: eligibleAgents?.length || 0,
      settingsKeys: Object.keys(settings || {}),
      storeDataType: typeof storeData
    });
    
    if (eligibleAgents.length === 0) {
      console.log('배정 대상자가 없어 빈 결과 반환');
      return {};
    }
    
    // 거래처수가 0인 영업사원을 제외 (중복 필터링 방지)
    console.log('거래처수 필터링 시작...');
    const filteredAgents = await filterAgentsByStoreCount(eligibleAgents, storeData);
    
    if (filteredAgents.length === 0) {
      console.log('⚠️ 거래처수가 있는 영업사원이 없어 배정을 중단합니다.');
      return {};
    }
    
    console.log(`🎯 calculateModelAssignment 필터링 결과:`, {
      전체대상자: eligibleAgents.length,
      거래처수필터링후: filteredAgents.length,
      포함된인원: filteredAgents.map(agent => agent.target)
    });
    
    // 1단계: 색상별로 개별 배정 계산
    console.log('색상별 배정 계산 시작...');
    const colorAssignments = {};
    const colorScores = {};
    
    for (const color of modelData.colors) {
      try {
        const colorQuantity = color.quantity || 0;
        console.log(`색상 ${color.name} 처리 시작 (수량: ${colorQuantity})`);
        
        if (colorQuantity > 0) {
          // 해당 색상의 가중치 계산
          console.log(`색상 ${color.name} 가중치 계산 시작...`);
          const weightedAgents = await calculateColorAccurateWeights(filteredAgents, modelName, color.name, settings, storeData, modelData);
          console.log(`색상 ${color.name} 가중치 계산 완료:`, {
            weightedAgentsCount: weightedAgents?.length || 0,
            totalWeight: weightedAgents?.reduce((sum, agent) => sum + (agent.finalWeight || 0), 0) || 0
          });
          
          // 해당 색상의 배정량 계산
          console.log(`색상 ${color.name} 배정량 계산 시작...`);
          const colorBaseAssignments = calculateBaseAssignments(weightedAgents, colorQuantity);
          const colorAdjustedAssignments = adjustAssignments(colorBaseAssignments, colorQuantity);
          
          colorAssignments[color.name] = colorAdjustedAssignments;
          colorScores[color.name] = weightedAgents;
          
          console.log(`색상 ${color.name} 배정 완료:`, {
            baseAssignments: colorBaseAssignments.length,
            adjustedAssignments: colorAdjustedAssignments.length,
            totalAssigned: colorAdjustedAssignments.reduce((sum, item) => sum + (item.baseQuantity || 0), 0)
          });
        } else {
          console.log(`색상 ${color.name} 수량이 0이므로 건너뜀`);
        }
      } catch (error) {
        console.error(`색상 ${color.name} 처리 중 오류:`, error);
        throw new Error(`색상 ${color.name} 배정 계산 실패: ${error.message}`);
      }
    }
    
    // 2단계: 영업사원별로 색상별 배정량 통합
    console.log('영업사원별 배정량 통합 시작...');
    const assignments = {};
    
    filteredAgents.forEach(agent => {
      try {
        const agentColorQuantities = {};
        const agentColorScores = {};
        let totalAgentQuantity = 0;
        
        // 각 색상별 배정량과 점수 합산
        Object.entries(colorAssignments).forEach(([colorName, colorAssignmentList]) => {
          const agentColorAssignment = colorAssignmentList.find(item => item.agent.contactId === agent.contactId);
          const colorQuantity = agentColorAssignment ? agentColorAssignment.baseQuantity : 0;
          const colorScore = colorScores[colorName].find(item => item.agent.contactId === agent.contactId);
          
          agentColorQuantities[colorName] = colorQuantity;
          agentColorScores[colorName] = {
            averageScore: colorScore?.rawScore || 0,
            details: colorScore?.details || {} // calculateColorRawScore에서 반환하는 새로운 구조
          };
          
          // 디버깅: 실제 전달되는 데이터 확인
          console.log(`🔍 ${agent.target} - ${modelName}-${colorName} 점수 데이터:`, {
            rawScore: colorScore?.rawScore,
            details: colorScore?.details,
            finalWeight: colorScore?.finalWeight
          });
          totalAgentQuantity += colorQuantity;
        });
        
        if (totalAgentQuantity > 0) {
          assignments[agent.contactId] = {
            agentName: agent.target,
            office: agent.office,
            department: agent.department,
            quantity: totalAgentQuantity,
            colorQuantities: agentColorQuantities, // 색상별 배정량
            colorScores: agentColorScores, // 색상별 점수
            averageScore: Object.values(agentColorScores).reduce((sum, score) => sum + score.averageScore, 0) / Object.keys(agentColorScores).length, // 평균 점수
            colors: modelData.colors.map(color => color.name),
            details: Object.values(agentColorScores)[0]?.details || {} // 첫 번째 색상의 세부정보
          };
          
          console.log(`✅ ${agent.target} 배정 완료:`, {
            totalQuantity: totalAgentQuantity,
            colorQuantities: agentColorQuantities
          });
        } else {
          console.log(`❌ ${agent.target} 배정량 0으로 제외`);
        }
      } catch (error) {
        console.error(`${agent.target} 배정 처리 중 오류:`, error);
        throw new Error(`${agent.target} 배정 처리 실패: ${error.message}`);
      }
    });
    
    // 3단계: 검증 - 각 색상별 총 배정량 확인
    console.log('색상별 배정 검증 시작...');
    Object.entries(colorAssignments).forEach(([colorName, colorAssignmentList]) => {
      const totalColorAssigned = colorAssignmentList.reduce((sum, item) => sum + item.baseQuantity, 0);
      const expectedColorQuantity = modelData.colors.find(color => color.name === colorName)?.quantity || 0;
      
      console.log(`✅ 색상 ${colorName} 배정 검증:`, {
        expected: expectedColorQuantity,
        assigned: totalColorAssigned,
        difference: expectedColorQuantity - totalColorAssigned,
        agentScores: colorScores[colorName].map(item => ({
          agent: item.agent.target,
          score: Math.round(item.rawScore),
          weight: Math.round(item.finalWeight * 100) / 100
        }))
      });
    });
    
    // 전체 검증
    const totalAssigned = Object.values(assignments).reduce((sum, assignment) => sum + assignment.quantity, 0);
    const totalExpected = modelData.colors.reduce((sum, color) => sum + (color.quantity || 0), 0);
    
    console.log(`✅ 모델 ${modelName} 색상별 정확한 배정 완료:`, {
      totalExpected,
      totalAssigned,
      difference: totalExpected - totalAssigned,
      agentCount: eligibleAgents.length,
      colors: modelData.colors.map(color => `${color.name}: ${color.quantity}개`)
    });
    
    return assignments;
  } catch (error) {
    console.error(`=== calculateModelAssignment 실패: ${modelName} ===`);
    console.error('에러 객체:', error);
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    
    // 에러를 다시 던져서 상위에서 처리할 수 있도록 함
    throw error;
  }
};

// 사무실별 배정 수량 집계
export const aggregateOfficeAssignment = (assignments, eligibleAgents) => {
  const officeStats = {};
  
  eligibleAgents.forEach(agent => {
    if (!officeStats[agent.office]) {
      officeStats[agent.office] = {
        office: agent.office,
        agentCount: 0,
        totalQuantity: 0,
        agents: []
      };
    }
    
    officeStats[agent.office].agentCount++;
    officeStats[agent.office].agents.push(agent);
    
    // 해당 영업사원의 배정량 추가 (모든 모델의 합계)
    if (assignments[agent.contactId]) {
      const agentTotalQuantity = Object.values(assignments[agent.contactId]).reduce((sum, assignment) => sum + assignment.quantity, 0);
      officeStats[agent.office].totalQuantity += agentTotalQuantity;
    }
  });
  
  return officeStats;
};

// 소속별 배정 수량 집계
export const aggregateDepartmentAssignment = (assignments, eligibleAgents) => {
  const departmentStats = {};
  
  eligibleAgents.forEach(agent => {
    if (!departmentStats[agent.department]) {
      departmentStats[agent.department] = {
        department: agent.department,
        agentCount: 0,
        totalQuantity: 0,
        agents: []
      };
    }
    
    departmentStats[agent.department].agentCount++;
    departmentStats[agent.department].agents.push(agent);
    
    // 해당 영업사원의 배정량 추가 (모든 모델의 합계)
    if (assignments[agent.contactId]) {
      const agentTotalQuantity = Object.values(assignments[agent.contactId]).reduce((sum, assignment) => sum + assignment.quantity, 0);
      departmentStats[agent.department].totalQuantity += agentTotalQuantity;
    }
  });
  
  return departmentStats;
};

// 전체 배정 계산 (최적화된 버전)
export const calculateFullAssignment = async (agents, settings, storeData = null) => {
  try {
    console.log('=== calculateFullAssignment 시작 ===');
    console.log('입력 파라미터:', {
      agentsCount: agents?.length || 0,
      settingsKeys: Object.keys(settings || {}),
      storeDataType: typeof storeData,
      storeDataKeys: Object.keys(storeData || {}),
      storeDataLength: storeData?.stores?.length || 0
    });
    
    const { models } = settings;
    console.log('모델 설정:', Object.keys(models || {}));
    
    const { eligibleAgents } = getSelectedTargets(agents, settings);
    console.log('선택된 배정 대상:', eligibleAgents.length, '명');
    
    // 거래처수 0인 인원을 배정목록에서 제거
    console.log('거래처수 필터링 시작...');
    const filteredAgents = await filterAgentsByStoreCount(eligibleAgents, storeData);
    
    console.log(`🎯 배정 대상자 필터링 결과:`, {
      전체대상자: eligibleAgents.length,
      거래처수필터링후: filteredAgents.length,
      제외된인원: eligibleAgents.length - filteredAgents.length,
      포함된인원: filteredAgents.map(agent => agent.target),
      제외된인원: eligibleAgents.filter(agent => !filteredAgents.find(fa => fa.contactId === agent.contactId)).map(agent => agent.target)
    });
    
    // 필터링된 영업사원이 없으면 빈 결과 반환
    if (filteredAgents.length === 0) {
      console.log('⚠️ 거래처수가 있는 영업사원이 없어 배정을 중단합니다.');
      return {
        agents: {},
        offices: {},
        departments: {},
        models: {}
      };
    }
    
    const results = {
      agents: {},
      offices: {},
      departments: {},
      models: {}
    };
    
    // 모든 모델의 배정을 병렬로 계산
    console.log('모델별 배정 계산 시작...');
    const modelPromises = Object.entries(models).map(async ([modelName, modelData]) => {
      try {
        console.log(`모델 ${modelName} 배정 계산 시작...`);
        const modelAssignments = await calculateModelAssignment(modelName, modelData, filteredAgents, settings, storeData);
        console.log(`모델 ${modelName} 배정 계산 완료:`, {
          assignmentsCount: Object.keys(modelAssignments || {}).length,
          totalAssigned: Object.values(modelAssignments || {}).reduce((sum, assignment) => sum + (assignment.quantity || 0), 0)
        });
        
        return {
          modelName,
          modelAssignments,
          modelData
        };
      } catch (error) {
        console.error(`모델 ${modelName} 배정 계산 중 오류:`, error);
        throw new Error(`모델 ${modelName} 배정 계산 실패: ${error.message}`);
      }
    });
    
    const modelResults = await Promise.all(modelPromises);
    console.log('모든 모델 배정 계산 완료');
    
    // 결과 통합 - 영업사원별로 모델별 배정 결과 그룹화
    console.log('결과 통합 시작...');
    modelResults.forEach(({ modelName, modelAssignments, modelData }) => {
      // 영업사원별 배정 결과를 모델별로 그룹화하여 저장
      Object.entries(modelAssignments).forEach(([contactId, assignment]) => {
        if (!results.agents[contactId]) {
          results.agents[contactId] = {};
        }
        results.agents[contactId][modelName] = assignment;
      });
      
      // 모델별 결과 저장
      results.models[modelName] = {
        name: modelName,
        totalQuantity: modelData.colors.reduce((sum, color) => sum + (color.quantity || 0), 0),
        assignedQuantity: Object.values(modelAssignments).reduce((sum, assignment) => sum + assignment.quantity, 0),
        assignments: modelAssignments,
        colors: modelData.colors // 색상별 수량 정보 포함
      };
    });
    
    // 사무실별 집계
    console.log('사무실별 집계 시작...');
    results.offices = aggregateOfficeAssignment(results.agents, filteredAgents);
    
    // 소속별 집계
    console.log('소속별 집계 시작...');
    results.departments = aggregateDepartmentAssignment(results.agents, filteredAgents);
    
    console.log('=== calculateFullAssignment 완료 ===');
    console.log('최종 결과 요약:', {
      agentsCount: Object.keys(results.agents).length,
      officesCount: Object.keys(results.offices).length,
      departmentsCount: Object.keys(results.departments).length,
      modelsCount: Object.keys(results.models).length,
      totalAssigned: Object.values(results.agents).reduce((sum, agentModels) => {
        return sum + Object.values(agentModels).reduce((agentSum, assignment) => agentSum + (assignment.quantity || 0), 0);
      }, 0)
    });
    
    return results;
  } catch (error) {
    console.error('=== calculateFullAssignment 실패 ===');
    console.error('에러 객체:', error);
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    
    // 에러를 다시 던져서 상위에서 처리할 수 있도록 함
    throw error;
  }
};

// 캐시 정리 함수
export const clearAssignmentCache = () => {
  calculationCache.clear();
  activationDataCache = null;
  activationDataTimestamp = 0;
}; 