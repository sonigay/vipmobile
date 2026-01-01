import React, { useState, useEffect, useMemo } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel, Alert, Menu, MenuItem, Select, FormControl, InputLabel, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Tabs, Tab, CircularProgress } from '@mui/material';
import { 
  Update as UpdateIcon, 
  Person as PersonIcon, 
  Notifications as NotificationsIcon, 
  NotificationsOff as NotificationsOffIcon, 
  Logout as LogoutIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  MoreVert as MoreVertIcon,
  SwapHoriz as SwapHorizIcon,
  Map as MapIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications, 
  checkPushNotificationPermission, 
  requestPushNotificationPermission,
  getPushSubscriptionStatus,
  sendTestPushNotification,
  debugPushNotificationStatus
} from '../utils/pushNotificationUtils';
import { getModeColor, getModeTitle, resolveModeKey } from '../config/modeConfig';

function Header({ inventoryUserName, isInventoryMode, currentUserId, onLogout, loggedInStore, isAgentMode, currentView, onViewChange, activationData, agentTarget, data, onModeChange, availableModes, onCheckUpdate = null, currentMode, mapDisplayOption, onMapDisplayOptionChange }) {
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [mapDisplayOptionDialogOpen, setMapDisplayOptionDialogOpen] = useState(false);
  const [mapDisplayOptionUsers, setMapDisplayOptionUsers] = useState([]);
  const [mapDisplayOptionLoading, setMapDisplayOptionLoading] = useState(false);
  const [mapDisplayOptionTab, setMapDisplayOptionTab] = useState(0); // 0: 관리자모드, 1: 일반모드
  const [mapDisplayOptionSettings, setMapDisplayOptionSettings] = useState({}); // { userId: { option, value } }

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

  // 담당자의 거래처들 찾기 함수
  const getAgentStores = () => {
    if (!data || !data.stores || !agentTarget) {
      return [];
    }
    
    // 담당자명 앞 3글자로 매칭
    const agentPrefix = agentTarget.toString().substring(0, 3);
    
    const agentStores = data.stores.filter(store => {
      if (!store.manager) return false;
      const managerPrefix = store.manager.toString().substring(0, 3);
      return managerPrefix === agentPrefix;
    });
    
    return agentStores;
  };

  // 담당자의 거래처들의 카테고리별 재고 계산 함수
  const getAgentInventoryByCategory = () => {
    if (!agentTarget) {
      return { phones: 0, wearables: 0, tablets: 0 };
    }
    
    const agentStores = getAgentStores();
    const categories = {
      phones: 0,      // 휴대폰
      wearables: 0,   // 웨어러블
      tablets: 0      // 테블릿 (smartDevices)
    };
    
    agentStores.forEach(store => {
      if (!store.inventory) return;
      
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
    });
    

    
    return categories;
  };

  // 담당자의 거래처들의 당월 개통 데이터 계산 함수
  const getAgentActivationTotal = () => {
    if (!activationData || !agentTarget) {
      return 0;
    }
    
    const agentStores = getAgentStores();
    const agentStoreNames = agentStores.map(store => store.name);
    
    let totalActivation = 0;
    const matchedStores = [];
    
    Object.values(activationData).forEach(storeData => {
      // 담당자의 거래처인지 확인
      if (agentStoreNames.includes(storeData.storeName)) {
        totalActivation += storeData.currentMonth || 0;
        matchedStores.push({
          storeName: storeData.storeName,
          currentMonth: storeData.currentMonth || 0
        });
      }
    });
    

    
    return totalActivation;
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
    console.log('푸시 알림 구독 시도 - currentUserId:', currentUserId);
    
    if (!currentUserId) {
      const errorMsg = '사용자 ID가 필요합니다.';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      console.log('푸시 알림 구독 함수 호출...');
      await subscribeToPushNotifications(currentUserId);
      console.log('푸시 알림 구독 성공!');
      
      setPushSubscribed(true);
      setPushEnabled(true);
    } catch (error) {
      const errorMsg = `푸시 알림 구독에 실패했습니다: ${error.message}`;
      console.error('푸시 알림 구독 실패:', error);
      setError(errorMsg);
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

  // 푸시 알림 디버깅
  const handleDebugPushNotifications = async () => {
    try {
      await debugPushNotificationStatus();
    } catch (error) {
      console.error('푸시 알림 디버깅 실패:', error);
    }
  };

  // 메뉴 핸들러
  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // 지도 재고 노출 옵션 사용자 목록 로드
  const loadMapDisplayOptionUsers = async () => {
    setMapDisplayOptionLoading(true);
    setError('');
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      // agentModePermission을 우선적으로 사용, 없으면 userRole 사용
      const userRole = loggedInStore?.agentInfo?.agentModePermission || loggedInStore?.userRole || '';
      const userId = loggedInStore?.id || loggedInStore?.contactId || '';
      
      console.log('🔍 [지도옵션] 사용자 목록 로드 시작:', { 
        userRole, 
        userId, 
        API_URL,
        agentModePermission: loggedInStore?.agentInfo?.agentModePermission,
        originalUserRole: loggedInStore?.userRole
      });
      
      const response = await fetch(`${API_URL}/api/map-display-option/users`, {
        headers: {
          'x-user-role': userRole,
          'x-user-id': userId
        }
      });

      console.log('🔍 [지도옵션] 사용자 목록 응답:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔍 [지도옵션] 사용자 목록 로드 실패:', errorData);
        setError(errorData.error || `사용자 목록을 불러올 수 없습니다. (${response.status})`);
        setMapDisplayOptionUsers([]);
        return;
      }

      const data = await response.json();
      console.log('🔍 [지도옵션] 사용자 목록 데이터:', data);
      
      if (data.success) {
        const users = data.users || [];
        console.log('🔍 [지도옵션] 사용자 수:', users.length);
        setMapDisplayOptionUsers(users);
        
        // 각 사용자의 옵션 설정 로드
        const settings = {};
        for (const user of users) {
            for (const mode of ['관리자모드', '일반모드']) {
              try {
                // agentModePermission을 우선적으로 사용
                const optionUserRole = loggedInStore?.agentInfo?.agentModePermission || loggedInStore?.userRole || '';
                const optionResponse = await fetch(`${API_URL}/api/map-display-option?userId=${encodeURIComponent(user.userId)}&mode=${encodeURIComponent(mode)}`, {
                  headers: {
                    'x-user-role': optionUserRole,
                    'x-user-id': userId
                  }
                });
              
              if (optionResponse.ok) {
                const optionData = await optionResponse.json();
                if (optionData.success) {
                  settings[`${user.userId}_${mode}`] = {
                    option: optionData.option || '전체',
                    value: optionData.value || '',
                    updatedAt: optionData.updatedAt || '',
                    updatedBy: optionData.updatedBy || ''
                  };
                }
              }
            } catch (err) {
              console.warn(`🔍 [지도옵션] 사용자 ${user.userId}의 ${mode} 옵션 로드 실패:`, err);
            }
          }
        }
        setMapDisplayOptionSettings(settings);
      } else {
        setError(data.error || '사용자 목록을 불러올 수 없습니다.');
        setMapDisplayOptionUsers([]);
      }
    } catch (error) {
      console.error('🔍 [지도옵션] 사용자 목록 로드 오류:', error);
      setError(`사용자 목록을 불러오는 중 오류가 발생했습니다: ${error.message}`);
      setMapDisplayOptionUsers([]);
    } finally {
      setMapDisplayOptionLoading(false);
    }
  };

  // 지도 재고 노출 옵션 저장
  const handleSaveMapDisplayOptions = async () => {
    setMapDisplayOptionLoading(true);
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      const currentMode = mapDisplayOptionTab === 0 ? '관리자모드' : '일반모드';
      
      for (const user of mapDisplayOptionUsers) {
        const key = `${user.userId}_${currentMode}`;
        const setting = mapDisplayOptionSettings[key];
        
        if (setting) {
          // agentModePermission을 우선적으로 사용
          const saveUserRole = loggedInStore?.agentInfo?.agentModePermission || loggedInStore?.userRole || '';
          const response = await fetch(`${API_URL}/api/map-display-option`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-role': saveUserRole,
              'x-user-id': loggedInStore?.id || loggedInStore?.contactId || ''
            },
            body: JSON.stringify({
              userId: user.userId,
              mode: currentMode,
              option: setting.option,
              value: setting.value || '',
              updatedBy: loggedInStore?.name || loggedInStore?.agentInfo?.target || ''
            })
          });

          if (!response.ok) {
            throw new Error(`옵션 저장 실패: ${user.userId}`);
          }
        }
      }

      alert('옵션이 저장되었습니다.');
      if (onMapDisplayOptionChange) {
        onMapDisplayOptionChange();
      }
      setMapDisplayOptionDialogOpen(false);
    } catch (error) {
      console.error('옵션 저장 오류:', error);
      setError('옵션 저장 중 오류가 발생했습니다.');
    } finally {
      setMapDisplayOptionLoading(false);
    }
  };

  const handleViewChange = (view) => {
    if (onViewChange) {
      onViewChange(view);
    }
    handleMenuClose();
  };

  const resolvedModeKey = useMemo(() => resolveModeKey(currentMode), [currentMode]);
  const headerColor = useMemo(() => getModeColor(resolvedModeKey), [resolvedModeKey]);
  const headerTitle = useMemo(() => getModeTitle(resolvedModeKey, '재고 조회 시스템'), [resolvedModeKey]);

  return (
    <AppBar position="static" sx={{ backgroundColor: headerColor }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {headerTitle}
          {loggedInStore && !isInventoryMode && !isAgentMode && resolvedModeKey !== 'inventoryRecovery' && (
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
          {(isInventoryMode || resolvedModeKey === 'inventoryRecovery') && inventoryUserName && (
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
                    const categories = getAgentInventoryByCategory();
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
                    label={`총개통:${getAgentActivationTotal()}개`}
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
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Tooltip title="모드 변경">
              <IconButton
                color="inherit"
                onClick={onModeChange}
                sx={{ 
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 1
                }}
              >
                <SwapHorizIcon />
              </IconButton>
            </Tooltip>
          )}
          
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
          
          {typeof onCheckUpdate === 'function' && (
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
          
          {/* 지도 재고 노출 옵션 설정 버튼 (M 권한자만) */}
          {(() => {
            if (!loggedInStore) return false;
            const userRole = loggedInStore.userRole;
            const agentModePermission = loggedInStore.agentInfo?.agentModePermission;
            const isMPermission = userRole === 'M' || 
                                 agentModePermission === 'M' ||
                                 (agentModePermission && agentModePermission.toString().toUpperCase() === 'M');
            
            // 디버깅 로그
            if (isAgentMode) {
              console.log('🔍 [지도옵션] 권한 체크:', {
                userRole,
                agentModePermission,
                agentInfo: loggedInStore.agentInfo,
                isMPermission
              });
            }
            
            return isMPermission;
          })() && (
            <Tooltip title="지도 재고 노출 옵션 설정">
              <IconButton
                color="inherit"
                onClick={() => {
                  setMapDisplayOptionDialogOpen(true);
                  loadMapDisplayOptionUsers();
                }}
                sx={{ 
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 1
                }}
              >
                <MapIcon />
              </IconButton>
            </Tooltip>
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
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={handleTestNotification}
                disabled={loading}
                fullWidth
              >
                테스트 알림 전송
              </Button>
              <Button
                variant="outlined"
                onClick={handleDebugPushNotifications}
                disabled={loading}
                fullWidth
                size="small"
              >
                디버깅 정보 출력
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

      {/* 지도 재고 노출 옵션 설정 다이얼로그 */}
      <Dialog 
        open={mapDisplayOptionDialogOpen} 
        onClose={() => setMapDisplayOptionDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          지도 재고 노출 옵션 설정
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Tabs value={mapDisplayOptionTab} onChange={(e, newValue) => setMapDisplayOptionTab(newValue)}>
              <Tab label="관리자모드" />
              <Tab label="일반모드" />
            </Tabs>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            
            {mapDisplayOptionLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : mapDisplayOptionUsers.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <Typography color="text.secondary">
                  사용자 목록이 없습니다.
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>사용자ID</TableCell>
                      <TableCell>이름</TableCell>
                      <TableCell>노출옵션</TableCell>
                      <TableCell>선택값</TableCell>
                      <TableCell>수정일시</TableCell>
                      <TableCell>수정자</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mapDisplayOptionUsers.map((user) => {
                      const currentMode = mapDisplayOptionTab === 0 ? '관리자모드' : '일반모드';
                      const setting = mapDisplayOptionSettings[`${user.userId}_${currentMode}`] || { option: '전체', value: '' };
                      
                      return (
                        <TableRow key={user.userId}>
                          <TableCell>{user.userId}</TableCell>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                              <Select
                                value={setting.option}
                                onChange={(e) => {
                                  const newSettings = { ...mapDisplayOptionSettings };
                                  const key = `${user.userId}_${currentMode}`;
                                  newSettings[key] = { ...setting, option: e.target.value };
                                  setMapDisplayOptionSettings(newSettings);
                                }}
                              >
                                <MenuItem value="전체">전체</MenuItem>
                                <MenuItem value="코드별">코드별</MenuItem>
                                <MenuItem value="사무실별">사무실별</MenuItem>
                                <MenuItem value="소속별">소속별</MenuItem>
                                <MenuItem value="담당자별">담당자별</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={setting.value}
                              onChange={(e) => {
                                const newSettings = { ...mapDisplayOptionSettings };
                                const key = `${user.userId}_${currentMode}`;
                                newSettings[key] = { ...setting, value: e.target.value };
                                setMapDisplayOptionSettings(newSettings);
                              }}
                              placeholder="선택값 (일반모드는 자동)"
                              disabled={!isAgentMode && mapDisplayOptionTab === 1}
                            />
                          </TableCell>
                          <TableCell>{setting.updatedAt || '-'}</TableCell>
                          <TableCell>{setting.updatedBy || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapDisplayOptionDialogOpen(false)}>취소</Button>
          <Button 
            onClick={handleSaveMapDisplayOptions} 
            variant="contained"
            disabled={mapDisplayOptionLoading}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}

export default Header; 