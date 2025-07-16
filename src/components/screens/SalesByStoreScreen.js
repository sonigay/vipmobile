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
  const [data, setData] = useState({ byStore: {}, byAgent: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('store'); // 'store' 또는 'agent'
  const [selectedStore, setSelectedStore] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState(0);
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

  // 담당자 수정 다이얼로그 열기 (현재는 비활성화)
  const handleEditAgent = (item) => {
    // 새로운 데이터 구조에서는 개별 항목 편집이 어려우므로 임시로 비활성화
    setMessage({ type: 'info', text: '담당자 수정 기능은 현재 개발 중입니다.' });
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

  // 디버깅용: 데이터 구조 확인
  useEffect(() => {
    if (data.byAgent && Object.keys(data.byAgent).length > 0) {
      console.log('담당자별 데이터 구조:', data.byAgent);
      Object.entries(data.byAgent).forEach(([agent, agentData]) => {
        console.log(`${agent} 담당자의 POS 목록:`, Object.keys(agentData));
      });
    }
  }, [data.byAgent]);

  // 데이터 목록
  const storeCodes = Object.keys(data.byStore);
  const agents = Object.keys(data.byAgent);

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

  if (storeCodes.length === 0 && agents.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="info">
          표시할 데이터가 없습니다.
        </Alert>
      </Container>
    );
  }

  const currentStoreCode = storeCodes[selectedStore];
  const currentStoreData = data.byStore[currentStoreCode] || [];
  const currentAgentName = agents[selectedAgent];
  const currentAgentData = data.byAgent[currentAgentName] || {};

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
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadData}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : '새로고침'}
        </Button>
        
        <Button
          variant={viewMode === 'store' ? 'contained' : 'outlined'}
          startIcon={<StoreIcon />}
          onClick={() => setViewMode('store')}
          sx={{ backgroundColor: viewMode === 'store' ? '#ff9a9e' : undefined }}
        >
          대리점코드별 정리
        </Button>
        
        <Button
          variant={viewMode === 'agent' ? 'contained' : 'outlined'}
          startIcon={<PersonIcon />}
          onClick={() => setViewMode('agent')}
          sx={{ backgroundColor: viewMode === 'agent' ? '#ff9a9e' : undefined }}
        >
          담당자별 정리
        </Button>
      </Box>

      {/* 대리점코드별 탭 */}
      {viewMode === 'store' && (
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
              {storeCodes.map((storeCode, index) => {
                const storeData = data.byStore[storeCode] || {};
                const totalItems = Object.values(storeData).reduce((sum, agentData) => sum + agentData.total, 0);
                
                return (
                  <Tab
                    key={storeCode}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StoreIcon fontSize="small" />
                        {storeCode}
                        <Chip
                          label={totalItems}
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
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* 담당자별 탭 - 컴팩트 버전 */}
      {viewMode === 'agent' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              담당자별 정리
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {agents.map((agent, index) => {
                const agentData = data.byAgent[agent] || {};
                const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
                const isSelected = index === selectedAgent;
                
                return (
                  <Button
                    key={agent}
                    variant={isSelected ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setSelectedAgent(index)}
                    sx={{
                      minWidth: 'auto',
                      px: 2,
                      py: 1,
                      fontSize: '0.8rem',
                      backgroundColor: isSelected ? '#ff9a9e' : undefined,
                      '&:hover': {
                        backgroundColor: isSelected ? '#f48fb1' : undefined
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PersonIcon fontSize="small" />
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        {agent}
                      </Typography>
                      <Chip
                        label={totalItems}
                        size="small"
                        color={isSelected ? 'default' : 'primary'}
                        sx={{ fontSize: '0.6rem', height: 16, minWidth: 20 }}
                      />
                    </Box>
                  </Button>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 대리점코드별 데이터 테이블 */}
      {viewMode === 'store' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              {currentStoreCode} - 담당자별 정리
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="200px">담당자</TableCell>
                    <TableCell width="120px" align="center">서류접수</TableCell>
                    <TableCell width="120px" align="center">서류미접수</TableCell>
                    <TableCell width="100px" align="center">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(currentStoreData).map(([agent, agentData]) => (
                    <TableRow key={agent} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={agent}
                            color="primary"
                            size="small"
                            icon={<PersonIcon />}
                            sx={{ fontSize: '0.8rem' }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={agentData.received}
                          color="success"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={agentData.notReceived}
                          color="warning"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={agentData.total}
                          color="primary"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40, fontWeight: 'bold' }}
                        />
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
                    label={`총 담당자: ${Object.keys(currentStoreData).length}명`}
                    color="primary"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Chip
                    label={`총 건수: ${Object.values(currentStoreData).reduce((sum, agentData) => sum + agentData.total, 0)}건`}
                    color="info"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Chip
                    label={`서류접수: ${Object.values(currentStoreData).reduce((sum, agentData) => sum + agentData.received, 0)}건`}
                    color="success"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Chip
                    label={`미접수: ${Object.values(currentStoreData).reduce((sum, agentData) => sum + agentData.notReceived, 0)}건`}
                    color="warning"
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 담당자별 데이터 테이블 */}
      {viewMode === 'agent' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              {currentAgentName} - POS별 정리
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="200px">POS명</TableCell>
                    <TableCell width="120px" align="center">서류접수</TableCell>
                    <TableCell width="120px" align="center">서류미접수</TableCell>
                    <TableCell width="100px" align="center">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(currentAgentData).map(([posName, posData]) => (
                    <TableRow key={posName} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {posName || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.received}
                          color="success"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.notReceived}
                          color="warning"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.total}
                          color="primary"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40, fontWeight: 'bold' }}
                        />
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
                    label={`총 POS: ${Object.keys(currentAgentData).length}개`}
                    color="primary"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Chip
                    label={`총 건수: ${Object.values(currentAgentData).reduce((sum, posData) => sum + posData.total, 0)}건`}
                    color="info"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Chip
                    label={`서류접수: ${Object.values(currentAgentData).reduce((sum, posData) => sum + posData.received, 0)}건`}
                    color="success"
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Chip
                    label={`미접수: ${Object.values(currentAgentData).reduce((sum, posData) => sum + posData.notReceived, 0)}건`}
                    color="warning"
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

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