import React from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper
} from '@mui/material';
import {
  Policy as PolicyIcon
} from '@mui/icons-material';

function PolicyMode({ onLogout, loggedInStore }) {
  const handleBackToMain = () => {
    // 메인 화면으로 돌아가기 (모드 선택 팝업 표시)
    window.location.reload();
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            정책 모드
          </Typography>
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            borderRadius: 3
          }}
        >
          <PolicyIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
          <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
            정책 모드
          </Typography>
          <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
            준비 중입니다
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
            정책 및 규정 관련 기능이 개발 중입니다.<br />
            빠른 시일 내에 서비스를 제공하겠습니다.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}

export default PolicyMode; 