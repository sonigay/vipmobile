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
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkCheckIcon
} from '@mui/icons-material';
import RealtimeDashboard from '../RealtimeDashboard';
import {
  realtimeDashboardManager,
  getRealtimeStats,
  refreshAllRealtimeData
} from '../../utils/realtimeDashboardUtils';

const RealtimeDashboardScreen = ({ onBack, onLogout }) => {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 대시보드 통계 업데이트
    const updateStats = () => {
      const stats = getRealtimeStats();
      setDashboardStats(stats);
    };

    // 초기 통계 로드
    updateStats();

    // 주기적 통계 업데이트
    const statsInterval = setInterval(updateStats, 10000);

    return () => {
      clearInterval(statsInterval);
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setError(null);
      await refreshAllRealtimeData();
    } catch (error) {
      console.error('대시보드 새로고침 실패:', error);
      setError('데이터 새로고침 중 오류가 발생했습니다.');
    }
  };

  const handleAutoRefreshToggle = () => {
    setAutoRefresh(!autoRefresh);
    if (autoRefresh) {
      realtimeDashboardManager.stopPeriodicUpdates();
    } else {
      realtimeDashboardManager.startPeriodicUpdates();
    }
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
            실시간 대시보드
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* 연결 상태 */}
          {dashboardStats && (
            <Chip
              icon={dashboardStats.connectionStatus.isConnected ? <NetworkCheckIcon /> : <SpeedIcon />}
              label={`구독자: ${dashboardStats.subscribers} | 캐시: ${dashboardStats.cachedDataTypes}`}
              color={dashboardStats.connectionStatus.isConnected ? 'success' : 'warning'}
              size="small"
            />
          )}
          
          {/* 자동 새로고침 토글 */}
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={handleAutoRefreshToggle}
                size="small"
              />
            }
            label="자동 새로고침"
            sx={{ mr: 1 }}
          />
          
          {/* 새로고침 버튼 */}
          <Tooltip title="새로고침">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {/* 설정 버튼 */}
          <Tooltip title="설정">
            <IconButton>
              <SettingsIcon />
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

      {/* 오류 알림 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 시스템 상태 요약 */}
      {dashboardStats && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              시스템 상태 요약
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon color="primary" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      가동시간
                    </Typography>
                    <Typography variant="body1">
                      {Math.floor(dashboardStats.uptime / (1000 * 60 * 60))}시간
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MemoryIcon color="warning" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      메모리 사용량
                    </Typography>
                    <Typography variant="body1">
                      {dashboardStats.memoryUsage ? Math.round(dashboardStats.memoryUsage.percentage) : 0}%
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NetworkCheckIcon color="success" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      연결 상태
                    </Typography>
                    <Typography variant="body1">
                      {dashboardStats.connectionStatus.isConnected ? '온라인' : '오프라인'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NotificationsIcon color="info" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      마지막 업데이트
                    </Typography>
                    <Typography variant="body1">
                      {dashboardStats.lastUpdate ? new Date(dashboardStats.lastUpdate).toLocaleTimeString() : '없음'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 실시간 대시보드 컴포넌트 */}
      <RealtimeDashboard />

      {/* 고급 메트릭 토글 */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <FormControlLabel
          control={
            <Switch
              checked={showAdvancedMetrics}
              onChange={(e) => setShowAdvancedMetrics(e.target.checked)}
            />
          }
          label="고급 메트릭 표시"
        />
      </Box>

      {/* 고급 메트릭 (선택적) */}
      {showAdvancedMetrics && dashboardStats && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              고급 시스템 메트릭
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  메모리 상세 정보
                </Typography>
                {dashboardStats.memoryUsage && (
                  <Box>
                    <Typography variant="body2">
                      사용 중: {Math.round(dashboardStats.memoryUsage.used / 1024 / 1024)}MB
                    </Typography>
                    <Typography variant="body2">
                      총 할당: {Math.round(dashboardStats.memoryUsage.total / 1024 / 1024)}MB
                    </Typography>
                    <Typography variant="body2">
                      제한: {Math.round(dashboardStats.memoryUsage.limit / 1024 / 1024)}MB
                    </Typography>
                  </Box>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  연결 상세 정보
                </Typography>
                <Typography variant="body2">
                  재연결 시도: {dashboardStats.connectionStatus.reconnectAttempts}
                </Typography>
                <Typography variant="body2">
                  구독자 수: {dashboardStats.subscribers}
                </Typography>
                <Typography variant="body2">
                  캐시된 데이터 타입: {dashboardStats.cachedDataTypes}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default RealtimeDashboardScreen; 