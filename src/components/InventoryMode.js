import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Skeleton
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Help as HelpIcon,
  SimCard as SimCardIcon,
  PhoneAndroid as PhoneAndroidIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  PersonAdd as PersonAddIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Compare as CompareIcon,
  Warning as WarningIcon,
  History as HistoryIcon,
  Watch as WatchIcon,
  Tablet as TabletIcon,
  Settings as SettingsIcon,
  AccountTree as AccountTreeIcon,
  SwapHoriz as SwapHorizIcon
} from '@mui/icons-material';
import { fetchData } from '../api';
import UpdateProgressPopup from './UpdateProgressPopup';

import NotificationButton from './NotificationButton';
import AnnouncementBanner from './AnnouncementBanner';
import { notificationManager } from '../utils/notificationUtils';
import { 
  mobileOptimizationManager, 
  applyMobileOptimizations, 
  optimizeMobileNavigation, 
  optimizePerformance,
  isMobile 
} from '../utils/mobileUtils';

// 지연 로딩 컴포넌트들
const InventoryAuditScreen = lazy(() => import('./screens/InventoryAuditScreen'));
const MasterInventoryScreen = lazy(() => import('./screens/MasterInventoryScreen'));
const DuplicateCasesScreen = lazy(() => import('./screens/DuplicateCasesScreen'));

const AssignmentSettingsScreen = lazy(() => import('./screens/AssignmentSettingsScreen'));
const DepartmentAssignmentScreen = lazy(() => import('./screens/DepartmentAssignmentScreen'));
const AssignmentHistoryScreen = lazy(() => import('./screens/AssignmentHistoryScreen'));
const RealtimeDashboardScreen = lazy(() => import('./screens/RealtimeDashboardScreen'));

// 로딩 스켈레톤 컴포넌트
const LoadingSkeleton = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Skeleton variant="rectangular" height={120} />
      </Grid>
      <Grid item xs={12} md={4}>
        <Skeleton variant="rectangular" height={120} />
      </Grid>
      <Grid item xs={12} md={4}>
        <Skeleton variant="rectangular" height={120} />
      </Grid>
    </Grid>
    <Skeleton variant="rectangular" height={400} sx={{ mt: 2 }} />
  </Box>
);

