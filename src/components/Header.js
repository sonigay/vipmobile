import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel, Alert } from '@mui/material';
import { Update as UpdateIcon, Person as PersonIcon, Notifications as NotificationsIcon, NotificationsOff as NotificationsOffIcon } from '@mui/icons-material';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  checkPushNotificationPermission, 
  requestPushNotificationPermission,
  getPushSubscriptionStatus,
  sendTestPushNotification
} from '../utils/pushNotificationUtils';

function Header({ onCheckUpdate, inventoryUserName, isInventoryMode, currentUserId }) {
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 푸시 알림 상태 초기화
  useEffect(() => {
    const initializePushNotifications = async () => {
      try {
        const permission = await checkPushNotificationPermission();
        setPushPermission(permission);
        
        if (permission === 'granted') {
          const status = await getPushSubscriptionStatus();
          setPushSubscribed(status.subscribed);
          setPushEnabled(status.subscribed);
        }
      } catch (error) {
        console.error('푸시 알림 상태 초기화 실패:', error);
      }
    };

    initializePushNotifications();
  }, []);

  // 푸시 알림 권한 요청
  const handleRequestPermission = async () => {
    try {
      setLoading(true);
      setError('');
      
      const permission = await requestPushNotificationPermission();
      setPushPermission(permission);
      
      if (permission === 'granted') {
        // 권한이 허용되면 자동으로 구독
        await handleSubscribe();
      } else {
        setError('알림 권한이 거부되었습니다.');
      }
    } catch (error) {
      setError('알림 권한 요청 중 오류가 발생했습니다.');
      console.error('알림 권한 요청 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 푸시 알림 구독
  const handleSubscribe = async () => {
    if (!currentUserId) {
      setError('사용자 ID가 필요합니다.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await subscribeToPushNotifications(currentUserId);
      setPushSubscribed(true);
      setPushEnabled(true);
    } catch (error) {
      setError('푸시 알림 구독에 실패했습니다.');
      console.error('푸시 알림 구독 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 푸시 알림 구독 해제
  const handleUnsubscribe = async () => {
    if (!currentUserId) {
      setError('사용자 ID가 필요합니다.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await unsubscribeFromPushNotifications(currentUserId);
      setPushSubscribed(false);
      setPushEnabled(false);
    } catch (error) {
      setError('푸시 알림 구독 해제에 실패했습니다.');
      console.error('푸시 알림 구독 해제 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 테스트 알림 전송
  const handleTestNotification = async () => {
    if (!currentUserId) {
      setError('사용자 ID가 필요합니다.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await sendTestPushNotification(currentUserId);
    } catch (error) {
      setError('테스트 알림 전송에 실패했습니다.');
      console.error('테스트 알림 전송 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          재고 조회 시스템
          {isInventoryMode && inventoryUserName && (
            <Chip
              icon={<PersonIcon />}
              label={`접속자: ${inventoryUserName}`}
              size="small"
              sx={{ 
                ml: 2, 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          )}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* 푸시 알림 설정 버튼 */}
          <Tooltip title="푸시 알림 설정">
            <IconButton
              color="inherit"
              onClick={() => setPushDialogOpen(true)}
              sx={{ 
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 1
              }}
            >
              {pushEnabled ? <NotificationsIcon /> : <NotificationsOffIcon />}
            </IconButton>
          </Tooltip>
          
          {onCheckUpdate && (
            <Button
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={onCheckUpdate}
              sx={{ 
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 2,
                px: 2
              }}
            >
              업데이트 확인
            </Button>
          )}
        </Box>
      </Toolbar>

      {/* 푸시 알림 설정 다이얼로그 */}
      <Dialog open={pushDialogOpen} onClose={() => setPushDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>푸시 알림 설정</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              푸시 알림을 통해 새로운 배정이나 중요한 업데이트를 실시간으로 받을 수 있습니다.
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              알림 권한: {pushPermission === 'granted' ? '허용됨' : pushPermission === 'denied' ? '거부됨' : '요청 필요'}
            </Typography>
            <Typography variant="subtitle2" gutterBottom>
              구독 상태: {pushSubscribed ? '구독됨' : '구독되지 않음'}
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={pushEnabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    if (pushPermission === 'granted') {
                      handleSubscribe();
                    } else {
                      handleRequestPermission();
                    }
                  } else {
                    handleUnsubscribe();
                  }
                }}
                disabled={loading}
              />
            }
            label="푸시 알림 활성화"
          />

          {pushEnabled && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleTestNotification}
                disabled={loading}
                fullWidth
              >
                테스트 알림 전송
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPushDialogOpen(false)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}

export default Header; 