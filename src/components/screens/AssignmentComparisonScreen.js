import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Button,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  LinearProgress,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Compare as CompareIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Add as AddIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Timeline as TimelineIcon,
  Insights as InsightsIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import {
  compareAssignments,
  generateComparisonReport,
  COMPARISON_TYPES,
  assignmentComparisonManager
} from '../../utils/assignmentComparisonUtils';
import { loadAssignmentHistory, exportComparisonReport } from '../../utils/assignmentHistory';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

function AssignmentComparisonScreen({ onBack, onLogout }) {
  const [histories, setHistories] = useState([]);
  const [selectedHistory1, setSelectedHistory1] = useState('');
  const [selectedHistory2, setSelectedHistory2] = useState('');
  const [comparisonType, setComparisonType] = useState(COMPARISON_TYPES.OVERALL);
  const [comparison, setComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [activeInsightTab, setActiveInsightTab] = useState(0);

  // 배정 이력 로드
  useEffect(() => {
    loadHistories();
  }, []);

  const loadHistories = async () => {
    try {
      const loadedHistories = await loadAssignmentHistory();
      setHistories(loadedHistories);
    } catch (error) {
      console.error('배정 이력 로드 실패:', error);
    }
  };

  // 비교 실행
  const handleCompare = async () => {
    if (!selectedHistory1 || !selectedHistory2) {
      alert('비교할 두 배정 이력을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const history1 = histories.find(h => h.id === selectedHistory1);
      const history2 = histories.find(h => h.id === selectedHistory2);

      if (!history1 || !history2) {
        alert('선택한 배정 이력을 찾을 수 없습니다.');
        return;
      }

      const comparisonResult = compareAssignments(history1, history2, comparisonType);
      setComparison(comparisonResult);
    } catch (error) {
      console.error('비교 실패:', error);
      alert('비교 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 비교 리포트 내보내기
  const handleExportReport = async () => {
    if (!comparison) {
      alert('먼저 비교를 실행해주세요.');
      return;
    }

    try {
      const history1 = histories.find(h => h.id === selectedHistory1);
      const history2 = histories.find(h => h.id === selectedHistory2);
      
      const report = generateComparisonReport(history1, history2, comparisonType);
      await exportComparisonReport(report);
    } catch (error) {
      console.error('리포트 내보내기 실패:', error);
      alert('리포트 내보내기 중 오류가 발생했습니다.');
    }
  };

  // 캐시 정리
  const handleClearCache = () => {
    assignmentComparisonManager.clearCache();
    alert('비교 캐시가 정리되었습니다.');
  };

  // 날짜 포맷
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('ko-KR');
  };

  // 변화량 색상 가져오기
  const getChangeColor = (change) => {
    if (change > 0) return 'success';
    if (change < 0) return 'error';
    return 'default';
  };

  // 변화량 아이콘 가져오기
  const getChangeIcon = (change) => {
    if (change > 0) return <TrendingUpIcon />;
    if (change < 0) return <TrendingDownIcon />;
    return <RemoveIcon />;
  };

  // 차트 데이터 생성
  const generateChartData = () => {
    if (!comparison) return [];

    const { summary } = comparison;
    return [
      {
        name: '총 수량',
        history1: summary.totalQuantity.history1,
        history2: summary.totalQuantity.history2,
        change: summary.totalQuantity.change
      },
      {
        name: '영업사원 수',
        history1: summary.totalAgents.history1,
        history2: summary.totalAgents.history2,
        change: summary.totalAgents.change
      },
      {
        name: '모델 수',
        history1: summary.totalModels.history1,
        history2: summary.totalModels.history2,
        change: summary.totalModels.change
      }
    ];
  };

  // 모델 분포 차트 데이터
  const generateModelDistributionData = () => {
    if (!comparison || !comparison.details.model) return [];

    const { models } = comparison.details.model;
    return Object.entries(models).map(([model, data]) => ({
      name: model,
      history1: data.data?.before?.totalQuantity || 0,
      history2: data.data?.after?.totalQuantity || 0,
      change: data.change?.quantity || 0
    }));
  };

  // 인사이트 필터링
  const getFilteredInsights = (impact) => {
    if (!comparison) return [];
    return comparison.insights.filter(insight => 
      impact === 'all' || insight.impact === impact
    );
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onBack}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            배정 이력 비교 및 분석
          </Typography>
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* 비교 설정 */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            비교 설정
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>첫 번째 배정 이력</InputLabel>
                <Select
                  value={selectedHistory1}
                  onChange={(e) => setSelectedHistory1(e.target.value)}
                  label="첫 번째 배정 이력"
                >
                  {histories.map(history => (
                    <MenuItem key={history.id} value={history.id}>
                      {history.metadata.name} ({formatDate(history.metadata.createdAt)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>두 번째 배정 이력</InputLabel>
                <Select
                  value={selectedHistory2}
                  onChange={(e) => setSelectedHistory2(e.target.value)}
                  label="두 번째 배정 이력"
                >
                  {histories.map(history => (
                    <MenuItem key={history.id} value={history.id}>
                      {history.metadata.name} ({formatDate(history.metadata.createdAt)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>비교 타입</InputLabel>
                <Select
                  value={comparisonType}
                  onChange={(e) => setComparisonType(e.target.value)}
                  label="비교 타입"
                >
                  <MenuItem value={COMPARISON_TYPES.OVERALL}>전체</MenuItem>
                  <MenuItem value={COMPARISON_TYPES.AGENT}>영업사원별</MenuItem>
                  <MenuItem value={COMPARISON_TYPES.OFFICE}>사무실별</MenuItem>
                  <MenuItem value={COMPARISON_TYPES.DEPARTMENT}>소속별</MenuItem>
                  <MenuItem value={COMPARISON_TYPES.MODEL}>모델별</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<CompareIcon />}
                  onClick={handleCompare}
                  disabled={!selectedHistory1 || !selectedHistory2 || isLoading}
                >
                  비교 실행
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExportReport}
                  disabled={!comparison}
                >
                  리포트 내보내기
                </Button>
                <Tooltip title="비교 캐시 정리">
                  <IconButton onClick={handleClearCache}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {isLoading && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} />
              <Typography>비교 분석 중...</Typography>
            </Box>
            <LinearProgress sx={{ mt: 1 }} />
          </Paper>
        )}

        {comparison && (
          <>
            {/* 비교 요약 */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                비교 요약
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        총 배정 수량
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h4">
                          {comparison.summary.totalQuantity.history2}
                        </Typography>
                        <Chip
                          icon={getChangeIcon(comparison.summary.totalQuantity.change)}
                          label={`${comparison.summary.totalQuantity.change > 0 ? '+' : ''}${comparison.summary.totalQuantity.change}`}
                          color={getChangeColor(comparison.summary.totalQuantity.change)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        이전: {comparison.summary.totalQuantity.history1}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        영업사원 수
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h4">
                          {comparison.summary.totalAgents.history2}
                        </Typography>
                        <Chip
                          icon={getChangeIcon(comparison.summary.totalAgents.change)}
                          label={`${comparison.summary.totalAgents.change > 0 ? '+' : ''}${comparison.summary.totalAgents.change}`}
                          color={getChangeColor(comparison.summary.totalAgents.change)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        이전: {comparison.summary.totalAgents.history1}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        모델 수
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h4">
                          {comparison.summary.totalModels.history2}
                        </Typography>
                        <Chip
                          icon={getChangeIcon(comparison.summary.totalModels.change)}
                          label={`${comparison.summary.totalModels.change > 0 ? '+' : ''}${comparison.summary.totalModels.change}`}
                          color={getChangeColor(comparison.summary.totalModels.change)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        이전: {comparison.summary.totalModels.history1}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        효율성 변화
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h4">
                          {comparison.metrics.efficiency.averageQuantityPerAgent.changePercent > 0 ? '+' : ''}
                          {comparison.metrics.efficiency.averageQuantityPerAgent.changePercent.toFixed(1)}%
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        영업사원당 평균
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Paper>

            {/* 상세 분석 */}
            <Paper sx={{ p: 2, mb: 2 }}>
              <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                <Tab label="차트 분석" icon={<BarChartIcon />} />
                <Tab label="상세 비교" icon={<EditIcon />} />
                <Tab label="인사이트" icon={<InsightsIcon />} />
              </Tabs>

              {activeTab === 0 && (
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>
                        주요 지표 비교
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={generateChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="history1" fill="#8884d8" name="이전" />
                          <Bar dataKey="history2" fill="#82ca9d" name="현재" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>
                        모델별 분포
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={generateModelDistributionData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Bar dataKey="history1" fill="#8884d8" name="이전" />
                          <Bar dataKey="history2" fill="#82ca9d" name="현재" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {activeTab === 1 && (
                <Box sx={{ mt: 2 }}>
                  {comparisonType === COMPARISON_TYPES.AGENT && (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>영업사원</TableCell>
                            <TableCell>상태</TableCell>
                            <TableCell>수량 변화</TableCell>
                            <TableCell>모델 변화</TableCell>
                            <TableCell>상세</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(comparison.details.agents).map(([agentId, agent]) => (
                            <TableRow key={agentId}>
                              <TableCell>{agent.data?.name || agentId}</TableCell>
                              <TableCell>
                                <Chip
                                  label={agent.status}
                                  color={
                                    agent.status === 'added' ? 'success' :
                                    agent.status === 'removed' ? 'error' :
                                    agent.status === 'changed' ? 'warning' : 'default'
                                  }
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {agent.change.quantity}
                                  {getChangeIcon(agent.change.quantity)}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {agent.change.models}
                                  {getChangeIcon(agent.change.models)}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Accordion>
                                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography>상세 정보</Typography>
                                  </AccordionSummary>
                                  <AccordionDetails>
                                    <pre style={{ fontSize: '12px' }}>
                                      {JSON.stringify(agent, null, 2)}
                                    </pre>
                                  </AccordionDetails>
                                </Accordion>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {comparisonType === COMPARISON_TYPES.MODEL && (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>모델</TableCell>
                            <TableCell>상태</TableCell>
                            <TableCell>수량 변화</TableCell>
                            <TableCell>영업사원 변화</TableCell>
                            <TableCell>상세</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(comparison.details.models).map(([model, modelData]) => (
                            <TableRow key={model}>
                              <TableCell>{model}</TableCell>
                              <TableCell>
                                <Chip
                                  label={modelData.status}
                                  color={
                                    modelData.status === 'added' ? 'success' :
                                    modelData.status === 'removed' ? 'error' :
                                    modelData.status === 'changed' ? 'warning' : 'default'
                                  }
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {modelData.change.quantity}
                                  {getChangeIcon(modelData.change.quantity)}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {modelData.change.agents}
                                  {getChangeIcon(modelData.change.agents)}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Accordion>
                                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography>상세 정보</Typography>
                                  </AccordionSummary>
                                  <AccordionDetails>
                                    <pre style={{ fontSize: '12px' }}>
                                      {JSON.stringify(modelData, null, 2)}
                                    </pre>
                                  </AccordionDetails>
                                </Accordion>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {activeTab === 2 && (
                <Box sx={{ mt: 2 }}>
                  <Tabs value={activeInsightTab} onChange={(e, newValue) => setActiveInsightTab(newValue)}>
                    <Tab label="전체" value="all" />
                    <Tab label="긍정적" value="positive" />
                    <Tab label="부정적" value="negative" />
                    <Tab label="높은 영향" value="high" />
                  </Tabs>

                  <Box sx={{ mt: 2 }}>
                    {getFilteredInsights(activeInsightTab).map((insight, index) => (
                      <Alert
                        key={index}
                        severity={
                          insight.impact === 'positive' ? 'success' :
                          insight.impact === 'negative' ? 'error' :
                          insight.impact === 'high' ? 'warning' : 'info'
                        }
                        sx={{ mb: 1 }}
                      >
                        <Typography variant="subtitle2" gutterBottom>
                          {insight.message}
                        </Typography>
                        <Typography variant="body2">
                          {insight.recommendation}
                        </Typography>
                      </Alert>
                    ))}

                    {getFilteredInsights(activeInsightTab).length === 0 && (
                      <Alert severity="info">
                        해당 조건의 인사이트가 없습니다.
                      </Alert>
                    )}
                  </Box>
                </Box>
              )}
            </Paper>
          </>
        )}

        {!comparison && !isLoading && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <CompareIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              배정 이력 비교
            </Typography>
            <Typography color="text.secondary">
              비교할 두 배정 이력을 선택하고 비교를 실행해주세요.
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
}

export default AssignmentComparisonScreen; 