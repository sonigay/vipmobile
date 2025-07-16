import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Event as EventIcon,
  SwapHoriz as SwapHorizIcon,
  Settings as SettingsIcon,
  Store as StoreIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import ReservationSettingsScreen from './screens/ReservationSettingsScreen';
import SalesByStoreScreen from './screens/SalesByStoreScreen';
import { hasNewDeployment, performAutoLogout, shouldCheckForUpdates, setLastUpdateCheck } from '../utils/updateDetection';
import UpdateProgressPopup from './UpdateProgressPopup';

function ReservationMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [currentTab, setCurrentTab] = useState(0);
  const [showUpdateProgressPopup, setShowUpdateProgressPopup] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalReservations: 0,
    completedReservations: 0,
    pendingReservations: 0,
    totalAgents: 0,
    totalStores: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 새로운 배포 감지
  useEffect(() => {
    const checkForNewDeployment = async () => {
      // 새로운 배포가 있는지 확인
      if (shouldCheckForUpdates()) {
        const hasNew = await hasNewDeployment();
        if (hasNew) {
          console.log('새로운 배포 감지 - 자동 로그아웃 실행');
          await performAutoLogout();
          // 업데이트 진행 팝업 표시
          setShowUpdateProgressPopup(true);
          return;
        }
        setLastUpdateCheck();
      }
    };

    // 새로운 배포 체크
    checkForNewDeployment();
  }, []);

  // Service Worker 메시지 리스너
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'AUTO_LOGOUT_REQUIRED') {
          console.log('Service Worker에서 자동 로그아웃 요청 받음');
          performAutoLogout();
          setShowUpdateProgressPopup(true);
        }
      });
    }
  }, []);

  // 대시보드 데이터 로드
  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-by-store/data`);
      
      if (!response.ok) {
        throw new Error('데이터를 불러올 수 없습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        const data = result.data;
        const stats = result.stats;
        
        // 대시보드 데이터 계산
        const totalReservations = stats?.totalItems || 0;
        const totalDocumentReceived = stats?.totalDocumentReceived || 0;
        const pendingReservations = totalReservations - totalDocumentReceived;
        const totalAgents = stats?.totalAgents || 0;
        const totalStores = stats?.totalStores || 0;
        
        // 최근 활동 데이터 (임시)
        const recentActivity = [
          { type: 'reservation', message: '새로운 사전예약이 등록되었습니다.', time: '5분 전' },
          { type: 'document', message: '서류접수가 완료되었습니다.', time: '10분 전' },
          { type: 'agent', message: '담당자 배정이 변경되었습니다.', time: '15분 전' }
        ];
        
        setDashboardData({
          totalReservations,
          completedReservations: totalDocumentReceived,
          pendingReservations,
          totalAgents,
          totalStores,
          recentActivity
        });
      } else {
        throw new Error(result.message || '데이터 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === 0) {
      loadDashboardData();
    }
  }, [currentTab]);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleBackToMain = () => {
    // 메인 화면으로 돌아가기 (모드 선택 팝업 표시)
    window.location.reload();
  };

  // 탭 내용 렌더링
  const renderTabContent = () => {
    switch (currentTab) {
      case 0: // 메인 탭
        return (
          <Container maxWidth="lg" sx={{ py: 3 }}>
            {/* 헤더 */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h4" component="h1" sx={{ mb: 1, fontWeight: 'bold', color: '#ff9a9e' }}>
                사전예약 대시보드
              </Typography>
              <Typography variant="body1" color="text.secondary">
                사전예약 현황과 주요 통계를 한눈에 확인하세요
              </Typography>
            </Box>

            {/* 에러 메시지 */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* 통계 카드 */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
                  color: 'white'
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          {dashboardData.totalReservations.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          총 사전예약
                        </Typography>
                      </Box>
                      <EventIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)',
                  color: 'white'
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          {dashboardData.completedReservations.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          서류접수 완료
                        </Typography>
                      </Box>
                      <CheckCircleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                  color: 'white'
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          {dashboardData.pendingReservations.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          서류접수 대기
                        </Typography>
                      </Box>
                      <WarningIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ 
                  background: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
                  color: 'white'
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          {dashboardData.totalAgents}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          담당자 수
                        </Typography>
                      </Box>
                      <PeopleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* 빠른 액션 */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
                      빠른 액션
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<SettingsIcon />}
                        onClick={() => setCurrentTab(1)}
                        sx={{ justifyContent: 'flex-start', py: 1.5 }}
                      >
                        사전예약정리 셋팅
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<StoreIcon />}
                        onClick={() => setCurrentTab(2)}
                        sx={{ justifyContent: 'flex-start', py: 1.5 }}
                      >
                        판매처별정리
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={loadDashboardData}
                        disabled={loading}
                        sx={{ justifyContent: 'flex-start', py: 1.5 }}
                      >
                        {loading ? <CircularProgress size={20} /> : '데이터 새로고침'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
                      최근 활동
                    </Typography>
                    <List dense>
                      {dashboardData.recentActivity.map((activity, index) => (
                        <ListItem key={index} sx={{ px: 0 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {activity.type === 'reservation' && <EventIcon color="primary" />}
                            {activity.type === 'document' && <CheckCircleIcon color="success" />}
                            {activity.type === 'agent' && <PeopleIcon color="info" />}
                          </ListItemIcon>
                          <ListItemText
                            primary={activity.message}
                            secondary={activity.time}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* 진행률 표시 */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
                  서류접수 진행률
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        진행률
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {dashboardData.totalReservations > 0 
                          ? Math.round((dashboardData.completedReservations / dashboardData.totalReservations) * 100)
                          : 0}%
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      width: '100%', 
                      height: 8, 
                      backgroundColor: '#e0e0e0', 
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}>
                      <Box sx={{ 
                        width: `${dashboardData.totalReservations > 0 
                          ? (dashboardData.completedReservations / dashboardData.totalReservations) * 100 
                          : 0}%`,
                        height: '100%',
                        backgroundColor: '#4caf50',
                        transition: 'width 0.3s ease'
                      }} />
                    </Box>
                  </Box>
                  <Chip 
                    label={`${dashboardData.completedReservations}/${dashboardData.totalReservations}`}
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          </Container>
        );
      case 1: // 사전예약정리 셋팅 탭
        return (
          <ReservationSettingsScreen 
            loggedInStore={loggedInStore}
          />
        );
      case 2: // 판매처별정리 탭
        return (
          <SalesByStoreScreen 
            loggedInStore={loggedInStore}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            사전예약 모드
          </Typography>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={() => {
                console.log('ReservationMode 모드 전환 버튼 클릭됨');
                console.log('onModeChange 존재:', !!onModeChange);
                console.log('availableModes:', availableModes);
                onModeChange();
              }}
              startIcon={<SwapHorizIcon />}
              sx={{ 
                mr: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              모드 변경
            </Button>
          )}
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'white' }}>
        <Container maxWidth="lg">
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '1rem',
                fontWeight: 500
              }
            }}
          >
            <Tab 
              label="메인" 
              icon={<EventIcon />} 
              iconPosition="start"
              sx={{ 
                minHeight: 64,
                '&.Mui-selected': {
                  color: '#ff9a9e'
                }
              }}
            />
            <Tab 
              label="사전예약정리 셋팅" 
              icon={<SettingsIcon />} 
              iconPosition="start"
              sx={{ 
                minHeight: 64,
                '&.Mui-selected': {
                  color: '#ff9a9e'
                }
              }}
            />
            <Tab 
              label="판매처별정리" 
              icon={<StoreIcon />} 
              iconPosition="start"
              sx={{ 
                minHeight: 64,
                '&.Mui-selected': {
                  color: '#ff9a9e'
                }
              }}
            />
          </Tabs>
        </Container>
      </Box>
      
      {/* 탭 내용 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {renderTabContent()}
      </Box>

      {showUpdateProgressPopup && <UpdateProgressPopup />}
    </Box>
  );
}

export default ReservationMode; 