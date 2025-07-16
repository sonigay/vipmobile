import React, { useState } from 'react';
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
  Card,
  CardContent
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  SwapHoriz as SwapHorizIcon,
  AccountBalance as AccountBalanceIcon,
  Image as ImageIcon,
  TableChart as TableChartIcon
} from '@mui/icons-material';

function ChartMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [activeTab, setActiveTab] = useState(0);

  const handleBackToMain = () => {
    // 메인 화면으로 돌아가기 (모드 선택 팝업 표시)
    window.location.reload();
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // 탭 구성
  const tabs = [
    {
      label: '채권장표',
      icon: <AccountBalanceIcon />,
      component: <BondChartTab />
    },
    {
      label: '준비 중',
      icon: <BarChartIcon />,
      component: <ComingSoonTab />
    }
  ];

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            장표 모드
          </Typography>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={() => {
                console.log('ChartMode 모드 전환 버튼 클릭됨');
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
            value={activeTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '1rem',
                fontWeight: 'bold',
                color: '#666',
                '&.Mui-selected': {
                  color: '#f5576c',
                  fontWeight: 'bold'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#f5576c',
                height: 3
              }
            }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                sx={{ 
                  textTransform: 'none',
                  minHeight: 64,
                  py: 1
                }}
              />
            ))}
          </Tabs>
        </Container>
      </Box>
      
      {/* 탭 컨텐츠 */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 3, overflow: 'auto' }}>
        {tabs[activeTab].component}
      </Container>
    </Box>
  );
}

// 채권장표 탭 컴포넌트
function BondChartTab() {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold', color: '#f5576c' }}>
        채권장표
      </Typography>
      
      <Typography variant="h6" sx={{ mb: 2, color: '#666' }}>
        이미지 업로드를 통한 채권 데이터 수집 및 관리
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 4 }}>
        {/* 이미지 업로드 카드 */}
        <Card elevation={3} sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ImageIcon sx={{ fontSize: 32, color: '#f5576c', mr: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                이미지 업로드
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              채권 관련 이미지를 업로드하여 OCR로 데이터를 추출합니다.
            </Typography>
            <Button
              variant="contained"
              fullWidth
              sx={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #e085e8 0%, #e04a5f 100%)'
                }
              }}
            >
              이미지 선택
            </Button>
          </CardContent>
        </Card>

        {/* 데이터 관리 카드 */}
        <Card elevation={3} sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TableChartIcon sx={{ fontSize: 32, color: '#f5576c', mr: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                데이터 관리
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              추출된 데이터를 확인하고 편집할 수 있습니다.
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              sx={{
                borderColor: '#f5576c',
                color: '#f5576c',
                '&:hover': {
                  borderColor: '#e04a5f',
                  backgroundColor: 'rgba(245, 87, 108, 0.04)'
                }
              }}
            >
              데이터 보기
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* 기능 설명 */}
      <Card elevation={2} sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
            주요 기능
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                📸 이미지 OCR
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 단말기채권, 재고초과채권, 담보초과채권 이미지 업로드<br/>
                • 무료 OCR 기술로 텍스트 자동 추출<br/>
                • 다중 이미지 동시 처리 지원
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                📊 자동 표 생성
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 추출된 데이터를 깔끔한 표로 자동 정리<br/>
                • 일자별 데이터 그룹핑 및 관리<br/>
                • 통계 및 분석 기능 제공
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// 준비 중 탭 컴포넌트
function ComingSoonTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <BarChartIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        추가 기능
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        추가적인 장표 및 차트 관련 기능이 개발 중입니다.<br />
        빠른 시일 내에 서비스를 제공하겠습니다.
      </Typography>
    </Paper>
  );
}

export default ChartMode; 