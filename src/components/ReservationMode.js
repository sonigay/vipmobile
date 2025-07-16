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
  Tab
} from '@mui/material';
import {
  Event as EventIcon,
  SwapHoriz as SwapHorizIcon,
  Settings as SettingsIcon,
  Store as StoreIcon
} from '@mui/icons-material';
import ReservationSettingsScreen from './screens/ReservationSettingsScreen';
import SalesByStoreScreen from './screens/SalesByStoreScreen';
import { hasNewDeployment, performAutoLogout, shouldCheckForUpdates, setLastUpdateCheck } from '../utils/updateDetection';
import UpdateProgressPopup from './UpdateProgressPopup';

function ReservationMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [currentTab, setCurrentTab] = useState(0);
  const [showUpdateProgressPopup, setShowUpdateProgressPopup] = useState(false);

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
          <Container maxWidth="lg" sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Paper 
              elevation={3} 
              sx={{ 
                p: 4, 
                textAlign: 'center',
                background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
                color: 'white',
                borderRadius: 3
              }}
            >
              <EventIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
              <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
                사전예약 모드
              </Typography>
              <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
                준비 중입니다
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
                사전예약 및 일정 관리 기능이 개발 중입니다.<br />
                빠른 시일 내에 서비스를 제공하겠습니다.
              </Typography>
            </Paper>
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