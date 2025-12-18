import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const DriveMonitoringTab = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monitoringData, setMonitoringData] = useState(null);

  useEffect(() => {
    loadMonitoringData();
    // 30초마다 자동 새로고침
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:3002'}/api/direct/drive-monitoring?days=7`
      );
      
      if (!response.ok) {
        throw new Error('모니터링 데이터를 불러오는데 실패했습니다.');
      }
      
      const result = await response.json();
      if (result.success) {
        setMonitoringData(result.data);
        setError(null);
      } else {
        throw new Error(result.error || '알 수 없는 오류');
      }
    } catch (err) {
      console.error('모니터링 데이터 로드 오류:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !monitoringData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !monitoringData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!monitoringData) {
    return null;
  }

  const { dailyData, recentCalls, totalStats } = monitoringData;
  const today = totalStats.today;
  const threshold = totalStats.threshold;
  const todayErrorRate = today.count > 0 ? (today.errors / today.count) * 100 : 0;
  const isDailyCallsExceeded = today.count >= threshold.dailyCalls;
  const isErrorRateExceeded = todayErrorRate >= (threshold.errorRate * 100);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
        Google Drive API 모니터링
      </Typography>

      {/* 오늘의 통계 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">오늘의 호출량</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                {today.count.toLocaleString()}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  임계값: {threshold.dailyCalls.toLocaleString()}회
                </Typography>
                {isDailyCallsExceeded ? (
                  <Chip
                    icon={<WarningIcon />}
                    label="임계값 초과"
                    color="error"
                    size="small"
                  />
                ) : (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="정상"
                    color="success"
                    size="small"
                  />
                )}
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min((today.count / threshold.dailyCalls) * 100, 100)}
                sx={{ mt: 1 }}
                color={isDailyCallsExceeded ? 'error' : 'primary'}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ErrorIcon color={isErrorRateExceeded ? 'error' : 'action'} sx={{ mr: 1 }} />
                <Typography variant="h6">에러율</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                {todayErrorRate.toFixed(2)}%
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  에러: {today.errors}회 / 총: {today.count}회
                </Typography>
                {isErrorRateExceeded ? (
                  <Chip
                    icon={<WarningIcon />}
                    label="임계값 초과"
                    color="error"
                    size="small"
                  />
                ) : (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="정상"
                    color="success"
                    size="small"
                  />
                )}
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min((todayErrorRate / (threshold.errorRate * 100)) * 100, 100)}
                sx={{ mt: 1 }}
                color={isErrorRateExceeded ? 'error' : 'primary'}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                최근 에러
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {totalStats.recentErrors.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                최근 20개 기록 중
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 경고 알림 */}
      {(isDailyCallsExceeded || isErrorRateExceeded) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
            ⚠️ 임계값 초과 경고
          </Typography>
          {isDailyCallsExceeded && (
            <Typography variant="body2">
              • 일일 호출량이 임계값({threshold.dailyCalls.toLocaleString()}회)을 초과했습니다. ({today.count.toLocaleString()}회)
            </Typography>
          )}
          {isErrorRateExceeded && (
            <Typography variant="body2">
              • 에러율이 임계값({(threshold.errorRate * 100).toFixed(2)}%)을 초과했습니다. ({todayErrorRate.toFixed(2)}%)
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
            트래픽이 계속 증가하면 Cloudflare R2 또는 Google Cloud Storage로 마이그레이션을 고려해주세요.
          </Typography>
        </Alert>
      )}

      {/* 일일 통계 테이블 */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">최근 7일 통계</Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>날짜</TableCell>
                <TableCell align="right">총 호출</TableCell>
                <TableCell align="right">에러</TableCell>
                <TableCell align="right">에러율</TableCell>
                <TableCell>상태</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dailyData.map((day, index) => {
                const dayErrorRate = day.totalCalls > 0 ? (day.errors / day.totalCalls) * 100 : 0;
                const hasWarning = day.thresholdExceeded.dailyCalls || day.thresholdExceeded.errorRate;
                
                return (
                  <TableRow key={index} sx={{ bgcolor: hasWarning ? 'error.lighter' : 'inherit' }}>
                    <TableCell>{day.date}</TableCell>
                    <TableCell align="right">{day.totalCalls.toLocaleString()}</TableCell>
                    <TableCell align="right">{day.errors}</TableCell>
                    <TableCell align="right">{dayErrorRate.toFixed(2)}%</TableCell>
                    <TableCell>
                      {hasWarning ? (
                        <Chip label="경고" color="error" size="small" />
                      ) : (
                        <Chip label="정상" color="success" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 최근 호출 기록 */}
      <Paper>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">최근 호출 기록 (최근 20개)</Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>시간</TableCell>
                <TableCell>작업</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>소요시간</TableCell>
                <TableCell>에러</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentCalls.slice(0, 20).map((call, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {new Date(call.timestamp).toLocaleString('ko-KR')}
                  </TableCell>
                  <TableCell>{call.operation}</TableCell>
                  <TableCell>
                    {call.success ? (
                      <Chip label="성공" color="success" size="small" />
                    ) : (
                      <Chip label="실패" color="error" size="small" />
                    )}
                  </TableCell>
                  <TableCell>{call.duration}ms</TableCell>
                  <TableCell>
                    {call.error ? (
                      <Typography variant="caption" color="error" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {call.error}
                      </Typography>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default DriveMonitoringTab;
