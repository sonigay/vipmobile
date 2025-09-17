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

  // 마당접수 누락 데이터 로드
  const loadMappingFailures = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/yard-receipt-missing-analysis`);
      const result = await response.json();
      
      if (result.success) {
        const analysis = result.analysis;
        const missingDetails = analysis.yardReceipt.missingDetails || [];
        
        console.log('서버에서 받은 누락 데이터:', missingDetails.slice(0, 3));
        
        // 누락된 데이터를 그룹화
        const groupedMissing = {};
        missingDetails.forEach(item => {
          const key = item.reason;
          if (!groupedMissing[key]) {
            groupedMissing[key] = {
              reason: key,
              count: 0,
              items: []
            };
          }
          groupedMissing[key].count++;
          groupedMissing[key].items.push(item);
        });
        
        const failureList = Object.values(groupedMissing);
        console.log('그룹화된 누락 데이터:', failureList);
        setMappingFailures(failureList);
        
        // 통계 정보 저장
        setFailureReasons({
          total: analysis.yardReceipt.total,
          matched: analysis.yardReceipt.matched,
          unmatched: analysis.yardReceipt.unmatched,
          appCalculated: analysis.appCalculation.calculatedReceived,
          difference: analysis.difference.difference
        });
      } else {
        setError('마당접수 누락 데이터를 불러오는데 실패했습니다.');
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
  const actualMissingCount = mappingFailures.reduce((sum, item) => sum + item.items.length, 0);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { 
          minHeight: '80vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6">
              마당접수 누락 데이터 분석
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
              마당접수 시트의 385건 중에서 앱에 반영되지 않은 누락 데이터를 확인할 수 있습니다.
            </Alert>

            {/* 통계 정보 표시 */}
            {failureReasons.total && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  📊 데이터 분석 결과
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">마당접수 총 건수</Typography>
                    <Typography variant="h6" color="primary">{failureReasons.total}건</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">앱 계산 건수</Typography>
                    <Typography variant="h6" color="success.main">{failureReasons.appCalculated}건</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">누락 건수</Typography>
                    <Typography variant="h6" color="error.main">{actualMissingCount}건</Typography>
                  </Box>
                </Box>
              </Box>
            )}

            <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>예약번호</TableCell>
                    <TableCell>상호명</TableCell>
                    <TableCell>고객명</TableCell>
                    <TableCell>POS코드</TableCell>
                    <TableCell>접수시간</TableCell>
                    <TableCell>메모</TableCell>
                    <TableCell>누락 원인</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mappingFailures.map((item, index) => 
                    item.items.map((detail, detailIndex) => (
                      <TableRow key={`${index}-${detailIndex}`}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {detail.reservationNumber || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {detail.storeName || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {detail.customerName || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {detail.posCode || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {detail.receivedDateTime || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {detail.receivedMemo || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={item.reason} 
                            color="error" 
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
