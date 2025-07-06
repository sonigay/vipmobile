import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel, Alert, Menu, MenuItem } from '@mui/material';
import { 
  Update as UpdateIcon, 
  Person as PersonIcon, 
  Notifications as NotificationsIcon, 
  NotificationsOff as NotificationsOffIcon, 
  Logout as LogoutIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  checkPushNotificationPermission, 
  requestPushNotificationPermission,
  getPushSubscriptionStatus,
  sendTestPushNotification
} from '../utils/pushNotificationUtils';

function Header({ onCheckUpdate, inventoryUserName, isInventoryMode, currentUserId, onLogout, loggedInStore, isAgentMode, currentView, onViewChange }) {
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // 매장 재고 계산 함수 (일반모드용)
  const getStoreInventory = (store) => {
    if (!store || !store.inventory) return 0;
    
    // 새로운 데이터 구조: { phones: {}, sims: {}, wearables: {}, smartDevices: {} }
    let totalInventory = 0;
    
    // 모든 카테고리의 재고를 합산
    Object.values(store.inventory).forEach(category => {
      if (typeof category === 'object' && category !== null) {
        Object.values(category).forEach(model => {
          if (typeof model === 'object' && model !== null) {
            Object.values(model).forEach(status => {
              if (typeof status === 'object' && status !== null) {
                Object.values(status).forEach(item => {
                  // 새로운 구조: { quantity: number, shippedDate: string }
                  if (typeof item === 'object' && item && item.quantity) {
                    totalInventory += item.quantity || 0;
                  } else if (typeof item === 'number') {
                    // 기존 구조 호환성
                    totalInventory += item || 0;
                  }
                });
              }
            });
          }
        });
      }
    });
    
    return totalInventory;
  };

  // 관리자모드용 카테고리별 재고 계산 함수
  const getAgentInventoryByCategory = (store) => {
    if (!store || !store.inventory) {
      return { phones: 0, wearables: 0, tablets: 0 };
    }
    
    const categories = {
      phones: 0,      // 휴대폰
      wearables: 0,   // 웨어러블
      tablets: 0      // 테블릿 (smartDevices)
    };
    
    // phones 카테고리 (휴대폰)
    if (store.inventory.phones) {
      Object.values(store.inventory.phones).forEach(model => {
        if (typeof model === 'object' && model !== null) {
          Object.values(model).forEach(status => {
            if (typeof status === 'object' && status !== null) {
              Object.values(status).forEach(item => {
                if (typeof item === 'object' && item && item.quantity) {
                  categories.phones += item.quantity || 0;
                } else if (typeof item === 'number') {
                  categories.phones += item || 0;
                }
              });
            }
          });
        }
      });
    }
    
    // wearables 카테고리 (웨어러블)
    if (store.inventory.wearables) {
      Object.values(store.inventory.wearables).forEach(model => {
        if (typeof model === 'object' && model !== null) {
          Object.values(model).forEach(status => {
            if (typeof status === 'object' && status !== null) {
              Object.values(status).forEach(item => {
                if (typeof item === 'object' && item && item.quantity) {
                  categories.wearables += item.quantity || 0;
                } else if (typeof item === 'number') {
                  categories.wearables += item || 0;
                }
              });
            }
          });
        }
      });
    }
    
    // smartDevices 카테고리 (테블릿)
    if (store.inventory.smartDevices) {
      Object.values(store.inventory.smartDevices).forEach(model => {
        if (typeof model === 'object' && model !== null) {
          Object.values(model).forEach(status => {
            if (typeof status === 'object' && status !== null) {
              Object.values(status).forEach(item => {
                if (typeof item === 'object' && item && item.quantity) {
                  categories.tablets += item.quantity || 0;
                } else if (typeof item === 'number') {
                  categories.tablets += item || 0;
                }
              });
            }
          });
        }
      });
    }
    
    return categories;
  };

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

  // 메뉴 핸들러
  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleViewChange = (view) => {
    if (onViewChange) {
      onViewChange(view);
    }
    handleMenuClose();
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {isInventoryMode ? '재고 조회 시스템' : '재고 조회 시스템'}
          {loggedInStore && !isInventoryMode && !isAgentMode && (
            <Chip
              icon={<PersonIcon />}
              label={`${loggedInStore.name} : ${getStoreInventory(loggedInStore)}대`}
              size="small"
              sx={{ 
                ml: 2, 
                backgroundColor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                '& .MuiChip-icon': { color: 'white' }
              }}
            />
          )}
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
          {isAgentMode && loggedInStore && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
              <Chip
                icon={<PersonIcon />}
                label={`${loggedInStore.name}`}
                size="small"
                sx={{ 
                  backgroundColor: 'rgba(255,255,255,0.2)', 
                  color: 'white',
                  '& .MuiChip-icon': { color: 'white' }
                }}
              />
              {currentView === 'all' && (
                <Chip
                  label="전체재고확인"
                  size="small"
                  sx={{ 
                    backgroundColor: 'rgba(255,255,255,0.15)', 
                    color: 'white',
                    fontSize: '0.75rem'
                  }}
                />
              )}
              {currentView === 'assigned' && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Chip
                    label="담당재고확인"
                    size="small"
                    sx={{ 
                      backgroundColor: 'rgba(255,255,255,0.15)', 
                      color: 'white',
                      fontSize: '0.75rem'
                    }}
                  />
                  {(() => {
                    const categories = getAgentInventoryByCategory(loggedInStore);
                    return (
                      <>
                        <Chip
                          label={`휴대폰:${categories.phones}대`}
                          size="small"
                          sx={{ 
                            backgroundColor: 'rgba(76, 175, 80, 0.3)', 
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                        <Chip
                          label={`웨어러블:${categories.wearables}대`}
                          size="small"
                          sx={{ 
                            backgroundColor: 'rgba(255, 152, 0, 0.3)', 
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                        <Chip
                          label={`테블릿:${categories.tablets}대`}
                          size="small"
                          sx={{ 
                            backgroundColor: 'rgba(156, 39, 176, 0.3)', 
                            color: 'white',
                            fontSize: '0.7rem'
                          }}
                        />
                      </>
                    );
                  })()}
                </Box>
              )}
              {currentView === 'activation' && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Chip
                    label="담당개통확인"
                    size="small"
                    sx={{ 
                      backgroundColor: 'rgba(255,255,255,0.15)', 
                      color: 'white',
                      fontSize: '0.75rem'
                    }}
                  />
                  <Chip
                    label="총개통수량 확인 중..."
                    size="small"
                    sx={{ 
                      backgroundColor: 'rgba(33, 150, 243, 0.3)', 
                      color: 'white',
                      fontSize: '0.7rem'
                    }}
                  />
                </Box>
              )}
            </Box>
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
          
          {/* 관리자모드 메뉴 */}
          {isAgentMode && (
            <IconButton
              color="inherit"
              onClick={handleMenuOpen}
              sx={{ 
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 1
              }}
            >
              <MoreVertIcon />
            </IconButton>
          )}
          
          {/* 로그아웃 버튼 */}
          {onLogout && (
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={onLogout}
              sx={{ 
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 2,
                px: 2
              }}
            >
              로그아웃
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

      {/* 관리자모드 메뉴 */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleViewChange('all')}>
          <InventoryIcon sx={{ mr: 1 }} />
          전체재고확인
        </MenuItem>
        <MenuItem onClick={() => handleViewChange('assigned')}>
          <AssignmentIcon sx={{ mr: 1 }} />
          담당재고확인
        </MenuItem>
        <MenuItem onClick={() => handleViewChange('activation')}>
          <BusinessIcon sx={{ mr: 1 }} />
          담당개통확인
        </MenuItem>
      </Menu>
    </AppBar>
  );
}

export default Header; 