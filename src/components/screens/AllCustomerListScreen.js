import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Cached as CachedIcon
} from '@mui/icons-material';
import { 
  getCachedAllCustomerList, 
  getCachedSearchResults, 
  clearAllCustomerCache, 
  getAllCustomerCacheStats 
} from '../../utils/allCustomerCache';

function AllCustomerListScreen({ loggedInStore }) {
  const [customerList, setCustomerList] = useState([]);
  const [filteredCustomerList, setFilteredCustomerList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cacheStats, setCacheStats] = useState(null);
  const [assignmentStatus, setAssignmentStatus] = useState({});
  const [loadingAssignment, setLoadingAssignment] = useState(false);

  // 전체 고객리스트 로드 (캐시 적용)
  const loadAllCustomerList = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getCachedAllCustomerList(process.env.REACT_APP_API_URL);
      
      if (result.success) {
        setCustomerList(result.data);
        setFilteredCustomerList(result.data);
      } else {
        throw new Error(result.message || '전체 고객 리스트 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('전체 고객 리스트 로드 오류:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 검색 기능 (캐시 적용)
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredCustomerList(customerList);
      return;
    }

    // 캐시된 검색 결과 사용
    const filtered = getCachedSearchResults(query, customerList);
    setFilteredCustomerList(filtered);
  }, [customerList]);

  // 검색 초기화
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setFilteredCustomerList(customerList);
  }, [customerList]);

  // 캐시 새로고침
  const refreshCache = useCallback(async () => {
    clearAllCustomerCache();
    await loadAllCustomerList();
    await loadAssignmentStatus();
  }, [loadAllCustomerList, loadAssignmentStatus]);

  // 재고배정 상태 로드
  const loadAssignmentStatus = useCallback(async () => {
    setLoadingAssignment(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/assignment-status`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 예약번호를 키로 하는 맵 생성
          const statusMap = {};
          result.data.forEach(item => {
            statusMap[item.reservationNumber] = {
              assignmentStatus: item.assignmentStatus,
              activationStatus: item.activationStatus,
              assignedSerialNumber: item.assignedSerialNumber,
              waitingOrder: item.waitingOrder
            };
          });
          setAssignmentStatus(statusMap);
        }
      }
    } catch (error) {
      console.error('재고배정 상태 로드 오류:', error);
    } finally {
      setLoadingAssignment(false);
    }
  }, []);

  // 캐시 통계 업데이트
  const updateCacheStats = useCallback(() => {
    const stats = getAllCustomerCacheStats();
    setCacheStats(stats);
  }, []);

  // 엑셀 다운로드
  const downloadExcel = useCallback(async () => {
    if (filteredCustomerList.length === 0) {
      setError('다운로드할 데이터가 없습니다.');
      return;
    }

    setDownloadingExcel(true);
    setError('');

    try {
      // XLSX 라이브러리 동적 import
      const XLSX = await import('xlsx');
      
      // 헤더 정의
      const headers = [
        '순번',
        '고객명',
        '예약번호',
        '사이트예약',
        '마당접수일',
        '온세일접수일',
        '모델/용량/색상',
        '유형',
        '대리점',
        'POS명',
        '재고배정',
        '개통완료',
        '사이트메모',
        '마당메모',
        '접수자'
      ];

      // 데이터 준비
      const excelData = filteredCustomerList.map((customer, index) => {
        const status = assignmentStatus[customer.reservationNumber];
        return [
          index + 1,
          customer.customerName || '',
          customer.reservationNumber || '',
          customer.reservationDateTime || '',
          customer.yardReceivedDate || '',
          customer.onSaleReceivedDate || '',
          customer.modelCapacityColor || '',
          customer.type || '',
          customer.storeCode || '',
          customer.posName || '',
          status?.assignmentStatus || '로딩중...',
          status?.activationStatus || '로딩중...',
          customer.reservationMemo || '',
          customer.yardReceivedMemo || '',
          customer.receiver || ''
        ];
      });

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...excelData]);

      // 컬럼 너비 설정
      const colWidths = [
        { wch: 8 },   // 순번
        { wch: 15 },  // 고객명
        { wch: 12 },  // 예약번호
        { wch: 15 },  // 사이트예약
        { wch: 15 },  // 마당접수일
        { wch: 15 },  // 온세일접수일
        { wch: 25 },  // 모델/용량/색상
        { wch: 10 },  // 유형
        { wch: 12 },  // 대리점
        { wch: 15 },  // POS명
        { wch: 12 },  // 재고배정
        { wch: 12 },  // 개통완료
        { wch: 20 },  // 사이트메모
        { wch: 20 },  // 마당메모
        { wch: 10 }   // 접수자
      ];
      ws['!cols'] = colWidths;

      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(wb, ws, '전체고객리스트');

      // 파일명 생성
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fileName = `전체고객리스트_${timestamp}.xlsx`;

      // 엑셀 파일 다운로드
      XLSX.writeFile(wb, fileName);

      setError('');
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
      setError('엑셀 파일 다운로드에 실패했습니다.');
    } finally {
      setDownloadingExcel(false);
    }
  }, [filteredCustomerList]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadAllCustomerList();
    loadAssignmentStatus();
  }, [loadAllCustomerList, loadAssignmentStatus]);

  // 캐시 통계 주기적 업데이트
  useEffect(() => {
    updateCacheStats();
    const interval = setInterval(updateCacheStats, 10000); // 10초마다 업데이트
    return () => clearInterval(interval);
  }, [updateCacheStats]);

  // 메모이제이션된 통계 정보
  const statsInfo = useMemo(() => {
    if (!cacheStats) return null;
    
    // 재고배정 상태 통계 계산
    const assignmentStats = Object.values(assignmentStatus).reduce((acc, status) => {
      if (status.assignmentStatus === '배정완료') acc.assigned++;
      else if (status.assignmentStatus.startsWith('미배정')) acc.unassigned++;
      
      if (status.activationStatus === '개통완료') acc.activated++;
      else if (status.activationStatus === '미개통') acc.notActivated++;
      
      return acc;
    }, { assigned: 0, unassigned: 0, activated: 0, notActivated: 0 });
    
    return {
      totalCustomers: customerList.length,
      filteredCustomers: filteredCustomerList.length,
      cacheSize: cacheStats.size,
      maxCacheSize: cacheStats.maxSize,
      cacheHitRate: cacheStats.size > 0 ? '활성' : '비활성',
      assignmentStats
    };
  }, [cacheStats, customerList.length, filteredCustomerList.length, assignmentStatus]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#ff9a9e' }}>
            전체고객리스트
          </Typography>
          
          {/* 캐시 상태 표시 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {statsInfo && (
              <Chip
                icon={<CachedIcon />}
                label={`캐시: ${statsInfo.cacheHitRate} (${statsInfo.cacheSize}/${statsInfo.maxCacheSize})`}
                color={statsInfo.cacheSize > 0 ? 'success' : 'default'}
                size="small"
              />
            )}
            <Tooltip title="캐시 새로고침">
              <IconButton onClick={refreshCache} disabled={loading} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        <Typography variant="body1" color="text.secondary">
          전체 고객 정보를 확인하고 검색할 수 있습니다 (모델/용량/색상)
        </Typography>
        
        {/* 통계 정보 */}
        {statsInfo && (
          <Box sx={{ mt: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              label={`전체: ${statsInfo.totalCustomers}명`} 
              variant="outlined" 
              size="small" 
            />
            <Chip 
              label={`검색결과: ${statsInfo.filteredCustomers}명`} 
              variant="outlined" 
              size="small" 
              color={statsInfo.filteredCustomers !== statsInfo.totalCustomers ? 'primary' : 'default'}
            />
            <Chip 
              label={`재고배정: ${statsInfo.assignmentStats.assigned}완료/${statsInfo.assignmentStats.unassigned}미배정`} 
              variant="outlined" 
              size="small" 
              color="success"
            />
            <Chip 
              label={`개통완료: ${statsInfo.assignmentStats.activated}완료/${statsInfo.assignmentStats.notActivated}미개통`} 
              variant="outlined" 
              size="small" 
              color="info"
            />
          </Box>
        )}
      </Box>

      {/* 검색 및 액션 버튼 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 검색창 */}
            <TextField
              placeholder="고객명, 예약번호, 모델/용량/색상, 대리점 등으로 검색..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton onClick={clearSearch} size="small">
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {/* 새로고침 버튼 */}
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadAllCustomerList}
              disabled={loading}
            >
              {loading ? <CircularProgress size={16} /> : '새로고침'}
            </Button>

            {/* 엑셀 다운로드 버튼 */}
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={downloadExcel}
              disabled={downloadingExcel || filteredCustomerList.length === 0}
              sx={{ 
                backgroundColor: '#ff9a9e',
                '&:hover': { backgroundColor: '#ff8a8e' }
              }}
            >
              {downloadingExcel ? <CircularProgress size={16} /> : '엑셀 다운로드'}
            </Button>
          </Box>

          {/* 검색 결과 정보 */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              총 {customerList.length}명의 고객 중 {filteredCustomerList.length}명 표시
            </Typography>
            {searchQuery && (
              <Chip
                label={`검색어: "${searchQuery}"`}
                size="small"
                onDelete={clearSearch}
                color="primary"
              />
            )}
          </Box>
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 고객리스트 테이블 */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
            고객 리스트 ({filteredCustomerList.length}명) - 모델/용량/색상
          </Typography>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredCustomerList.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width="60px" align="center">순번</TableCell>
                    <TableCell width="120px">고객명</TableCell>
                    <TableCell width="100px">예약번호</TableCell>
                    <TableCell width="120px">사이트예약</TableCell>
                    <TableCell width="120px">마당접수일</TableCell>
                    <TableCell width="120px">온세일접수일</TableCell>
                    <TableCell width="150px">모델/용량/색상</TableCell>
                    <TableCell width="80px">유형</TableCell>
                    <TableCell width="100px">대리점</TableCell>
                    <TableCell width="100px">POS명</TableCell>
                    <TableCell width="100px" align="center">재고배정</TableCell>
                    <TableCell width="100px" align="center">개통완료</TableCell>
                    <TableCell width="200px">사이트메모</TableCell>
                    <TableCell width="200px">마당메모</TableCell>
                    <TableCell width="80px">접수자</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCustomerList.map((customer, index) => (
                    <TableRow key={`${customer.reservationNumber}-${index}`} hover>
                      <TableCell align="center">
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {index + 1}
                        </Typography>
                      </TableCell>
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
                          {customer.yardReceivedDate || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {customer.onSaleReceivedDate || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={customer.modelCapacityColor || '-'}
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
                      <TableCell align="center">
                        {loadingAssignment ? (
                          <CircularProgress size={16} />
                        ) : (
                          (() => {
                            const status = assignmentStatus[customer.reservationNumber];
                            if (!status) return '-';
                            
                            const isAssigned = status.assignmentStatus === '배정완료';
                            const isWaiting = status.assignmentStatus.startsWith('미배정');
                            
                            return (
                              <Chip
                                label={status.assignmentStatus}
                                size="small"
                                color={isAssigned ? 'success' : isWaiting ? 'warning' : 'default'}
                                sx={{
                                  fontSize: '0.7rem',
                                  backgroundColor: isAssigned ? '#4caf50' : isWaiting ? '#ff9800' : '#f5f5f5',
                                  color: isAssigned || isWaiting ? 'white' : 'black',
                                  fontWeight: 'bold'
                                }}
                              />
                            );
                          })()
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {loadingAssignment ? (
                          <CircularProgress size={16} />
                        ) : (
                          (() => {
                            const status = assignmentStatus[customer.reservationNumber];
                            if (!status) return '-';
                            
                            const isActivated = status.activationStatus === '개통완료';
                            
                            return (
                              <Chip
                                label={status.activationStatus}
                                size="small"
                                color={isActivated ? 'success' : 'default'}
                                sx={{
                                  fontSize: '0.7rem',
                                  backgroundColor: isActivated ? '#2196f3' : '#f5f5f5',
                                  color: isActivated ? 'white' : 'black',
                                  fontWeight: 'bold'
                                }}
                              />
                            );
                          })()
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {customer.reservationMemo || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {customer.yardReceivedMemo || '-'}
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
          ) : (
            <Alert severity="info">
              {searchQuery ? '검색 결과가 없습니다.' : '고객 리스트 데이터가 없습니다. 새로고침 버튼을 클릭하여 데이터를 로드해주세요.'}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}

export default AllCustomerListScreen; 