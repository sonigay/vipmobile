import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Grid
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  Store as StoreIcon
} from '@mui/icons-material';

function SalesByStoreScreen({ loggedInStore }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStore, setSelectedStore] = useState(0);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAgentValue, setEditAgentValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-by-store/data`);
      
      if (!response.ok) {
        throw new Error('데이터를 불러올 수 없습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        if (Object.keys(result.data).length > 0) {
          setSelectedStore(0);
        }
      } else {
        throw new Error(result.message || '데이터 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('판매처별정리 데이터 로드 오류:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 담당자 수정 다이얼로그 열기
  const handleEditAgent = (item) => {
    setEditingAgent(item);
    setEditAgentValue(item.agent || '');
    setEditDialogOpen(true);
  };

  // 담당자 수정 저장
  const handleSaveAgent = async () => {
    if (!editingAgent) return;
    
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-by-store/update-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeCode: editingAgent.storeCode,
          posName: editingAgent.posName,
          agent: editAgentValue
        })
      });
      
      if (!response.ok) {
        throw new Error('담당자 업데이트에 실패했습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        // 로컬 상태 업데이트
        setData(prevData => {
          const newData = { ...prevData };
          const storeCode = editingAgent.storeCode;
          const posName = editingAgent.posName;
          
          if (newData[storeCode]) {
            newData[storeCode] = newData[storeCode].map(item => 
              item.posName === posName && item.storeCode === storeCode
                ? { ...item, agent: editAgentValue }
                : item
            );
          }
          
          return newData;
        });
        
        setMessage({ type: 'success', text: '담당자가 성공적으로 업데이트되었습니다.' });
        setEditDialogOpen(false);
      } else {
        throw new Error(result.message || '담당자 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('담당자 업데이트 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  // 담당자 수정 취소
  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingAgent(null);
    setEditAgentValue('');
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  // 대리점코드 목록
  const storeCodes = Object.keys(data);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={loadData}
        >
          다시 시도
        </Button>
      </Container>
    );
  }

  if (storeCodes.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="info">
          표시할 데이터가 없습니다.
        </Alert>
      </Container>
    );
  }

  const selectedStoreCode = storeCodes[selectedStore];
  const selectedStoreData = data[selectedStoreCode] || [];

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold', color: '#ff9a9e' }}>
        판매처별정리
      </Typography>

      {/* 메시지 표시 */}
      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }}>
          {message.text}
        </Alert>
      )}

      {/* 액션 버튼 */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : '새로고침'}
        </Button>
      </Box>

      {/* 대리점코드별 탭 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
            대리점코드별 정리
          </Typography>
          
          <Tabs
            value={selectedStore}
            onChange={(event, newValue) => setSelectedStore(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 48,
                fontSize: '0.9rem',
                fontWeight: 500
              }
            }}
          >
            {storeCodes.map((storeCode, index) => (
              <Tab
                key={storeCode}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StoreIcon fontSize="small" />
                    {storeCode}
                    <Chip
                      label={data[storeCode]?.length || 0}
                      size="small"
                      color="primary"
                      sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  </Box>
                }
                sx={{
                  '&.Mui-selected': {
                    color: '#ff9a9e'
                  }
                }}
              />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* 선택된 대리점의 데이터 테이블 */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
            {selectedStoreCode} - POS별 정리
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width="60px">행번호</TableCell>
                  <TableCell width="200px">POS명</TableCell>
                  <TableCell width="150px">담당자</TableCell>
                  <TableCell width="120px">서류접수</TableCell>
                  <TableCell>예약번호</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedStoreData.map((item, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{item.rowIndex}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.posName || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {item.agent ? (
                          <Chip
                            label={item.agent}
                            color="primary"
                            size="small"
                            icon={<PersonIcon />}
                            sx={{ fontSize: '0.8rem' }}
                          />
                        ) : (
                          <Chip
                            label="미배정"
                            color="default"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.8rem' }}
                          />
                        )}
                        <Tooltip title="담당자 수정">
                          <IconButton
                            size="small"
                            onClick={() => handleEditAgent(item)}
                            sx={{ p: 0.5 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.isDocumentReceived ? '접수완료' : '미접수'}
                        color={item.isDocumentReceived ? 'success' : 'warning'}
                        icon={item.isDocumentReceived ? <CheckCircleIcon /> : <WarningIcon />}
                        size="small"
                        sx={{ fontSize: '0.8rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {item.reservationNumber || '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 통계 정보 */}
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Chip
                  label={`총 ${selectedStoreData.length}건`}
                  color="primary"
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <Chip
                  label={`담당자 배정: ${selectedStoreData.filter(item => item.agent).length}건`}
                  color="info"
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <Chip
                  label={`서류접수: ${selectedStoreData.filter(item => item.isDocumentReceived).length}건`}
                  color="success"
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <Chip
                  label={`미접수: ${selectedStoreData.filter(item => !item.isDocumentReceived).length}건`}
                  color="warning"
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* 담당자 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onClose={handleCancelEdit} maxWidth="sm" fullWidth>
        <DialogTitle>
          담당자 수정
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              POS명: {editingAgent?.posName}
            </Typography>
            <TextField
              fullWidth
              label="담당자"
              value={editAgentValue}
              onChange={(e) => setEditAgentValue(e.target.value)}
              placeholder="담당자명을 입력하세요"
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEdit} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={handleSaveAgent}
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default SalesByStoreScreen; 