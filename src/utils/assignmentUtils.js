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

// 개통실적 데이터 배치 로드 (성능 최적화)
let activationDataCache = null;
let activationDataTimestamp = 0;

const loadActivationDataBatch = async () => {
  const now = Date.now();
  
  // 캐시가 유효한 경우 캐시된 데이터 반환
  if (activationDataCache && (now - activationDataTimestamp) < CACHE_DURATION) {
    return activationDataCache;
  }
  
  try {
    const API_URL = process.env.REACT_APP_API_URL;
    const [currentMonthResponse, previousMonthResponse] = await Promise.all([
      fetch(`${API_URL}/api/activation-data/current-month`),
      fetch(`${API_URL}/api/activation-data/previous-month`)
    ]);
    
    const currentMonthData = await currentMonthResponse.json();
    const previousMonthData = await previousMonthResponse.json();
    
    // 데이터를 인덱싱하여 빠른 검색 가능
    const indexedData = {
      current: new Map(),
      previous: new Map()
    };
    
    // 담당자별로 데이터 그룹화
    currentMonthData.forEach(record => {
      const key = record['담당자'];
      if (!indexedData.current.has(key)) {
        indexedData.current.set(key, []);
      }
      indexedData.current.get(key).push(record);
    });
    
    previousMonthData.forEach(record => {
      const key = record['담당자'];
      if (!indexedData.previous.has(key)) {
        indexedData.previous.set(key, []);
      }
      indexedData.previous.get(key).push(record);
    });
    
    activationDataCache = indexedData;
    activationDataTimestamp = now;
    
    return indexedData;
  } catch (error) {
    console.error('개통실적 데이터 배치 로드 실패:', error);
    return { current: new Map(), previous: new Map() };
  }
};

// 원시 점수 계산 (정규화 전)
const calculateRawScore = async (agent, model, settings, storeData) => {
  const { ratios } = settings;
  
  try {
    // 배치로드된 개통실적 데이터 사용
    const activationData = await loadActivationDataBatch();
    
    // 담당자별 데이터 추출 (인덱싱된 데이터 사용)
    const agentCurrentData = activationData.current.get(agent.target) || [];
    const agentPreviousData = activationData.previous.get(agent.target) || [];
    
    // 모델별 데이터 필터링
    const modelCurrentData = agentCurrentData.filter(record => record['모델'] === model);
    const modelPreviousData = agentPreviousData.filter(record => record['모델'] === model);
    
    // 수량 계산
    const currentMonthSales = modelCurrentData.reduce((sum, record) => sum + (parseInt(record['개통']) || 0), 0);
    const previousMonthSales = modelPreviousData.reduce((sum, record) => sum + (parseInt(record['개통']) || 0), 0);
    const totalSales = currentMonthSales + previousMonthSales;
    
    // 보유재고 계산 (storeData에서 해당 모델의 재고량)
    const remainingInventory = storeData?.inventory?.[model]?.정상 || 0;
    
    // 새로운 배정 비율 계산
    const turnoverRate = remainingInventory + totalSales > 0 
      ? (totalSales / (remainingInventory + totalSales)) * 100 
      : 0;
    
    const storeCount = agentCurrentData.length; // 거래처수 = 담당자별로 보유중인 매장수
    const salesVolume = totalSales; // 판매량 = 당월실적+전월실적
    
    // 잔여재고 점수 계산 (재고가 적을수록 높은 점수)
    // 재고가 0이면 최고점(100), 재고가 많을수록 점수 감소
    const inventoryScore = remainingInventory === 0 ? 100 : Math.max(0, 100 - (remainingInventory * 10));
    
    // 원시 점수 계산 (개통실적 데이터가 없는 경우에도 기본값 제공)
    let rawScore = 0;
    
    if (totalSales > 0 || remainingInventory > 0 || storeCount > 0) {
      // 실제 데이터가 있는 경우
      rawScore = (
        turnoverRate * (ratios.turnoverRate / 100) +
        storeCount * (ratios.storeCount / 100) +
        inventoryScore * (ratios.remainingInventory / 100) + // 잔여재고 점수 사용
        salesVolume * (ratios.salesVolume / 100)
      );
    } else {
      // 데이터가 없는 경우 기본 점수 (균등 배정을 위한 최소 점수)
      rawScore = 50;
    }
    
    return {
      rawScore,
      details: {
        turnoverRate: Math.round(turnoverRate * 100) / 100,
        storeCount,
        remainingInventory,
        inventoryScore: Math.round(inventoryScore * 100) / 100,
        salesVolume
      }
    };
  } catch (error) {
    console.error('원시 점수 계산 중 오류:', error);
    return { rawScore: 50, details: {} };
  }
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
    
    // 결과 캐싱
    setCache(cacheKey, rawScore);
    
    return rawScore;
  } catch (error) {
    console.error('배정 점수 계산 중 오류:', error);
    return 50; // 기본값
  }
};

