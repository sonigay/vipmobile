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
  DataUsage as DataUsageIcon,
  Update as UpdateIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';

const DataCollectionMode = ({ 
  loggedInStore, 
  onLogout, 
  onModeChange, 
  availableModes 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  // 로딩 상태
  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#9C27B0' }}>
          <Toolbar>
            <DataUsageIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              정보수집 모드
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
        <AppBar position="static" sx={{ backgroundColor: '#9C27B0' }}>
          <Toolbar>
            <DataUsageIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              정보수집 모드
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
      <AppBar position="static" sx={{ backgroundColor: '#9C27B0' }}>
        <Toolbar>
          <DataUsageIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            정보수집 모드
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
              onClick={onModeChange}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                },
                ml: 1
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

      {/* 메인 콘텐츠 */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Container maxWidth="lg">
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <CardContent>
              <DataUsageIcon sx={{ fontSize: 80, color: '#9C27B0', mb: 2 }} />
              <Typography variant="h4" component="h1" gutterBottom>
                정보수집 모드
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                현재 개발 중입니다
              </Typography>
              <Typography variant="body1" color="text.secondary">
                곧 새로운 기능으로 찾아뵙겠습니다.
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>

      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="dataCollection"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('정보수집모드 새 업데이트가 추가되었습니다.');
        }}
      />
    </Box>
  );
};

export default DataCollectionMode;