function InventoryMode({ onLogout, loggedInStore, onAssignmentMode, inventoryUserName, onModeChange, availableModes }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('main');
  const [preloadedScreens, setPreloadedScreens] = useState(new Set());
  
  // 검색 관련 상태
  const [searchType, setSearchType] = useState('store');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState(null);
  
  // 체크박스 선택 관련 상태
  const [selectedStores, setSelectedStores] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  
  // 탭 상태
  const [tabValue, setTabValue] = useState(0);
  // 업데이트 진행 팝업 상태
  const [showUpdateProgressPopup, setShowUpdateProgressPopup] = useState(false);
  // 알림 시스템 및 모바일 최적화 초기화 상태
  const [notificationInitialized, setNotificationInitialized] = useState(false);

  // 데이터 로딩 (메모이제이션 적용)
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetchData();
      if (response.success) {
        setData(response.data);
        setFilteredData(response.data);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('데이터 로딩 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);



  // 알림 시스템 및 모바일 최적화 초기화
  useEffect(() => {
    if (!notificationInitialized) {
      // 알림 권한 요청
      notificationManager.requestNotificationPermission();
      
      // 오래된 알림 및 공지사항 정리
      notificationManager.cleanupOldNotifications();
      notificationManager.cleanupExpiredAnnouncements();
      
      // 모바일 최적화 적용
      applyMobileOptimizations();
      optimizeMobileNavigation();
      optimizePerformance();
      
      // 초기화 완료
      setNotificationInitialized(true);
    }
  }, [notificationInitialized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 검색 필터링 (메모이제이션 적용)
  const filteredDataMemo = useMemo(() => {
    if (!data) return null;

    if (!searchTerm.trim()) {
      return data;
    }

    const term = searchTerm.toLowerCase();
    
    return data.filter(store => {
      if (searchType === 'store') {
        return store.name.toLowerCase().includes(term);
      } else if (searchType === 'manager') {
        return store.manager && store.manager.toLowerCase().includes(term);
      }
      return false;
    });
  }, [data, searchTerm, searchType]);

  useEffect(() => {
    setFilteredData(filteredDataMemo);
  }, [filteredDataMemo]);

  // 총 재고 수량 계산 (메모이제이션 적용)
  const getTotalInventory = useCallback((store) => {
    if (!store.inventory) return 0;
    
    let total = 0;
    Object.values(store.inventory).forEach(category => {
      if (typeof category === 'object' && category !== null) {
      Object.values(category).forEach(model => {
          if (typeof model === 'object' && model !== null) {
        Object.values(model).forEach(status => {
              if (typeof status === 'object' && status !== null) {
          Object.values(status).forEach(qty => {
                  // qty가 객체인 경우 quantity 속성을 확인
                  if (typeof qty === 'object' && qty !== null && qty.quantity !== undefined) {
                    total += qty.quantity || 0;
                  } else if (typeof qty === 'number') {
            total += qty || 0;
                  }
          });
              }
        });
          }
      });
      }
    });
    
    return total;
  }, []);

  // 재고 통계 계산 (메모이제이션 적용)
  const stats = useMemo(() => {
    if (!filteredData) return { totalStores: 0, totalInventory: 0, storesWithInventory: 0 };

    let totalInventory = 0;
    let storesWithInventory = 0;

    filteredData.forEach(store => {
      if (store.inventory) {
        const storeInventory = getTotalInventory(store);
        totalInventory += storeInventory;
        if (storeInventory > 0) {
          storesWithInventory++;
        }
      }
    });

    return {
      totalStores: filteredData.length,
      totalInventory,
      storesWithInventory
    };
  }, [filteredData, getTotalInventory]);

  // 담당자별 통계 계산 (메모이제이션 적용)
  const managerStats = useMemo(() => {
    if (!filteredData) return [];

    const managerMap = new Map();

    filteredData.forEach(store => {
      const manager = store.manager || '미지정';
      if (!managerMap.has(manager)) {
        managerMap.set(manager, {
          manager,
          storeCount: 0,
          totalInventory: 0,
          stores: []
        });
      }

      const managerData = managerMap.get(manager);
      managerData.storeCount++;
      managerData.stores.push(store);

      if (store.inventory) {
        const storeInventory = getTotalInventory(store);
        managerData.totalInventory += storeInventory;
      }
    });

    return Array.from(managerMap.values()).sort((a, b) => b.totalInventory - a.totalInventory);
  }, [filteredData, getTotalInventory]);

  // 화면 사전 로딩 함수
  const preloadScreen = useCallback((screenName) => {
    if (!preloadedScreens.has(screenName)) {
      setPreloadedScreens(prev => new Set([...prev, screenName]));
      console.log(`화면 사전 로딩: ${screenName}`);
    }
  }, [preloadedScreens]);

  // 메뉴 호버 시 화면 사전 로딩
  const handleMenuHover = useCallback((menuType, subMenu) => {
    const screenName = `${menuType}_${subMenu}`;
    preloadScreen(screenName);
  }, [preloadScreen]);

  // 체크박스 핸들러
  const handleStoreSelect = (storeId) => {
    setSelectedStores(prev => {
      if (prev.includes(storeId)) {
        return prev.filter(id => id !== storeId);
      } else {
        if (prev.length >= 5) {
          alert('최대 5개 매장까지만 선택할 수 있습니다.');
          return prev;
        }
        return [...prev, storeId];
      }
    });
  };

  // 메뉴 핸들러 (최적화)
  const handleMenuClick = useCallback((event, menuType) => {
    setAnchorEl(event.currentTarget);
    setSelectedMenu(menuType);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setSelectedMenu(null);
  }, []);

  const handleSubMenuClick = useCallback((subMenu) => {
    console.log(`${selectedMenu} - ${subMenu} 메뉴 클릭`);
    
    const screenName = `${selectedMenu}_${subMenu}`;
    
    // 화면 전환 시 즉시 로딩 상태 표시
    setCurrentScreen('loading');
    
    // 다음 틱에서 실제 화면 전환 (UI 블로킹 방지)
    setTimeout(() => {
      setCurrentScreen(screenName);
      handleMenuClose();
    }, 0);
  }, [selectedMenu, handleMenuClose]);

  // 탭 변경 핸들러 (최적화)
  const handleTabChange = useCallback((event, newValue) => {
    setTabValue(newValue);
  }, []);

  // 메인 화면으로 돌아가기 (최적화)
  const handleBackToMain = useCallback(() => {
    setCurrentScreen('main');
    setTabValue(0);
  }, []);

  // 업데이트 진행 팝업 닫기 핸들러
  const handleUpdateProgressPopupClose = useCallback(() => {
    setShowUpdateProgressPopup(false);
  }, []);

  // 매장별 재고 정보 정리 (메모이제이션 적용)
  const getStoreInventorySummary = useCallback((store) => {
    if (!store.inventory) return { 
      total: 0, 
      phones: { normal: 0, history: 0, defective: 0 }, 
      sims: { normal: 0, history: 0, defective: 0 },
      wearables: { normal: 0, history: 0, defective: 0 },
      smartDevices: { normal: 0, history: 0, defective: 0 }
    };

    const summary = {
      total: 0,
      phones: { normal: 0, history: 0, defective: 0 },
      sims: { normal: 0, history: 0, defective: 0 },
      wearables: { normal: 0, history: 0, defective: 0 },
      smartDevices: { normal: 0, history: 0, defective: 0 }
    };

    // 단말기
    Object.values(store.inventory.phones || {}).forEach(model => {
      Object.entries(model).forEach(([status, colors]) => {
        const qty = Object.values(colors).reduce((sum, val) => {
          // val이 객체인 경우 quantity 필드 확인
          if (typeof val === 'object' && val !== null && val.quantity !== undefined) {
            return sum + (val.quantity || 0);
          } else if (typeof val === 'number') {
            return sum + (val || 0);
          }
          return sum;
        }, 0);
        if (status === '정상') summary.phones.normal += qty;
        else if (status === '이력') summary.phones.history += qty;
        else if (status === '불량') summary.phones.defective += qty;
        summary.total += qty;
      });
    });

    // 유심
    Object.values(store.inventory.sims || {}).forEach(model => {
      Object.entries(model).forEach(([status, colors]) => {
        const qty = Object.values(colors).reduce((sum, val) => {
          // val이 객체인 경우 quantity 필드 확인
          if (typeof val === 'object' && val !== null && val.quantity !== undefined) {
            return sum + (val.quantity || 0);
          } else if (typeof val === 'number') {
            return sum + (val || 0);
          }
          return sum;
        }, 0);
        if (status === '정상') summary.sims.normal += qty;
        else if (status === '이력') summary.sims.history += qty;
        else if (status === '불량') summary.sims.defective += qty;
        summary.total += qty;
      });
    });

    // 웨어러블
    Object.values(store.inventory.wearables || {}).forEach(model => {
      Object.entries(model).forEach(([status, colors]) => {
        const qty = Object.values(colors).reduce((sum, val) => {
          // val이 객체인 경우 quantity 필드 확인
          if (typeof val === 'object' && val !== null && val.quantity !== undefined) {
            return sum + (val.quantity || 0);
          } else if (typeof val === 'number') {
            return sum + (val || 0);
          }
          return sum;
        }, 0);
        if (status === '정상') summary.wearables.normal += qty;
        else if (status === '이력') summary.wearables.history += qty;
        else if (status === '불량') summary.wearables.defective += qty;
        summary.total += qty;
      });
    });

    // 스마트기기
    Object.values(store.inventory.smartDevices || {}).forEach(model => {
      Object.entries(model).forEach(([status, colors]) => {
        const qty = Object.values(colors).reduce((sum, val) => {
          // val이 객체인 경우 quantity 필드 확인
          if (typeof val === 'object' && val !== null && val.quantity !== undefined) {
            return sum + (val.quantity || 0);
          } else if (typeof val === 'number') {
            return sum + (val || 0);
          }
          return sum;
        }, 0);
        if (status === '정상') summary.smartDevices.normal += qty;
        else if (status === '이력') summary.smartDevices.history += qty;
        else if (status === '불량') summary.smartDevices.defective += qty;
        summary.total += qty;
      });
    });

    return summary;
  }, []);

  // 매장 상태 판단 (메모이제이션 적용)
  const getStoreStatus = useCallback((store) => {
    const inventorySummary = getStoreInventorySummary(store);
    
    // 정상 재고가 있는지 확인
    const hasNormalInventory = inventorySummary.phones.normal > 0 || 
                              inventorySummary.sims.normal > 0 ||
                              inventorySummary.wearables.normal > 0 ||
                              inventorySummary.smartDevices.normal > 0;
    
    // 불량 재고가 있는지 확인
    const hasDefectiveInventory = inventorySummary.phones.defective > 0 || 
                                 inventorySummary.sims.defective > 0 ||
                                 inventorySummary.wearables.defective > 0 ||
                                 inventorySummary.smartDevices.defective > 0;
    
    if (inventorySummary.total === 0) {
      return { status: '재고없음', color: 'error', icon: <CancelIcon /> };
    } else if (hasDefectiveInventory) {
      return { status: '불량재고', color: 'error', icon: <WarningIcon /> };
    } else if (hasNormalInventory) {
      return { status: '정상재고', color: 'success', icon: <CheckCircleIcon /> };
    } else {
      return { status: '이력재고', color: 'warning', icon: <HistoryIcon /> };
    }
  }, [getStoreInventorySummary]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  // 메인 화면
  if (currentScreen === 'main') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <AppBar position="static" sx={{ backgroundColor: '#2E7D32' }}>
          <Toolbar>
            <InventoryIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              재고 관리 시스템
            </Typography>
            
            {/* 2차 메뉴 */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                color="inherit" 
                onClick={(e) => handleMenuClick(e, 'assignment')}
                onMouseEnter={() => {
                  handleMenuHover('assignment', 'office');
                  handleMenuHover('assignment', 'sales');
                }}
                endIcon={<ExpandMoreIcon />}
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                재고배정
              </Button>
            </Box>
            
            {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
            {onModeChange && availableModes && availableModes.length > 1 && (
              <Button
                color="inherit"
                onClick={() => {
                  console.log('InventoryMode 모드 전환 버튼 클릭됨');
                  console.log('onModeChange 존재:', !!onModeChange);
                  console.log('availableModes:', availableModes);
                  onModeChange();
                }}
                startIcon={<SwapHorizIcon />}
                sx={{ 
                  ml: 2,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                모드 변경
              </Button>
            )}
            
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>

        {/* 드롭다운 메뉴 */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          PaperProps={{
            sx: {
              minWidth: '220px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              backgroundColor: 'rgba(255,255,255,0.95)',
              '& .MuiMenuItem-root': {
                borderRadius: '8px',
                margin: '4px 8px',
                padding: '12px 16px',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(46, 125, 50, 0.08)',
                  transform: 'translateX(4px)',
                  boxShadow: '0 2px 8px rgba(46, 125, 50, 0.15)'
                },
                '&:active': {
                  transform: 'translateX(2px) scale(0.98)'
                }
              }
            }
          }}
        >
          {selectedMenu === 'assignment' && (
            <>
              <MenuItem onClick={() => handleSubMenuClick('settings')}>
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>배정셋팅</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => setCurrentScreen('assignment_history')}>
                <ListItemIcon>
                  <HistoryIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>배정 히스토리</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>

        {/* 알림 시스템 */}
        <NotificationButton />
        <AnnouncementBanner />

        {/* 메인 콘텐츠 */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          {/* 검색 및 필터 */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>검색 유형</InputLabel>
                  <Select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    label="검색 유형"
                  >
                    <MenuItem value="store">매장명</MenuItem>
                    <MenuItem value="manager">담당자</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={`${searchType === 'store' ? '매장명' : '담당자'}을 입력하세요`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedStores([]);
                      setShowComparison(false);
                    }}
                    size="small"
                  >
                    초기화
                  </Button>
                  {selectedStores.length > 0 && (
                    <Button
                      variant="contained"
                      startIcon={<CompareIcon />}
                      onClick={() => setShowComparison(!showComparison)}
                      size="small"
                    >
                      비교 ({selectedStores.length}/5)
                    </Button>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* 선택된 매장 비교 */}
          {showComparison && selectedStores.length > 0 && (
            <Accordion sx={{ mb: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                  <CompareIcon sx={{ mr: 1 }} />
                  선택된 매장 비교 ({selectedStores.length}개)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {selectedStores.map(storeId => {
                    const store = filteredData?.find(s => s.id === storeId);
                    if (!store) return null;
                    
                    const inventorySummary = getStoreInventorySummary(store);
                    const status = getStoreStatus(store);
                    
                    return (
                      <Grid item xs={12} md={6} lg={4} key={storeId}>
                        <Card>
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              {store.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              담당자: {store.manager || '미지정'}
                            </Typography>
                            <Chip
                              icon={status.icon}
                              label={status.status}
                              color={status.color}
                              size="small"
                              sx={{ mb: 1 }}
                            />
                            <Typography variant="body2">
                              총 재고: {inventorySummary.total}개
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              정상: {inventorySummary.phones.normal + inventorySummary.sims.normal}개
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              불량: {inventorySummary.phones.defective + inventorySummary.sims.defective}개
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </AccordionDetails>
            </Accordion>
          )}

          {/* 탭 */}
          <Paper sx={{ mb: 3 }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="재고 관리 탭">
              <Tab label="매장별 재고" />
              <Tab label="담당자별 분석" />
            </Tabs>
          </Paper>

          {/* 매장별 재고 탭 */}
          {tabValue === 0 && (
            <>
              {/* 통계 카드 */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <StoreIcon sx={{ mr: 2, color: 'primary.main' }} />
                        <Box>
                          <Typography variant="h4">{stats.totalStores}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {searchTerm ? '검색된 매장' : '전체 매장'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <InventoryIcon sx={{ mr: 2, color: 'success.main' }} />
                        <Box>
                          <Typography variant="h4">{stats.totalInventory}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            총 재고량
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <InventoryIcon sx={{ mr: 2, color: 'warning.main' }} />
                        <Box>
                          <Typography variant="h4">{stats.storesWithInventory}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            재고 보유 매장
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 매장 목록 테이블 */}
              <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 'calc(100vh - 500px)' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={selectedStores.length > 0 && selectedStores.length < filteredData?.length}
                            checked={selectedStores.length === filteredData?.length && filteredData?.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const allIds = filteredData?.map(store => store.id).slice(0, 5) || [];
                                setSelectedStores(allIds);
                              } else {
                                setSelectedStores([]);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>매장명</TableCell>
                        <TableCell>담당자</TableCell>
                        <TableCell align="center">상태</TableCell>
                        <TableCell align="center">총 재고</TableCell>
                        <TableCell>단말기 (정상/이력/불량)</TableCell>
                        <TableCell>유심 (정상/이력/불량)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredData?.map((store) => {
                        const inventorySummary = getStoreInventorySummary(store);
                        const status = getStoreStatus(store);
                        const isSelected = selectedStores.includes(store.id);
                        
                        return (
                          <TableRow key={store.id} hover selected={isSelected}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={isSelected}
                                onChange={() => handleStoreSelect(store.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <StoreIcon sx={{ mr: 1, fontSize: 20 }} />
                                <Typography variant="body2" fontWeight="medium">
                                  {store.name}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {store.manager ? (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                                  {store.manager}
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  미지정
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                icon={status.icon}
                                label={status.status}
                                color={status.color}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${inventorySummary.total}개`}
                                color={inventorySummary.total > 0 ? 'success' : 'default'}
                                variant={inventorySummary.total > 0 ? 'filled' : 'outlined'}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Chip
                                  label={`정상: ${inventorySummary.phones.normal}`}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`이력: ${inventorySummary.phones.history}`}
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`불량: ${inventorySummary.phones.defective}`}
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                />
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Chip
                                  label={`정상: ${inventorySummary.sims.normal}`}
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`이력: ${inventorySummary.sims.history}`}
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                />
                                <Chip
                                  label={`불량: ${inventorySummary.sims.defective}`}
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}

          {/* 담당자별 분석 탭 */}
          {tabValue === 1 && (
            <>
              {/* 담당자별 통계 카드 */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon sx={{ mr: 2, color: 'primary.main' }} />
                        <Box>
                          <Typography variant="h4">{managerStats.length}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            담당자 수
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <StoreIcon sx={{ mr: 2, color: 'success.main' }} />
                        <Box>
                          <Typography variant="h4">
                            {managerStats.reduce((sum, mgr) => sum + mgr.storeCount, 0)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            거래처 총수
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <InventoryIcon sx={{ mr: 2, color: 'warning.main' }} />
                        <Box>
                          <Typography variant="h4">
                            {managerStats.reduce((sum, mgr) => sum + mgr.totalInventory, 0)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            총재고 합계
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* 담당자별 목록 테이블 */}
              <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 'calc(100vh - 500px)' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>담당자</TableCell>
                        <TableCell align="center">거래처 수</TableCell>
                        <TableCell align="center">총 재고</TableCell>
                        <TableCell>담당 매장</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {managerStats.map((manager) => (
                        <TableRow key={manager.manager} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <PersonIcon sx={{ mr: 1, fontSize: 20 }} />
                              <Typography variant="body2" fontWeight="medium">
                                {manager.manager}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${manager.storeCount}개`}
                              color="primary"
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${manager.totalInventory}개`}
                              color={manager.totalInventory > 0 ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {manager.stores.slice(0, 3).map((store) => (
                                <Chip
                                  key={store.id}
                                  label={store.name || '알 수 없음'}
                                  size="small"
                                  variant="outlined"
                                  icon={<StoreIcon />}
                                />
                              ))}
                              {manager.stores.length > 3 && (
                                <Chip
                                  label={`+${manager.stores.length - 3}개`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </Box>
      </Box>
    );
  }

  // 다른 화면들 (지연 로딩 적용)
  if (currentScreen === 'loading') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static">
          <Toolbar>
            <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
              ← 뒤로가기
            </Button>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              화면 로딩 중...
            </Typography>
            <Button color="inherit" onClick={onLogout}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        
        {/* 알림 시스템 */}
        <NotificationButton />
        <AnnouncementBanner />
        
        <LoadingSkeleton />
      </Box>
    );
  }

  // 지연 로딩 화면들
  if (currentScreen.startsWith('inventory_')) {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <InventoryAuditScreen 
          data={data}
          onBack={handleBackToMain}
          onLogout={onLogout}
          screenType={currentScreen}
        />
      </Suspense>
    );
  }

  if (currentScreen.startsWith('master_')) {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <MasterInventoryScreen 
          data={data}
          onBack={handleBackToMain}
          onLogout={onLogout}
          screenType={currentScreen}
        />
      </Suspense>
    );
  }

  if (currentScreen.startsWith('duplicate_')) {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <DuplicateCasesScreen 
          data={data}
          onBack={handleBackToMain}
          onLogout={onLogout}
          screenType={currentScreen}
        />
      </Suspense>
    );
  }

  if (currentScreen === 'assignment_settings') {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <AssignmentSettingsScreen 
          data={data}
          onBack={handleBackToMain}
          onLogout={onLogout}
        />
      </Suspense>
    );
  }

  if (currentScreen === 'assignment_department') {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <DepartmentAssignmentScreen 
          data={data}
          onBack={handleBackToMain}
          onLogout={onLogout}
        />
      </Suspense>
    );
  }

  if (currentScreen === 'assignment_history') {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <AssignmentHistoryScreen
          onBack={handleBackToMain}
          onLogout={onLogout}
        />
      </Suspense>
    );
  }



  if (currentScreen === 'realtime_dashboard') {
    return (
      <Suspense fallback={<LoadingSkeleton />}>
        <RealtimeDashboardScreen
          onBack={handleBackToMain}
          onLogout={onLogout}
        />
      </Suspense>
    );
  }

  // 기본 화면 (임시)
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {currentScreen.replace('_', ' - ')}
          </Typography>
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>
      
      {/* 알림 시스템 */}
      <NotificationButton />
      <AnnouncementBanner />
      
      <Box sx={{ flex: 1, p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography variant="h4" color="text.secondary">
          {currentScreen} 화면 개발 중...
        </Typography>
      </Box>
      
      {/* 업데이트 진행 팝업 */}
      <UpdateProgressPopup
        open={showUpdateProgressPopup}
        onClose={handleUpdateProgressPopupClose}
      />
    </Box>
  );
}

export default InventoryMode; 