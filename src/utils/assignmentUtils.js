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

// 색상별 원시 점수 계산 (정규화 전)
const calculateColorRawScore = async (agent, model, color, settings, storeData) => {
  const { ratios } = settings;
  
  try {
    // 배치로드된 개통실적 데이터 사용
    const activationData = await loadActivationDataBatch();
    
    // 담당자별 데이터 추출 (인덱싱된 데이터 사용)
    const agentCurrentData = activationData.current.get(agent.target) || [];
    const agentPreviousData = activationData.previous.get(agent.target) || [];
    
    // 모델+색상별 데이터 필터링 (색상 정보가 있는 경우)
    const modelColorCurrentData = agentCurrentData.filter(record => 
      record['모델'] === model && 
      (record['색상'] === color || !record['색상']) // 색상 정보가 없으면 모델만으로 필터링
    );
    const modelColorPreviousData = agentPreviousData.filter(record => 
      record['모델'] === model && 
      (record['색상'] === color || !record['색상'])
    );
    
    // 모델별 데이터 필터링 (색상별 데이터가 없을 경우 모델별로 계산)
    const modelCurrentData = agentCurrentData.filter(record => record['모델'] === model);
    const modelPreviousData = agentPreviousData.filter(record => record['모델'] === model);
    
    // 색상별 수량 계산 (색상별 데이터가 있으면 사용, 없으면 모델별 데이터 사용)
    const currentMonthSales = modelColorCurrentData.length > 0 
      ? modelColorCurrentData.reduce((sum, record) => sum + (parseInt(record['개통']) || 0), 0)
      : modelCurrentData.reduce((sum, record) => sum + (parseInt(record['개통']) || 0), 0);
    const previousMonthSales = modelColorPreviousData.length > 0
      ? modelColorPreviousData.reduce((sum, record) => sum + (parseInt(record['개통']) || 0), 0)
      : modelPreviousData.reduce((sum, record) => sum + (parseInt(record['개통']) || 0), 0);
    const totalSales = currentMonthSales + previousMonthSales;
    
    // 보유재고 계산 (storeData에서 해당 모델의 재고량)
    const remainingInventory = storeData?.inventory?.[model]?.정상 || 0;
    
    // 색상별 회전율 계산
    const turnoverRate = remainingInventory + totalSales > 0 
      ? (totalSales / (remainingInventory + totalSales)) * 100 
      : 0;
    
    const storeCount = agentCurrentData.length; // 거래처수 = 담당자별로 보유중인 매장수
    const salesVolume = totalSales; // 판매량 = 당월실적+전월실적
    
    // 잔여재고 점수 계산 (재고가 적을수록 높은 점수)
    const inventoryScore = remainingInventory === 0 ? 100 : Math.max(0, 100 - (remainingInventory * 10));
    
    // 원시 점수 계산
    let rawScore = 0;
    
    if (totalSales > 0 || remainingInventory > 0 || storeCount > 0) {
      // 정규화된 값 사용
      const normalizedTurnoverRate = turnoverRate / 100;
      const normalizedInventoryScore = inventoryScore / 100;
      const normalizedStoreCount = Math.min(storeCount / 10, 1);
      const normalizedSalesVolume = Math.min(salesVolume / 100, 1);
      
      rawScore = (
        (ratios.turnoverRate / 100) * normalizedTurnoverRate +
        (ratios.remainingInventory / 100) * normalizedInventoryScore +
        (ratios.storeCount / 100) * normalizedStoreCount +
        (ratios.salesVolume / 100) * normalizedSalesVolume
      ) * 100;
    } else {
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

// 색상별 정확한 가중치 계산
const calculateColorAccurateWeights = async (agents, modelName, colorName, settings, storeData) => {
  const weightPromises = agents.map(async (agent) => {
    const { rawScore, details } = await calculateColorRawScore(agent, modelName, colorName, settings, storeData);
    
    // 최종 가중치 (rawScore와 동일한 방식으로 계산)
    const finalWeight = rawScore / 100; // 0-1 범위로 변환
    
    return { agent, finalWeight, rawScore, details };
  });
  
  return await Promise.all(weightPromises);
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
  if (eligibleAgents.length === 0) {
    return {};
  }
  
  // 1단계: 색상별로 개별 배정 계산
  const colorAssignments = {};
  const colorScores = {};
  
  for (const color of modelData.colors) {
    const colorQuantity = color.quantity || 0;
    if (colorQuantity > 0) {
      // 해당 색상의 가중치 계산
      const weightedAgents = await calculateColorAccurateWeights(eligibleAgents, modelName, color.name, settings, storeData);
      
      // 해당 색상의 배정량 계산
      const colorBaseAssignments = calculateBaseAssignments(weightedAgents, colorQuantity);
      const colorAdjustedAssignments = adjustAssignments(colorBaseAssignments, colorQuantity);
      
      colorAssignments[color.name] = colorAdjustedAssignments;
      colorScores[color.name] = weightedAgents;
    }
  }
  
  // 2단계: 영업사원별로 색상별 배정량 통합
  const assignments = {};
  
  eligibleAgents.forEach(agent => {
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
        details: colorScore?.details || {}
      };
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
    }
  });
  
  // 3단계: 검증 - 각 색상별 총 배정량 확인
  Object.entries(colorAssignments).forEach(([colorName, colorAssignmentList]) => {
    const totalColorAssigned = colorAssignmentList.reduce((sum, item) => sum + item.baseQuantity, 0);
    const expectedColorQuantity = modelData.colors.find(color => color.name === colorName)?.quantity || 0;
    
    console.log(`✅ 색상 ${colorName} 배정 검증:`, {
      expected: expectedColorQuantity,
      assigned: totalColorAssigned,
      difference: expectedColorQuantity - totalColorAssigned
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