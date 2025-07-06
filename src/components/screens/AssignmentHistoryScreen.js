import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tabs,
  Tab,
  LinearProgress,
  Tooltip,
  Badge
} from '@mui/material';
import {
  History as HistoryIcon,
  Compare as CompareIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Settings as SettingsIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Timeline as TimelineIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  GetApp as GetAppIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon
} from '@mui/icons-material';
import {
  getAssignmentHistory,
  deleteHistoryItem,
  clearAssignmentHistory,
  calculateHistoryStats,
  compareHistoryItems,
  exportHistory,
  importHistory
} from '../../utils/assignmentHistory';
import AssignmentComparisonScreen from './AssignmentComparisonScreen';

function AssignmentHistoryScreen({ onBack, onLogout }) {
  const [history, setHistory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [comparisonDialog, setComparisonDialog] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [importDialog, setImportDialog] = useState(false);
  const [importData, setImportData] = useState('');
  const [stats, setStats] = useState(null);
  const [showComparisonScreen, setShowComparisonScreen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isLoading, setIsLoading] = useState(false);

  // 히스토리 로드
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    setIsLoading(true);
    const historyData = getAssignmentHistory();
    setHistory(historyData);
    setStats(calculateHistoryStats());
    setIsLoading(false);
  };

  // 필터링된 히스토리
  const filteredHistory = useMemo(() => {
    let filtered = history;

    // 날짜 범위 필터링
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.timestamp);
        const startDate = dateRange.start ? new Date(dateRange.start) : null;
        const endDate = dateRange.end ? new Date(dateRange.end) : null;

        if (startDate && endDate) {
          return itemDate >= startDate && itemDate <= endDate;
        } else if (startDate) {
          return itemDate >= startDate;
        } else if (endDate) {
          return itemDate <= endDate;
        }
        return true;
      });
    }

    // 타입별 필터링
    if (filterType !== 'all') {
      filtered = filtered.filter(item => {
        const hasOfficeData = item.assignmentData.offices && Object.keys(item.assignmentData.offices).length > 0;
        const hasDepartmentData = item.assignmentData.departments && Object.keys(item.assignmentData.departments).length > 0;
        const hasAgentData = item.assignmentData.agents && Object.keys(item.assignmentData.agents).length > 0;

        switch (filterType) {
          case 'office':
            return hasOfficeData;
          case 'department':
            return hasDepartmentData;
          case 'agent':
            return hasAgentData;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [history, filterType, dateRange]);

  // 사무실별 배정 데이터 분석
  const officeAnalysis = useMemo(() => {
    const analysis = {};
    
    filteredHistory.forEach(item => {
      if (item.assignmentData.offices) {
        Object.entries(item.assignmentData.offices).forEach(([office, data]) => {
          if (!analysis[office]) {
            analysis[office] = {
              totalAssignments: 0,
              totalQuantity: 0,
              models: {},
              dates: []
            };
          }
          
          analysis[office].totalAssignments++;
          analysis[office].totalQuantity += data.quantity || 0;
          analysis[office].dates.push(item.timestamp);
          
          // 모델별 데이터
          if (data.models) {
            Object.entries(data.models).forEach(([model, quantity]) => {
              if (!analysis[office].models[model]) {
                analysis[office].models[model] = 0;
              }
              analysis[office].models[model] += quantity;
            });
          }
        });
      }
    });
    
    return analysis;
  }, [filteredHistory]);

  // 소속별 배정 데이터 분석
  const departmentAnalysis = useMemo(() => {
    const analysis = {};
    
    filteredHistory.forEach(item => {
      if (item.assignmentData.departments) {
        Object.entries(item.assignmentData.departments).forEach(([department, data]) => {
          if (!analysis[department]) {
            analysis[department] = {
              totalAssignments: 0,
              totalQuantity: 0,
              models: {},
              dates: []
            };
          }
          
          analysis[department].totalAssignments++;
          analysis[department].totalQuantity += data.quantity || 0;
          analysis[department].dates.push(item.timestamp);
          
          if (data.models) {
            Object.entries(data.models).forEach(([model, quantity]) => {
              if (!analysis[department].models[model]) {
                analysis[department].models[model] = 0;
              }
              analysis[department].models[model] += quantity;
            });
          }
        });
      }
    });
    
    return analysis;
  }, [filteredHistory]);

  // 영업사원별 배정 데이터 분석
  const agentAnalysis = useMemo(() => {
    const analysis = {};
    
    filteredHistory.forEach(item => {
      if (item.assignmentData.agents) {
        Object.entries(item.assignmentData.agents).forEach(([agentId, data]) => {
          const agent = item.agents.find(a => a.contactId === agentId);
          const agentName = agent ? agent.target : agentId;
          
          if (!analysis[agentName]) {
            analysis[agentName] = {
              totalAssignments: 0,
              totalQuantity: 0,
              models: {},
              dates: [],
              office: agent?.office || '미지정',
              department: agent?.department || '미지정'
            };
          }
          
          analysis[agentName].totalAssignments++;
          analysis[agentName].totalQuantity += data.quantity || 0;
          analysis[agentName].dates.push(item.timestamp);
          
          if (data.models) {
            Object.entries(data.models).forEach(([model, quantity]) => {
              if (!analysis[agentName].models[model]) {
                analysis[agentName].models[model] = 0;
              }
              analysis[agentName].models[model] += quantity;
            });
          }
        });
      }
    });
    
    return analysis;
  }, [filteredHistory]);

  // 히스토리 삭제
  const handleDeleteHistory = (historyId) => {
    if (deleteHistoryItem(historyId)) {
      loadHistory();
    }
  };

  // 히스토리 전체 삭제
  const handleClearAllHistory = () => {
    if (window.confirm('모든 히스토리를 삭제하시겠습니까?')) {
      if (clearAssignmentHistory()) {
        loadHistory();
      }
    }
  };

  // 고급 비교 화면 열기
  const handleOpenComparisonScreen = () => {
    setShowComparisonScreen(true);
  };

  // 히스토리 비교
  const handleCompareHistory = () => {
    if (selectedItems.length !== 2) {
      alert('비교하려면 정확히 2개의 항목을 선택해주세요.');
      return;
    }

    const comparison = compareHistoryItems(selectedItems[0], selectedItems[1]);
    if (comparison) {
      setComparisonResult(comparison);
      setComparisonDialog(true);
    }
  };

  // 히스토리 내보내기
  const handleExportHistory = () => {
    const exportData = exportHistory(selectedItems.length > 0 ? selectedItems : null);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assignment_history_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Excel 형식으로 내보내기
  const handleExportExcel = () => {
    // Excel 내보내기 로직 구현
    alert('Excel 내보내기 기능은 준비 중입니다.');
  };

  // PDF 형식으로 내보내기
  const handleExportPDF = () => {
    // PDF 내보내기 로직 구현
    alert('PDF 내보내기 기능은 준비 중입니다.');
  };

  // 히스토리 가져오기
  const handleImportHistory = () => {
    if (importHistory(importData)) {
      loadHistory();
      setImportDialog(false);
      setImportData('');
    } else {
      alert('히스토리 가져오기에 실패했습니다.');
    }
  };

  // 날짜 포맷팅
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('ko-KR');
  };

  // 트렌드 아이콘
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUpIcon color="success" />;
      case 'decreasing':
        return <TrendingDownIcon color="error" />;
      default:
        return <TrendingFlatIcon color="action" />;
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <HistoryIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            배정 히스토리
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Excel 내보내기">
              <IconButton
                color="inherit"
                onClick={handleExportExcel}
                disabled={filteredHistory.length === 0}
              >
                <ExcelIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="PDF 내보내기">
              <IconButton
                color="inherit"
                onClick={handleExportPDF}
                disabled={filteredHistory.length === 0}
              >
                <PdfIcon />
              </IconButton>
            </Tooltip>
            <Button
              color="inherit"
              startIcon={<DownloadIcon />}
              onClick={handleExportHistory}
              disabled={filteredHistory.length === 0}
              sx={{ 
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 2,
                px: 2
              }}
            >
              JSON 내보내기
            </Button>
            <Button
              color="inherit"
              startIcon={<UploadIcon />}
              onClick={() => setImportDialog(true)}
              sx={{ 
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 2,
                px: 2
              }}
            >
              가져오기
            </Button>
            <Button color="inherit" onClick={onLogout}>
              로그아웃
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        
        {/* 로딩 인디케이터 */}
        {isLoading && (
          <LinearProgress sx={{ mb: 2 }} />
        )}
        
        {/* 통계 카드 */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {stats.totalAssignments}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        총 배정 횟수
                      </Typography>
                    </Box>
                    <HistoryIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'white',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {stats.averageAssigned}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        평균 배정량
                      </Typography>
                    </Box>
                    <BarChartIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'white',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {filteredHistory.length}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        필터된 결과
                      </Typography>
                    </Box>
                    <FilterIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                color: 'white',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        {getTrendIcon(stats.recentTrend)}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        최근 트렌드
                      </Typography>
                    </Box>
                    <TimelineIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* 필터 섹션 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              필터 및 검색
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>배정 타입</InputLabel>
                  <Select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    label="배정 타입"
                  >
                    <MenuItem value="all">전체</MenuItem>
                    <MenuItem value="office">사무실별</MenuItem>
                    <MenuItem value="department">소속별</MenuItem>
                    <MenuItem value="agent">영업사원별</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="시작 날짜"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="종료 날짜"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFilterType('all');
                      setDateRange({ start: '', end: '' });
                    }}
                    startIcon={<RefreshIcon />}
                  >
                    초기화
                  </Button>
                  <Button
                    variant="contained"
                    onClick={loadHistory}
                    startIcon={<RefreshIcon />}
                  >
                    새로고침
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* 탭 네비게이션 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon fontSize="small" />
                  <span>전체 히스토리</span>
                  <Badge badgeContent={filteredHistory.length} color="primary" />
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BarChartIcon fontSize="small" />
                  <span>사무실별 분석</span>
                  <Badge badgeContent={Object.keys(officeAnalysis).length} color="secondary" />
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PieChartIcon fontSize="small" />
                  <span>소속별 분석</span>
                  <Badge badgeContent={Object.keys(departmentAnalysis).length} color="secondary" />
                </Box>
              } 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BarChartIcon fontSize="small" />
                  <span>영업사원별 분석</span>
                  <Badge badgeContent={Object.keys(agentAnalysis).length} color="secondary" />
                </Box>
              } 
            />
          </Tabs>
        </Paper>

        {/* 탭 콘텐츠 */}
        {activeTab === 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                전체 배정 히스토리
              </Typography>
              {filteredHistory.length === 0 ? (
                <Alert severity="info">
                  {history.length === 0 ? '저장된 배정 히스토리가 없습니다.' : '필터 조건에 맞는 히스토리가 없습니다.'}
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>날짜</TableCell>
                        <TableCell>배정 대상</TableCell>
                        <TableCell>총 배정량</TableCell>
                        <TableCell>담당자 수</TableCell>
                        <TableCell>모델 수</TableCell>
                        <TableCell>작업</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredHistory.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{formatDate(item.timestamp)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {item.assignmentData.offices && Object.keys(item.assignmentData.offices).length > 0 && (
                                <Chip label="사무실별" size="small" color="primary" />
                              )}
                              {item.assignmentData.departments && Object.keys(item.assignmentData.departments).length > 0 && (
                                <Chip label="소속별" size="small" color="secondary" />
                              )}
                              {item.assignmentData.agents && Object.keys(item.assignmentData.agents).length > 0 && (
                                <Chip label="영업사원별" size="small" color="success" />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>{item.metadata.totalAssigned}개</TableCell>
                          <TableCell>{item.metadata.totalAgents}명</TableCell>
                          <TableCell>{item.metadata.totalModels}개</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => handleDeleteHistory(item.id)}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 1 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                사무실별 배정 분석
              </Typography>
              {Object.keys(officeAnalysis).length === 0 ? (
                <Alert severity="info">사무실별 배정 데이터가 없습니다.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {Object.entries(officeAnalysis).map(([office, data]) => (
                    <Grid item xs={12} md={6} lg={4} key={office}>
                      <Card sx={{ 
                        transition: 'all 0.3s ease',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
                      }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {office}
                          </Typography>
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              총 배정 횟수: {data.totalAssignments}회
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              총 배정량: {data.totalQuantity}개
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              평균 배정량: {Math.round(data.totalQuantity / data.totalAssignments)}개
                            </Typography>
                          </Box>
                          <Typography variant="subtitle2" gutterBottom>
                            모델별 배정량:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {Object.entries(data.models).map(([model, quantity]) => (
                              <Chip
                                key={model}
                                label={`${model}: ${quantity}개`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 2 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                소속별 배정 분석
              </Typography>
              {Object.keys(departmentAnalysis).length === 0 ? (
                <Alert severity="info">소속별 배정 데이터가 없습니다.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {Object.entries(departmentAnalysis).map(([department, data]) => (
                    <Grid item xs={12} md={6} lg={4} key={department}>
                      <Card sx={{ 
                        transition: 'all 0.3s ease',
                        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
                      }}>
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {department}
                          </Typography>
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              총 배정 횟수: {data.totalAssignments}회
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              총 배정량: {data.totalQuantity}개
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              평균 배정량: {Math.round(data.totalQuantity / data.totalAssignments)}개
                            </Typography>
                          </Box>
                          <Typography variant="subtitle2" gutterBottom>
                            모델별 배정량:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {Object.entries(data.models).map(([model, quantity]) => (
                              <Chip
                                key={model}
                                label={`${model}: ${quantity}개`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 3 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                영업사원별 배정 분석
              </Typography>
              {Object.keys(agentAnalysis).length === 0 ? (
                <Alert severity="info">영업사원별 배정 데이터가 없습니다.</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>영업사원</TableCell>
                        <TableCell>사무실</TableCell>
                        <TableCell>소속</TableCell>
                        <TableCell>총 배정 횟수</TableCell>
                        <TableCell>총 배정량</TableCell>
                        <TableCell>평균 배정량</TableCell>
                        <TableCell>모델별 배정량</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(agentAnalysis).map(([agentName, data]) => (
                        <TableRow key={agentName} hover>
                          <TableCell>
                            <Typography variant="subtitle2">{agentName}</Typography>
                          </TableCell>
                          <TableCell>{data.office}</TableCell>
                          <TableCell>{data.department}</TableCell>
                          <TableCell>{data.totalAssignments}회</TableCell>
                          <TableCell>{data.totalQuantity}개</TableCell>
                          <TableCell>{Math.round(data.totalQuantity / data.totalAssignments)}개</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {Object.entries(data.models).slice(0, 3).map(([model, quantity]) => (
                                <Chip
                                  key={model}
                                  label={`${model}: ${quantity}`}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                              {Object.keys(data.models).length > 3 && (
                                <Chip
                                  label={`+${Object.keys(data.models).length - 3}개`}
                                  size="small"
                                  color="primary"
                                />
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}
      </Box>

      {/* 비교 결과 다이얼로그 */}
      <Dialog open={comparisonDialog} onClose={() => setComparisonDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>배정 히스토리 비교</DialogTitle>
        <DialogContent>
          {comparisonResult && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  이전 배정 ({new Date(comparisonResult.timestamp1).toLocaleDateString()})
                </Typography>
                <Card>
                  <CardContent>
                    <Typography variant="body2">
                      총 배정량: {comparisonResult.results.totalAssigned.before}개
                    </Typography>
                    <Typography variant="body2">
                      담당자 수: {comparisonResult.results.totalAgents.before}명
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  현재 배정 ({new Date(comparisonResult.timestamp2).toLocaleDateString()})
                </Typography>
                <Card>
                  <CardContent>
                    <Typography variant="body2">
                      총 배정량: {comparisonResult.results.totalAssigned.after}개
                    </Typography>
                    <Typography variant="body2">
                      담당자 수: {comparisonResult.results.totalAgents.after}명
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  변화량
                </Typography>
                <Card>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          배정량 변화
                        </Typography>
                        <Typography variant="h6" color={comparisonResult.results.totalAssigned.change > 0 ? 'success' : 'error'}>
                          {comparisonResult.results.totalAssigned.change > 0 ? '+' : ''}
                          {comparisonResult.results.totalAssigned.change}개
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          담당자 수 변화
                        </Typography>
                        <Typography variant="h6" color={comparisonResult.results.totalAgents.change > 0 ? 'success' : 'error'}>
                          {comparisonResult.results.totalAgents.change > 0 ? '+' : ''}
                          {comparisonResult.results.totalAgents.change}명
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComparisonDialog(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 가져오기 다이얼로그 */}
      <Dialog open={importDialog} onClose={() => setImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>히스토리 가져오기</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            JSON 형식의 히스토리 데이터를 붙여넣어주세요.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={10}
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="JSON 데이터를 여기에 붙여넣으세요..."
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>취소</Button>
          <Button onClick={handleImportHistory} variant="contained">
            가져오기
          </Button>
        </DialogActions>
      </Dialog>

      {/* 고급 비교 화면 */}
      {showComparisonScreen && (
        <AssignmentComparisonScreen
          onBack={() => setShowComparisonScreen(false)}
          onLogout={onLogout}
        />
      )}
    </Box>
  );
}

export default AssignmentHistoryScreen; 