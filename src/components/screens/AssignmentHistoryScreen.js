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
  Divider
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
  Settings as SettingsIcon
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

  // 히스토리 로드
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const historyData = getAssignmentHistory();
    setHistory(historyData);
    setStats(calculateHistoryStats());
  };

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
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        
        {/* 통계 카드 */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="primary">
                    {stats.totalAssignments}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    총 배정 횟수
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="secondary">
                    {stats.averageAssigned}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    평균 배정량
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getTrendIcon(stats.recentTrend)}
                    <Typography variant="h4" sx={{ ml: 1 }}>
                      {stats.recentTrend === 'increasing' ? '증가' : 
                       stats.recentTrend === 'decreasing' ? '감소' : '안정'}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    최근 트렌드
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h4" color="warning.main">
                    {history.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    저장된 히스토리
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* 액션 버튼 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Button
                variant="outlined"
                onClick={handleCompareHistory}
                disabled={selectedItems.length !== 2}
                startIcon={<CompareIcon />}
              >
                간단 비교 ({selectedItems.length}/2)
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                onClick={handleOpenComparisonScreen}
                startIcon={<CompareIcon />}
              >
                고급 비교 및 분석
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                onClick={handleExportHistory}
                startIcon={<DownloadIcon />}
              >
                내보내기
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                onClick={() => setImportDialog(true)}
                startIcon={<UploadIcon />}
              >
                가져오기
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                color="error"
                onClick={handleClearAllHistory}
                startIcon={<DeleteIcon />}
              >
                전체 삭제
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* 히스토리 테이블 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              배정 히스토리 목록
            </Typography>
            
            {history.length === 0 ? (
              <Alert severity="info">
                저장된 배정 히스토리가 없습니다.
              </Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(history.map(item => item.id));
                            } else {
                              setSelectedItems([]);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>날짜</TableCell>
                      <TableCell>영업사원 수</TableCell>
                      <TableCell>모델 수</TableCell>
                      <TableCell>총 배정량</TableCell>
                      <TableCell>배정률</TableCell>
                      <TableCell>작업</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell padding="checkbox">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems([...selectedItems, item.id]);
                              } else {
                                setSelectedItems(selectedItems.filter(id => id !== item.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>{formatDate(item.timestamp)}</TableCell>
                        <TableCell>{item.metadata.totalAgents}명</TableCell>
                        <TableCell>{item.metadata.totalModels}개</TableCell>
                        <TableCell>{item.metadata.totalAssigned}개</TableCell>
                        <TableCell>
                          {item.metadata.totalQuantity > 0 
                            ? Math.round((item.metadata.totalAssigned / item.metadata.totalQuantity) * 100)
                            : 0}%
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteHistory(item.id)}
                            color="error"
                          >
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
      </Box>

      {/* 비교 결과 다이얼로그 */}
      <Dialog open={comparisonDialog} onClose={() => setComparisonDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>배정 설정 비교 결과</DialogTitle>
        <DialogContent>
          {comparisonResult && (
            <Box>
              <Typography variant="h6" gutterBottom>
                설정 변경 사항
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">회전율</Typography>
                  <Typography variant="body2">
                    {comparisonResult.settings.turnoverRate.before}% → {comparisonResult.settings.turnoverRate.after}%
                    {comparisonResult.settings.turnoverRate.change > 0 && ' (+' + comparisonResult.settings.turnoverRate.change + ')'}
                    {comparisonResult.settings.turnoverRate.change < 0 && ' (' + comparisonResult.settings.turnoverRate.change + ')'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">거래처수</Typography>
                  <Typography variant="body2">
                    {comparisonResult.settings.storeCount.before}% → {comparisonResult.settings.storeCount.after}%
                    {comparisonResult.settings.storeCount.change > 0 && ' (+' + comparisonResult.settings.storeCount.change + ')'}
                    {comparisonResult.settings.storeCount.change < 0 && ' (' + comparisonResult.settings.storeCount.change + ')'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">잔여재고</Typography>
                  <Typography variant="body2">
                    {comparisonResult.settings.remainingInventory.before}% → {comparisonResult.settings.remainingInventory.after}%
                    {comparisonResult.settings.remainingInventory.change > 0 && ' (+' + comparisonResult.settings.remainingInventory.change + ')'}
                    {comparisonResult.settings.remainingInventory.change < 0 && ' (' + comparisonResult.settings.remainingInventory.change + ')'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">판매량</Typography>
                  <Typography variant="body2">
                    {comparisonResult.settings.salesVolume.before}% → {comparisonResult.settings.salesVolume.after}%
                    {comparisonResult.settings.salesVolume.change > 0 && ' (+' + comparisonResult.settings.salesVolume.change + ')'}
                    {comparisonResult.settings.salesVolume.change < 0 && ' (' + comparisonResult.settings.salesVolume.change + ')'}
                  </Typography>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                결과 변경 사항
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">총 배정량</Typography>
                  <Typography variant="body2">
                    {comparisonResult.results.totalAssigned.before}개 → {comparisonResult.results.totalAssigned.after}개
                    {comparisonResult.results.totalAssigned.change > 0 && ' (+' + comparisonResult.results.totalAssigned.change + ')'}
                    {comparisonResult.results.totalAssigned.change < 0 && ' (' + comparisonResult.results.totalAssigned.change + ')'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">영업사원 수</Typography>
                  <Typography variant="body2">
                    {comparisonResult.results.totalAgents.before}명 → {comparisonResult.results.totalAgents.after}명
                    {comparisonResult.results.totalAgents.change > 0 && ' (+' + comparisonResult.results.totalAgents.change + ')'}
                    {comparisonResult.results.totalAgents.change < 0 && ' (' + comparisonResult.results.totalAgents.change + ')'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
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
          <Typography variant="body2" color="text.secondary" gutterBottom>
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
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialog(false)}>취소</Button>
          <Button onClick={handleImportHistory} variant="contained">가져오기</Button>
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