// 사전예약 배정 관련 유틸리티 함수들

// API 기본 URL 설정
const API_BASE_URL = process.env.REACT_APP_API_URL;

// 캐시 시스템
const assignmentCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

// 캐시 유틸리티
const cacheUtils = {
  set: (key, data, ttl = CACHE_TTL) => {
    const now = Date.now();
    assignmentCache.set(key, {
      data,
      timestamp: now,
      ttl: now + ttl
    });
  },
  
  get: (key) => {
    const item = assignmentCache.get(key);
    if (!item) return null;
    
    const now = Date.now();
    if (now > item.ttl) {
      assignmentCache.delete(key);
      return null;
    }
    
    return item.data;
  },
  
  delete: (key) => {
    assignmentCache.delete(key);
  },
  
  clear: () => {
    assignmentCache.clear();
  }
};

// 선택된 대상자 가져오기 (매장별 우선 배정)
export const getSelectedReservationTargets = (targets, agents) => {
  const selectedAgents = new Set();
  
  // 1순위: 매장별 선택 (가장 우선)
  Object.entries(targets.stores || {}).forEach(([store, selected]) => {
    if (selected) {
      agents.filter(agent => agent.store === store).forEach(agent => {
        selectedAgents.add(agent.name);
      });
    }
  });
  
  // 2순위: 담당자별 선택 (매장별에서 선택되지 않은 담당자들)
  Object.entries(targets.agents || {}).forEach(([agentName, selected]) => {
    if (selected && !selectedAgents.has(agentName)) {
      selectedAgents.add(agentName);
    }
  });
  
  // 3순위: 소속별 선택 (매장별/담당자별에서 선택되지 않은 담당자들)
  Object.entries(targets.departments || {}).forEach(([department, selected]) => {
    if (selected) {
      agents.filter(agent => 
        agent.department === department && !selectedAgents.has(agent.name)
      ).forEach(agent => {
        selectedAgents.add(agent.name);
      });
    }
  });
  
  // 4순위: 사무실별 선택 (매장별/담당자별/소속별에서 선택되지 않은 담당자들)
  Object.entries(targets.offices || {}).forEach(([office, selected]) => {
    if (selected) {
      agents.filter(agent => 
        agent.office === office && !selectedAgents.has(agent.name)
      ).forEach(agent => {
        selectedAgents.add(agent.name);
      });
    }
  });
  
  return Array.from(selectedAgents).map(agentName => 
    agents.find(agent => agent.name === agentName)
  ).filter(Boolean);
};

// 사전예약 데이터 가져오기
const fetchReservationData = async () => {
  try {
    // 온세일접수 데이터 (1순위)
    const onSaleResponse = await fetch(`${API_BASE_URL}/api/reservation-data/on-sale-receipt`);
    const onSaleData = onSaleResponse.ok ? await onSaleResponse.json() : { data: [] };
    
    // 마당접수 데이터 (2순위)
    const yardResponse = await fetch(`${API_BASE_URL}/api/reservation-data/yard-receipt`);
    const yardData = yardResponse.ok ? await yardResponse.json() : { data: [] };
    
    // 사전예약사이트 데이터 (3순위)
    const siteResponse = await fetch(`${API_BASE_URL}/api/reservation-data/reservation-site`);
    const siteData = siteResponse.ok ? await siteResponse.json() : { data: [] };
    
    return {
      onSale: onSaleData.data || [],
      yard: yardData.data || [],
      site: siteData.data || []
    };
  } catch (error) {
    console.error('사전예약 데이터 가져오기 실패:', error);
    return {
      onSale: [],
      yard: [],
      site: []
    };
  }
};

// 접수시간 파싱
const parseReceiptTime = (timeString) => {
  if (!timeString) return new Date(0);
  
  try {
    // 다양한 시간 형식 처리
    const date = new Date(timeString);
    return isNaN(date.getTime()) ? new Date(0) : date;
  } catch (error) {
    console.error('시간 파싱 실패:', timeString, error);
    return new Date(0);
  }
};

