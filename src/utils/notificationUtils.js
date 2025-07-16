// 알림 및 공지사항 관리 유틸리티

// 알림 타입 정의
export const NOTIFICATION_TYPES = {
  ASSIGNMENT_COMPLETED: 'assignment_completed',
  ASSIGNMENT_UPDATED: 'assignment_updated',
  SETTINGS_CHANGED: 'settings_changed',
  SYSTEM_NOTICE: 'system_notice',
  IMPORTANT_UPDATE: 'important_update'
};

// 알림 우선순위 정의
export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

// 로컬 스토리지 키
const NOTIFICATIONS_KEY = 'assignmentNotifications';
const ANNOUNCEMENTS_KEY = 'systemAnnouncements';
const NOTIFICATION_SETTINGS_KEY = 'notificationSettings';

// 알림 관리 클래스
class NotificationManager {
  constructor() {
    this.notifications = this.loadNotifications();
    this.announcements = this.loadAnnouncements();
    this.settings = this.loadSettings();
  }

  // 알림 로드
  loadNotifications() {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('알림 로드 실패:', error);
      return [];
    }
  }

  // 공지사항 로드
  loadAnnouncements() {
    try {
      const stored = localStorage.getItem(ANNOUNCEMENTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('공지사항 로드 실패:', error);
      return [];
    }
  }

  // 설정 로드
  loadSettings() {
    try {
      const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      return stored ? JSON.parse(stored) : {
        enabled: true,
        sound: true,
        desktop: true,
        email: false,
        autoClear: 7 // 7일 후 자동 삭제
      };
    } catch (error) {
      console.error('알림 설정 로드 실패:', error);
      return {
        enabled: true,
        sound: true,
        desktop: true,
        email: false,
        autoClear: 7
      };
    }
  }

  // 알림 저장
  saveNotifications() {
    try {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(this.notifications));
    } catch (error) {
      console.error('알림 저장 실패:', error);
    }
  }

  // 공지사항 저장
  saveAnnouncements() {
    try {
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(this.announcements));
    } catch (error) {
      console.error('공지사항 저장 실패:', error);
    }
  }

  // 설정 저장
  saveSettings() {
    try {
      localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('알림 설정 저장 실패:', error);
    }
  }

  // 새 알림 추가
  addNotification(type, title, message, priority = NOTIFICATION_PRIORITY.MEDIUM, data = {}) {
    if (!this.settings.enabled) return;

    const notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      priority,
      data,
      timestamp: new Date().toISOString(),
      read: false,
      archived: false
    };

    this.notifications.unshift(notification);
    this.saveNotifications();

    // 데스크톱 알림
    if (this.settings.desktop && 'Notification' in window) {
      this.showDesktopNotification(title, message);
    }

    // 사운드 알림
    if (this.settings.sound) {
      this.playNotificationSound();
    }

    return notification;
  }

  // 배정 완료 알림
  addAssignmentCompletedNotification(assignmentData) {
    const { totalAgents, totalQuantity, models } = assignmentData;
    
    return this.addNotification(
      NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
      '배정 완료',
      `${totalAgents}명의 영업사원에게 총 ${totalQuantity}개의 제품이 배정되었습니다.`,
      NOTIFICATION_PRIORITY.HIGH,
      assignmentData
    );
  }

  // 배정 업데이트 알림
  addAssignmentUpdatedNotification(assignmentData) {
    const { updatedModels, totalQuantity } = assignmentData;
    
    return this.addNotification(
      NOTIFICATION_TYPES.ASSIGNMENT_UPDATED,
      '배정 업데이트',
      `${updatedModels}개 모델의 배정이 업데이트되었습니다. (총 ${totalQuantity}개)`,
      NOTIFICATION_PRIORITY.MEDIUM,
      assignmentData
    );
  }

  // 설정 변경 알림
  addSettingsChangedNotification(settingsData) {
    // 배정 비율 변경 여부 확인
    const hasRatioChanged = settingsData && settingsData.ratios && settingsData.previousRatios;
    let message = '';
    
    if (hasRatioChanged) {
      const changes = [];
      const { ratios, previousRatios, changedBy } = settingsData;
      
      if (ratios.turnoverRate !== previousRatios.turnoverRate) {
        changes.push(`회전율: ${previousRatios.turnoverRate}% → ${ratios.turnoverRate}%`);
      }
      if (ratios.storeCount !== previousRatios.storeCount) {
        changes.push(`거래처수: ${previousRatios.storeCount}% → ${ratios.storeCount}%`);
      }
      if (ratios.remainingInventory !== previousRatios.remainingInventory) {
        changes.push(`잔여재고: ${previousRatios.remainingInventory}% → ${ratios.remainingInventory}%`);
      }
      if (ratios.salesVolume !== previousRatios.salesVolume) {
        changes.push(`판매량: ${previousRatios.salesVolume}% → ${ratios.salesVolume}%`);
      }
      
      if (changes.length > 0) {
        const userName = changedBy || '시스템';
        message = `${userName}님이 배정 비율을 다음과 같이 변경했습니다:\n${changes.join('\n')}`;
      }
    }
    
    // 배정 비율이 변경된 경우에만 알림 전송
    if (message) {
      return this.addNotification(
        NOTIFICATION_TYPES.SETTINGS_CHANGED,
        '배정 비율 변경 알림',
        message,
        NOTIFICATION_PRIORITY.MEDIUM,
        settingsData
      );
    }
    
    return null; // 변경사항이 없으면 알림 전송하지 않음
  }

  // 시스템 공지사항 추가
  addSystemAnnouncement(title, content, priority = NOTIFICATION_PRIORITY.MEDIUM, expiresAt = null) {
    const announcement = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title,
      content,
      priority,
      timestamp: new Date().toISOString(),
      expiresAt,
      active: true
    };

    this.announcements.unshift(announcement);
    this.saveAnnouncements();

    return announcement;
  }

  // 알림 읽음 처리
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.saveNotifications();
    }
  }

  // 알림 아카이브
  archiveNotification(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.archived = true;
      this.saveNotifications();
    }
  }

  // 알림 삭제
  deleteNotification(notificationId) {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.saveNotifications();
  }

  // 공지사항 비활성화
  deactivateAnnouncement(announcementId) {
    const announcement = this.announcements.find(a => a.id === announcementId);
    if (announcement) {
      announcement.active = false;
      this.saveAnnouncements();
    }
  }

  // 공지사항 삭제
  deleteAnnouncement(announcementId) {
    this.announcements = this.announcements.filter(a => a.id !== announcementId);
    this.saveAnnouncements();
  }

  // 읽지 않은 알림 개수
  getUnreadCount() {
    return this.notifications.filter(n => !n.read && !n.archived).length;
  }

  // 활성 공지사항 개수
  getActiveAnnouncementsCount() {
    const now = new Date().toISOString();
    return this.announcements.filter(a => 
      a.active && (!a.expiresAt || a.expiresAt > now)
    ).length;
  }

  // 알림 목록 가져오기 (필터링)
  getNotifications(filters = {}) {
    let filtered = [...this.notifications];

    // 읽음 상태 필터
    if (filters.read !== undefined) {
      filtered = filtered.filter(n => n.read === filters.read);
    }

    // 아카이브 상태 필터
    if (filters.archived !== undefined) {
      filtered = filtered.filter(n => n.archived === filters.archived);
    }

    // 타입 필터
    if (filters.type) {
      filtered = filtered.filter(n => n.type === filters.type);
    }

    // 우선순위 필터
    if (filters.priority) {
      filtered = filtered.filter(n => n.priority === filters.priority);
    }

    // 날짜 범위 필터
    if (filters.startDate) {
      filtered = filtered.filter(n => n.timestamp >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter(n => n.timestamp <= filters.endDate);
    }

    return filtered;
  }

  // 활성 공지사항 가져오기
  getActiveAnnouncements() {
    const now = new Date().toISOString();
    return this.announcements.filter(a => 
      a.active && (!a.expiresAt || a.expiresAt > now)
    );
  }

  // 설정 업데이트
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  // 오래된 알림 정리
  cleanupOldNotifications() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.settings.autoClear);

    this.notifications = this.notifications.filter(n => 
      new Date(n.timestamp) > cutoffDate
    );
    this.saveNotifications();
  }

  // 만료된 공지사항 정리
  cleanupExpiredAnnouncements() {
    const now = new Date().toISOString();
    this.announcements = this.announcements.filter(a => 
      !a.expiresAt || a.expiresAt > now
    );
    this.saveAnnouncements();
  }

  // 데스크톱 알림 표시
  showDesktopNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    }
  }

  // 알림 사운드 재생
  playNotificationSound() {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch(error => {
        console.warn('알림 사운드 재생 실패:', error);
      });
    } catch (error) {
      console.warn('알림 사운드 생성 실패:', error);
    }
  }

  // 알림 권한 요청
  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.settings.desktop = true;
          this.saveSettings();
        }
      });
    }
  }

  // 모든 알림 읽음 처리
  markAllAsRead() {
    this.notifications.forEach(n => {
      if (!n.read) n.read = true;
    });
    this.saveNotifications();
  }

  // 모든 알림 삭제
  clearAllNotifications() {
    this.notifications = [];
    this.saveNotifications();
  }

  // 알림 통계
  getNotificationStats() {
    const total = this.notifications.length;
    const unread = this.getUnreadCount();
    const archived = this.notifications.filter(n => n.archived).length;
    
    const byType = {};
    const byPriority = {};
    
    this.notifications.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    });

    return {
      total,
      unread,
      archived,
      byType,
      byPriority
    };
  }
}

// 싱글톤 인스턴스 생성
export const notificationManager = new NotificationManager();

// 편의 함수들
export const addNotification = (type, title, message, priority, data) => {
  return notificationManager.addNotification(type, title, message, priority, data);
};

export const addAssignmentCompletedNotification = (assignmentData) => {
  return notificationManager.addAssignmentCompletedNotification(assignmentData);
};

export const addAssignmentUpdatedNotification = (assignmentData) => {
  return notificationManager.addAssignmentUpdatedNotification(assignmentData);
};

export const addSettingsChangedNotification = (settingsData) => {
  return notificationManager.addSettingsChangedNotification(settingsData);
};

export const addSystemAnnouncement = (title, content, priority, expiresAt) => {
  return notificationManager.addSystemAnnouncement(title, content, priority, expiresAt);
};

export const getUnreadCount = () => notificationManager.getUnreadCount();
export const getActiveAnnouncements = () => notificationManager.getActiveAnnouncements();
export const getNotificationStats = () => notificationManager.getNotificationStats(); 