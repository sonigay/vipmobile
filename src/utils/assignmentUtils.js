// 배정 로직 유틸리티 함수들

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
  
  // 조건에 맞는 영업사원 필터링
  const eligibleAgents = agents.filter(agent => {
    // 영업사원별 선택이 되어 있는지 확인
    const isAgentSelected = selectedAgentIds.includes(agent.contactId);
    
    // 사무실 또는 소속이 선택되어 있는지 확인
    const isOfficeSelected = selectedOffices.includes(agent.office);
    const isDepartmentSelected = selectedDepartments.includes(agent.department);
    
    return isAgentSelected && (isOfficeSelected || isDepartmentSelected);
  });
  
  return {
    selectedOffices,
    selectedDepartments,
    selectedAgentIds,
    eligibleAgents
  };
};

// 배정 점수 계산
export const calculateAssignmentScore = async (agent, model, settings, storeData) => {
  const { ratios } = settings;
  
  try {
    // 개통실적 데이터 가져오기
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
    const [currentMonthResponse, previousMonthResponse] = await Promise.all([
      fetch(`${API_URL}/api/activation-data/current-month`),
      fetch(`${API_URL}/api/activation-data/previous-month`)
    ]);
    
    const currentMonthData = await currentMonthResponse.json();
    const previousMonthData = await previousMonthResponse.json();
    
    // 담당자별 데이터 추출
    const agentCurrentData = currentMonthData.filter(record => record['담당자'] === agent.target);
    const agentPreviousData = previousMonthData.filter(record => record['담당자'] === agent.target);
    
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
      : 0; // 모델별회전율 = (당월실적+전월실적)/(보유재고+당월실적+전월실적)
    
    const storeCount = agentCurrentData.length; // 거래처수 = 담당자별로 보유중인 매장수
    const salesVolume = totalSales; // 판매량 = 당월실적+전월실적
    
    return (
      turnoverRate * (ratios.turnoverRate / 100) +
      storeCount * (ratios.storeCount / 100) +
      remainingInventory * (ratios.remainingInventory / 100) +
      salesVolume * (ratios.salesVolume / 100)
    );
  } catch (error) {
    console.error('배정 점수 계산 중 오류:', error);
    // 오류 발생 시 기본값 반환
    return 50;
  }
};

// 모델별 배정 수량 계산
export const calculateModelAssignment = async (modelName, modelData, eligibleAgents, settings, storeData) => {
  if (eligibleAgents.length === 0) {
    return {};
  }
  
  const totalQuantity = modelData.quantity;
  
  // 각 영업사원의 배정 점수 계산
  const agentScores = [];
  for (const agent of eligibleAgents) {
    const score = await calculateAssignmentScore(agent, modelName, settings, storeData);
    agentScores.push({ agent, score });
  }
  
  // 점수별로 정렬
  agentScores.sort((a, b) => b.score - a.score);
  
  // 총 점수 계산
  const totalScore = agentScores.reduce((sum, item) => sum + item.score, 0);
  
  const assignments = {};
  
  // 점수 비율에 따른 배정량 계산
  agentScores.forEach(({ agent, score }) => {
    const ratio = totalScore > 0 ? score / totalScore : 1 / eligibleAgents.length;
    const assignedQuantity = Math.round(totalQuantity * ratio);
    
    assignments[agent.contactId] = {
      agentName: agent.target,
      office: agent.office,
      department: agent.department,
      quantity: assignedQuantity,
      colors: modelData.colors,
      score: score,
      ratio: ratio
    };
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
    
    // 해당 영업사원의 배정량 추가
    if (assignments[agent.contactId]) {
      officeStats[agent.office].totalQuantity += assignments[agent.contactId].quantity;
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
    
    // 해당 영업사원의 배정량 추가
    if (assignments[agent.contactId]) {
      departmentStats[agent.department].totalQuantity += assignments[agent.contactId].quantity;
    }
  });
  
  return departmentStats;
};

// 전체 배정 계산
export const calculateFullAssignment = async (agents, settings, storeData = null) => {
  const { models } = settings;
  const { eligibleAgents } = getSelectedTargets(agents, settings);
  
  const results = {
    agents: {},
    offices: {},
    departments: {},
    models: {}
  };
  
  // 각 모델별로 배정 계산
  for (const [modelName, modelData] of Object.entries(models)) {
    const modelAssignments = await calculateModelAssignment(modelName, modelData, eligibleAgents, settings, storeData);
    
    // 영업사원별 배정 결과 저장
    Object.assign(results.agents, modelAssignments);
    
    // 모델별 결과 저장
    results.models[modelName] = {
      name: modelName,
      totalQuantity: modelData.quantity,
      assignedQuantity: Object.values(modelAssignments).reduce((sum, assignment) => sum + assignment.quantity, 0),
      assignments: modelAssignments
    };
  }
  
  // 사무실별 집계
  results.offices = aggregateOfficeAssignment(results.agents, eligibleAgents);
  
  // 소속별 집계
  results.departments = aggregateDepartmentAssignment(results.agents, eligibleAgents);
  
  return results;
}; 