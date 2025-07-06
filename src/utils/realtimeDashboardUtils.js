// 실시간 대시보드 유틸리티

// 실시간 데이터 타입
export const REALTIME_DATA_TYPES = {
  INVENTORY: 'inventory',
  ASSIGNMENT: 'assignment',
  ACTIVATION: 'activation',
  NOTIFICATION: 'notification',
  SYSTEM: 'system'
};

// 실시간 이벤트 타입
export const REALTIME_EVENTS = {
  DATA_UPDATE: 'data_update',
  ASSIGNMENT_COMPLETE: 'assignment_complete',
  INVENTORY_CHANGE: 'inventory_change',
  ACTIVATION_UPDATE: 'activation_update',
  NOTIFICATION_NEW: 'notification_new',
  SYSTEM_ALERT: 'system_alert'
};

// 실시간 대시보드 관리자 클래스
class RealtimeDashboardManager {
  constructor() {
    this.subscribers = new Map();
    this.dataCache = new Map();
    this.updateInterval = null;
    this.websocket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    this.initialize();
  }

  // 초기화
  initialize() {
    console.log('실시간 대시보드 매니저 초기화');
    
    // 주기적 데이터 업데이트 설정
    this.startPeriodicUpdates();
    
    // WebSocket 연결 시도 (선택적)
    this.connectWebSocket();
    
    // 브라우저 탭 포커스 이벤트 리스너
    this.setupFocusListener();
    
    // 네트워크 상태 모니터링
    this.setupNetworkListener();
  }

