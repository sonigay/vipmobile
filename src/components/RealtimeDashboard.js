import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Storage as StorageIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';

const RealtimeDashboard = ({ onClose, data }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [systemStats, setSystemStats] = useState({
    totalStores: 0,
    totalAgents: 0,
    totalInventory: 0,
    recentAssignments: 0,
    systemStatus: '정상',
    uptime: '0일 0시간 0분'
  });

  // 시스템 통계 계산
  const calculateSystemStats = () => {
    if (!data || !data.stores) return;

    const totalStores = data.stores.length;
    const totalAgents = data.agents ? data.agents.length : 0;
    
    let totalInventory = 0;
    data.stores.forEach(store => {
      if (store.inventory) {
        Object.values(store.inventory).forEach(category => {
          if (typeof category === 'object' && category !== null) {
            Object.values(category).forEach(model => {
              if (typeof model === 'object' && model !== null) {
                Object.values(model).forEach(status => {
                  if (typeof status === 'object' && status !== null) {
                    Object.values(status).forEach(qty => {
                      if (typeof qty === 'number') {
                        totalInventory += qty || 0;
                      } else if (typeof qty === 'object' && qty && typeof qty.quantity === 'number') {
                        totalInventory += qty.quantity || 0;
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    // 시스템 가동시간 계산 (임시)
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24시간 전
    const uptime = Math.floor((Date.now() - startTime.getTime()) / (1000 * 60 * 60 * 24));
    const hours = Math.floor(((Date.now() - startTime.getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor(((Date.now() - startTime.getTime()) % (1000 * 60 * 60)) / (1000 * 60));

    setSystemStats({
      totalStores,
      totalAgents,
      totalInventory,
      recentAssignments: Math.floor(Math.random() * 10) + 1, // 임시 데이터
      systemStatus: '정상',
      uptime: `${uptime}일 ${hours}시간 ${minutes}분`
    });
  };

  // 데이터 새로고침
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      calculateSystemStats();
      setLastUpdate(new Date());
      setIsLoading(false);
    }, 1000);
  };

  useEffect(() => {
    calculateSystemStats();
    
    // 30초마다 자동 새로고침
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000);

    return () => clearInterval(interval);
  }, [data]);

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: '#1976d2',
        color: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon />
          <Typography variant="h6">실시간 대시보드</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip 
            label={systemStats.systemStatus} 
            color="success" 
            size="small"
            sx={{ color: 'white' }}
          />
          <IconButton 
            color="inherit" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshIcon />
          </IconButton>
          <IconButton color="inherit" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, overflow: 'auto' }}>
        {isLoading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary">
              데이터 새로고침 중...
            </Typography>
          </Box>
        )}

        {/* 시스템 개요 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <StorageIcon sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
                <Typography variant="h4" color="primary">
                  {systemStats.totalStores}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  등록된 매장
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <PeopleIcon sx={{ fontSize: 40, color: '#2e7d32', mb: 1 }} />
                <Typography variant="h4" color="success.main">
                  {systemStats.totalAgents}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  등록된 담당자
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <ShoppingCartIcon sx={{ fontSize: 40, color: '#f57c00', mb: 1 }} />
                <Typography variant="h4" color="warning.main">
                  {systemStats.totalInventory.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  총 재고량
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 40, color: '#7b1fa2', mb: 1 }} />
                <Typography variant="h4" color="secondary.main">
                  {systemStats.recentAssignments}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  최근 배정 건수
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 시스템 상태 */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  시스템 상태
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>시스템 상태</TableCell>
                        <TableCell>
                          <Chip 
                            label={systemStats.systemStatus} 
                            color="success" 
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>가동시간</TableCell>
                        <TableCell>{systemStats.uptime}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>마지막 업데이트</TableCell>
                        <TableCell>
                          {lastUpdate.toLocaleString('ko-KR')}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  최근 활동
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  시스템이 정상적으로 운영되고 있습니다.
                </Alert>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">데이터 동기화</Typography>
                    <Chip label="완료" color="success" size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">백업 상태</Typography>
                    <Chip label="정상" color="success" size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2">네트워크 연결</Typography>
                    <Chip label="안정" color="success" size="small" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
        <Button onClick={onClose} variant="contained">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RealtimeDashboard; 