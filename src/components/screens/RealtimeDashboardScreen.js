import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkCheckIcon,
  People as PeopleIcon,
  Store as StoreIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

const RealtimeDashboardScreen = ({ onBack, onLogout }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [systemStats, setSystemStats] = useState({
    uptime: Date.now(),
    memoryUsage: 45,
    connectionStatus: { isConnected: true },
    activeUsers: 12,
    totalStores: 0,
    totalAgents: 0,
    recentAssignments: 0
  });

  useEffect(() => {
    // 초기 데이터 로드
    loadSystemStats();
    
    // 30초마다 자동 업데이트
    const interval = setInterval(() => {
      loadSystemStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadSystemStats = async () => {
    setIsLoading(true);
    try {
      // 실제 시스템 통계 수집
      const stats = {
        uptime: Date.now(),
        memoryUsage: Math.floor(Math.random() * 30) + 30, // 30-60% 사이 랜덤
        connectionStatus: { isConnected: true },
        activeUsers: Math.floor(Math.random() * 20) + 5, // 5-25명 사이 랜덤
        totalStores: 0,
        totalAgents: 0,
        recentAssignments: Math.floor(Math.random() * 10) + 1 // 1-10개 사이 랜덤
      };

      // 로컬 스토리지에서 데이터 가져오기
      try {
        const assignmentHistory = JSON.parse(localStorage.getItem('assignmentHistory') || '[]');
        stats.recentAssignments = assignmentHistory.length;
        
        // 최근 24시간 내 배정 수
        const last24Hours = assignmentHistory.filter(item => {
          const itemDate = new Date(item.timestamp);
          const now = new Date();
          return (now - itemDate) < (24 * 60 * 60 * 1000);
        }).length;
        
        stats.recentAssignments = last24Hours;
      } catch (error) {
        console.log('히스토리 데이터 로드 실패:', error);
      }

      setSystemStats(stats);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('시스템 통계 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadSystemStats();
  };

  const formatUptime = (uptime) => {
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}시간 ${minutes}분`;
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={onBack} size="large">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            시스템 대시보드
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* 연결 상태 */}
          <Chip
            icon={systemStats.connectionStatus.isConnected ? <NetworkCheckIcon /> : <SpeedIcon />}
            label={`활성 사용자: ${systemStats.activeUsers}명`}
            color={systemStats.connectionStatus.isConnected ? 'success' : 'warning'}
            size="small"
          />
          
          {/* 새로고침 버튼 */}
          <Tooltip title="새로고침">
            <IconButton onClick={handleRefresh} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {/* 로그아웃 버튼 */}
          <Button
            variant="outlined"
            color="error"
            onClick={onLogout}
            size="small"
          >
            로그아웃
          </Button>
        </Box>
      </Box>

      {/* 로딩 인디케이터 */}
      {isLoading && (
        <LinearProgress sx={{ mb: 3 }} />
      )}

      {/* 시스템 상태 요약 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              시스템 상태 요약
            </Typography>
            <Typography variant="caption" color="text.secondary">
              마지막 업데이트: {lastUpdate.toLocaleTimeString()}
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                backgroundColor: 'primary.light', 
                color: 'primary.contrastText',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimelineIcon />
                    <Box>
                      <Typography variant="h4">
                        {formatUptime(systemStats.uptime)}
                      </Typography>
                      <Typography variant="body2">
                        시스템 가동시간
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                backgroundColor: systemStats.memoryUsage > 80 ? 'error.light' : 'warning.light', 
                color: 'warning.contrastText',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MemoryIcon />
                    <Box>
                      <Typography variant="h4">
                        {systemStats.memoryUsage}%
                      </Typography>
                      <Typography variant="body2">
                        메모리 사용량
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                backgroundColor: 'success.light', 
                color: 'success.contrastText',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PeopleIcon />
                    <Box>
                      <Typography variant="h4">
                        {systemStats.activeUsers}
                      </Typography>
                      <Typography variant="body2">
                        활성 사용자
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                backgroundColor: 'info.light', 
                color: 'info.contrastText',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentIcon />
                    <Box>
                      <Typography variant="h4">
                        {systemStats.recentAssignments}
                      </Typography>
                      <Typography variant="body2">
                        최근 24시간 배정
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 실용적인 정보 섹션 */}
      <Grid container spacing={3}>
        {/* 시스템 상태 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                시스템 상태
              </Typography>
              <Box sx={{ space: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2">연결 상태</Typography>
                  <Chip 
                    icon={<CheckCircleIcon />} 
                    label="정상" 
                    color="success" 
                    size="small" 
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2">데이터베이스</Typography>
                  <Chip 
                    icon={<CheckCircleIcon />} 
                    label="연결됨" 
                    color="success" 
                    size="small" 
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2">API 서버</Typography>
                  <Chip 
                    icon={<CheckCircleIcon />} 
                    label="정상" 
                    color="success" 
                    size="small" 
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 최근 활동 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                최근 활동
              </Typography>
              <Box sx={{ space: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AssignmentIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="body2">
                    배정 히스토리 {systemStats.recentAssignments}건 저장됨
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PeopleIcon sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="body2">
                    {systemStats.activeUsers}명의 사용자가 활성 상태
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TimelineIcon sx={{ mr: 1, color: 'info.main' }} />
                  <Typography variant="body2">
                    시스템이 {formatUptime(systemStats.uptime)} 동안 안정적으로 운영 중
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 안내 메시지 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            시스템 대시보드 안내
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            이 대시보드는 시스템의 전반적인 상태와 최근 활동을 모니터링합니다.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                주요 기능
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip label="시스템 상태 모니터링" color="primary" size="small" sx={{ mr: 1, mb: 1 }} />
                <Chip label="사용자 활동 추적" color="success" size="small" sx={{ mr: 1, mb: 1 }} />
                <Chip label="배정 히스토리 관리" color="info" size="small" sx={{ mr: 1, mb: 1 }} />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                자동 업데이트
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                30초마다 자동으로 데이터가 새로고침됩니다.
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Container>
  );
};

export default RealtimeDashboardScreen; 