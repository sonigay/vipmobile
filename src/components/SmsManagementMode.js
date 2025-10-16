import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  Container
} from '@mui/material';
import {
  Message as MessageIcon,
  Update as UpdateIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';

const SmsManagementMode = ({ 
  loggedInStore, 
  onLogout, 
  onModeChange, 
  availableModes 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  // SMS 관리모드 진입 시 업데이트 팝업 표시 (숨김 설정 확인 후)
  useEffect(() => {
    // 오늘 하루 보지 않기 설정 확인
    const hideUntil = localStorage.getItem('hideUpdate_smsManagement');
    const shouldShowPopup = !(hideUntil && new Date() < new Date(hideUntil));
    
    if (shouldShowPopup) {
      // 숨김 설정이 없거나 만료된 경우에만 팝업 표시
      setShowUpdatePopup(true);
    }
  }, []);

  // 로딩 상태
  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#00897B' }}>
          <Toolbar>
            <MessageIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              SMS 관리 모드
            </Typography>
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#00897B' }}>
          <Toolbar>
            <MessageIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              SMS 관리 모드
            </Typography>
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Alert severity="error" sx={{ width: '50%' }}>
            <AlertTitle>오류</AlertTitle>
            {error}
          </Alert>
        </Box>
      </Box>
    );
  }

  // 메인 화면
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ backgroundColor: '#00897B' }}>
        <Toolbar>
          <MessageIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            SMS 관리 모드
          </Typography>
          
          {/* 업데이트 확인 버튼 */}
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={() => setShowUpdatePopup(true)}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)'
              }
            }}
          >
            업데이트 확인
          </Button>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={onModeChange}
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

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, overflow: 'auto', backgroundColor: '#f5f5f5' }}>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <MessageIcon sx={{ fontSize: 80, color: '#00897B', mb: 2 }} />
                <Typography variant="h4" gutterBottom fontWeight="bold">
                  SMS 관리 모드
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  SMS 수신 및 전달 관리 시스템
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  현재 개발 중입니다. 곧 새로운 기능으로 찾아뵙겠습니다.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>

      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="smsManagement"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('SMS 관리모드 새 업데이트가 추가되었습니다.');
        }}
      />
    </Box>
  );
};

export default SmsManagementMode;

