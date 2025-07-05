import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
  Phone as PhoneIcon,
  Watch as WatchIcon,
  Tablet as TabletIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkCheckIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  realtimeDashboardManager,
  subscribeToRealtimeData,
  unsubscribeFromRealtimeData,
  refreshAllRealtimeData,
  getRealtimeStats,
  REALTIME_DATA_TYPES
} from '../utils/realtimeDashboardUtils';

const RealtimeDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    inventory: null,
    assignment: null,
    activation: null,
    system: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    isConnected: false,
    reconnectAttempts: 0
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 실시간 데이터 구독
  useEffect(() => {
    const handleInventoryUpdate = (data) => {
      setDashboardData(prev => ({ ...prev, inventory: data }));
      setLastUpdate(Date.now());
    };

    const handleAssignmentUpdate = (data) => {
      setDashboardData(prev => ({ ...prev, assignment: data }));
      setLastUpdate(Date.now());
    };

    const handleActivationUpdate = (data) => {
      setDashboardData(prev => ({ ...prev, activation: data }));
      setLastUpdate(Date.now());
    };

    const handleSystemUpdate = (data) => {
      setDashboardData(prev => ({ ...prev, system: data }));
      setLastUpdate(Date.now());
    };

    // 구독 등록
    subscribeToRealtimeData(REALTIME_DATA_TYPES.INVENTORY, handleInventoryUpdate);
    subscribeToRealtimeData(REALTIME_DATA_TYPES.ASSIGNMENT, handleAssignmentUpdate);
    subscribeToRealtimeData(REALTIME_DATA_TYPES.ACTIVATION, handleActivationUpdate);
    subscribeToRealtimeData(REALTIME_DATA_TYPES.SYSTEM, handleSystemUpdate);

    // 초기 데이터 로드
    loadInitialData();

    // 연결 상태 모니터링
    const statusInterval = setInterval(() => {
      const stats = getRealtimeStats();
      setConnectionStatus(stats.connectionStatus);
    }, 5000);

    return () => {
      // 구독 해제
      unsubscribeFromRealtimeData(REALTIME_DATA_TYPES.INVENTORY, handleInventoryUpdate);
      unsubscribeFromRealtimeData(REALTIME_DATA_TYPES.ASSIGNMENT, handleAssignmentUpdate);
      unsubscribeFromRealtimeData(REALTIME_DATA_TYPES.ACTIVATION, handleActivationUpdate);
      unsubscribeFromRealtimeData(REALTIME_DATA_TYPES.SYSTEM, handleSystemUpdate);
      
      clearInterval(statusInterval);
    };
  }, []);

  // 초기 데이터 로드
  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await refreshAllRealtimeData();
      
      setLoading(false);
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  // 수동 새로고침
  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      await refreshAllRealtimeData();
      setLoading(false);
    } catch (error) {
      console.error('데이터 새로고침 실패:', error);
      setError('데이터 새로고침 중 오류가 발생했습니다.');
      setLoading(false);
    }
  }, []);

  // 상태 표시 아이콘
  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  // 재고 요약 카드
  const InventorySummaryCard = ({ data }) => {
    if (!data) return <LoadingCard title="재고 현황" />;

    const { totalInventory, categoryBreakdown, recentChanges } = data;

    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" component="div">
              재고 현황
            </Typography>
            <InventoryIcon color="primary" />
          </Box>
          
          <Typography variant="h4" component="div" sx={{ mb: 2, color: 'primary.main' }}>
            {totalInventory?.toLocaleString() || 0}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            총 재고 수량
          </Typography>

          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <PhoneIcon color="primary" />
                <Typography variant="body2">
                  {categoryBreakdown?.phones || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  휴대폰
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <WatchIcon color="secondary" />
                <Typography variant="body2">
                  {categoryBreakdown?.wearables || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  웨어러블
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box sx={{ textAlign: 'center' }}>
                <TabletIcon color="info" />
                <Typography variant="body2">
                  {categoryBreakdown?.tablets || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  태블릿
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {recentChanges && recentChanges.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                최근 변경사항
              </Typography>
              {recentChanges.slice(0, 3).map((change, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  {change.type === 'increase' ? (
                    <TrendingUpIcon color="success" sx={{ fontSize: 16, mr: 0.5 }} />
                  ) : (
                    <TrendingDownIcon color="error" sx={{ fontSize: 16, mr: 0.5 }} />
                  )}
                  <Typography variant="caption">
                    {change.storeName}: {change.quantity}개 {change.type === 'increase' ? '증가' : '감소'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // 배정 현황 카드
  const AssignmentSummaryCard = ({ data }) => {
    if (!data) return <LoadingCard title="배정 현황" />;

    const { totalAssigned, assignmentProgress, recentAssignments } = data;

    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" component="div">
              배정 현황
            </Typography>
            <AssignmentIcon color="primary" />
          </Box>
          
          <Typography variant="h4" component="div" sx={{ mb: 2, color: 'primary.main' }}>
            {totalAssigned?.toLocaleString() || 0}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            총 배정 수량
          </Typography>

          {assignmentProgress && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">진행률</Typography>
                <Typography variant="body2">{assignmentProgress.percentage}%</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={assignmentProgress.percentage} 
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}

          {recentAssignments && recentAssignments.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                최근 배정
              </Typography>
              {recentAssignments.slice(0, 3).map((assignment, index) => (
                <Box key={index} sx={{ mb: 0.5 }}>
                  <Typography variant="caption" display="block">
                    {assignment.target}: {assignment.quantity}개
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(assignment.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // 개통 실적 카드
  const ActivationSummaryCard = ({ data }) => {
    if (!data) return <LoadingCard title="개통 실적" />;

    const { totalActivation, monthlyTrend, topModels } = data;

    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" component="div">
              개통 실적
            </Typography>
            <TrendingUpIcon color="primary" />
          </Box>
          
          <Typography variant="h4" component="div" sx={{ mb: 2, color: 'primary.main' }}>
            {totalActivation?.toLocaleString() || 0}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            이번 달 총 개통
          </Typography>

          {monthlyTrend && monthlyTrend.length > 0 && (
            <Box sx={{ height: 100, mb: 2 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="activation" stroke="#1976d2" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}

          {topModels && topModels.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                인기 모델
              </Typography>
              {topModels.slice(0, 3).map((model, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption">{model.name}</Typography>
                  <Typography variant="caption" color="primary">
                    {model.count}개
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // 시스템 상태 카드
  const SystemStatusCard = ({ data }) => {
    if (!data) return <LoadingCard title="시스템 상태" />;

    const { uptime, memory, network, performance } = data;

    return (
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" component="div">
              시스템 상태
            </Typography>
            <SpeedIcon color="primary" />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center' }}>
                <TimelineIcon color="info" />
                <Typography variant="body2">
                  {Math.floor(uptime / (1000 * 60 * 60))}시간
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  가동시간
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center' }}>
                <MemoryIcon color="warning" />
                <Typography variant="body2">
                  {memory ? Math.round(memory.percentage) : 0}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  메모리
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center' }}>
                <NetworkCheckIcon color="success" />
                <Typography variant="body2">
                  {network?.online ? '온라인' : '오프라인'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  네트워크
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box sx={{ textAlign: 'center' }}>
                <SpeedIcon color="primary" />
                <Typography variant="body2">
                  {performance?.fps || 0} FPS
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  성능
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {memory && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption">메모리 사용량</Typography>
                <Typography variant="caption">
                  {Math.round(memory.used / 1024 / 1024)}MB / {Math.round(memory.limit / 1024 / 1024)}MB
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={memory.percentage} 
                color={memory.percentage > 80 ? 'error' : memory.percentage > 60 ? 'warning' : 'primary'}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  // 로딩 카드
  const LoadingCard = ({ title }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="div">
            {title}
          </Typography>
          <CircularProgress size={20} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 100 }}>
          <CircularProgress />
        </Box>
      </CardContent>
    </Card>
  );

  // 연결 상태 표시
  const ConnectionStatus = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Chip
        icon={connectionStatus.isConnected ? <CheckCircleIcon /> : <ErrorIcon />}
        label={connectionStatus.isConnected ? '실시간 연결됨' : '연결 끊어짐'}
        color={connectionStatus.isConnected ? 'success' : 'error'}
        size="small"
      />
      {lastUpdate && (
        <Typography variant="caption" color="text.secondary">
          마지막 업데이트: {new Date(lastUpdate).toLocaleTimeString()}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          실시간 대시보드
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ConnectionStatus />
          <Tooltip title="새로고침">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 오류 알림 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 대시보드 그리드 */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={3}>
          <InventorySummaryCard data={dashboardData.inventory} />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <AssignmentSummaryCard data={dashboardData.assignment} />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <ActivationSummaryCard data={dashboardData.activation} />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <SystemStatusCard data={dashboardData.system} />
        </Grid>
      </Grid>

      {/* 실시간 차트 섹션 */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          실시간 트렌드
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  재고 변화 추이
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.inventory?.trend || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="phones" stroke="#1976d2" name="휴대폰" />
                      <Line type="monotone" dataKey="wearables" stroke="#ff9800" name="웨어러블" />
                      <Line type="monotone" dataKey="tablets" stroke="#9c27b0" name="태블릿" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  배정 현황 분포
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.assignment?.distribution || []}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {dashboardData.assignment?.distribution?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#1976d2', '#ff9800', '#9c27b0', '#4caf50'][index % 4]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default RealtimeDashboard; 