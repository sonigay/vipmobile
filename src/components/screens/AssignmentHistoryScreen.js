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
  Badge,
  TablePagination
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
  TableChart as ExcelIcon,
  Business as BusinessIcon,
  Group as GroupIcon,
  Person as PersonIcon
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
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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

  // 사무실별 배정 로그 데이터
  const officeLogs = useMemo(() => {
    const logs = [];
    
    filteredHistory.forEach(item => {
      if (item.assignmentData.offices) {
        Object.entries(item.assignmentData.offices).forEach(([office, data]) => {
          logs.push({
            id: `${item.id}-${office}`,
            timestamp: item.timestamp,
            type: '사무실',
            target: office,
            assignedBy: item.assignedBy || '시스템',
            quantity: data.quantity || 0,
            models: data.models || {},
            totalModels: Object.values(data.models || {}).reduce((sum, qty) => sum + qty, 0),
            status: '완료',
            historyId: item.id
          });
        });
      }
    });
    
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [filteredHistory]);

  // 소속별 배정 로그 데이터
  const departmentLogs = useMemo(() => {
    const logs = [];
    
    filteredHistory.forEach(item => {
      if (item.assignmentData.departments) {
        Object.entries(item.assignmentData.departments).forEach(([department, data]) => {
          logs.push({
            id: `${item.id}-${department}`,
            timestamp: item.timestamp,
            type: '소속',
            target: department,
            assignedBy: item.assignedBy || '시스템',
            quantity: data.quantity || 0,
            models: data.models || {},
            totalModels: Object.values(data.models || {}).reduce((sum, qty) => sum + qty, 0),
            status: '완료',
            historyId: item.id
          });
        });
      }
    });
    
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [filteredHistory]);

  // 영업사원별 배정 로그 데이터
  const agentLogs = useMemo(() => {
    const logs = [];
    
    filteredHistory.forEach(item => {
      if (item.assignmentData.agents) {
        Object.entries(item.assignmentData.agents).forEach(([agent, data]) => {
          logs.push({
            id: `${item.id}-${agent}`,
            timestamp: item.timestamp,
            type: '영업사원',
            target: agent,
            assignedBy: item.assignedBy || '시스템',
            quantity: data.quantity || 0,
            models: data.models || {},
            totalModels: Object.values(data.models || {}).reduce((sum, qty) => sum + qty, 0),
            status: '완료',
            historyId: item.id
          });
        });
      }
    });
    
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [filteredHistory]);

  // 현재 탭에 따른 데이터
  const currentLogs = useMemo(() => {
    switch (activeTab) {
      case 0: // 전체
        return [...officeLogs, ...departmentLogs, ...agentLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      case 1: // 사무실별
        return officeLogs;
      case 2: // 소속별
        return departmentLogs;
      case 3: // 영업사원별
        return agentLogs;
      default:
        return [];
    }
  }, [activeTab, officeLogs, departmentLogs, agentLogs]);

  // 페이지네이션된 데이터
  const paginatedLogs = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return currentLogs.slice(startIndex, startIndex + rowsPerPage);
  }, [currentLogs, page, rowsPerPage]);

  // 통계 계산
  const calculateStats = () => {
    const totalLogs = currentLogs.length;
    const totalQuantity = currentLogs.reduce((sum, log) => sum + log.quantity, 0);
    const totalModels = currentLogs.reduce((sum, log) => sum + log.totalModels, 0);
    const uniqueAssigners = new Set(currentLogs.map(log => log.assignedBy)).size;

    return {
      totalLogs,
      totalQuantity,
      totalModels,
      uniqueAssigners
    };
  };

  const currentStats = calculateStats();

  // 모델 정보를 문자열로 변환
  const formatModels = (models) => {
    if (!models || Object.keys(models).length === 0) return '-';
    return Object.entries(models)
      .map(([model, qty]) => `${model} ${qty}대`)
      .join(', ');
  };

  // 날짜 포맷팅
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 탭 변경 핸들러
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setPage(0); // 탭 변경 시 첫 페이지로
  };

  // 페이지 변경 핸들러
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // 페이지당 행 수 변경 핸들러
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // 로그 삭제 핸들러
  const handleDeleteLog = (historyId) => {
    if (window.confirm('이 배정 기록을 삭제하시겠습니까?')) {
      deleteHistoryItem(historyId);
      loadHistory();
    }
  };

  // 전체 삭제 핸들러
  const handleClearAllLogs = () => {
    if (window.confirm('모든 배정 기록을 삭제하시겠습니까?')) {
      clearAssignmentHistory();
      loadHistory();
    }
  };

  // 내보내기 핸들러
  const handleExportLogs = () => {
    const exportData = currentLogs.map(log => ({
      '배정일시': formatDate(log.timestamp),
      '배정유형': log.type,
      '배정대상': log.target,
      '배정자': log.assignedBy,
      '배정수량': log.quantity,
      '모델정보': formatModels(log.models),
      '상태': log.status
    }));

    const csvContent = [
      Object.keys(exportData[0]).join(','),
      ...exportData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `배정히스토리_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onBack}>
            <HistoryIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            배정 히스토리
          </Typography>
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 컨텐츠 */}
      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        {/* 통계 카드 */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {currentStats.totalLogs}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  총 배정 기록
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {currentStats.totalQuantity.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  총 배정 수량
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {currentStats.totalModels.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  총 모델 수량
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="secondary.main">
                  {currentStats.uniqueAssigners}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  배정 담당자
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 필터 및 액션 버튼 */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="시작일"
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            label="종료일"
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>필터</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="필터"
            >
              <MenuItem value="all">전체</MenuItem>
              <MenuItem value="office">사무실</MenuItem>
              <MenuItem value="department">소속</MenuItem>
              <MenuItem value="agent">영업사원</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadHistory}
            disabled={isLoading}
          >
            새로고침
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportLogs}
            disabled={currentLogs.length === 0}
          >
            내보내기
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleClearAllLogs}
            disabled={currentLogs.length === 0}
          >
            전체삭제
          </Button>
        </Box>

        {/* 탭 */}
        <Paper sx={{ mb: 2 }}>
          <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
            <Tab 
              label={`전체 (${officeLogs.length + departmentLogs.length + agentLogs.length})`}
              icon={<TimelineIcon />}
            />
            <Tab 
              label={`사무실별 (${officeLogs.length})`}
              icon={<BusinessIcon />}
            />
            <Tab 
              label={`소속별 (${departmentLogs.length})`}
              icon={<GroupIcon />}
            />
            <Tab 
              label={`영업사원별 (${agentLogs.length})`}
              icon={<PersonIcon />}
            />
          </Tabs>
        </Paper>

        {/* 로딩 표시 */}
        {isLoading && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              데이터를 불러오는 중...
            </Typography>
          </Box>
        )}

        {/* 배정 로그 테이블 */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>배정일시</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>배정유형</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>배정대상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>배정자</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>배정수량</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>모델정보</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>상태</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>액션</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        배정 기록이 없습니다.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>{formatDate(log.timestamp)}</TableCell>
                      <TableCell>
                        <Chip 
                          label={log.type} 
                          size="small"
                          color={
                            log.type === '사무실' ? 'primary' :
                            log.type === '소속' ? 'secondary' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{log.target}</TableCell>
                      <TableCell>{log.assignedBy}</TableCell>
                      <TableCell sx={{ textAlign: 'center', fontWeight: 'bold' }}>
                        {log.quantity.toLocaleString()}대
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Tooltip title={formatModels(log.models)}>
                          <Typography variant="body2" noWrap>
                            {formatModels(log.models)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={log.status} 
                          size="small"
                          color="success"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteLog(log.historyId)}
                          title="삭제"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* 페이지네이션 */}
          <TablePagination
            component="div"
            count={currentLogs.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="페이지당 행 수:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        </Paper>
      </Box>
    </Box>
  );
}

export default AssignmentHistoryScreen; 