// 우선순위 기반 배정 계산
export const calculateReservationAssignment = async (
  settings,
  selectedTargets,
  setProgress,
  setProgressMessage
) => {
  try {
    console.log('사전예약 배정 계산 시작');
    console.log('설정:', settings);
    console.log('선택된 대상자:', selectedTargets.length, '명');
    
    setProgress(10);
    setProgressMessage('사전예약 데이터 수집 중...');
    
    // 사전예약 데이터 가져오기
    const reservationData = await fetchReservationData();
    
    setProgress(30);
    setProgressMessage('데이터 정렬 및 필터링 중...');
    
    // 선택된 모델들
    const selectedModels = Object.entries(settings.models)
      .filter(([key, model]) => model.enabled)
      .map(([key, model]) => ({
        key,
        name: model.name,
        color: model.color,
        quantity: model.quantity
      }));
    
    console.log('선택된 모델:', selectedModels);
    
    // 고객명 + 대리점코드 기준으로 중복 제거 및 우선순위 적용
    const customerStoreMap = new Map(); // 고객명_대리점코드 -> 최고우선순위 아이템
    
    console.log('온세일 데이터:', reservationData.onSale.length, '건');
    console.log('마당접수 데이터:', reservationData.yard.length, '건');
    console.log('사전예약사이트 데이터:', reservationData.site.length, '건');
    
    // 1순위: 온세일접수 (고객명 + 대리점코드 매칭)
    const filteredOnSale = reservationData.onSale.filter(item => 
      selectedModels.some(model => model.name === item.model && model.color === item.color)
    );
    console.log('필터링된 온세일 데이터:', filteredOnSale.length, '건');
    
    filteredOnSale.forEach(item => {
      const key = `${item.customerName}_${item.storeCode}`;
      if (!customerStoreMap.has(key)) {
        customerStoreMap.set(key, { ...item, priority: 1, source: 'onSale' });
        console.log(`온세일 매칭: ${item.customerName} (${item.storeCode}) -> ${item.model} ${item.color}`);
      }
    });
    
    // 2순위: 마당접수 (고객명 + 대리점코드 매칭, 온세일에서 이미 처리된 고객은 제외)
    const filteredYard = reservationData.yard.filter(item => 
      selectedModels.some(model => model.name === item.model && model.color === item.color)
    );
    console.log('필터링된 마당접수 데이터:', filteredYard.length, '건');
    
    filteredYard.forEach(item => {
      const key = `${item.customerName}_${item.storeCode}`;
      if (!customerStoreMap.has(key)) {
        customerStoreMap.set(key, { ...item, priority: 2, source: 'yard' });
        console.log(`마당접수 매칭: ${item.customerName} (${item.storeCode}) -> ${item.model} ${item.color}`);
      }
    });
    
    // 3순위: 사전예약사이트 (고객명 + 대리점코드 매칭, 온세일/마당접수에서 이미 처리된 고객은 제외)
    const filteredSite = reservationData.site.filter(item => 
      selectedModels.some(model => model.name === item.model && model.color === item.color)
    );
    console.log('필터링된 사전예약사이트 데이터:', filteredSite.length, '건');
    
    filteredSite.forEach(item => {
      const key = `${item.customerName}_${item.storeCode}`;
      if (!customerStoreMap.has(key)) {
        customerStoreMap.set(key, { ...item, priority: 3, source: 'site' });
        console.log(`사전예약사이트 매칭: ${item.customerName} (${item.storeCode}) -> ${item.model} ${item.color}`);
      }
    });
    
    console.log('최종 매칭된 고객 수:', customerStoreMap.size, '명');
    
    // 우선순위별로 정렬된 데이터 생성 (사전예약사이트 사이트예약시간 오름차순 우선)
    const sortedData = {
      onSale: Array.from(customerStoreMap.values())
        .filter(item => item.priority === 1)
        .sort((a, b) => {
          // 온세일접수는 사전예약사이트의 사이트예약시간으로 정렬
          const siteA = reservationData.site.find(site => 
            site.customerName === a.customerName && site.storeCode === a.storeCode
          );
          const siteB = reservationData.site.find(site => 
            site.customerName === b.customerName && site.storeCode === b.storeCode
          );
          return parseReceiptTime(siteA?.receiptTime || a.receiptTime) - parseReceiptTime(siteB?.receiptTime || b.receiptTime);
        }),
      
      yard: Array.from(customerStoreMap.values())
        .filter(item => item.priority === 2)
        .sort((a, b) => {
          // 마당접수도 사전예약사이트의 사이트예약시간으로 정렬
          const siteA = reservationData.site.find(site => 
            site.customerName === a.customerName && site.storeCode === a.storeCode
          );
          const siteB = reservationData.site.find(site => 
            site.customerName === b.customerName && site.storeCode === b.storeCode
          );
          return parseReceiptTime(siteA?.receiptTime || a.receiptTime) - parseReceiptTime(siteB?.receiptTime || b.receiptTime);
        }),
      
      site: Array.from(customerStoreMap.values())
        .filter(item => item.priority === 3)
        .sort((a, b) => parseReceiptTime(a.receiptTime) - parseReceiptTime(b.receiptTime))
    };
    
    setProgress(50);
    setProgressMessage('배정 로직 실행 중...');
    
    // 배정 결과
    const assignments = [];
    const agentAssignments = new Map(); // 담당자별 배정 현황
    
    // 담당자별 초기화
    selectedTargets.forEach(agent => {
      agentAssignments.set(agent.name, {
        agent: agent.name,
        assignments: [],
        totalQuantity: 0
      });
    });
    
    // 우선순위별로 배정 실행
    const allItems = [
      ...sortedData.onSale,
      ...sortedData.yard,
      ...sortedData.site
    ].sort((a, b) => {
      // 1순위: 우선순위
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // 2순위: 접수시간
      return parseReceiptTime(a.receiptTime) - parseReceiptTime(b.receiptTime);
    });
    
    console.log('정렬된 전체 아이템:', allItems.length, '개');
    
    // 순차 배정
    allItems.forEach((item, index) => {
      // 해당 모델의 최대 수량 확인
      const modelConfig = selectedModels.find(model => 
        model.name === item.model && model.color === item.color
      );
      
      if (!modelConfig) return;
      
      // 현재까지 배정된 수량 확인
      const currentAssigned = assignments.filter(assignment => 
        assignment.model === item.model && 
        assignment.color === item.color
      ).reduce((sum, assignment) => sum + assignment.quantity, 0);
      
      // 남은 수량이 있는지 확인
      if (currentAssigned >= modelConfig.quantity) return;
      
      // 담당자 선택 (가장 적게 배정받은 담당자 우선)
      const availableAgents = Array.from(agentAssignments.values())
        .sort((a, b) => a.totalQuantity - b.totalQuantity);
      
      if (availableAgents.length === 0) return;
      
      const selectedAgent = availableAgents[0];
      
      // 배정 실행
      const assignment = {
        agent: selectedAgent.agent,
        model: item.model,
        color: item.color,
        quantity: 1,
        priority: item.priority,
        source: item.source,
        receiptTime: item.receiptTime,
        reservationNumber: item.reservationNumber,
        customerName: item.customerName
      };
      
      assignments.push(assignment);
      
      // 담당자별 배정 현황 업데이트
      const agentData = agentAssignments.get(selectedAgent.agent);
      agentData.assignments.push(assignment);
      agentData.totalQuantity += 1;
      
      // 진행률 업데이트
      if (index % 10 === 0) {
        const progress = 50 + Math.floor((index / allItems.length) * 40);
        setProgress(progress);
        setProgressMessage(`배정 진행 중... (${index + 1}/${allItems.length})`);
      }
    });
    
    setProgress(90);
    setProgressMessage('배정 결과 정리 중...');
    
    // 배정 결과 정리
    const result = {
      assignments,
      summary: {
        totalAssignments: assignments.length,
        byPriority: {
          1: assignments.filter(a => a.priority === 1).length,
          2: assignments.filter(a => a.priority === 2).length,
          3: assignments.filter(a => a.priority === 3).length
        },
        byAgent: Array.from(agentAssignments.values()).map(agent => ({
          agent: agent.agent,
          totalQuantity: agent.totalQuantity,
          assignments: agent.assignments.length
        })),
        byModel: selectedModels.map(model => ({
          model: model.name,
          color: model.color,
          requested: model.quantity,
          assigned: assignments.filter(a => 
            a.model === model.name && a.color === model.color
          ).reduce((sum, a) => sum + a.quantity, 0)
        }))
      },
      settings: settings,
      timestamp: new Date().toISOString()
    };
    
    // 캐시에 저장
    const cacheKey = `reservation_assignment_${JSON.stringify(settings)}_${selectedTargets.length}`;
    cacheUtils.set(cacheKey, result);
    
    setProgress(100);
    setProgressMessage('배정 계산 완료');
    
    console.log('✅ 사전예약 배정 계산 완료');
    console.log('배정 결과:', result);
    
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    console.error('사전예약 배정 계산 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 캐시 클리어
export const clearReservationAssignmentCache = () => {
  cacheUtils.clear();
  console.log('✅ 사전예약 배정 캐시 클리어 완료');
};

// 배정 결과 검증
export const validateAssignmentResult = (result) => {
  if (!result || !result.assignments) {
    return { valid: false, error: '배정 결과가 없습니다.' };
  }
  
  const assignments = result.assignments;
  
  // 기본 검증
  if (assignments.length === 0) {
    return { valid: false, error: '배정된 항목이 없습니다.' };
  }
  
  // 중복 검증
  const seen = new Set();
  for (const assignment of assignments) {
    const key = `${assignment.agent}_${assignment.model}_${assignment.color}_${assignment.reservationNumber}`;
    if (seen.has(key)) {
      return { valid: false, error: '중복 배정이 발견되었습니다.' };
    }
    seen.add(key);
  }
  
  return { valid: true };
};

// 배정 통계 생성
export const generateAssignmentStats = (result) => {
  if (!result || !result.assignments) {
    return null;
  }
  
  const assignments = result.assignments;
  
  // 우선순위별 통계
  const priorityStats = {
    1: { count: 0, percentage: 0 },
    2: { count: 0, percentage: 0 },
    3: { count: 0, percentage: 0 }
  };
  
  assignments.forEach(assignment => {
    priorityStats[assignment.priority].count++;
  });
  
  const total = assignments.length;
  Object.keys(priorityStats).forEach(priority => {
    priorityStats[priority].percentage = total > 0 ? 
      Math.round((priorityStats[priority].count / total) * 100) : 0;
  });
  
  // 담당자별 통계
  const agentStats = {};
  assignments.forEach(assignment => {
    if (!agentStats[assignment.agent]) {
      agentStats[assignment.agent] = { count: 0, models: new Set() };
    }
    agentStats[assignment.agent].count++;
    agentStats[assignment.agent].models.add(`${assignment.model} ${assignment.color}`);
  });
  
  // 모델별 통계
  const modelStats = {};
  assignments.forEach(assignment => {
    const modelKey = `${assignment.model} ${assignment.color}`;
    if (!modelStats[modelKey]) {
      modelStats[modelKey] = { count: 0, agents: new Set() };
    }
    modelStats[modelKey].count++;
    modelStats[modelKey].agents.add(assignment.agent);
  });
  
  return {
    total: total,
    priorityStats,
    agentStats: Object.entries(agentStats).map(([agent, stats]) => ({
      agent,
      count: stats.count,
      models: Array.from(stats.models)
    })),
    modelStats: Object.entries(modelStats).map(([model, stats]) => ({
      model,
      count: stats.count,
      agents: Array.from(stats.agents)
    }))
  };
};

// 배정 결과 내보내기
export const exportAssignmentResult = (result, format = 'json') => {
  if (!result || !result.assignments) {
    return null;
  }
  
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);
    
    case 'csv':
      const headers = ['담당자', '모델', '색상', '수량', '우선순위', '접수시간', '예약번호', '고객명'];
      const rows = result.assignments.map(assignment => [
        assignment.agent,
        assignment.model,
        assignment.color,
        assignment.quantity,
        assignment.priority,
        assignment.receiptTime,
        assignment.reservationNumber,
        assignment.customerName
      ]);
      
      return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    default:
      return null;
  }
}; 