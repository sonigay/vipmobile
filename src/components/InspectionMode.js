import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Tooltip,
  Switch,
  FormControlLabel,
  Autocomplete
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  SwapHoriz as SwapHorizIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Normalize as NormalizeIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import {
  fetchInspectionData,
  updateInspectionCompletion,
  saveNormalizationData,
  updateSystemData,
  fetchFieldValues,
  getDifferenceTypeColor,
  getDifferenceTypeLabel,
  filterDifferences,
  extractAssignedAgents,
  calculateStatistics
} from '../utils/inspectionUtils';

function InspectionMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  // 상태 관리
  const [currentView, setCurrentView] = useState('personal'); // 'personal' | 'overview'
  const [inspectionData, setInspectionData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 필터 상태
  const [filters, setFilters] = useState({
    searchTerm: '',
    type: 'all',
    assignedAgent: 'all',
    completionStatus: 'all'
  });
  
  // 정규화 다이얼로그 상태
  const [normalizeDialog, setNormalizeDialog] = useState({
    open: false,
    item: null,
    normalizedValue: '',
    fieldValues: [],
    isLoadingValues: false
  });
  
  // 완료된 항목 추적
  const [completedItems, setCompletedItems] = useState(new Set());
  
  // 완료 상태 로드
  const loadCompletionStatus = useCallback(async () => {
    if (!loggedInStore?.contactId) return;
    
    try {
      // 검수결과 시트에서 완료 상태 로드
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/inspection/completion-status?userId=${loggedInStore.contactId}`);
      if (response.ok) {
        const data = await response.json();
        const completedSet = new Set(data.completedItems || []);
        setCompletedItems(completedSet);
      }
    } catch (error) {
      console.error('완료 상태 로드 오류:', error);
    }
  }, [loggedInStore?.contactId]);

  // 사용자 권한 확인
  const hasOverviewPermission = loggedInStore?.modePermissions?.inspectionOverview;

  // 데이터 로딩
  const loadInspectionData = useCallback(async () => {
    if (!loggedInStore?.contactId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchInspectionData(
        currentView, 
        currentView === 'personal' ? loggedInStore.contactId : null
      );
      
      if (response.success) {
        setInspectionData(response.data);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('검수 데이터 로딩 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentView, loggedInStore?.contactId]);

  // 초기 데이터 로딩
  useEffect(() => {
    loadInspectionData();
    loadCompletionStatus();
  }, [loadInspectionData, loadCompletionStatus]);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    if (!inspectionData?.differences) return [];
    
    // 완료 상태를 포함한 데이터
    const differencesWithCompletion = inspectionData.differences.map(diff => ({
      ...diff,
      completed: completedItems.has(diff.key)
    }));
    
    return filterDifferences(differencesWithCompletion, filters);
  }, [inspectionData, filters, completedItems]);

  // 통계 계산
  const statistics = useMemo(() => {
    if (!inspectionData?.differences) return null;
    
    // 완료 상태를 포함한 통계 계산
    const differencesWithCompletion = inspectionData.differences.map(diff => ({
      ...diff,
      completed: completedItems.has(diff.key)
    }));
    
    return calculateStatistics(differencesWithCompletion);
  }, [inspectionData, completedItems]);

  // 처리자 목록
  const assignedAgents = useMemo(() => {
    if (!inspectionData?.differences) return [];
    return extractAssignedAgents(inspectionData.differences);
  }, [inspectionData]);

  // 검수 완료 처리
  const handleComplete = async (item) => {
    if (!loggedInStore?.contactId) return;
    
    try {
      const response = await updateInspectionCompletion(
        item.key,
        loggedInStore.contactId,
        '완료'
      );
      
      if (response.success) {
        setCompletedItems(prev => new Set([...prev, item.key]));
        // 완료 상태 다시 로드
        loadCompletionStatus();
      } else {
        setError('완료 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('완료 처리 오류:', error);
      setError('완료 처리 중 오류가 발생했습니다.');
    }
  };

  // 정규화 다이얼로그 열기
  const handleNormalize = async (item) => {
    setNormalizeDialog(prev => ({
      ...prev,
      open: true,
      item,
      normalizedValue: item.correctValue || item.incorrectValue || '',
      fieldValues: [],
      isLoadingValues: true
    }));

    // 필드값 로드
    try {
      const response = await fetchFieldValues(item.field);
      if (response.success) {
        setNormalizeDialog(prev => ({
          ...prev,
          fieldValues: response.data.values || [],
          isLoadingValues: false
        }));
      } else {
        setNormalizeDialog(prev => ({
          ...prev,
          fieldValues: [],
          isLoadingValues: false
        }));
      }
    } catch (error) {
      console.error('필드값 로드 오류:', error);
      setNormalizeDialog(prev => ({
        ...prev,
        fieldValues: [],
        isLoadingValues: false
      }));
    }
  };

  // 폰클개통데이터 수정 처리
  const handleUpdateSystemData = async (item) => {
    if (!loggedInStore?.contactId || !item.systemRow) return;
    
    try {
      const response = await updateSystemData(
        item.key,
        loggedInStore.contactId,
        item.field,
        item.correctValue,
        item.systemRow
      );
      
      if (response.success) {
        // 성공 메시지 표시
        setError(null);
        // 데이터 다시 로드
        loadInspectionData();
        // 완료 처리
        await handleComplete(item);
      } else {
        setError('폰클개통데이터 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('폰클개통데이터 수정 오류:', error);
      setError('폰클개통데이터 수정 중 오류가 발생했습니다.');
    }
  };

  // 정규화 저장
  const handleSaveNormalization = async () => {
    const { item, normalizedValue } = normalizeDialog;
    
    if (!normalizedValue.trim() || !loggedInStore?.contactId) return;
    
    try {
      const response = await saveNormalizationData(
        item.key,
        loggedInStore.contactId,
        item.correctValue || item.incorrectValue,
        normalizedValue.trim(),
        item.field
      );
      
      if (response.success) {
        setNormalizeDialog({ open: false, item: null, normalizedValue: '', fieldValues: [], isLoadingValues: false });
        // 완료 상태 다시 로드
        loadCompletionStatus();
      } else {
        setError('정규화 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('정규화 저장 오류:', error);
      setError('정규화 저장 중 오류가 발생했습니다.');
    }
  };

  // 필터 변경
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // 뷰 전환
  const handleViewChange = (view) => {
    setCurrentView(view);
    setFilters({
      searchTerm: '',
      type: 'all',
      assignedAgent: 'all',
      completionStatus: 'all'
    });
  };

  // 통계 카드 컴포넌트
  const StatCard = ({ title, value, color, icon }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {icon}
          <Typography variant="h6" component="div" sx={{ ml: 1 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div" sx={{ color }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ backgroundColor: '#1976d2' }}>
        <Toolbar>
          <AssignmentIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            검수 모드
          </Typography>
          
          {/* 뷰 전환 버튼 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              variant={currentView === 'personal' ? 'contained' : 'outlined'}
              onClick={() => handleViewChange('personal')}
              size="small"
              sx={{ color: 'white', borderColor: 'white' }}
            >
              <PersonIcon sx={{ mr: 1 }} />
              개인 담당
            </Button>
            <Button
              variant={currentView === 'overview' ? 'contained' : 'outlined'}
              onClick={() => handleViewChange('overview')}
              size="small"
              disabled={!hasOverviewPermission}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              <BusinessIcon sx={{ mr: 1 }} />
              전체 현황
            </Button>
          </Box>
          
          {/* 새로고침 버튼 */}
          <IconButton 
            color="inherit" 
            onClick={loadInspectionData}
            disabled={isLoading}
            sx={{ mr: 2 }}
          >
            <RefreshIcon />
          </IconButton>
          
          {/* 모드 전환 버튼 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={onModeChange}
              startIcon={<SwapHorizIcon />}
              sx={{ mr: 2 }}
            >
              모드 변경
            </Button>
          )}
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 콘텐츠 */}
      <Container maxWidth="xl" sx={{ flex: 1, py: 2, overflow: 'auto' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 로딩 상태 표시 */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                검수 데이터를 불러오는 중...
              </Typography>
            </Box>
          </Box>
        )}

        {/* 데이터 없음 상태 표시 */}
        {!isLoading && (!inspectionData || !inspectionData.differences) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <InfoIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                검수할 데이터가 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                수기초와 폰클개통데이터를 비교할 차이점이 없거나 데이터를 불러올 수 없습니다.
              </Typography>
              <Button 
                variant="outlined" 
                onClick={loadInspectionData}
                startIcon={<RefreshIcon />}
              >
                다시 시도
              </Button>
            </Box>
          </Box>
        )}

        {/* 통계 카드 */}
        {!isLoading && statistics && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="전체"
                value={statistics.total}
                color="#1976d2"
                icon={<InfoIcon color="primary" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="완료"
                value={statistics.completed}
                color="#2e7d32"
                icon={<CheckCircleIcon color="success" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="대기"
                value={statistics.pending}
                color="#ed6c02"
                icon={<WarningIcon color="warning" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="완료율"
                value={`${statistics.completionRate}%`}
                color="#1976d2"
                icon={<TrendingUpIcon color="primary" />}
              />
            </Grid>
          </Grid>
        )}

        {/* 진행률 바 */}
        {!isLoading && statistics && statistics.total > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ mr: 1 }}>
                검수 진행률
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statistics.completed} / {statistics.total}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={statistics.completionRate} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {/* 필터 패널 */}
        {!isLoading && inspectionData && inspectionData.differences && (
          <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="검색..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>타입</InputLabel>
                <Select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  label="타입"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="manual_only">수기초만</MenuItem>
                  <MenuItem value="system_only">시스템만</MenuItem>
                  <MenuItem value="mismatch">값 불일치</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {currentView === 'overview' && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>처리자</InputLabel>
                  <Select
                    value={filters.assignedAgent}
                    onChange={(e) => handleFilterChange('assignedAgent', e.target.value)}
                    label="처리자"
                  >
                    <MenuItem value="all">전체</MenuItem>
                    {assignedAgents.map(agent => (
                      <MenuItem key={agent} value={agent}>{agent}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>완료 상태</InputLabel>
                <Select
                  value={filters.completionStatus}
                  onChange={(e) => handleFilterChange('completionStatus', e.target.value)}
                  label="완료 상태"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="completed">완료</MenuItem>
                  <MenuItem value="pending">대기</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* 데이터 테이블 */}
        {!isLoading && inspectionData && inspectionData.differences && (
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>가입번호</TableCell>
                  <TableCell>타입</TableCell>
                  <TableCell>필드</TableCell>
                  <TableCell>정확한 값 (수기초)</TableCell>
                  <TableCell>잘못된 값 (폰클개통데이터)</TableCell>
                  {currentView === 'overview' && <TableCell>처리자</TableCell>}
                  <TableCell>상태</TableCell>
                  <TableCell>작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={currentView === 'overview' ? 8 : 7} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentView === 'overview' ? 8 : 7} align="center">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item, index) => (
                    <TableRow key={`${item.key}-${index}`}>
                      <TableCell>{item.key}</TableCell>
                      <TableCell>
                        <Chip
                          label={getDifferenceTypeLabel(item.type)}
                          size="small"
                          sx={{ 
                            backgroundColor: getDifferenceTypeColor(item.type),
                            color: 'white'
                          }}
                        />
                      </TableCell>
                      <TableCell>{item.field}</TableCell>
                      <TableCell sx={{ maxWidth: 200, wordBreak: 'break-word', color: 'success.main', fontWeight: 'bold' }}>
                        {item.correctValue}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, wordBreak: 'break-word', color: 'error.main' }}>
                        {item.incorrectValue}
                      </TableCell>
                      {currentView === 'overview' && (
                        <TableCell>{item.assignedAgent}</TableCell>
                      )}
                      <TableCell>
                        {completedItems.has(item.key) ? (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="완료"
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip
                            label="대기"
                            color="warning"
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {!completedItems.has(item.key) && (
                            <Tooltip title="완료 처리">
                              <IconButton
                                size="small"
                                onClick={() => handleComplete(item)}
                                color="success"
                              >
                                <CheckCircleIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {item.type === 'mismatch' && item.systemRow && (
                            <Tooltip title="폰클개통데이터 수정">
                              <IconButton
                                size="small"
                                onClick={() => handleUpdateSystemData(item)}
                                color="warning"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="정규화">
                            <IconButton
                              size="small"
                              onClick={() => handleNormalize(item)}
                              color="primary"
                            >
                              <NormalizeIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="상세보기">
                            <IconButton
                              size="small"
                              color="info"
                            >
                              <VisibilityIcon />
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
        </Paper>
        )}
      </Container>

      {/* 정규화 다이얼로그 */}
      <Dialog 
        open={normalizeDialog.open} 
        onClose={() => setNormalizeDialog({ open: false, item: null, normalizedValue: '', fieldValues: [], isLoadingValues: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>데이터 정규화</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              가입번호: {normalizeDialog.item?.key}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              필드: {normalizeDialog.item?.field}
            </Typography>
            <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
              정확한 값 (수기초): {normalizeDialog.item?.correctValue}
            </Typography>
            <Typography variant="body2" color="error.main">
              잘못된 값 (폰클개통데이터): {normalizeDialog.item?.incorrectValue}
            </Typography>
          </Box>
          {normalizeDialog.isLoadingValues ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Autocomplete
              freeSolo
              options={normalizeDialog.fieldValues}
              value={normalizeDialog.normalizedValue}
              onChange={(event, newValue) => {
                setNormalizeDialog(prev => ({
                  ...prev,
                  normalizedValue: newValue || ''
                }));
              }}
              onInputChange={(event, newInputValue) => {
                setNormalizeDialog(prev => ({
                  ...prev,
                  normalizedValue: newInputValue
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="정규화된 값"
                  placeholder="기존 값에서 선택하거나 새로 입력하세요..."
                  multiline
                  rows={3}
                />
              )}
              loading={normalizeDialog.isLoadingValues}
              noOptionsText="일치하는 값이 없습니다"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setNormalizeDialog({ open: false, item: null, normalizedValue: '', fieldValues: [], isLoadingValues: false })}
          >
            취소
          </Button>
          <Button 
            onClick={handleSaveNormalization}
            variant="contained"
            disabled={!normalizeDialog.normalizedValue.trim()}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default InspectionMode; 