  // 주기적 업데이트 시작
  startPeriodicUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      this.performPeriodicUpdate();
    }, 30000); // 30초마다 업데이트
  }

  // 주기적 업데이트 수행
  async performPeriodicUpdate() {
    try {
      console.log('실시간 데이터 주기적 업데이트 시작');
      
      // 여러 데이터 소스에서 병렬로 데이터 가져오기
      const updatePromises = [
        this.updateInventoryData(),
        this.updateAssignmentData(),
        this.updateActivationData(),
        this.updateSystemStatus()
      ];
      
      const results = await Promise.allSettled(updatePromises);
      
      // 성공한 업데이트들 처리
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const dataType = ['inventory', 'assignment', 'activation', 'system'][index];
          this.notifySubscribers(dataType, result.value);
        } else {
          console.error(`실시간 데이터 업데이트 실패 (${index}):`, result.reason);
        }
      });
      
    } catch (error) {
      console.error('실시간 데이터 업데이트 중 오류:', error);
    }
  }

  // 재고 데이터 업데이트
  async updateInventoryData() {
    try {
      const API_URL = process.env.REACT_APP_API_URL;
      const response = await fetch(`${API_URL}/api/inventory-summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 캐시 업데이트
      this.dataCache.set(REALTIME_DATA_TYPES.INVENTORY, {
        data,
        timestamp: Date.now(),
        source: 'api'
      });
      
      return data;
    } catch (error) {
      console.error('재고 데이터 업데이트 실패:', error);
      
      // 캐시된 데이터 반환
      const cached = this.dataCache.get(REALTIME_DATA_TYPES.INVENTORY);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5분 이내
        return cached.data;
      }
      
      throw error;
    }
  }

  // 배정 데이터 업데이트
  async updateAssignmentData() {
    try {
      const API_URL = process.env.REACT_APP_API_URL;
      const response = await fetch(`${API_URL}/api/assignment-summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 캐시 업데이트
      this.dataCache.set(REALTIME_DATA_TYPES.ASSIGNMENT, {
        data,
        timestamp: Date.now(),
        source: 'api'
      });
      
      return data;
    } catch (error) {
      console.error('배정 데이터 업데이트 실패:', error);
      
      // 캐시된 데이터 반환
      const cached = this.dataCache.get(REALTIME_DATA_TYPES.ASSIGNMENT);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5분 이내
        return cached.data;
      }
      
      throw error;
    }
  }

  // 개통 데이터 업데이트
  async updateActivationData() {
    try {
      const API_URL = process.env.REACT_APP_API_URL;
      const response = await fetch(`${API_URL}/api/activation-summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 캐시 업데이트
      this.dataCache.set(REALTIME_DATA_TYPES.ACTIVATION, {
        data,
        timestamp: Date.now(),
        source: 'api'
      });
      
      return data;
    } catch (error) {
      console.error('개통 데이터 업데이트 실패:', error);
      
      // 캐시된 데이터 반환
      const cached = this.dataCache.get(REALTIME_DATA_TYPES.ACTIVATION);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5분 이내
        return cached.data;
      }
      
      throw error;
    }
  }

  // 시스템 상태 업데이트
  async updateSystemStatus() {
    try {
      const status = {
        timestamp: Date.now(),
        uptime: this.getUptime(),
        memory: this.getMemoryUsage(),
        network: this.getNetworkStatus(),
        performance: this.getPerformanceMetrics()
      };
      
      // 캐시 업데이트
      this.dataCache.set(REALTIME_DATA_TYPES.SYSTEM, {
        data: status,
        timestamp: Date.now(),
        source: 'local'
      });
      
      return status;
    } catch (error) {
      console.error('시스템 상태 업데이트 실패:', error);
      throw error;
    }
  }

  // 시스템 가동 시간 계산
  getUptime() {
    if (!window.performance || !window.performance.timing) {
      return Date.now() - (window.performance.timeOrigin || Date.now());
    }
    
    const timing = window.performance.timing;
    return Date.now() - timing.navigationStart;
  }

  // 메모리 사용량 확인
  getMemoryUsage() {
    if (!window.performance || !window.performance.memory) {
      return null;
    }
    
    const memory = window.performance.memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }

  // 네트워크 상태 확인
  getNetworkStatus() {
    if (!navigator.connection) {
      return { online: navigator.onLine };
    }
    
    const connection = navigator.connection;
    return {
      online: navigator.onLine,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt
    };
  }

  // 성능 메트릭 수집
  getPerformanceMetrics() {
    const metrics = {};
    
    // 페이지 로드 시간
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      metrics.pageLoadTime = timing.loadEventEnd - timing.navigationStart;
      metrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
    }
    
    // 현재 FPS (간단한 추정)
    if (window.requestAnimationFrame) {
      let frameCount = 0;
      let lastTime = performance.now();
      
      const countFrames = (currentTime) => {
        frameCount++;
        if (currentTime - lastTime >= 1000) {
          metrics.fps = frameCount;
          frameCount = 0;
          lastTime = currentTime;
        }
        requestAnimationFrame(countFrames);
      };
      
      requestAnimationFrame(countFrames);
    }
    
    return metrics;
  }

  // WebSocket 연결
  connectWebSocket() {
    try {
      const API_URL = process.env.REACT_APP_API_URL;
      const wsUrl = API_URL.replace('http', 'ws') + '/ws/dashboard';
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('실시간 대시보드 WebSocket 연결됨');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('실시간 대시보드 WebSocket 연결 끊어짐');
        this.isConnected = false;
        this.attemptReconnect();
      };
      
      this.websocket.onerror = (error) => {
        console.error('실시간 대시보드 WebSocket 오류:', error);
        this.isConnected = false;
      };
      
    } catch (error) {
      console.error('WebSocket 연결 실패:', error);
    }
  }

  // WebSocket 재연결 시도
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('WebSocket 최대 재연결 시도 횟수 초과');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`WebSocket 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts} (${delay}ms 후)`);
    
    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  // WebSocket 메시지 처리
  handleWebSocketMessage(message) {
    const { type, data, timestamp } = message;
    
    switch (type) {
      case REALTIME_EVENTS.DATA_UPDATE:
        this.handleDataUpdate(data);
        break;
      case REALTIME_EVENTS.ASSIGNMENT_COMPLETE:
        this.handleAssignmentComplete(data);
        break;
      case REALTIME_EVENTS.INVENTORY_CHANGE:
        this.handleInventoryChange(data);
        break;
      case REALTIME_EVENTS.ACTIVATION_UPDATE:
        this.handleActivationUpdate(data);
        break;
      case REALTIME_EVENTS.NOTIFICATION_NEW:
        this.handleNewNotification(data);
        break;
      case REALTIME_EVENTS.SYSTEM_ALERT:
        this.handleSystemAlert(data);
        break;
      default:
        console.warn('알 수 없는 WebSocket 메시지 타입:', type);
    }
  }

  // 데이터 업데이트 처리
  handleDataUpdate(data) {
    const { dataType, content } = data;
    
    // 캐시 업데이트
    this.dataCache.set(dataType, {
      data: content,
      timestamp: Date.now(),
      source: 'websocket'
    });
    
    // 구독자들에게 알림
    this.notifySubscribers(dataType, content);
  }

  // 배정 완료 처리
  handleAssignmentComplete(data) {
    console.log('배정 완료 이벤트:', data);
    
    // 배정 데이터 즉시 업데이트
    this.updateAssignmentData();
    
    // 알림 표시
    this.showNotification('배정 완료', `${data.assignmentType} 배정이 완료되었습니다.`);
  }

  // 재고 변경 처리
  handleInventoryChange(data) {
    console.log('재고 변경 이벤트:', data);
    
    // 재고 데이터 즉시 업데이트
    this.updateInventoryData();
    
    // 알림 표시
    this.showNotification('재고 변경', `${data.storeName}의 재고가 변경되었습니다.`);
  }

  // 개통 업데이트 처리
  handleActivationUpdate(data) {
    console.log('개통 업데이트 이벤트:', data);
    
    // 개통 데이터 즉시 업데이트
    this.updateActivationData();
    
    // 알림 표시
    this.showNotification('개통 업데이트', '개통 실적이 업데이트되었습니다.');
  }

  // 새 알림 처리
  handleNewNotification(data) {
    console.log('새 알림 이벤트:', data);
    
    // 알림 표시
    this.showNotification(data.title, data.message, data.type);
  }

  // 시스템 알림 처리
  handleSystemAlert(data) {
    console.log('시스템 알림 이벤트:', data);
    
    // 시스템 알림 표시
    this.showNotification('시스템 알림', data.message, 'warning');
  }

  // 알림 표시
  showNotification(title, message, type = 'info') {
    // 브라우저 알림 API 사용
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: 'dashboard-notification'
      });
    }
    
    // 커스텀 알림 시스템에도 전달
    if (window.notificationManager) {
      window.notificationManager.showNotification(title, message, type);
    }
  }

  // 브라우저 탭 포커스 리스너 설정
  setupFocusListener() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('페이지 포커스됨 - 실시간 데이터 새로고침');
        this.performPeriodicUpdate();
      }
    });
    
    window.addEventListener('focus', () => {
      console.log('윈도우 포커스됨 - 실시간 데이터 새로고침');
      this.performPeriodicUpdate();
    });
  }

  // 네트워크 상태 리스너 설정
  setupNetworkListener() {
    window.addEventListener('online', () => {
      console.log('네트워크 연결됨 - 실시간 데이터 새로고침');
      this.performPeriodicUpdate();
      this.connectWebSocket();
    });
    
    window.addEventListener('offline', () => {
      console.log('네트워크 연결 끊어짐');
      this.isConnected = false;
    });
  }

  // 구독자 등록
  subscribe(dataType, callback) {
    if (!this.subscribers.has(dataType)) {
      this.subscribers.set(dataType, new Set());
    }
    
    this.subscribers.get(dataType).add(callback);
    
    // 즉시 현재 데이터 전송
    const cached = this.dataCache.get(dataType);
    if (cached) {
      callback(cached.data);
    }
    
    console.log(`실시간 데이터 구독 등록: ${dataType}`);
  }

  // 구독자 해제
  unsubscribe(dataType, callback) {
    if (this.subscribers.has(dataType)) {
      this.subscribers.get(dataType).delete(callback);
      console.log(`실시간 데이터 구독 해제: ${dataType}`);
    }
  }

  // 구독자들에게 알림
  notifySubscribers(dataType, data) {
    if (this.subscribers.has(dataType)) {
      this.subscribers.get(dataType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('구독자 콜백 실행 오류:', error);
        }
      });
    }
  }

  // 수동 데이터 새로고침
  async refreshData(dataType) {
    try {
      let data;
      
      switch (dataType) {
        case REALTIME_DATA_TYPES.INVENTORY:
          data = await this.updateInventoryData();
          break;
        case REALTIME_DATA_TYPES.ASSIGNMENT:
          data = await this.updateAssignmentData();
          break;
        case REALTIME_DATA_TYPES.ACTIVATION:
          data = await this.updateActivationData();
          break;
        case REALTIME_DATA_TYPES.SYSTEM:
          data = await this.updateSystemStatus();
          break;
        default:
          throw new Error(`알 수 없는 데이터 타입: ${dataType}`);
      }
      
      this.notifySubscribers(dataType, data);
      return data;
    } catch (error) {
      console.error(`데이터 새로고침 실패 (${dataType}):`, error);
      throw error;
    }
  }

  // 모든 데이터 새로고침
  async refreshAllData() {
    console.log('모든 실시간 데이터 새로고침 시작');
    
    try {
      await this.performPeriodicUpdate();
      console.log('모든 실시간 데이터 새로고침 완료');
    } catch (error) {
      console.error('모든 데이터 새로고침 실패:', error);
      throw error;
    }
  }

  // 캐시된 데이터 가져오기
  getCachedData(dataType) {
    const cached = this.dataCache.get(dataType);
    if (cached) {
      return {
        ...cached.data,
        _cached: true,
        _timestamp: cached.timestamp,
        _source: cached.source
      };
    }
    return null;
  }

  // 연결 상태 확인
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      lastUpdate: this.getLastUpdateTime()
    };
  }

  // 마지막 업데이트 시간
  getLastUpdateTime() {
    const timestamps = Array.from(this.dataCache.values()).map(cache => cache.timestamp);
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }

  // 통계 정보 가져오기
  getStats() {
    const stats = {
      subscribers: 0,
      cachedDataTypes: this.dataCache.size,
      connectionStatus: this.getConnectionStatus(),
      memoryUsage: this.getMemoryUsage(),
      uptime: this.getUptime()
    };
    
    // 구독자 수 계산
    this.subscribers.forEach(subscriberSet => {
      stats.subscribers += subscriberSet.size;
    });
    
    return stats;
  }

  // 정리
  cleanup() {
    console.log('실시간 대시보드 매니저 정리 시작');
    
    // 주기적 업데이트 중지
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // WebSocket 연결 종료
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    // 구독자 목록 정리
    this.subscribers.clear();
    
    // 캐시 정리
    this.dataCache.clear();
    
    console.log('실시간 대시보드 매니저 정리 완료');
  }
}

// 싱글톤 인스턴스 생성
export const realtimeDashboardManager = new RealtimeDashboardManager();

// 편의 함수들
export const subscribeToRealtimeData = (dataType, callback) => {
  realtimeDashboardManager.subscribe(dataType, callback);
};

export const unsubscribeFromRealtimeData = (dataType, callback) => {
  realtimeDashboardManager.unsubscribe(dataType, callback);
};

export const refreshRealtimeData = (dataType) => {
  return realtimeDashboardManager.refreshData(dataType);
};

export const refreshAllRealtimeData = () => {
  return realtimeDashboardManager.refreshAllData();
};

export const getRealtimeStats = () => {
  return realtimeDashboardManager.getStats();
};

export const getCachedRealtimeData = (dataType) => {
  return realtimeDashboardManager.getCachedData(dataType);
}; 