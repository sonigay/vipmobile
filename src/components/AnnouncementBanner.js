import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  IconButton,
  Collapse,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Announcement as AnnouncementIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { getActiveAnnouncements, NOTIFICATION_PRIORITY } from '../utils/notificationUtils';

function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [visibleAnnouncements, setVisibleAnnouncements] = useState(new Set());

  // 공지사항 로드
  useEffect(() => {
    const loadAnnouncements = () => {
      const activeAnnouncements = getActiveAnnouncements();
      setAnnouncements(activeAnnouncements);
      
      // 새로 추가된 공지사항들을 표시 상태로 설정
      const newVisible = new Set(visibleAnnouncements);
      activeAnnouncements.forEach(announcement => {
        if (!visibleAnnouncements.has(announcement.id)) {
          newVisible.add(announcement.id);
        }
      });
      setVisibleAnnouncements(newVisible);
    };

    // 초기 로드
    loadAnnouncements();

    // 주기적으로 업데이트 (1분마다)
    const interval = setInterval(loadAnnouncements, 60000);

    // 스토리지 변경 이벤트 리스너
    const handleStorageChange = (e) => {
      if (e.key === 'systemAnnouncements') {
        loadAnnouncements();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [visibleAnnouncements]);

  // 공지사항 닫기
  const handleClose = (announcementId) => {
    setVisibleAnnouncements(prev => {
      const newSet = new Set(prev);
      newSet.delete(announcementId);
      return newSet;
    });
  };

  // 우선순위에 따른 색상 가져오기
  const getSeverity = (priority) => {
    switch (priority) {
      case NOTIFICATION_PRIORITY.LOW:
        return 'info';
      case NOTIFICATION_PRIORITY.MEDIUM:
        return 'info';
      case NOTIFICATION_PRIORITY.HIGH:
        return 'warning';
      case NOTIFICATION_PRIORITY.URGENT:
        return 'error';
      default:
        return 'info';
    }
  };

  // 우선순위에 따른 아이콘 가져오기
  const getIcon = (priority) => {
    switch (priority) {
      case NOTIFICATION_PRIORITY.LOW:
        return <InfoIcon />;
      case NOTIFICATION_PRIORITY.MEDIUM:
        return <AnnouncementIcon />;
      case NOTIFICATION_PRIORITY.HIGH:
        return <WarningIcon />;
      case NOTIFICATION_PRIORITY.URGENT:
        return <ErrorIcon />;
      default:
        return <AnnouncementIcon />;
    }
  };

  // 우선순위에 따른 라벨 가져오기
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case NOTIFICATION_PRIORITY.LOW:
        return '낮음';
      case NOTIFICATION_PRIORITY.MEDIUM:
        return '보통';
      case NOTIFICATION_PRIORITY.HIGH:
        return '높음';
      case NOTIFICATION_PRIORITY.URGENT:
        return '긴급';
      default:
        return '보통';
    }
  };

  // 날짜 포맷
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('ko-KR');
  };

  // 표시할 공지사항 필터링 (우선순위 순으로 정렬)
  const visibleAnnouncementsList = announcements
    .filter(announcement => visibleAnnouncements.has(announcement.id))
    .sort((a, b) => {
      const priorityOrder = {
        [NOTIFICATION_PRIORITY.URGENT]: 4,
        [NOTIFICATION_PRIORITY.HIGH]: 3,
        [NOTIFICATION_PRIORITY.MEDIUM]: 2,
        [NOTIFICATION_PRIORITY.LOW]: 1
      };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

  if (visibleAnnouncementsList.length === 0) {
    return null;
  }

  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1300 }}>
      {visibleAnnouncementsList.map((announcement) => (
        <Collapse key={announcement.id} in={visibleAnnouncements.has(announcement.id)}>
          <Alert
            severity={getSeverity(announcement.priority)}
            icon={getIcon(announcement.priority)}
            action={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={getPriorityLabel(announcement.priority)}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    color: 'inherit',
                    borderColor: 'inherit',
                    '& .MuiChip-label': { color: 'inherit' }
                  }}
                />
                <IconButton
                  aria-label="close"
                  color="inherit"
                  size="small"
                  onClick={() => handleClose(announcement.id)}
                >
                  <CloseIcon fontSize="inherit" />
                </IconButton>
              </Box>
            }
            sx={{
              borderRadius: 0,
              '& .MuiAlert-message': {
                width: '100%'
              }
            }}
          >
            <Box>
              <AlertTitle sx={{ fontWeight: 'bold', mb: 1 }}>
                {announcement.title}
              </AlertTitle>
              <Box sx={{ mb: 1 }}>
                {announcement.content}
              </Box>
              <Box sx={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {formatDate(announcement.timestamp)}
                {announcement.expiresAt && ` • 만료: ${formatDate(announcement.expiresAt)}`}
              </Box>
            </Box>
          </Alert>
        </Collapse>
      ))}
    </Box>
  );
}

export default AnnouncementBanner; 