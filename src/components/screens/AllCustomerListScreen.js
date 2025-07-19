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
  Badge,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Cached as CachedIcon,
  FilterList as FilterIcon
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
  const [assignmentFilter, setAssignmentFilter] = useState('all'); // 'all', 'assigned', 'unassigned'
  const [activationFilter, setActivationFilter] = useState('all'); // 'all', 'activated', 'notActivated'
  const [activationData, setActivationData] = useState({});
  const [loadingActivation, setLoadingActivation] = useState(false);

  // 전체 고객리스트 로드 (캐시 적용)
  const loadAllCustomerList = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🔍 [전체고객리스트 디버깅] 고객리스트 로드 시작');
      const result = await getCachedAllCustomerList(process.env.REACT_APP_API_URL);
      
      if (result.success) {
        console.log('✅ [전체고객리스트 디버깅] 고객리스트 로드 성공');
        console.log(`  - 로드된 고객 수: ${result.data.length}명`);
        console.log(`  - 첫 번째 고객 예약번호: ${result.data[0]?.reservationNumber || '없음'}`);
        console.log(`  - 마지막 고객 예약번호: ${result.data[result.data.length - 1]?.reservationNumber || '없음'}`);
        
        setCustomerList(result.data);
        setFilteredCustomerList(result.data);
      } else {
        throw new Error(result.message || '전체 고객 리스트 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ [전체고객리스트 디버깅] 고객리스트 로드 오류:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 필터링 및 검색 적용
  const applyFilters = useCallback(() => {
    let filtered = customerList;

    // 검색 필터 적용
    if (searchQuery.trim()) {
      filtered = getCachedSearchResults(searchQuery, filtered);
    }

    // 재고배정 상태 필터 적용
    if (assignmentFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const status = assignmentStatus[customer.reservationNumber];
        if (!status) return false;
        
        if (assignmentFilter === 'assigned') {
          return status.assignmentStatus === '배정완료';
        } else if (assignmentFilter === 'unassigned') {
          return status.assignmentStatus.startsWith('미배정');
        }
        return true;
      });
    }

    // 개통완료 상태 필터 적용
    if (activationFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const status = assignmentStatus[customer.reservationNumber];
        if (!status) return false;
        
        if (activationFilter === 'activated') {
          return status.activationStatus === '개통완료';
        } else if (activationFilter === 'notActivated') {
          return status.activationStatus === '미개통';
        }
        return true;
      });
    }

    setFilteredCustomerList(filtered);
  }, [customerList, searchQuery, assignmentFilter, activationFilter, assignmentStatus]);

  // 검색 기능 (캐시 적용)
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  // 검색 초기화
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // 모든 필터 초기화
  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setAssignmentFilter('all');
    setActivationFilter('all');
  }, []);

  // 캐시 새로고침
  const refreshCache = useCallback(async () => {
    console.log('🔄 [전체고객리스트 디버깅] 캐시 새로고침 시작');
    clearAllCustomerCache();
    await loadAllCustomerList();
    
    // 재고배정 상태도 함께 로드
    try {
      setLoadingAssignment(true);
      console.log('🔍 [재고배정 디버깅] API 요청 시작');
      console.log(`  - API URL: ${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/assignment-status`);
      
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/assignment-status`);
      
      console.log('📡 [재고배정 디버깅] API 응답 상태:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('📊 [재고배정 디버깅] API 응답 데이터:', result);
        
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
          
          // 핵심 디버깅: 데이터 매핑 상태 확인
          console.log('🔍 [재고배정 디버깅] 데이터 매핑 상태:');
          console.log(`  - 고객리스트: ${customerList.length}개`);
          console.log(`  - 배정상태 데이터: ${Object.keys(statusMap).length}개`);
          console.log(`  - 매핑 성공률: ${((Object.keys(statusMap).length / customerList.length) * 100).toFixed(1)}%`);
          
          // 테스트용 디버깅: 일련번호 1005552 관련 고객 확인
          const testCustomer = customerList.find(c => {
            const status = statusMap[c.reservationNumber];
            return status && status.assignedSerialNumber === '1005552';
          });
          
          if (testCustomer) {
            const testStatus = statusMap[testCustomer.reservationNumber];
            console.log(`🎯 [전체고객리스트 디버깅] 테스트 고객 발견:`, {
              reservationNumber: testCustomer.reservationNumber,
              customerName: testCustomer.customerName,
              assignedSerialNumber: testStatus.assignedSerialNumber,
              assignmentStatus: testStatus.assignmentStatus,
              activationStatus: testStatus.activationStatus
            });
          } else {
            console.log(`❌ [전체고객리스트 디버깅] 일련번호 1005552가 배정된 고객을 찾을 수 없음`);
          }
          
          // 상세 매핑 분석
          const customerReservationNumbers = customerList.map(c => c.reservationNumber).filter(Boolean);
          const statusReservationNumbers = Object.keys(statusMap);
          
          console.log('📋 [재고배정 디버깅] 예약번호 매핑 분석:');
          console.log(`  - 고객리스트 예약번호 샘플 (처음 5개):`, customerReservationNumbers.slice(0, 5));
          console.log(`  - 배정상태 예약번호 샘플 (처음 5개):`, statusReservationNumbers.slice(0, 5));
          
          // 매칭되지 않는 예약번호 찾기
          const unmatchedCustomers = customerReservationNumbers.filter(
            num => !statusReservationNumbers.includes(num)
          );
          console.log(`  - 매칭되지 않는 고객 수: ${unmatchedCustomers.length}개`);
          if (unmatchedCustomers.length > 0) {
            console.log(`  - 매칭되지 않는 예약번호 샘플:`, unmatchedCustomers.slice(0, 10));
          }
          
          // 배정상태 통계
          const assignmentStats = {
            배정완료: 0,
            미배정: 0,
            개통완료: 0,
            미개통: 0
          };
          
          Object.values(statusMap).forEach(status => {
            if (status.assignmentStatus === '배정완료') assignmentStats.배정완료++;
            else if (status.assignmentStatus.startsWith('미배정')) assignmentStats.미배정++;
            
            if (status.activationStatus === '개통완료') assignmentStats.개통완료++;
            else if (status.activationStatus === '미개통') assignmentStats.미개통++;
          });
          
          console.log('📈 [재고배정 디버깅] 배정상태 통계:', assignmentStats);
          
        } else {
          console.error('❌ [재고배정 디버깅] API 응답 실패:', result);
        }
      } else {
        console.error('❌ [재고배정 디버깅] API 요청 실패:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ [재고배정 디버깅] API 오류 상세:', errorText);
      }
    } catch (error) {
      console.error('❌ [재고배정 디버깅] 로드 오류:', error);
      console.error('❌ [재고배정 디버깅] 오류 스택:', error.stack);
    } finally {
      setLoadingAssignment(false);
    }
  }, [loadAllCustomerList, customerList.length]);



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
    
    // 재고배정 상태도 함께 로드
    const loadAssignmentStatus = async () => {
      try {
        setLoadingAssignment(true);
        console.log('🔍 [재고배정 디버깅] useEffect에서 배정상태 로드 시작');
        console.log(`  - 현재 고객리스트 길이: ${customerList.length}`);
        
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/assignment-status`);
        
        console.log('📡 [재고배정 디버깅] useEffect API 응답 상태:', response.status, response.statusText);
        
        if (response.ok) {
          const result = await response.json();
          console.log('📊 [재고배정 디버깅] useEffect API 응답 데이터:', result);
          
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
            
            // 핵심 디버깅: 데이터 매핑 상태 확인
            console.log('🔍 [재고배정 디버깅] useEffect 데이터 매핑 상태:');
            console.log(`  - 고객리스트: ${customerList.length}개`);
            console.log(`  - 배정상태 데이터: ${Object.keys(statusMap).length}개`);
            console.log(`  - 매핑 성공률: ${((Object.keys(statusMap).length / customerList.length) * 100).toFixed(1)}%`);
            
            // 상세 매핑 분석
            const customerReservationNumbers = customerList.map(c => c.reservationNumber).filter(Boolean);
            const statusReservationNumbers = Object.keys(statusMap);
            
            console.log('📋 [재고배정 디버깅] useEffect 예약번호 매핑 분석:');
            console.log(`  - 고객리스트 예약번호 샘플 (처음 5개):`, customerReservationNumbers.slice(0, 5));
            console.log(`  - 배정상태 예약번호 샘플 (처음 5개):`, statusReservationNumbers.slice(0, 5));
            
            // 매칭되지 않는 예약번호 찾기
            const unmatchedCustomers = customerReservationNumbers.filter(
              num => !statusReservationNumbers.includes(num)
            );
            console.log(`  - 매칭되지 않는 고객 수: ${unmatchedCustomers.length}개`);
            if (unmatchedCustomers.length > 0) {
              console.log(`  - 매칭되지 않는 예약번호 샘플:`, unmatchedCustomers.slice(0, 10));
            }
            
            // 배정완료된 고객들이 있으면 자동으로 저장 API 호출
            const completedAssignments = result.data.filter(item => 
              item.assignmentStatus === '배정완료' && item.assignedSerialNumber
            );
            
            if (completedAssignments.length > 0) {
              console.log('💾 [전체고객리스트 디버깅] 배정완료 고객 발견, 자동 저장 시작:', completedAssignments.length, '개');
              
              const assignments = completedAssignments.map(item => ({
                reservationNumber: item.reservationNumber,
                assignedSerialNumber: item.assignedSerialNumber
              }));
              
              try {
                const saveResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/save-assignment`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ assignments })
                });
                
                if (saveResponse.ok) {
                  const saveResult = await saveResponse.json();
                  console.log('✅ [전체고객리스트 디버깅] 자동 저장 완료:', saveResult.updated, '개 저장,', saveResult.skipped, '개 유지');
                } else {
                  console.error('❌ [전체고객리스트 디버깅] 자동 저장 실패:', saveResponse.status);
                }
              } catch (saveError) {
                console.error('❌ [전체고객리스트 디버깅] 자동 저장 오류:', saveError);
              }
            }
            
          } else {
            console.error('❌ [재고배정 디버깅] useEffect API 응답 실패:', result);
          }
        } else {
          console.error('❌ [재고배정 디버깅] useEffect API 요청 실패:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('❌ [재고배정 디버깅] useEffect API 오류 상세:', errorText);
        }
      } catch (error) {
        console.error('❌ [재고배정 디버깅] useEffect 로드 오류:', error);
        console.error('❌ [재고배정 디버깅] useEffect 오류 스택:', error.stack);
      } finally {
        setLoadingAssignment(false);
      }
    };
    
    if (customerList.length > 0) {
      loadAssignmentStatus();
      
      // 개통 상태도 함께 로드
      const loadActivationStatus = async () => {
        try {
          setLoadingActivation(true);
          console.log('📱 [개통상태 디버깅] 개통 상태 로드 시작');
          
          const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/inventory/activation-status`);
          
          if (response.ok) {
            const result = await response.json();
            console.log('📊 [개통상태 디버깅] 개통 상태 응답:', result);
            
            if (result.success) {
              // 예약번호를 키로 하는 맵 생성
              const activationMap = {};
              result.data.forEach(item => {
                activationMap[item.reservationNumber] = {
                  activationStatus: item.activationStatus,
                  assignedSerialNumber: item.assignedSerialNumber
                };
              });
              
              setActivationData(activationMap);
              console.log(`✅ [개통상태 디버깅] 개통 상태 로드 완료: ${Object.keys(activationMap).length}개`);
              
              // 테스트용 디버깅: 일련번호 1005552 관련 개통 상태 확인
              const testActivation = result.data.find(item => item.assignedSerialNumber === '1005552');
              if (testActivation) {
                console.log(`🎯 [개통상태 디버깅] 테스트 일련번호 개통 상태:`, {
                  reservationNumber: testActivation.reservationNumber,
                  customerName: testActivation.customerName,
                  assignedSerialNumber: testActivation.assignedSerialNumber,
                  activationStatus: testActivation.activationStatus
                });
              } else {
                console.log(`❌ [개통상태 디버깅] 일련번호 1005552의 개통 상태를 찾을 수 없음`);
              }
            }
          }
        } catch (error) {
          console.error('❌ [개통상태 디버깅] 개통 상태 로드 오류:', error);
        } finally {
          setLoadingActivation(false);
        }
      };
      
      loadActivationStatus();
    } else {
      console.log('⚠️ [재고배정 디버깅] 고객리스트가 비어있어 배정상태 로드를 건너뜀');
    }
  }, [customerList.length]);

  // 필터 변경 시 적용
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

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

          {/* 필터 UI */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                필터:
              </Typography>
            </Box>
            
            {/* 재고배정 상태 필터 */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>재고배정</InputLabel>
              <Select
                value={assignmentFilter}
                label="재고배정"
                onChange={(e) => setAssignmentFilter(e.target.value)}
              >
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="assigned">배정완료</MenuItem>
                <MenuItem value="unassigned">미배정</MenuItem>
              </Select>
            </FormControl>

            {/* 개통완료 상태 필터 */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>개통완료</InputLabel>
              <Select
                value={activationFilter}
                label="개통완료"
                onChange={(e) => setActivationFilter(e.target.value)}
              >
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="activated">개통완료</MenuItem>
                <MenuItem value="notActivated">미개통</MenuItem>
              </Select>
            </FormControl>

            {/* 필터 초기화 버튼 */}
            {(assignmentFilter !== 'all' || activationFilter !== 'all' || searchQuery) && (
              <Button
                variant="outlined"
                size="small"
                onClick={clearAllFilters}
                startIcon={<ClearIcon />}
              >
                필터 초기화
              </Button>
            )}
          </Box>

          {/* 검색 결과 정보 */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
            {assignmentFilter !== 'all' && (
              <Chip
                label={`재고배정: ${assignmentFilter === 'assigned' ? '배정완료' : '미배정'}`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {activationFilter !== 'all' && (
              <Chip
                label={`개통완료: ${activationFilter === 'activated' ? '개통완료' : '미개통'}`}
                size="small"
                color="info"
                variant="outlined"
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
                            
                            // 디버깅: 개별 고객의 배정상태 확인
                            if (index < 5) { // 처음 5개만 로그 출력
                              console.log(`🔍 [테이블 디버깅] 고객 ${index + 1}:`, {
                                reservationNumber: customer.reservationNumber,
                                customerName: customer.customerName,
                                status: status,
                                hasStatus: !!status
                              });
                            }
                            
                            if (!status) {
                              return '-';
                            }
                            
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
                            
                            // 디버깅: 개별 고객의 개통상태 확인
                            if (index < 5) { // 처음 5개만 로그 출력
                              console.log(`🔍 [테이블 디버깅] 고객 ${index + 1} 개통상태:`, {
                                reservationNumber: customer.reservationNumber,
                                activationStatus: status?.activationStatus || '없음',
                                hasStatus: !!status
                              });
                            }
                            
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