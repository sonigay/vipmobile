const API_URL = process.env.REACT_APP_API_URL;

// 검수 데이터 가져오기
export async function fetchInspectionData(view = 'personal', userId = null, field = null) {
  try {
    console.log('검수 데이터 요청 중...', { view, userId, field });
    const startTime = Date.now();
    
    const params = new URLSearchParams({ view });
    if (userId) {
      params.append('userId', userId);
    }
    if (field) {
      params.append('field', field);
    }
    
    const response = await fetch(`${API_URL}/api/inspection-data?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    const fetchTime = Date.now() - startTime;
    console.log(`검수 데이터 요청 완료: ${fetchTime}ms, 차이점 수: ${data.total}개`);
    
    return { success: true, data };
  } catch (error) {
    console.error('검수 데이터 가져오기 오류:', error);
    return { success: false, error };
  }
}

// 검수 완료 상태 업데이트
export async function updateInspectionCompletion(itemId, userId, status = '완료') {
  try {
    console.log('검수 완료 상태 업데이트 중...', { itemId, userId, status });
    
    const response = await fetch(`${API_URL}/api/inspection/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId,
        userId,
        status
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('검수 완료 상태 업데이트 성공:', result);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('검수 완료 상태 업데이트 오류:', error);
    return { success: false, error };
  }
}

// 정규화 데이터 저장
export async function saveNormalizationData(itemId, userId, originalValue, normalizedValue, field) {
  try {
    console.log('정규화 데이터 저장 중...', { itemId, userId, field, normalizedValue });
    
    const response = await fetch(`${API_URL}/api/inspection/normalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId,
        userId,
        originalValue,
        normalizedValue,
        field
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('정규화 데이터 저장 성공:', result);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('정규화 데이터 저장 오류:', error);
    return { success: false, error };
  }
}

// 폰클개통데이터 수정
export async function updateSystemData(itemId, userId, field, correctValue, systemRow) {
  try {
    console.log('폰클개통데이터 수정 중...', { itemId, userId, field, correctValue, systemRow });
    
    const response = await fetch(`${API_URL}/api/inspection/update-system-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId,
        userId,
        field,
        correctValue,
        systemRow
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('폰클개통데이터 수정 성공:', result);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('폰클개통데이터 수정 오류:', error);
    return { success: false, error };
  }
}

// 필드별 고유값 조회
export async function fetchFieldValues(field) {
  try {
    console.log('필드값 조회 중...', { field });
    
    const response = await fetch(`${API_URL}/api/inspection/field-values?field=${encodeURIComponent(field)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('필드값 조회 성공:', result);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('필드값 조회 오류:', error);
    return { success: false, error };
  }
}

// 비교 가능한 필드 목록 조회
export async function fetchAvailableFields() {
  try {
    const response = await fetch(`${API_URL}/api/inspection/available-fields`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    console.error('필드 목록 조회 오류:', error);
    return { success: false, error };
  }
}

// 차이점 타입별 색상 반환
export function getDifferenceTypeColor(type) {
  switch (type) {
    case 'manual_only':
      return '#ff9800'; // 주황색
    case 'system_only':
      return '#f44336'; // 빨간색
    case 'mismatch':
      return '#2196f3'; // 파란색
    default:
      return '#757575'; // 회색
  }
}

// 차이점 타입별 라벨 반환
export function getDifferenceTypeLabel(type) {
  switch (type) {
    case 'manual_only':
      return '수기초만';
    case 'system_only':
      return '시스템만';
    case 'mismatch':
      return '값 불일치';
    default:
      return '알 수 없음';
  }
}

// 차이점 필터링 함수
export function filterDifferences(differences, filters) {
  let filtered = differences;

  // 검색어 필터링
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(diff => 
      diff.key.toLowerCase().includes(term) ||
      diff.field.toLowerCase().includes(term) ||
      (diff.correctValue && diff.correctValue.toLowerCase().includes(term)) ||
      (diff.incorrectValue && diff.incorrectValue.toLowerCase().includes(term)) ||
      diff.assignedAgent.toLowerCase().includes(term)
    );
  }

  // 타입 필터링
  if (filters.type && filters.type !== 'all') {
    filtered = filtered.filter(diff => diff.type === filters.type);
  }

  // 처리자 필터링
  if (filters.assignedAgent && filters.assignedAgent !== 'all') {
    filtered = filtered.filter(diff => diff.assignedAgent === filters.assignedAgent);
  }

  // 완료 상태 필터링
  if (filters.completionStatus && filters.completionStatus !== 'all') {
    filtered = filtered.filter(diff => {
      if (filters.completionStatus === 'completed') {
        return diff.completed;
      } else {
        return !diff.completed;
      }
    });
  }

  return filtered;
}

// 처리자 목록 추출
export function extractAssignedAgents(differences) {
  const agents = new Set();
  differences.forEach(diff => {
    if (diff.assignedAgent) {
      agents.add(diff.assignedAgent);
    }
  });
  return Array.from(agents).sort();
}

// 통계 계산
export function calculateStatistics(differences) {
  const stats = {
    total: differences.length,
    manualOnly: differences.filter(d => d.type === 'manual_only').length,
    systemOnly: differences.filter(d => d.type === 'system_only').length,
    mismatched: differences.filter(d => d.type === 'mismatch').length,
    completed: differences.filter(d => d.completed).length,
    pending: differences.filter(d => !d.completed).length
  };

  stats.completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return stats;
} 

// 컬럼 설정 조회
export async function fetchColumnSettings() {
  try {
    const API_URL = process.env.REACT_APP_API_URL;
    const response = await fetch(`${API_URL}/api/inspection/columns`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '컬럼 설정 조회 실패');
    }
    
    return data;
  } catch (error) {
    console.error('컬럼 설정 조회 오류:', error);
    throw error;
  }
}

// 컬럼 설정 업데이트
export async function updateColumnSettings(settings) {
  try {
    const API_URL = process.env.REACT_APP_API_URL;
    const response = await fetch(`${API_URL}/api/inspection/columns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '컬럼 설정 업데이트 실패');
    }
    
    return data;
  } catch (error) {
    console.error('컬럼 설정 업데이트 오류:', error);
    throw error;
  }
}

// 수정완료 상태 업데이트
export async function updateModificationComplete(itemId, userId, isCompleted) {
  try {
    const API_URL = process.env.REACT_APP_API_URL;
    const response = await fetch(`${API_URL}/api/inspection/modification-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ itemId, userId, isCompleted }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '수정완료 상태 업데이트 실패');
    }
    
    return data;
  } catch (error) {
    console.error('수정완료 상태 업데이트 오류:', error);
    throw error;
  }
} 