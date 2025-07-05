const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// 날짜 문자열을 Date 객체로 변환
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // 다양한 날짜 형식 처리
  const dateFormats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}-\d{2}$/,       // MM-DD
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    /^\d{2}\/\d{2}$/       // MM/DD
  ];
  
  for (const format of dateFormats) {
    if (format.test(dateStr)) {
      const parts = dateStr.split(/[-\/]/);
      if (parts.length === 2) {
        // MM-DD 형식인 경우 현재 년도 추가
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, parseInt(parts[0]) - 1, parseInt(parts[1]));
      } else if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    }
  }
  
  return null;
}

// 당월 마지막 개통일 찾기
export function getLastActivationDate(currentMonthData) {
  const validDates = currentMonthData
    .filter(record => record['개통일'] && record['개통'] !== '선불개통')
    .map(record => parseDate(record['개통일']))
    .filter(date => date !== null);
  
  if (validDates.length === 0) {
    // 데이터가 없으면 오늘 날짜 반환
    return new Date();
  }
  
  return new Date(Math.max(...validDates));
}

// 당월 개통실적 데이터 가져오기
export async function fetchCurrentMonthData() {
  try {
    const response = await fetch(`${API_URL}/api/activation-data/current-month`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch current month data:', error);
    throw error;
  }
}

// 전월 개통실적 데이터 가져오기
export async function fetchPreviousMonthData() {
  try {
    const response = await fetch(`${API_URL}/api/activation-data/previous-month`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch previous month data:', error);
    throw error;
  }
}

// 날짜별 개통실적 데이터 가져오기
export async function fetchActivationDataByDate() {
  try {
    const response = await fetch(`${API_URL}/api/activation-data/by-date`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch activation data by date:', error);
    throw error;
  }
}

// 특정 날짜의 당월/전월 개통실적 비교 데이터 가져오기
export async function fetchActivationDateComparison(date) {
  try {
    const response = await fetch(`${API_URL}/api/activation-data/date-comparison/${date}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch activation date comparison data:', error);
    throw error;
  }
}

// 매장별 개통실적 비교 데이터 생성 (지도용)
export function generateStoreActivationComparison(currentMonthData, previousMonthData) {
  // 당월 마지막 개통일 찾기
  const lastActivationDate = getLastActivationDate(currentMonthData);
  
  // 매장별 당월 실적 계산 (담당자 정보 포함)
  const currentMonthStats = {};
  currentMonthData.forEach(record => {
    if (record['개통'] === '선불개통') return;
    
    const store = record['출고처'] || '미지정';
    const agent = record['담당자'] || '미지정';
    const activationDate = parseDate(record['개통일']);
    
    if (!activationDate) return;
    
    // 당월 1일부터 마지막 개통일까지
    const startOfMonth = new Date(lastActivationDate.getFullYear(), lastActivationDate.getMonth(), 1);
    if (activationDate >= startOfMonth && activationDate <= lastActivationDate) {
      if (!currentMonthStats[store]) {
        currentMonthStats[store] = {
          count: 0,
          models: {},
          agents: new Set() // 담당자 정보 수집
        };
      }
      currentMonthStats[store].count++;
      currentMonthStats[store].agents.add(agent);
      
      // 모델별 수량 집계
      const model = record['모델명'] || '미지정';
      const color = record['색상'] || '미지정';
      const modelKey = `${model} (${color})`;
      
      if (!currentMonthStats[store].models[modelKey]) {
        currentMonthStats[store].models[modelKey] = 0;
      }
      currentMonthStats[store].models[modelKey]++;
    }
  });
  
  // 매장별 전월 실적 계산 (동일 기간)
  const previousMonthStats = {};
  previousMonthData.forEach(record => {
    if (record['개통'] === '선불개통') return;
    
    const store = record['출고처'] || '미지정';
    const activationDate = parseDate(record['개통일']);
    
    if (!activationDate) return;
    
    // 전월 1일부터 마지막 개통일과 같은 일자까지
    const startOfPreviousMonth = new Date(lastActivationDate.getFullYear(), lastActivationDate.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(lastActivationDate.getFullYear(), lastActivationDate.getMonth() - 1, lastActivationDate.getDate());
    
    if (activationDate >= startOfPreviousMonth && activationDate <= endOfPreviousMonth) {
      if (!previousMonthStats[store]) {
        previousMonthStats[store] = 0;
      }
      previousMonthStats[store]++;
    }
  });
  
  // 비교 데이터 생성
  const comparisonData = {};
  Object.keys(currentMonthStats).forEach(store => {
    comparisonData[store] = {
      storeName: store,
      currentMonth: currentMonthStats[store].count,
      previousMonth: previousMonthStats[store] || 0,
      models: currentMonthStats[store].models,
      agents: Array.from(currentMonthStats[store].agents), // 담당자 목록
      lastActivationDate: lastActivationDate
    };
  });
  
  return comparisonData;
}

// 담당자별 개통실적 필터링 함수
export function filterActivationByAgent(activationData, agentTarget) {
  if (!activationData || !agentTarget) {
    return {};
  }
  
  const filteredData = {};
  
  Object.entries(activationData).forEach(([storeName, data]) => {
    // 해당 매장의 담당자 목록에서 agentTarget과 매칭되는지 확인
    const hasMatchingAgent = data.agents.some(agent => {
      if (!agent || !agentTarget) return false;
      
      // 담당자명 앞 3글자 비교 (기존 로직과 동일)
      const agentPrefix = agent.toString().substring(0, 3);
      const targetPrefix = agentTarget.toString().substring(0, 3);
      
      return agentPrefix === targetPrefix;
    });
    
    if (hasMatchingAgent) {
      filteredData[storeName] = data;
    }
  });
  
  return filteredData;
}

// 매장별 개통실적 통계 계산
export function calculateActivationStats(data) {
  const stats = {};
  
  data.forEach(record => {
    // 선불개통 제외
    if (record['개통'] === '선불개통') return;
    
    const store = record['출고처'] || '미지정';
    const agent = record['담당자'] || '미지정';
    
    if (!stats[store]) {
      stats[store] = {
        storeName: store,
        totalCount: 0,
        agents: {},
        details: []
      };
    }
    
    if (!stats[store].agents[agent]) {
      stats[store].agents[agent] = {
        agentName: agent,
        count: 0,
        details: []
      };
    }
    
    stats[store].totalCount++;
    stats[store].agents[agent].count++;
    
    const detail = {
      date: record['개통일'],
      time: `${record['개통시']}:${record['개통분']}`,
      model: record['모델명'],
      color: record['색상'],
      serialNumber: record['일련번호'],
      activation: record['개통']
    };
    
    stats[store].details.push(detail);
    stats[store].agents[agent].details.push(detail);
  });
  
  return stats;
}

// 담당자별 개통실적 통계 계산
export function calculateAgentStats(data) {
  const stats = {};
  
  data.forEach(record => {
    // 선불개통 제외
    if (record['개통'] === '선불개통') return;
    
    const agent = record['담당자'] || '미지정';
    const store = record['출고처'] || '미지정';
    
    if (!stats[agent]) {
      stats[agent] = {
        agentName: agent,
        totalCount: 0,
        stores: {},
        details: []
      };
    }
    
    if (!stats[agent].stores[store]) {
      stats[agent].stores[store] = 0;
    }
    
    stats[agent].totalCount++;
    stats[agent].stores[store]++;
    stats[agent].details.push({
      store: store,
      date: record['개통일'],
      time: `${record['개통시']}:${record['개통분']}`,
      model: record['모델명'],
      color: record['색상'],
      serialNumber: record['일련번호'],
      activation: record['개통']
    });
  });
  
  return stats;
} 