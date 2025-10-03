import { GoogleSpreadsheet } from 'google-spreadsheet';

const API_URL = process.env.REACT_APP_API_URL || 'https://jegomap2-server.onrender.com';

// 정책 관련 API 엔드포인트
const POLICY_ENDPOINTS = {
  GET_POLICIES: '/api/policies',
  CREATE_POLICY: '/api/policies',
  UPDATE_POLICY: '/api/policies',
  DELETE_POLICY: '/api/policies',
  APPROVE_POLICY: '/api/policies/approve',
  GET_NOTIFICATIONS: '/api/policies/notifications'
};

export class PolicyService {
  // 정책 목록 조회
  static async getPolicies(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.yearMonth) queryParams.append('yearMonth', filters.yearMonth);
      if (filters.policyType) queryParams.append('policyType', filters.policyType);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.userId) queryParams.append('userId', filters.userId);
      if (filters.approvalStatus) queryParams.append('approvalStatus', filters.approvalStatus);
      
      const response = await fetch(`${API_URL}${POLICY_ENDPOINTS.GET_POLICIES}?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.policies || [];
    } catch (error) {
      console.error('정책 목록 조회 실패:', error);
      throw error;
    }
  }

  // 정책 생성
  static async createPolicy(policyData) {
    try {
      const response = await fetch(`${API_URL}${POLICY_ENDPOINTS.CREATE_POLICY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(policyData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('정책 생성 실패:', error);
      throw error;
    }
  }

  // 정책 수정
  static async updatePolicy(policyId, updateData) {
    try {
      const response = await fetch(`${API_URL}${POLICY_ENDPOINTS.UPDATE_POLICY}/${policyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('정책 수정 실패:', error);
      throw error;
    }
  }

  // 정책 삭제
  static async deletePolicy(policyId) {
    try {
      const response = await fetch(`${API_URL}${POLICY_ENDPOINTS.DELETE_POLICY}/${policyId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('정책 삭제 실패:', error);
      throw error;
    }
  }

  // 정책 취소
  static async cancelPolicy(policyId, cancelData) {
    try {
      const response = await fetch(`${API_URL}/api/policies/${policyId}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cancelData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('정책 취소 실패:', error);
      throw error;
    }
  }

  // 승인 취소
  static async cancelApproval(policyId, cancelData) {
    try {
      const response = await fetch(`${API_URL}/api/policies/${policyId}/approval-cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cancelData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('승인 취소 실패:', error);
      throw error;
    }
  }

  // 정산 반영
  static async reflectSettlement(policyId, settlementData) {
    try {
      const response = await fetch(`${API_URL}/api/policies/${policyId}/settlement-reflect`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settlementData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('정산 반영 실패:', error);
      throw error;
    }
  }

  // 정책 승인
  static async approvePolicy(policyId, approvalData) {
    try {
      const response = await fetch(`${API_URL}/api/policies/${policyId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(approvalData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('정책 승인 실패:', error);
      throw error;
    }
  }

  // 알림 목록 조회
  static async getNotifications(userId) {
    try {
      const response = await fetch(`${API_URL}${POLICY_ENDPOINTS.GET_NOTIFICATIONS}?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.notifications || [];
    } catch (error) {
      console.error('알림 목록 조회 실패:', error);
      throw error;
    }
  }

  // 카테고리별 정책 개수 조회
  static async getPolicyCounts(yearMonth, policyType) {
    try {
      const policies = await this.getPolicies({ yearMonth, policyType });
      
      const counts = {};
      policies.forEach(policy => {
        const category = policy.category;
        counts[category] = (counts[category] || 0) + 1;
      });
      
      return counts;
    } catch (error) {
      console.error('정책 개수 조회 실패:', error);
      return {};
    }
  }

  // 사용자 권한 확인
  static getUserPermissionLevel(userId, userPermissions) {
    // 권한 레벨 매핑
    const permissionLevels = {
      'SS': 'total',      // 총괄
      'S': 'settlement',  // 정산팀
      'AA': 'team_a',     // A소속정책팀
      'BB': 'team_b',     // B소속정책팀
      'CC': 'team_c',     // C소속정책팀
      'DD': 'team_d',     // D소속정책팀
      'EE': 'team_e',     // E소속정책팀
      'FF': 'team_f',     // F소속정책팀
      'A': 'user_a',      // A일반 사용자
      'B': 'user_b',      // B일반 사용자
      'C': 'user_c',      // C일반 사용자
      'D': 'user_d',      // D일반 사용자
      'E': 'user_e',      // E일반 사용자
      'F': 'user_f'       // F일반 사용자
    };

    return permissionLevels[userPermissions] || 'user';
  }

  // 권한에 따른 접근 가능한 정책 필터링
  static filterPoliciesByPermission(policies, userPermission, userId) {
    const permissionLevel = this.getUserPermissionLevel(userId, userPermission);
    
    switch (permissionLevel) {
      case 'total':
      case 'settlement':
        // 총괄, 정산팀: 모든 정책 접근 가능
        return policies;
        
      case 'team_a':
      case 'team_b':
      case 'team_c':
      case 'team_d':
      case 'team_e':
      case 'team_f':
        // 소속정책팀: 해당 팀 사용자들의 정책만 접근 가능
        const teamPrefix = permissionLevel.replace('team_', '');
        return policies.filter(policy => 
          policy.inputUserId && policy.inputUserId.startsWith(teamPrefix)
        );
        
      default:
        // 일반 사용자: 본인이 입력한 정책만 접근 가능
        return policies.filter(policy => policy.inputUserId === userId);
    }
  }

  // 승인 상태별 색상 반환
  static getApprovalStatusColor(status) {
    switch (status) {
      case '승인':
        return 'success';
      case '반려':
        return 'error';
      case '대기':
        return 'warning';
      default:
        return 'default';
    }
  }

  // 정책 타입별 라벨 반환
  static getPolicyTypeLabel(policyType) {
    return policyType === 'wireless' ? '무선' : '유선';
  }

  // 카테고리 목록 조회
  static async getCategories() {
    try {
      const response = await fetch(`${API_URL}/api/policy-categories`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.categories || [];
    } catch (error) {
      console.error('카테고리 목록 조회 실패:', error);
      throw error;
    }
  }

  // 카테고리 추가
  static async createCategory(categoryData) {
    try {
      const response = await fetch(`${API_URL}/api/policy-categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('카테고리 생성 실패:', error);
      throw error;
    }
  }

  // 카테고리별 이름 반환 (기존 방식 - 하위 호환성 유지)
  static getCategoryName(categoryId) {
    const categoryNames = {
      'wireless_shoe': '구두정책',
      'wireless_union': '연합정책',
      'wireless_rate': '요금제유형별정책',
      'wireless_add_support': '부가추가지원정책',
      'wireless_add_deduct': '부가차감지원정책',
      'wireless_grade': '그레이드정책',
      'wireless_individual': '개별소급정책',
      'wired_shoe': '구두정책',
      'wired_union': '연합정책',
      'wired_rate': '요금제유형별정책',
      'wired_add_support': '부가추가지원정책',
      'wired_add_deduct': '부가차감지원정책',
      'wired_grade': '그레이드정책',
      'wired_individual': '개별소급정책'
    };
    
    return categoryNames[categoryId] || '기타';
  }
}

export default PolicyService; 