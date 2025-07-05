// 배정 히스토리 관리 유틸리티

// 히스토리 저장소 키
const HISTORY_STORAGE_KEY = 'assignmentHistory';
const MAX_HISTORY_COUNT = 50; // 최대 50개 히스토리 보관

// 배정 히스토리 항목 구조
export const createHistoryItem = (assignmentData, settings, agents, metadata = {}) => {
  return {
    id: generateHistoryId(),
    timestamp: new Date().toISOString(),
    assignmentData,
    settings,
    agents: agents.map(agent => ({
      contactId: agent.contactId,
      target: agent.target,
      office: agent.office,
      department: agent.department
    })),
    metadata: {
      totalAgents: agents.length,
      totalModels: Object.keys(assignmentData.models || {}).length,
      totalAssigned: Object.values(assignmentData.models || {}).reduce((sum, model) => sum + model.assignedQuantity, 0),
      totalQuantity: Object.values(assignmentData.models || {}).reduce((sum, model) => sum + model.totalQuantity, 0),
      ...metadata
    },
    version: '1.0'
  };
};

// 고유 히스토리 ID 생성
const generateHistoryId = () => {
  return `assignment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 히스토리 저장
export const saveAssignmentHistory = (historyItem) => {
  try {
    const existingHistory = getAssignmentHistory();
    
    // 새 히스토리를 맨 앞에 추가
    const updatedHistory = [historyItem, ...existingHistory];
    
    // 최대 개수 제한
    if (updatedHistory.length > MAX_HISTORY_COUNT) {
      updatedHistory.splice(MAX_HISTORY_COUNT);
    }
    
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
    return true;
  } catch (error) {
    console.error('히스토리 저장 실패:', error);
    return false;
  }
};

// 히스토리 조회
export const getAssignmentHistory = () => {
  try {
    const history = localStorage.getItem(HISTORY_STORAGE_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('히스토리 조회 실패:', error);
    return [];
  }
};

// 특정 히스토리 조회
export const getHistoryItem = (historyId) => {
  const history = getAssignmentHistory();
  return history.find(item => item.id === historyId);
};

// 히스토리 삭제
export const deleteHistoryItem = (historyId) => {
  try {
    const history = getAssignmentHistory();
    const filteredHistory = history.filter(item => item.id !== historyId);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filteredHistory));
    return true;
  } catch (error) {
    console.error('히스토리 삭제 실패:', error);
    return false;
  }
};

// 히스토리 전체 삭제
export const clearAssignmentHistory = () => {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('히스토리 전체 삭제 실패:', error);
    return false;
  }
};

// 히스토리 통계 계산
export const calculateHistoryStats = () => {
  const history = getAssignmentHistory();
  
  if (history.length === 0) {
    return {
      totalAssignments: 0,
      averageAssigned: 0,
      mostUsedSettings: null,
      recentTrend: 'stable'
    };
  }
  
  const totalAssignments = history.length;
  const averageAssigned = history.reduce((sum, item) => sum + item.metadata.totalAssigned, 0) / totalAssignments;
  
  // 가장 많이 사용된 설정 찾기
  const settingsCount = {};
  history.forEach(item => {
    const settingsKey = JSON.stringify(item.settings.ratios);
    settingsCount[settingsKey] = (settingsCount[settingsKey] || 0) + 1;
  });
  
  const mostUsedSettingsKey = Object.keys(settingsCount).reduce((a, b) => 
    settingsCount[a] > settingsCount[b] ? a : b
  );
  
  const mostUsedSettings = mostUsedSettingsKey ? JSON.parse(mostUsedSettingsKey) : null;
  
  // 최근 트렌드 계산 (최근 5개 vs 이전 5개)
  const recentItems = history.slice(0, 5);
  const previousItems = history.slice(5, 10);
  
  const recentAvg = recentItems.reduce((sum, item) => sum + item.metadata.totalAssigned, 0) / recentItems.length;
  const previousAvg = previousItems.reduce((sum, item) => sum + item.metadata.totalAssigned, 0) / previousItems.length;
  
  let recentTrend = 'stable';
  if (recentAvg > previousAvg * 1.1) {
    recentTrend = 'increasing';
  } else if (recentAvg < previousAvg * 0.9) {
    recentTrend = 'decreasing';
  }
  
  return {
    totalAssignments,
    averageAssigned: Math.round(averageAssigned),
    mostUsedSettings,
    recentTrend
  };
};

// 히스토리 비교 기능
export const compareHistoryItems = (historyId1, historyId2) => {
  const item1 = getHistoryItem(historyId1);
  const item2 = getHistoryItem(historyId2);
  
  if (!item1 || !item2) {
    return null;
  }
  
  const comparison = {
    timestamp1: item1.timestamp,
    timestamp2: item2.timestamp,
    settings: {
      turnoverRate: {
        before: item1.settings.ratios.turnoverRate,
        after: item2.settings.ratios.turnoverRate,
        change: item2.settings.ratios.turnoverRate - item1.settings.ratios.turnoverRate
      },
      storeCount: {
        before: item1.settings.ratios.storeCount,
        after: item2.settings.ratios.storeCount,
        change: item2.settings.ratios.storeCount - item1.settings.ratios.storeCount
      },
      remainingInventory: {
        before: item1.settings.ratios.remainingInventory,
        after: item2.settings.ratios.remainingInventory,
        change: item2.settings.ratios.remainingInventory - item1.settings.ratios.remainingInventory
      },
      salesVolume: {
        before: item1.settings.ratios.salesVolume,
        after: item2.settings.ratios.salesVolume,
        change: item2.settings.ratios.salesVolume - item1.settings.ratios.salesVolume
      }
    },
    results: {
      totalAssigned: {
        before: item1.metadata.totalAssigned,
        after: item2.metadata.totalAssigned,
        change: item2.metadata.totalAssigned - item1.metadata.totalAssigned
      },
      totalAgents: {
        before: item1.metadata.totalAgents,
        after: item2.metadata.totalAgents,
        change: item2.metadata.totalAgents - item1.metadata.totalAgents
      }
    }
  };
  
  return comparison;
};

// 히스토리 내보내기 (JSON)
export const exportHistory = (historyIds = null) => {
  const history = getAssignmentHistory();
  const targetHistory = historyIds 
    ? history.filter(item => historyIds.includes(item.id))
    : history;
  
  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    history: targetHistory
  };
  
  return JSON.stringify(exportData, null, 2);
};

// 히스토리 가져오기 (JSON)
export const importHistory = (jsonData) => {
  try {
    const importData = JSON.parse(jsonData);
    
    if (!importData.history || !Array.isArray(importData.history)) {
      throw new Error('유효하지 않은 히스토리 데이터입니다.');
    }
    
    const existingHistory = getAssignmentHistory();
    const importedHistory = importData.history.map(item => ({
      ...item,
      id: generateHistoryId(), // 새로운 ID 생성
      timestamp: item.timestamp || new Date().toISOString()
    }));
    
    const mergedHistory = [...importedHistory, ...existingHistory];
    
    // 중복 제거 (timestamp 기준)
    const uniqueHistory = mergedHistory.filter((item, index, self) => 
      index === self.findIndex(t => t.timestamp === item.timestamp)
    );
    
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(uniqueHistory));
    return true;
  } catch (error) {
    console.error('히스토리 가져오기 실패:', error);
    return false;
  }
}; 