import React, { useState, useEffect, useMemo } from 'react';
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
  // 선택된 회의 (회의진행 탭으로 전달)
  const [selectedMeetingForPresentation, setSelectedMeetingForPresentation] = useState(null);
  
  // 회의 모드 권한 확인 (OB 관리 모드와 동일한 방식)
  const meetingRole = useMemo(() => {
    const candidates = [
      loggedInStore?.meetingRole,
      loggedInStore?.agentInfo?.meetingRole,
      loggedInStore?.modePermissions?.meeting // modePermissions에서도 확인
    ]
      .map((role) => {
        if (role === true) return 'M'; // true는 M 권한으로 간주
        if (role === 'M' || role === 'O') return role.toString().toUpperCase();
        return (role || '').toString().toUpperCase();
      })
      .filter(Boolean);
    const matched = candidates.find((role) => ['M', 'O'].includes(role));
    return matched || 'O'; // 기본값은 O (회의진행만 가능)
  }, [loggedInStore]);
  
  // 접근 가능한 탭 확인
  const allowedTabs = useMemo(() => {
    if (meetingRole === 'M') {
      return [0, 1]; // 회의준비, 회의진행 모두 가능
    } else {
      return [1]; // 회의진행만 가능
    }
  }, [meetingRole]);
  
  // 초기 탭 설정 (권한에 따라)
  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      // 현재 탭에 접근 권한이 없으면 첫 번째 허용된 탭으로 이동
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab]);
  
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
              {allowedTabs.includes(0) && (
                <Tab 
                  icon={<EventNoteIcon />} 
                  iconPosition="start"
                  label="회의준비" 
                  sx={{ textTransform: 'none', fontWeight: 'bold' }}
                />
              )}
              {allowedTabs.includes(1) && (
                <Tab 
                  icon={<PlayArrowIcon />} 
                  iconPosition="start"
                  label="회의진행" 
                  sx={{ textTransform: 'none', fontWeight: 'bold' }}
                />
              )}
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
        {activeTab === 0 && allowedTabs.includes(0) && (
          <MeetingPreparationTab 
            loggedInStore={loggedInStore}
            onMeetingSelectForPresentation={(meeting) => {
              // 완료된 회의 선택 시 회의진행 탭으로 이동
              if (meeting && meeting.status === 'completed' && allowedTabs.includes(1)) {
                setSelectedMeetingForPresentation(meeting);
                setActiveTab(1);
              }
            }}
          />
        )}
        {activeTab === 1 && allowedTabs.includes(1) && (
          <MeetingPresentationTab 
            loggedInStore={loggedInStore}
            initialSelectedMeeting={selectedMeetingForPresentation}
            onMeetingDeselect={() => {
              setSelectedMeetingForPresentation(null);
            }}
          />
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