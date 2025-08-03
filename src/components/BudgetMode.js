import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material';
import {
  AccountBalance as BudgetIcon,
  Construction as ConstructionIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Update as UpdateIcon,
  SwapHoriz as SwapHorizIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';

function BudgetMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // 컴포넌트 마운트 시 업데이트 팝업 표시
  useEffect(() => {
    setShowUpdatePopup(true);
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ backgroundColor: '#795548' }}>
        <Toolbar>
          <BudgetIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            예산 모드
          </Typography>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={onModeChange}
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
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 콘텐츠 */}
      <Box sx={{ 
        p: 3, 
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#f5f5f5'
      }}>
        {/* 탭 메뉴 */}
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: '#e0e0e0', 
          mb: 3,
          backgroundColor: '#ffffff',
          borderRadius: 2,
          p: 1
        }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: '#666666',
                fontWeight: 'bold',
                '&.Mui-selected': {
                  color: '#795548'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#795548'
              }
            }}
          >
            <Tab label="예산 분석" icon={<AnalyticsIcon />} iconPosition="start" />
            <Tab label="예산 설정" icon={<SettingsIcon />} iconPosition="start" />
            <Tab label="예산 추적" icon={<TimelineIcon />} iconPosition="start" />
            <Tab label="예산 리포트" icon={<AssessmentIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* 탭별 콘텐츠 */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={{ 
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              border: '1px solid #e0e0e0'
            }}>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Box sx={{ mb: 3 }}>
                  <BudgetIcon sx={{ 
                    fontSize: 80, 
                    color: '#795548',
                    mb: 2
                  }} />
                  <CircularProgress 
                    size={60} 
                    sx={{ 
                      color: '#795548',
                      mb: 2
                    }} 
                  />
                </Box>
                
                <Typography variant="h4" component="h2" sx={{ 
                  fontWeight: 700,
                  color: '#795548',
                  mb: 2
                }}>
                  🚧 {activeTab === 0 ? '예산 분석' : activeTab === 1 ? '예산 설정' : activeTab === 2 ? '예산 추적' : '예산 리포트'} 준비중
                </Typography>
                
                <Typography variant="body1" sx={{ 
                  color: '#666666',
                  mb: 3,
                  maxWidth: 600,
                  mx: 'auto'
                }}>
                  {activeTab === 0 && '예산 분석 기능이 현재 개발 중입니다.'}
                  {activeTab === 1 && '예산 설정 기능이 현재 개발 중입니다.'}
                  {activeTab === 2 && '예산 추적 기능이 현재 개발 중입니다.'}
                  {activeTab === 3 && '예산 리포트 기능이 현재 개발 중입니다.'}
                  <br />
                  곧 더 나은 예산 관리 도구로 찾아뵙겠습니다!
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Chip 
                    label="준비중" 
                    icon={<ConstructionIcon />}
                    sx={{ 
                      backgroundColor: '#efebe9',
                      color: '#795548',
                      fontWeight: 'bold'
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 업데이트 팝업 */}
        <AppUpdatePopup
          open={showUpdatePopup}
          onClose={() => setShowUpdatePopup(false)}
          mode="budget"
          loggedInStore={loggedInStore}
          onUpdateAdded={() => {
            console.log('예산모드 새 업데이트가 추가되었습니다.');
          }}
        />
      </Box>
    </Box>
  );
}

export default BudgetMode; 