import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip,
  TextField,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

const MappingFailureModal = ({ open, onClose, onMappingUpdate }) => {
  const [mappingFailures, setMappingFailures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [newMapping, setNewMapping] = useState('');
  const [failureReasons, setFailureReasons] = useState({});
  const [showReasons, setShowReasons] = useState({});

  // 매핑 실패 원인 분석
  const analyzeFailureReasons = async (posCode) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/mapping-failure-analysis?posCode=${posCode}`);
      const result = await response.json();
      
      if (result.success) {
        setFailureReasons(prev => ({
          ...prev,
          [posCode]: result.reasons
        }));
      }
    } catch (err) {
      console.error('매핑 실패 원인 분석 오류:', err);
    }
  };

  // 매핑 실패 데이터 로드
  const loadMappingFailures = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-sales/by-store-agent`);
      const result = await response.json();
      
      if (result.success) {
        const failures = result.matchingFailures?.failureByPosCode || {};
        const failureList = Object.entries(failures).map(([posCode, data]) => ({
          posCode,
          posName: data.posName,
          count: data.count,
          items: data.items || []
        }));
        
        setMappingFailures(failureList);
        
        // 각 POS코드에 대해 실패 원인 분석
        failureList.forEach(item => {
          analyzeFailureReasons(item.posCode);
        });
      } else {
        setError('매핑 실패 데이터를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('데이터 로드 중 오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 매핑 설정 저장
  const handleSaveMapping = async (posCode, newStoreCode) => {
    if (!newStoreCode.trim()) {
      setError('매장코드를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/pos-code-mapping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          posCode,
          storeCode: newStoreCode.trim()
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 성공 시 해당 항목 제거
        setMappingFailures(prev => 
          prev.filter(item => item.posCode !== posCode)
        );
        
        // 부모 컴포넌트에 업데이트 알림
        if (onMappingUpdate) {
          onMappingUpdate();
        }
        
        setEditingItem(null);
        setNewMapping('');
      } else {
        setError(result.message || '매핑 설정에 실패했습니다.');
      }
    } catch (err) {
      setError('매핑 설정 중 오류가 발생했습니다: ' + err.message);
    }
  };

  // 모달 열릴 때 데이터 로드
  useEffect(() => {
    if (open) {
      loadMappingFailures();
    }
  }, [open]);

  const totalFailures = mappingFailures.reduce((sum, item) => sum + item.count, 0);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6">
              매핑 실패 항목 관리
            </Typography>
            <Chip 
              label={`총 ${totalFailures}건`} 
              color="error" 
              size="small"
            />
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              매핑이 실패한 POS코드들을 확인하고 올바른 매장코드로 매핑해주세요.
              매핑 설정 후에는 자동으로 목록에서 제거됩니다.
            </Alert>

            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>POS코드</TableCell>
                    <TableCell>POS명</TableCell>
                    <TableCell>실패건수</TableCell>
                    <TableCell>실패원인</TableCell>
                    <TableCell>새 매장코드</TableCell>
                    <TableCell>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mappingFailures.map((item) => (
                    <TableRow key={item.posCode}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {item.posCode}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.posName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={item.count} 
                          color="error" 
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {failureReasons[item.posCode] ? (
                          <Box>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => setShowReasons(prev => ({
                                ...prev,
                                [item.posCode]: !prev[item.posCode]
                              }))}
                              sx={{ textTransform: 'none', p: 0.5 }}
                            >
                              {showReasons[item.posCode] ? '숨기기' : '원인보기'}
                            </Button>
                            {showReasons[item.posCode] && (
                              <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>
                                  📋 실패 원인:
                                </Typography>
                                {failureReasons[item.posCode].reasons?.map((reason, index) => (
                                  <Typography key={index} variant="caption" display="block" color="text.secondary" sx={{ ml: 1 }}>
                                    • {reason}
                                  </Typography>
                                ))}
                                {failureReasons[item.posCode].solutions && failureReasons[item.posCode].solutions.length > 0 && (
                                  <>
                                    <Typography variant="caption" fontWeight="bold" display="block" sx={{ mt: 1, mb: 0.5 }}>
                                      💡 해결 방안:
                                    </Typography>
                                    {failureReasons[item.posCode].solutions.map((solution, index) => (
                                      <Typography key={index} variant="caption" display="block" color="primary.main" sx={{ ml: 1 }}>
                                        {solution}
                                      </Typography>
                                    ))}
                                  </>
                                )}
                              </Box>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            분석중...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingItem === item.posCode ? (
                          <TextField
                            size="small"
                            value={newMapping}
                            onChange={(e) => setNewMapping(e.target.value)}
                            placeholder="매장코드 입력"
                            sx={{ width: 120 }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            미설정
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingItem === item.posCode ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="저장">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleSaveMapping(item.posCode, newMapping)}
                              >
                                <SaveIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="취소">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingItem(null);
                                  setNewMapping('');
                                }}
                              >
                                <CloseIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setEditingItem(item.posCode);
                              setNewMapping('');
                            }}
                          >
                            매핑 설정
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {mappingFailures.length === 0 && !loading && (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color="success.main">
                  모든 매핑이 완료되었습니다!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  매핑 실패 항목이 없습니다.
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          닫기
        </Button>
        <Button 
          onClick={loadMappingFailures} 
          variant="outlined"
          disabled={loading}
        >
          새로고침
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MappingFailureModal;
