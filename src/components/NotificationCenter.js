import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  NotificationsNone as NotificationsNoneIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  Announcement as AnnouncementIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Close as CloseIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  DesktopWindows as DesktopIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import {
  notificationManager,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  getUnreadCount,
  getActiveAnnouncements,
  getNotificationStats
} from '../utils/notificationUtils';

function NotificationCenter({ open, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [settings, setSettings] = useState(notificationManager.settings);
  const [activeTab, setActiveTab] = useState(0);
  const [filters, setFilters] = useState({
    read: undefined,
    archived: false,
    type: '',
    priority: ''
  });
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    expiresAt: ''
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = () => {
    setNotifications(notificationManager.getNotifications(filters));
    setAnnouncements(notificationManager.getActiveAnnouncements());
  };

  // 알림 읽음 처리
  const handleMarkAsRead = (notificationId) => {
    notificationManager.markAsRead(notificationId);
    loadData();
    showSnackbar('알림을 읽음 처리했습니다.', 'success');
  };

  // 알림 아카이브
  const handleArchive = (notificationId) => {
    notificationManager.archiveNotification(notificationId);
    loadData();
    showSnackbar('알림을 아카이브했습니다.', 'success');
  };

  // 알림 삭제
  const handleDeleteNotification = (notificationId) => {
    notificationManager.deleteNotification(notificationId);
    loadData();
    showSnackbar('알림을 삭제했습니다.', 'success');
  };

  // 공지사항 비활성화
  const handleDeactivateAnnouncement = (announcementId) => {
    notificationManager.deactivateAnnouncement(announcementId);
    loadData();
    showSnackbar('공지사항을 비활성화했습니다.', 'success');
  };

  // 공지사항 삭제
  const handleDeleteAnnouncement = (announcementId) => {
    notificationManager.deleteAnnouncement(announcementId);
    loadData();
    showSnackbar('공지사항을 삭제했습니다.', 'success');
  };

  // 모든 알림 읽음 처리
  const handleMarkAllAsRead = () => {
    notificationManager.markAllAsRead();
    loadData();
    showSnackbar('모든 알림을 읽음 처리했습니다.', 'success');
  };

  // 모든 알림 삭제
  const handleClearAllNotifications = () => {
    notificationManager.clearAllNotifications();
    loadData();
    showSnackbar('모든 알림을 삭제했습니다.', 'success');
  };

  // 설정 업데이트
  const handleSettingChange = (setting, value) => {
    const newSettings = { ...settings, [setting]: value };
    setSettings(newSettings);
    notificationManager.updateSettings(newSettings);
    showSnackbar('설정이 업데이트되었습니다.', 'success');
  };

  // 새 공지사항 추가
  const handleAddAnnouncement = () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      showSnackbar('제목과 내용을 입력해주세요.', 'error');
      return;
    }

    notificationManager.addSystemAnnouncement(
      newAnnouncement.title,
      newAnnouncement.content,
      newAnnouncement.priority,
      newAnnouncement.expiresAt || null
    );

    setNewAnnouncement({
      title: '',
      content: '',
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      expiresAt: ''
    });
    setShowAddAnnouncement(false);
    loadData();
    showSnackbar('공지사항이 추가되었습니다.', 'success');
  };

  // 알림 권한 요청
  const handleRequestPermission = () => {
    notificationManager.requestNotificationPermission();
    showSnackbar('알림 권한을 요청했습니다.', 'info');
  };

  // 스낵바 표시
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // 알림 아이콘 가져오기
  const getNotificationIcon = (type, priority) => {
    switch (type) {
      case NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED:
        return <CheckCircleIcon color="success" />;
      case NOTIFICATION_TYPES.ASSIGNMENT_UPDATED:
        return <AssignmentIcon color="primary" />;
      case NOTIFICATION_TYPES.SETTINGS_CHANGED:
        return <SettingsIcon color="warning" />;
      case NOTIFICATION_TYPES.SYSTEM_NOTICE:
        return <InfoIcon color="info" />;
      case NOTIFICATION_TYPES.IMPORTANT_UPDATE:
        return <WarningIcon color="error" />;
      default:
        return <InfoIcon />;
    }
  };

  // 우선순위 색상 가져오기
  const getPriorityColor = (priority) => {
    switch (priority) {
      case NOTIFICATION_PRIORITY.LOW:
        return 'default';
      case NOTIFICATION_PRIORITY.MEDIUM:
        return 'primary';
      case NOTIFICATION_PRIORITY.HIGH:
        return 'warning';
      case NOTIFICATION_PRIORITY.URGENT:
        return 'error';
      default:
        return 'default';
    }
  };

  // 날짜 포맷
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('ko-KR');
  };

  const stats = getNotificationStats();

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: { 
            width: 450,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)'
          }
        }}
      >
        <AppBar position="static" elevation={0}>
          <Toolbar sx={{ backgroundColor: '#1976d2' }}>
            <NotificationsIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              알림 센터
            </Typography>
            <IconButton color="inherit" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
          {/* 통계 정보 */}
          <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
              알림 통계
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip 
                label={`전체: ${stats.total}`} 
                variant="outlined" 
                sx={{ borderRadius: 1 }}
              />
              <Chip 
                label={`읽지 않음: ${stats.unread}`} 
                color="primary"
                sx={{ borderRadius: 1 }}
              />
              <Chip 
                label={`아카이브: ${stats.archived}`} 
                variant="outlined"
                sx={{ borderRadius: 1 }}
              />
            </Box>
          </Paper>

          {/* 탭 */}
          <Paper sx={{ mb: 3, borderRadius: 2 }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)} 
              sx={{ 
                '& .MuiTab-root': {
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontSize: '0.9rem'
                }
              }}
            >
              <Tab label="알림" />
              <Tab label="공지사항" />
              <Tab label="설정" />
            </Tabs>
          </Paper>

          {/* 알림 탭 */}
          {activeTab === 0 && (
            <Box>
              {/* 필터 */}
              <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                  필터
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>읽음 상태</InputLabel>
                    <Select
                      value={filters.read === undefined ? '' : filters.read}
                      onChange={(e) => setFilters({ ...filters, read: e.target.value === '' ? undefined : e.target.value })}
                      label="읽음 상태"
                      sx={{ borderRadius: 1 }}
                    >
                      <MenuItem value="">전체</MenuItem>
                      <MenuItem value={false}>읽지 않음</MenuItem>
                      <MenuItem value={true}>읽음</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>타입</InputLabel>
                    <Select
                      value={filters.type}
                      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                      label="타입"
                      sx={{ borderRadius: 1 }}
                    >
                      <MenuItem value="">전체</MenuItem>
                      <MenuItem value={NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED}>배정 완료</MenuItem>
                      <MenuItem value={NOTIFICATION_TYPES.ASSIGNMENT_UPDATED}>배정 업데이트</MenuItem>
                      <MenuItem value={NOTIFICATION_TYPES.SETTINGS_CHANGED}>설정 변경</MenuItem>
                      <MenuItem value={NOTIFICATION_TYPES.SYSTEM_NOTICE}>시스템 공지</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Paper>

              {/* 액션 버튼 */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Button
                  size="small"
                  onClick={handleMarkAllAsRead}
                  disabled={stats.unread === 0}
                  variant="outlined"
                  sx={{ borderRadius: 1 }}
                >
                  모두 읽음
                </Button>
                <Button
                  size="small"
                  onClick={handleClearAllNotifications}
                  disabled={notifications.length === 0}
                  color="error"
                  variant="outlined"
                  sx={{ borderRadius: 1 }}
                >
                  모두 삭제
                </Button>
              </Box>

              {/* 알림 목록 */}
              <List>
                {notifications.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="알림이 없습니다"
                      secondary="새로운 알림이 도착하면 여기에 표시됩니다."
                    />
                  </ListItem>
                ) : (
                  notifications.map((notification) => (
                    <ListItem 
                      key={notification.id} 
                      divider
                      sx={{
                        alignItems: 'flex-start',
                        py: 2,
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                    >
                      <ListItemIcon sx={{ mt: 0.5, minWidth: 40 }}>
                        {getNotificationIcon(notification.type, notification.priority)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: notification.read ? 'normal' : 'bold',
                                color: notification.read ? 'text.primary' : 'primary.main'
                              }}
                            >
                              {notification.title}
                            </Typography>
                            <Chip
                              label={notification.priority}
                              size="small"
                              color={getPriorityColor(notification.priority)}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            {!notification.read && (
                              <Chip 
                                label="새" 
                                size="small" 
                                color="primary"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography 
                              variant="body2" 
                              color="text.secondary"
                              sx={{ 
                                mb: 1,
                                lineHeight: 1.4,
                                wordBreak: 'break-word'
                              }}
                            >
                              {notification.message}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{ fontSize: '0.75rem' }}
                            >
                              {formatDate(notification.timestamp)}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction sx={{ top: '50%', transform: 'translateY(-50%)' }}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {!notification.read && (
                            <IconButton
                              size="small"
                              onClick={() => handleMarkAsRead(notification.id)}
                              sx={{ 
                                color: 'success.main',
                                '&:hover': { backgroundColor: 'success.light', color: 'white' }
                              }}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            onClick={() => handleArchive(notification.id)}
                            sx={{ 
                              color: 'info.main',
                              '&:hover': { backgroundColor: 'info.light', color: 'white' }
                            }}
                          >
                            <ArchiveIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteNotification(notification.id)}
                            sx={{ 
                              color: 'error.main',
                              '&:hover': { backgroundColor: 'error.light', color: 'white' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))
                )}
              </List>
            </Box>
          )}

          {/* 공지사항 탭 */}
          {activeTab === 1 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  공지사항
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddAnnouncement(true)}
                  size="small"
                >
                  새 공지사항
                </Button>
              </Box>

              <List>
                {announcements.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="공지사항이 없습니다"
                      secondary="새로운 공지사항이 추가되면 여기에 표시됩니다."
                    />
                  </ListItem>
                ) : (
                  announcements.map((announcement) => (
                    <ListItem 
                      key={announcement.id} 
                      divider
                      sx={{
                        alignItems: 'flex-start',
                        py: 2,
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                    >
                      <ListItemIcon sx={{ mt: 0.5, minWidth: 40 }}>
                        <AnnouncementIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography 
                              variant="subtitle2"
                              sx={{ fontWeight: 'bold', color: 'primary.main' }}
                            >
                              {announcement.title}
                            </Typography>
                            <Chip
                              label={announcement.priority}
                              size="small"
                              color={getPriorityColor(announcement.priority)}
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography 
                              variant="body2" 
                              color="text.secondary"
                              sx={{ 
                                mb: 1,
                                lineHeight: 1.4,
                                wordBreak: 'break-word'
                              }}
                            >
                              {announcement.content}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{ fontSize: '0.75rem' }}
                            >
                              {formatDate(announcement.timestamp)}
                              {announcement.expiresAt && ` • 만료: ${formatDate(announcement.expiresAt)}`}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction sx={{ top: '50%', transform: 'translateY(-50%)' }}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeactivateAnnouncement(announcement.id)}
                            sx={{ 
                              color: 'warning.main',
                              '&:hover': { backgroundColor: 'warning.light', color: 'white' }
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                            sx={{ 
                              color: 'error.main',
                              '&:hover': { backgroundColor: 'error.light', color: 'white' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))
                )}
              </List>
            </Box>
          )}

          {/* 설정 탭 */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                알림 설정
              </Typography>

              <Paper sx={{ p: 2, mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enabled}
                      onChange={(e) => handleSettingChange('enabled', e.target.checked)}
                    />
                  }
                  label="알림 활성화"
                />
              </Paper>

              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  알림 방식
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.sound}
                      onChange={(e) => handleSettingChange('sound', e.target.checked)}
                      disabled={!settings.enabled}
                    />
                  }
                  label="사운드 알림"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.desktop}
                      onChange={(e) => handleSettingChange('desktop', e.target.checked)}
                      disabled={!settings.enabled}
                    />
                  }
                  label="데스크톱 알림"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.email}
                      onChange={(e) => handleSettingChange('email', e.target.checked)}
                      disabled={!settings.enabled}
                    />
                  }
                  label="이메일 알림"
                />
              </Paper>

              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  자동 정리
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>자동 삭제 기간</InputLabel>
                  <Select
                    value={settings.autoClear}
                    onChange={(e) => handleSettingChange('autoClear', e.target.value)}
                    label="자동 삭제 기간"
                  >
                    <MenuItem value={1}>1일</MenuItem>
                    <MenuItem value={3}>3일</MenuItem>
                    <MenuItem value={7}>7일</MenuItem>
                    <MenuItem value={30}>30일</MenuItem>
                    <MenuItem value={0}>자동 삭제 안함</MenuItem>
                  </Select>
                </FormControl>
              </Paper>

              <Button
                variant="outlined"
                onClick={handleRequestPermission}
                startIcon={<NotificationsIcon />}
                fullWidth
              >
                알림 권한 요청
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* 새 공지사항 추가 다이얼로그 */}
      <Dialog open={showAddAnnouncement} onClose={() => setShowAddAnnouncement(false)} maxWidth="sm" fullWidth>
        <DialogTitle>새 공지사항 추가</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="제목"
            value={newAnnouncement.title}
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="내용"
            value={newAnnouncement.content}
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
            margin="normal"
            multiline
            rows={4}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>우선순위</InputLabel>
            <Select
              value={newAnnouncement.priority}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value })}
              label="우선순위"
            >
              <MenuItem value={NOTIFICATION_PRIORITY.LOW}>낮음</MenuItem>
              <MenuItem value={NOTIFICATION_PRIORITY.MEDIUM}>보통</MenuItem>
              <MenuItem value={NOTIFICATION_PRIORITY.HIGH}>높음</MenuItem>
              <MenuItem value={NOTIFICATION_PRIORITY.URGENT}>긴급</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="만료일 (선택사항)"
            type="datetime-local"
            value={newAnnouncement.expiresAt}
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, expiresAt: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddAnnouncement(false)}>취소</Button>
          <Button onClick={handleAddAnnouncement} variant="contained">추가</Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default NotificationCenter; 