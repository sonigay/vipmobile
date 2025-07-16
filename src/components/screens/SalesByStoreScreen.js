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
  Store as StoreIcon,
  ColorLens as ColorLensIcon,
  Close as CloseIcon
} from '@mui/icons-material';

function SalesByStoreScreen({ loggedInStore }) {
  const [data, setData] = useState({ byStore: {}, byAgent: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('store'); // 'store', 'agent', 'modelColor'
  const [selectedStore, setSelectedStore] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [selectedPos, setSelectedPos] = useState(0);
  const [selectedModelColor, setSelectedModelColor] = useState(0);
  const [editingAgent, setEditingAgent] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAgentValue, setEditAgentValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [normalizationStatus, setNormalizationStatus] = useState(null);
  const [modelColorData, setModelColorData] = useState([]);
  const [loadingModelColor, setLoadingModelColor] = useState(false);
  const [customerListData, setCustomerListData] = useState([]);
  const [loadingCustomerList, setLoadingCustomerList] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState({ type: '', value: '' });

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

  // 정규화 상태 확인
  const checkNormalizationStatus = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-settings/normalized-data`);
      if (response.ok) {
        const result = await response.json();
        // 사전예약사이트의 모든 모델이 정규화되면 완료로 간주
        setNormalizationStatus(result.success && result.stats?.isCompleted);
      }
    } catch (error) {
      console.error('정규화 상태 확인 오류:', error);
      setNormalizationStatus(false);
    }
  };

  // POS별 고객 리스트 로드
  const loadCustomerListByPos = async (posName) => {
    setLoadingCustomerList(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-sales/model-color/by-pos/${encodeURIComponent(posName)}`);
      
      if (!response.ok) {
        throw new Error('POS별 고객 리스트를 불러올 수 없습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setCustomerListData(result.data);
        setSelectedFilter({ type: 'pos', value: posName });
        setMessage({ type: 'success', text: `${posName} 고객 리스트 로드 완료: ${result.data.length}명` });
      } else {
        throw new Error(result.message || 'POS별 고객 리스트 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('POS별 고객 리스트 로드 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingCustomerList(false);
    }
  };

  // 모델별 고객 리스트 로드
  const loadCustomerListByModel = async (model) => {
    setLoadingCustomerList(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-sales/customers/by-model/${encodeURIComponent(model)}`);
      
      if (!response.ok) {
        throw new Error('모델별 고객 리스트를 불러올 수 없습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setCustomerListData(result.data);
        setSelectedFilter({ type: 'model', value: model });
        setMessage({ type: 'success', text: `${model} 고객 리스트 로드 완료: ${result.data.length}명` });
      } else {
        throw new Error(result.message || '모델별 고객 리스트 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('모델별 고객 리스트 로드 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingCustomerList(false);
    }
  };

  // 모델색상별 데이터 로드
  const loadModelColorData = async () => {
    if (!normalizationStatus) {
      setMessage({ type: 'warning', text: '정규화작업이 완료되지 않았습니다.' });
      return;
    }

    setLoadingModelColor(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-sales/model-color`);
      
      if (!response.ok) {
        throw new Error('모델색상별 데이터를 불러올 수 없습니다.');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setModelColorData(result.data);
        setMessage({ type: 'success', text: `모델색상별 데이터 로드 완료: ${result.data.length}개 조합` });
      } else {
        throw new Error(result.message || '모델색상별 데이터 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('모델색상별 데이터 로드 오류:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoadingModelColor(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData();
    checkNormalizationStatus();
  }, []);

  // 모델색상별 탭 선택 시 데이터 로드
  useEffect(() => {
    if (viewMode === 'modelColor' && normalizationStatus && modelColorData.length === 0) {
      loadModelColorData();
    }
  }, [viewMode, normalizationStatus]);

  // 디버깅용: 데이터 구조 확인
  useEffect(() => {
    if (data.byAgent && Object.keys(data.byAgent).length > 0) {
      console.log('담당자별 데이터 구조:', data.byAgent);
      Object.entries(data.byAgent).forEach(([agent, agentData]) => {
        const posNames = Object.keys(agentData);
        const totalItems = Object.values(agentData).reduce((sum, posData) => sum + posData.total, 0);
        const totalReceived = Object.values(agentData).reduce((sum, posData) => sum + posData.received, 0);
        console.log(`${agent} 담당자: ${posNames.length}개 POS, 총 ${totalItems}건, 접수 ${totalReceived}건`);
        console.log(`  POS 목록:`, posNames);
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
        
        <Button
          variant={viewMode === 'modelColor' ? 'contained' : 'outlined'}
          startIcon={<ColorLensIcon />}
          onClick={() => {
            if (normalizationStatus) {
              setViewMode('modelColor');
            } else {
              setMessage({ 
                type: 'warning', 
                text: '모델색상별정리를 사용하려면 먼저 사전예약정리 셋팅에서 모델 정규화작업을 완료해주세요.' 
              });
            }
          }}
          sx={{ backgroundColor: viewMode === 'modelColor' ? '#ff9a9e' : undefined }}
        >
          모델색상별 정리
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

      {/* 담당자별 탭 */}
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
                const isSelected = selectedAgent === index;
                
                return (
                  <Button
                    key={agent}
                    variant={isSelected ? 'contained' : 'outlined'}
                    size="small"
                    startIcon={<PersonIcon />}
                    onClick={() => setSelectedAgent(index)}
                    sx={{
                      backgroundColor: isSelected ? '#ff9a9e' : undefined,
                      color: isSelected ? 'white' : undefined,
                      '&:hover': {
                        backgroundColor: isSelected ? '#ff8a8e' : undefined
                      },
                      minWidth: 'auto',
                      px: 2,
                      py: 1,
                      fontSize: '0.8rem'
                    }}
                  >
                    {agent}
                    <Chip
                      label={totalItems}
                      size="small"
                      color={isSelected ? 'default' : 'primary'}
                      sx={{ 
                        fontSize: '0.6rem', 
                        height: 16, 
                        ml: 1,
                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : undefined,
                        color: isSelected ? 'white' : undefined
                      }}
                    />
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
                    <TableCell width="60px" align="center">랭크</TableCell>
                    <TableCell width="200px">담당자</TableCell>
                    <TableCell width="120px" align="center">서류접수</TableCell>
                    <TableCell width="120px" align="center">서류미접수</TableCell>
                    <TableCell width="100px" align="center">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(currentStoreData)
                    .map(([agent, agentData]) => ({
                      agent,
                      agentData,
                      total: agentData.total
                    }))
                    .sort((a, b) => b.total - a.total) // 합계 내림차순 정렬
                    .map(({ agent, agentData }, index) => (
                    <TableRow key={agent} hover>
                      <TableCell align="center">
                        <Chip
                          label={index + 1}
                          size="small"
                          color={index < 3 ? 'primary' : 'default'}
                          sx={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 'bold',
                            backgroundColor: index < 3 ? '#ff9a9e' : undefined,
                            color: index < 3 ? 'white' : undefined
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={agent}
                            color="primary"
                            size="small"
                            icon={<PersonIcon />}
                            sx={{ 
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: '#ff8a8e'
                              }
                            }}
                            onClick={() => {
                              setViewMode('agent');
                              const agentIndex = agents.findIndex(a => a === agent);
                              if (agentIndex !== -1) {
                                setSelectedAgent(agentIndex);
                              }
                            }}
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
                    <TableCell width="60px" align="center">랭크</TableCell>
                    <TableCell width="200px">POS명</TableCell>
                    <TableCell width="120px" align="center">서류접수</TableCell>
                    <TableCell width="120px" align="center">서류미접수</TableCell>
                    <TableCell width="100px" align="center">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(currentAgentData)
                    .map(([posName, posData]) => ({
                      posName,
                      posData,
                      total: posData.total
                    }))
                    .sort((a, b) => b.total - a.total) // 합계 내림차순 정렬
                    .map(({ posName, posData }, index) => (
                    <TableRow key={posName} hover>
                      <TableCell align="center">
                        <Chip
                          label={index + 1}
                          size="small"
                          color={index < 3 ? 'primary' : 'default'}
                          sx={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 'bold',
                            backgroundColor: index < 3 ? '#ff9a9e' : undefined,
                            color: index < 3 ? 'white' : undefined
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={posName || '-'}
                          color="primary"
                          size="small"
                          icon={<StoreIcon />}
                          sx={{ 
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#ff8a8e'
                            }
                          }}
                          onClick={() => {
                            loadCustomerListByPos(posName);
                          }}
                        />
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

      {/* 모델색상별 정리 탭 */}
      {viewMode === 'modelColor' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              모델색상별 정리
            </Typography>
            
            {normalizationStatus ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ColorLensIcon />}
                  onClick={() => setSelectedModelColor(0)}
                  sx={{
                    backgroundColor: selectedModelColor === 0 ? '#ff9a9e' : undefined,
                    color: selectedModelColor === 0 ? 'white' : undefined,
                    '&:hover': {
                      backgroundColor: selectedModelColor === 0 ? '#ff8a8e' : undefined
                    }
                  }}
                >
                  전체 모델
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={loadModelColorData}
                  disabled={loadingModelColor}
                >
                  {loadingModelColor ? <CircularProgress size={16} /> : '데이터 로드'}
                </Button>
                {modelColorData.length > 0 && (
                  <Chip
                    label={`${modelColorData.length}개 모델색상 조합`}
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            ) : (
              <Alert severity="warning" sx={{ mb: 2 }}>
                모델색상별정리를 사용하려면 먼저 사전예약정리 셋팅에서 모델 정규화작업을 완료해주세요.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 모델색상별 데이터 테이블 */}
      {viewMode === 'modelColor' && normalizationStatus && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
                모델색상별 서류접수 현황
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadModelColorData}
                disabled={loadingModelColor}
                size="small"
              >
                {loadingModelColor ? <CircularProgress size={16} /> : '새로고침'}
              </Button>
            </Box>
            
            {loadingModelColor ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : modelColorData.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="60px" align="center">랭크</TableCell>
                      <TableCell width="200px">모델</TableCell>
                      <TableCell width="150px">색상</TableCell>
                      <TableCell width="120px" align="center">서류접수</TableCell>
                      <TableCell width="120px" align="center">서류미접수</TableCell>
                      <TableCell width="100px" align="center">합계</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {modelColorData.map((item) => (
                      <TableRow key={`${item.model}-${item.color}`} hover>
                        <TableCell align="center">
                          <Chip
                            label={item.rank}
                            size="small"
                            color={item.rank <= 3 ? 'primary' : 'default'}
                            sx={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 'bold',
                              backgroundColor: item.rank <= 3 ? '#ff9a9e' : undefined,
                              color: item.rank <= 3 ? 'white' : undefined
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.model}
                            color="primary"
                            size="small"
                            icon={<ColorLensIcon />}
                            sx={{ 
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: '#ff8a8e'
                              }
                            }}
                            onClick={() => loadCustomerListByModel(item.model)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.color}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.received}
                            color="success"
                            size="small"
                            sx={{ fontSize: '0.8rem', minWidth: 40 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.notReceived}
                            color="warning"
                            size="small"
                            sx={{ fontSize: '0.8rem', minWidth: 40 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={item.total}
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
            ) : (
              <Alert severity="info">
                모델색상별 데이터가 없습니다. 새로고침 버튼을 클릭하여 데이터를 로드해주세요.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* 고객 리스트 테이블 */}
      {customerListData.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
                {selectedFilter.type === 'pos' ? `${selectedFilter.value} 고객 리스트` : `${selectedFilter.value} 고객 리스트`}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<CloseIcon />}
                onClick={() => {
                  setCustomerListData([]);
                  setSelectedFilter({ type: '', value: '' });
                }}
                size="small"
              >
                닫기
              </Button>
            </Box>
            
            {loadingCustomerList ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="120px">고객명</TableCell>
                      <TableCell width="100px">예약번호</TableCell>
                      <TableCell width="120px">예약일시</TableCell>
                      <TableCell width="120px">접수일시</TableCell>
                      <TableCell width="150px">모델&색상</TableCell>
                      <TableCell width="80px">유형</TableCell>
                      <TableCell width="100px">대리점</TableCell>
                      <TableCell width="100px">POS명</TableCell>
                      <TableCell width="120px">예약메모</TableCell>
                      <TableCell width="120px">접수메모</TableCell>
                      <TableCell width="80px">접수자</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customerListData.map((customer, index) => (
                      <TableRow key={customer.reservationNumber} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.customerName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationDateTime}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.receivedDateTime || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={customer.model}
                            color="primary"
                            size="small"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.type || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.storeCode || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.posName || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationMemo || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.receivedMemo || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.receiver || '-'}
                          </Typography>
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