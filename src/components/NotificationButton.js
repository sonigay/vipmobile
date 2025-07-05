import React, { useState, useEffect } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  NotificationsNone as NotificationsNoneIcon
} from '@mui/icons-material';
import { getUnreadCount } from '../utils/notificationUtils';
import NotificationCenter from './NotificationCenter';

function NotificationButton() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  // 읽지 않은 알림 개수 업데이트
  useEffect(() => {
    const updateUnreadCount = () => {
      setUnreadCount(getUnreadCount());
    };

    // 초기 로드
    updateUnreadCount();

    // 주기적으로 업데이트 (30초마다)
    const interval = setInterval(updateUnreadCount, 30000);

    // 스토리지 변경 이벤트 리스너
    const handleStorageChange = (e) => {
      if (e.key === 'assignmentNotifications') {
        updateUnreadCount();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleClick = () => {
    setNotificationCenterOpen(true);
  };

  const handleClose = () => {
    setNotificationCenterOpen(false);
    // 알림 센터가 닫힐 때 읽지 않은 개수 업데이트
    setUnreadCount(getUnreadCount());
  };

  // 알림 아이콘 선택
  const getNotificationIcon = () => {
    if (unreadCount > 0) {
      return <NotificationsActiveIcon />;
    }
    return <NotificationsIcon />;
  };

  return (
    <>
      <Tooltip title={unreadCount > 0 ? `${unreadCount}개의 읽지 않은 알림` : '알림 센터'}>
        <IconButton
          color="inherit"
          onClick={handleClick}
          sx={{ mr: 1 }}
        >
          <Badge badgeContent={unreadCount > 0 ? unreadCount : 0} color="error">
            {getNotificationIcon()}
          </Badge>
        </IconButton>
      </Tooltip>

      <NotificationCenter
        open={notificationCenterOpen}
        onClose={handleClose}
      />
    </>
  );
}

export default NotificationButton; 