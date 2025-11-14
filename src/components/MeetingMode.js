import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import {
  SwapHoriz as SwapHorizIcon,
  Update as UpdateIcon,
  EventNote as EventNoteIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';

import AppUpdatePopup from './AppUpdatePopup';
import MeetingPreparationTab from './meeting/MeetingPreparationTab';
import MeetingPresentationTab from './meeting/MeetingPresentationTab';

function MeetingMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  // 탭 상태
  const [activeTab, setActiveTab] = useState(0);
  
  // 회의모드 진입 시 업데이트 팝업 표시 (숨김 설정 확인 후)
  useEffect(() => {
    // 오늘 하루 보지 않기 설정 확인
    const hideUntil = localStorage.getItem('hideUpdate_meeting');
    const shouldShowPopup = !(hideUntil && new Date() < new Date(hideUntil));
    
    if (shouldShowPopup) {
      // 숨김 설정이 없거나 만료된 경우에만 팝업 표시
      setShowUpdatePopup(true);
    }
  }, []);

  const handleBackToMain = () => {
    // 메인 화면으로 돌아가기 (모드 선택 팝업 표시)
    window.location.reload();
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ backgroundColor: '#3949AB' }}>
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600, mr: 3 }}>
            회의 모드
          </Typography>
          
          {/* 탭 네비게이션 */}
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              textColor="inherit"
              indicatorColor="secondary"
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab 
                icon={<EventNoteIcon />} 
                iconPosition="start"
                label="회의준비" 
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              />
              <Tab 
                icon={<PlayArrowIcon />} 
                iconPosition="start"
                label="회의진행" 
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              />
            </Tabs>
          </Box>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={() => {
                console.log('MeetingMode 모드 전환 버튼 클릭됨');
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
          
          {/* 업데이트 확인 버튼 */}
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={() => setShowUpdatePopup(true)}
            sx={{ 
              mr: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)'
              }
            }}
          >
            업데이트 확인
          </Button>
          
          <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>
      
      {/* 탭 컨텐츠 */}
      <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#f5f5f5' }}>
        {activeTab === 0 && (
          <MeetingPreparationTab loggedInStore={loggedInStore} />
        )}
        {activeTab === 1 && (
          <MeetingPresentationTab loggedInStore={loggedInStore} />
        )}
      </Box>
      
      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="meeting"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('회의모드 새 업데이트가 추가되었습니다.');
        }}
      />
    </Box>
  );
}

export default MeetingMode; 