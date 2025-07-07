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
  TablePagination,
  Avatar,
  ListItemAvatar
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
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon
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
  const [historyData, setHistoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [stats, setStats] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // 히스토리 데이터 로드
  useEffect(() => {
    loadHistoryData();
  }, []);

  const loadHistoryData = () => {
    setIsLoading(true);
    try {
      const history = getAssignmentHistory();
      setHistoryData(history);
      setStats(calculateHistoryStats());
    } catch (error) {
      console.error('히스토리 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    let filtered = historyData;

    // 검색어 필터링
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.metadata.assigner?.toLowerCase().includes(term) ||
        item.agents.some(agent => agent.target?.toLowerCase().includes(term)) ||
        Object.keys(item.assignmentData.models || {}).some(model => 
          model.toLowerCase().includes(term)
        )
      );
    }

    // 타입 필터링
    if (filterType !== 'all') {
      filtered = filtered.filter(item => {
        const totalAssigned = item.metadata.totalAssigned || 0;
        if (filterType === 'large' && totalAssigned >= 100) return true;
        if (filterType === 'medium' && totalAssigned >= 50 && totalAssigned < 100) return true;
        if (filterType === 'small' && totalAssigned < 50) return true;
        return false;
      });
    }

    return filtered;
  }, [historyData, searchTerm, filterType]);

  // 페이지네이션된 데이터
  const paginatedData = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  // 배정 타입 아이콘
  const getAssignmentTypeIcon = (item) => {
    const totalAssigned = item.metadata.totalAssigned || 0;
    if (totalAssigned >= 100) return <TrendingUpIcon color="success" />;
    if (totalAssigned >= 50) return <TrendingFlatIcon color="warning" />;
    return <TrendingDownIcon color="error" />;
  };

  // 배정 타입 라벨
  const getAssignmentTypeLabel = (item) => {
    const totalAssigned = item.metadata.totalAssigned || 0;
    if (totalAssigned >= 100) return '대규모';
    if (totalAssigned >= 50) return '중간';
    return '소규모';
  };

  // 배정 타입 색상
  const getAssignmentTypeColor = (item) => {
    const totalAssigned = item.metadata.totalAssigned || 0;
    if (totalAssigned >= 100) return 'success';
    if (totalAssigned >= 50) return 'warning';
    return 'error';
  };

  // 날짜 포맷팅
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 삭제 처리
  const handleDelete = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      const success = deleteHistoryItem(itemToDelete.id);
      if (success) {
        loadHistoryData();
        setSelectedItems(selectedItems.filter(id => id !== itemToDelete.id));
      }
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  // 전체 삭제
  const handleClearAll = () => {
    if (window.confirm('모든 배정 히스토리를 삭제하시겠습니까?')) {
      const success = clearAssignmentHistory();
      if (success) {
        loadHistoryData();
        setSelectedItems([]);
      }
    }
  };

  // 내보내기
  const handleExport = () => {
    const itemsToExport = selectedItems.length > 0 
      ? historyData.filter(item => selectedItems.includes(item.id))
      : filteredData;
    exportHistory(itemsToExport);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ backgroundColor: '#2E7D32' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onBack}>
            <HistoryIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            배정 히스토리
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={loadHistoryData}
              disabled={isLoading}
            >
              새로고침
            </Button>
            <Button
              color="inherit"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={filteredData.length === 0}
            >
              내보내기
            </Button>
            <Button
              color="inherit"
              startIcon={<DeleteIcon />}
              onClick={handleClearAll}
              disabled={historyData.length === 0}
            >
              전체삭제
            </Button>
          </Box>
          <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 컨텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        {/* 통계 카드 */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <HistoryIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Box>
                      <Typography variant="h4">{stats.totalAssignments}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        총 배정 횟수
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AssignmentIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Box>
                      <Typography variant="h4">{stats.averageAssigned}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        평균 배정량
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <GroupIcon sx={{ mr: 2, color: 'info.main' }} />
                    <Box>
                      <Typography variant="h4">
                        {historyData.length > 0 ? Math.round(historyData[0].metadata.totalAgents || 0) : 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        최근 배정 대상
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {stats.recentTrend === 'increasing' ? (
                      <TrendingUpIcon sx={{ mr: 2, color: 'success.main' }} />
                    ) : stats.recentTrend === 'decreasing' ? (
                      <TrendingDownIcon sx={{ mr: 2, color: 'error.main' }} />
                    ) : (
                      <TrendingFlatIcon sx={{ mr: 2, color: 'warning.main' }} />
                    )}
                    <Box>
                      <Typography variant="h4">
                        {stats.recentTrend === 'increasing' ? '증가' : 
                         stats.recentTrend === 'decreasing' ? '감소' : '안정'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        최근 트렌드
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* 검색 및 필터 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="검색 (배정자, 대상, 모델명)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>배정 규모</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="배정 규모"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="large">대규모 (100개 이상)</MenuItem>
                  <MenuItem value="medium">중간 (50-99개)</MenuItem>
                  <MenuItem value="small">소규모 (50개 미만)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary">
                검색 결과: {filteredData.length}개 기록
              </Typography>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('all');
                }}
                fullWidth
              >
                필터 초기화
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 로딩 상태 */}
        {isLoading && (
          <Box sx={{ width: '100%', mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              히스토리를 불러오는 중...
            </Typography>
          </Box>
        )}

        {/* 히스토리 테이블 */}
        {!isLoading && (
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>배정 타입</TableCell>
                    <TableCell>배정자</TableCell>
                    <TableCell>배정 대상</TableCell>
                    <TableCell>배정 모델</TableCell>
                    <TableCell align="center">배정량</TableCell>
                    <TableCell align="center">대상 수</TableCell>
                    <TableCell>배정 시간</TableCell>
                    <TableCell align="center">작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          배정 히스토리가 없습니다
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          배정확정 버튼을 누르면 여기에 기록이 남습니다
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getAssignmentTypeIcon(item)}
                            <Chip
                              label={getAssignmentTypeLabel(item)}
                              color={getAssignmentTypeColor(item)}
                              size="small"
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                              {item.metadata.assigner?.charAt(0) || '?'}
                            </Avatar>
                            <Typography variant="body2">
                              {item.metadata.assigner || '알 수 없음'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {item.agents.slice(0, 2).map((agent, index) => (
                              <Chip
                                key={index}
                                label={agent.target}
                                size="small"
                                variant="outlined"
                                icon={<PersonIcon />}
                              />
                            ))}
                            {item.agents.length > 2 && (
                              <Chip
                                label={`+${item.agents.length - 2}명 더`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {Object.keys(item.assignmentData.models || {}).slice(0, 2).map((model, index) => (
                              <Chip
                                key={index}
                                label={model}
                                size="small"
                                variant="outlined"
                                icon={<AssignmentIcon />}
                              />
                            ))}
                            {Object.keys(item.assignmentData.models || {}).length > 2 && (
                              <Chip
                                label={`+${Object.keys(item.assignmentData.models || {}).length - 2}개 더`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="h6" color="primary">
                            {item.metadata.totalAssigned || 0}개
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">
                            {item.metadata.totalAgents || 0}명
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(item.timestamp)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="상세보기">
                              <IconButton size="small" color="primary">
                                <InfoIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="삭제">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => handleDelete(item)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* 페이지네이션 */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredData.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="페이지당 행 수:"
              labelDisplayedRows={({ from, to, count }) => 
                `${from}-${to} / ${count !== -1 ? count : `${to}개 이상`}`
              }
            />
          </Paper>
        )}
      </Box>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>배정 히스토리 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            이 배정 기록을 삭제하시겠습니까?
          </Typography>
          {itemToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>배정자:</strong> {itemToDelete.metadata.assigner || '알 수 없음'}<br/>
                <strong>배정량:</strong> {itemToDelete.metadata.totalAssigned || 0}개<br/>
                <strong>배정 시간:</strong> {formatDate(itemToDelete.timestamp)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AssignmentHistoryScreen; 