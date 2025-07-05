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
export const calculateAssignmentScore = (agent, model, settings, storeData) => {
  const { ratios } = settings;
  
  // 실제 데이터가 없으므로 임시 계산 (나중에 실제 데이터로 교체)
  const turnoverRate = Math.random() * 100; // 회전율 (당월실적/(보유재고+당월실적))
  const storeCount = Math.random() * 50; // 거래처수
  const remainingInventory = Math.random() * 100; // 잔여재고
  const salesVolume = Math.random() * 100; // 판매량
  
  return (
    turnoverRate * (ratios.turnoverRate / 100) +
    storeCount * (ratios.storeCount / 100) +
    remainingInventory * (ratios.remainingInventory / 100) +
    salesVolume * (ratios.salesVolume / 100)
  );
};

// 모델별 배정 수량 계산
export const calculateModelAssignment = (modelName, modelData, eligibleAgents) => {
  if (eligibleAgents.length === 0) {
    return {};
  }
  
  const totalQuantity = modelData.quantity;
  const baseQuantity = Math.floor(totalQuantity / eligibleAgents.length);
  const remainder = totalQuantity % eligibleAgents.length;
  
  const assignments = {};
  
  eligibleAgents.forEach((agent, index) => {
    // 기본 수량 + 나머지 분배
    const assignedQuantity = baseQuantity + (index < remainder ? 1 : 0);
    assignments[agent.contactId] = {
      agentName: agent.target,
      office: agent.office,
      department: agent.department,
      quantity: assignedQuantity,
      colors: modelData.colors
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
export const calculateFullAssignment = (agents, settings) => {
  const { models } = settings;
  const { eligibleAgents } = getSelectedTargets(agents, settings);
  
  const results = {
    agents: {},
    offices: {},
    departments: {},
    models: {}
  };
  
  // 각 모델별로 배정 계산
  Object.entries(models).forEach(([modelName, modelData]) => {
    const modelAssignments = calculateModelAssignment(modelName, modelData, eligibleAgents);
    
    // 영업사원별 배정 결과 저장
    Object.assign(results.agents, modelAssignments);
    
    // 모델별 결과 저장
    results.models[modelName] = {
      name: modelName,
      totalQuantity: modelData.quantity,
      assignedQuantity: Object.values(modelAssignments).reduce((sum, assignment) => sum + assignment.quantity, 0),
      assignments: modelAssignments
    };
  });
  
  // 사무실별 집계
  results.offices = aggregateOfficeAssignment(results.agents, eligibleAgents);
  
  // 소속별 집계
  results.departments = aggregateDepartmentAssignment(results.agents, eligibleAgents);
  
  return results;
}; 