// 모델별 배정 수량 계산 (100% 배정 보장 버전)
export const calculateModelAssignment = async (modelName, modelData, eligibleAgents, settings, storeData) => {
  if (eligibleAgents.length === 0) {
    return {};
  }
  
  // 색상별 수량의 총합 계산
  const totalQuantity = modelData.colors.reduce((sum, color) => sum + (color.quantity || 0), 0);
  
  // 1단계: 모든 영업사원의 원시 점수 계산
  const rawScorePromises = eligibleAgents.map(async (agent) => {
    const { rawScore, details } = await calculateRawScore(agent, modelName, settings, storeData);
    return { agent, rawScore, details };
  });
  
  const agentRawScores = await Promise.all(rawScorePromises);
  
  // 2단계: 점수 정규화 (0-100 범위)
  const normalizedScores = normalizeScores(agentRawScores);
  
  // 3단계: 정규화된 점수로 정렬
  normalizedScores.sort((a, b) => b.normalizedScore - a.normalizedScore);
  
  // 4단계: 정규화된 점수 합계 계산
  const totalNormalizedScore = normalizedScores.reduce((sum, item) => sum + item.normalizedScore, 0);
  
  const assignments = {};
  let remainingQuantity = totalQuantity;
  
  // 5단계: 1차 배정 - 정규화된 점수 비율에 따른 기본 배정 (소수점 버림)
  normalizedScores.forEach(({ agent, normalizedScore, rawScore, details }, index) => {
    const ratio = totalNormalizedScore > 0 ? normalizedScore / totalNormalizedScore : 1 / eligibleAgents.length;
    
    // 기본 배정량 (소수점 버림으로 정확한 수량 계산)
    let assignedQuantity = Math.floor(totalQuantity * ratio);
    
    // 최소 1개 보장 (수량이 있는 경우)
    if (remainingQuantity > 0 && assignedQuantity === 0) {
      assignedQuantity = 1;
    }
    
    // 남은 수량 초과 방지
    assignedQuantity = Math.min(assignedQuantity, remainingQuantity);
    
    assignments[agent.contactId] = {
      agentName: agent.target,
      office: agent.office,
      department: agent.department,
      quantity: assignedQuantity,
      colors: modelData.colors.map(color => color.name), // 색상명 배열
      normalizedScore: normalizedScore,
      rawScore: rawScore,
      ratio: ratio,
      details: details
    };
    
    remainingQuantity -= assignedQuantity;
  });
  
  // 6단계: 잔여 재고 재배정 (100% 배정 보장)
  if (remainingQuantity > 0) {
    console.log(`🔄 모델 ${modelName}에서 ${remainingQuantity}개 잔여 재고 재배정 시작`);
    
    // 잔여재고 우선순위 기반 재배정 후보 선별
    const redistributionCandidates = normalizedScores
      .map(({ agent, normalizedScore, details }) => {
        // 잔여재고 확인 (details에서 가져옴)
        const hasInventory = details.remainingInventory > 0;
        
        return {
          agentId: agent.contactId,
          agent,
          normalizedScore,
          hasInventory,
          currentQuantity: assignments[agent.contactId]?.quantity || 0,
          priority: hasInventory ? 0 : 1 // 잔여재고 없는 곳 우선
        };
      })
      .sort((a, b) => {
        // 1순위: 잔여재고 없는 곳 우선
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // 2순위: 정규화된 점수 높은 순
        return b.normalizedScore - a.normalizedScore;
      });
    
    // 잔여재고 없는 곳에 우선 배정
    let redistributionIndex = 0;
    while (remainingQuantity > 0 && redistributionIndex < redistributionCandidates.length) {
      const candidate = redistributionCandidates[redistributionIndex];
      
      if (assignments[candidate.agentId]) {
        assignments[candidate.agentId].quantity += 1;
        assignments[candidate.agentId].redistributed = (assignments[candidate.agentId].redistributed || 0) + 1;
        remainingQuantity -= 1;
        
        console.log(`✅ ${candidate.agent.target}에게 잔여 재고 1개 추가 배정 (잔여재고: ${candidate.hasInventory ? '있음' : '없음'}, 점수: ${Math.round(candidate.normalizedScore)})`);
      }
      
      redistributionIndex++;
    }
    
    // 여전히 남은 수량이 있으면 모든 영업사원에게 순차 배정
    if (remainingQuantity > 0) {
      redistributionIndex = 0;
      while (remainingQuantity > 0) {
        const candidate = redistributionCandidates[redistributionIndex % redistributionCandidates.length];
        
        if (assignments[candidate.agentId]) {
          assignments[candidate.agentId].quantity += 1;
          assignments[candidate.agentId].redistributed = (assignments[candidate.agentId].redistributed || 0) + 1;
          remainingQuantity -= 1;
          
          console.log(`✅ ${candidate.agent.target}에게 추가 잔여 재고 1개 배정`);
        }
        
        redistributionIndex++;
      }
    }
  }
  
  console.log(`✅ 모델 ${modelName} 배정 완료:`, {
    totalQuantity,
    assignedQuantity: totalQuantity - remainingQuantity,
    remainingQuantity,
    agentCount: eligibleAgents.length,
    colors: modelData.colors.map(color => `${color.name}: ${color.quantity}개`),
    redistributionCount: Object.values(assignments).reduce((sum, assignment) => sum + (assignment.redistributed || 0), 0)
  });
  
  return assignments;
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
  const { models } = settings;
  const { eligibleAgents } = getSelectedTargets(agents, settings);
  
  const results = {
    agents: {},
    offices: {},
    departments: {},
    models: {}
  };
  
  // 모든 모델의 배정을 병렬로 계산
  const modelPromises = Object.entries(models).map(async ([modelName, modelData]) => {
    const modelAssignments = await calculateModelAssignment(modelName, modelData, eligibleAgents, settings, storeData);
    
    return {
      modelName,
      modelAssignments,
      modelData
    };
  });
  
  const modelResults = await Promise.all(modelPromises);
  
  // 결과 통합 - 영업사원별로 모델별 배정 결과 그룹화
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
  results.offices = aggregateOfficeAssignment(results.agents, eligibleAgents);
  
  // 소속별 집계
  results.departments = aggregateDepartmentAssignment(results.agents, eligibleAgents);
  
  return results;
};

// 캐시 정리 함수
export const clearAssignmentCache = () => {
  calculationCache.clear();
  activationDataCache = null;
  activationDataTimestamp = 0;
}; 