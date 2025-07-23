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
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Cached as CachedIcon,
  FilterList as FilterIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { FixedSizeList as List } from 'react-window';
import { 
  getCachedAllCustomerList, 
  getCachedSearchResults, 
  clearAllCustomerCache, 
  getAllCustomerCacheStats 
} from '../../utils/allCustomerCache';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// API URL 헬퍼 함수
function getApiUrl() {
  const url = process.env.REACT_APP_API_URL;
  if (!url) {
    throw new Error('REACT_APP_API_URL 환경변수가 설정되어 있지 않습니다.');
  }
  return url;
}

// 디바운스 훅
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// 가상화된 테이블 행 컴포넌트
const VirtualizedTableRow = React.memo(({ index, style, data }) => {
  const { 
    filteredCustomerList, 
    assignmentStatus, 
    loadingAssignment, 
    cancelCheckedItems, 
    onCancelCheckToggle,
    processingCancelCheck,
    loadingCancelData
  } = data;
  const customer = filteredCustomerList[index];

  if (!customer) return null;

  // 배경색 결정
  let rowBg = undefined;
  const status = assignmentStatus[customer.reservationNumber];
  const isCancelChecked = cancelCheckedItems.includes(customer.reservationNumber);
  
  if (isCancelChecked) {
    rowBg = '#ffebee'; // 붉은색 계열 (취소 체크된 경우)
  } else if (status) {
    if (status.activationStatus === '개통완료') {
      rowBg = '#e3f2fd'; // 파란색 계열
    } else if (status.assignmentStatus === '배정완료') {
      rowBg = '#e8f5e9'; // 초록색 계열
    }
  }

  return (
    <Box 
      style={style} 
      sx={{ 
        display: 'flex',
        borderBottom: '1px solid #e9ecef',
        backgroundColor: rowBg,
        '&:hover': {
          backgroundColor: rowBg ? rowBg : '#f8f9fa'
        },
        '&:nth-of-type(even)': {
          backgroundColor: rowBg ? rowBg : '#fafbfc'
        }
      }}
    >
      <Box sx={{ width: '60px', p: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" sx={{ 
          fontSize: '0.85rem', 
          fontWeight: 600, 
          color: '#1976d2',
          backgroundColor: '#e3f2fd',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          display: 'inline-block',
          minWidth: '24px',
          textAlign: 'center'
        }}>
          {index + 1}
        </Typography>
      </Box>
      <Box sx={{ width: '120px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ 
          fontWeight: 600, 
          color: '#2c3e50',
          fontSize: '0.85rem'
        }}>
          {customer.customerName}
        </Typography>
      </Box>
      <Box sx={{ width: '100px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ 
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          color: '#6c757d',
          backgroundColor: '#f8f9fa',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          display: 'inline-block'
        }}>
          {customer.reservationNumber}
        </Typography>
      </Box>
      <Box sx={{ width: '120px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {customer.reservationDateTime}
        </Typography>
      </Box>
      <Box sx={{ width: '120px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {customer.yardReceivedDate || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '120px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {customer.onSaleReceivedDate || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '150px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Chip
          label={customer.modelCapacityColor || '-'}
          color="primary"
          size="small"
          sx={{ 
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor: '#3f51b5',
            color: 'white',
            '&:hover': {
              backgroundColor: '#303f9f'
            },
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
      </Box>
      <Box sx={{ width: '80px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ 
          fontSize: '0.8rem',
          color: '#6c757d',
          fontStyle: 'italic'
        }}>
          {customer.type || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '100px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ 
          fontSize: '0.8rem',
          fontWeight: 500,
          color: '#495057',
          backgroundColor: '#e9ecef',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          display: 'inline-block'
        }}>
          {customer.storeCode || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '100px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ 
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#28a745',
          backgroundColor: '#d4edda',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          display: 'inline-block'
        }}>
          {customer.manager || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '100px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {customer.posName || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '100px', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loadingAssignment ? (
          <CircularProgress size={16} />
        ) : (
          (() => {
            const status = assignmentStatus[customer.reservationNumber];
            
            if (!status) {
              return '-';
            }
            
            // 개통완료 상태가 있으면 우선 표시
            if (status.activationStatus === '개통완료') {
              return (
                <Chip
                  label="개통완료"
                  size="small"
                  color="success"
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: '#2196f3',
                    color: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    '&:hover': {
                      backgroundColor: '#1976d2'
                    }
                  }}
                />
              );
            }
            
            // 개통완료가 아니면 기존 배정 상태 표시
            const isAssigned = status.assignmentStatus === '배정완료';
            const isWaiting = status.assignmentStatus.startsWith('미배정');
            
            return (
              <Chip
                label={status.assignmentStatus}
                size="small"
                color={isAssigned ? 'success' : isWaiting ? 'warning' : 'default'}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isAssigned ? '#4caf50' : isWaiting ? '#ff9800' : '#f5f5f5',
                  color: isAssigned || isWaiting ? 'white' : '#6c757d',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  '&:hover': {
                    backgroundColor: isAssigned ? '#45a049' : isWaiting ? '#e68900' : '#e9ecef'
                  }
                }}
              />
            );
          })()
        )}
      </Box>
      <Box sx={{ width: '100px', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: isActivated ? '#2196f3' : '#f5f5f5',
                  color: isActivated ? 'white' : '#6c757d',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  '&:hover': {
                    backgroundColor: isActivated ? '#1976d2' : '#e9ecef'
                  }
                }}
              />
            );
          })()
        )}
      </Box>
      <Box sx={{ width: '200px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {customer.reservationMemo || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '200px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {customer.yardReceivedMemo || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '80px', p: 1, display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {customer.receiver || '-'}
        </Typography>
      </Box>
      <Box sx={{ width: '60px', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {processingCancelCheck.has(customer.reservationNumber) ? (
          <CircularProgress size={16} />
        ) : (
          <IconButton
            size="small"
            onClick={() => onCancelCheckToggle(customer.reservationNumber)}
            disabled={loadingCancelData} // 데이터 로딩 중에는 비활성화
            sx={{
              color: isCancelChecked ? '#d32f2f' : '#757575',
              opacity: loadingCancelData ? 0.5 : 1,
              '&:hover': {
                backgroundColor: isCancelChecked ? '#ffcdd2' : '#f5f5f5'
              },
              '&:disabled': {
                opacity: 0.5,
                cursor: 'not-allowed'
              }
            }}
          >
            {isCancelChecked ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
          </IconButton>
        )}
      </Box>
    </Box>
  );
});

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
  const [inventoryStatus, setInventoryStatus] = useState({});
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [receptionFilter, setReceptionFilter] = useState('all'); // 'all', 'yard', 'onsale', 'both', 'either'
  const [yardDateFilter, setYardDateFilter] = useState('');
  const [onsaleDateFilter, setOnsaleDateFilter] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all'); // 'all' 또는 사무실명
  const [departmentFilter, setDepartmentFilter] = useState('all'); // 'all' 또는 소속명
  const [agentOfficeData, setAgentOfficeData] = useState({ offices: [], departments: {}, agentInfo: {} });
  const [loadingAgentData, setLoadingAgentData] = useState(false);
  const [expandedColors, setExpandedColors] = useState({}); // 색상 확장 상태 관리
  const [expandedModels, setExpandedModels] = useState({}); // 모델 확장 상태 관리
  const [inventoryExpanded, setInventoryExpanded] = useState(false);
  
  // 미매칭건 확인 관련 상태
  const [showUnmatchedDialog, setShowUnmatchedDialog] = useState(false);
  const [unmatchedData, setUnmatchedData] = useState({ yard: [], onSale: [], mobile: [] });
  const [loadingUnmatched, setLoadingUnmatched] = useState(false);
  const [unmatchedTab, setUnmatchedTab] = useState(0);
  
  // 취소 체크 관련 상태
  const [cancelCheckedItems, setCancelCheckedItems] = useState([]);
  const [loadingCancelData, setLoadingCancelData] = useState(false);
  const [processingCancelCheck, setProcessingCancelCheck] = useState(new Set());

  // 디바운스된 검색어 (300ms 지연)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // 대리점아이디관리 데이터 로드
  const loadAgentOfficeData = useCallback(async () => {
    setLoadingAgentData(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/agent-office-department`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAgentOfficeData(result.data);
        }
      } else {
        setAgentOfficeData({ offices: [], departments: {}, agentInfo: {} });
      }
    } catch (error) {
      setAgentOfficeData({ offices: [], departments: {}, agentInfo: {} });
    } finally {
      setLoadingAgentData(false);
    }
  }, []);

  // 전체 고객리스트 로드 (캐시 적용)
  const loadAllCustomerList = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getCachedAllCustomerList(getApiUrl());
      
      if (result.success) {
        setCustomerList(result.data);
        setFilteredCustomerList(result.data);
      } else {
        throw new Error(result.message || '전체 고객 리스트 로드에 실패했습니다.');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 필터링 및 검색 적용 (최적화)
  const applyFilters = useCallback(() => {
    let filtered = customerList;

    // 검색 필터 적용 (디바운스된 검색어 사용)
    if (debouncedSearchQuery.trim()) {
      filtered = getCachedSearchResults(debouncedSearchQuery, filtered);
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

    // 접수 상태 필터 적용
    if (receptionFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const yardReceived = customer.yardReceivedDate && customer.yardReceivedDate.trim() !== '';
        const onSaleReceived = customer.onSaleReceivedDate && customer.onSaleReceivedDate.trim() !== '';
        
        if (receptionFilter === 'yard') {
          return yardReceived && !onSaleReceived;
        } else if (receptionFilter === 'onsale') {
          return onSaleReceived && !yardReceived;
        } else if (receptionFilter === 'both') {
          return yardReceived && onSaleReceived;
        } else if (receptionFilter === 'either') {
          return (yardReceived && !onSaleReceived) || (onSaleReceived && !yardReceived);
        }
        return true;
      });
    }

    // 마당접수일 필터 적용
    if (yardDateFilter.trim()) {
      filtered = filtered.filter(customer => {
        if (!customer.yardReceivedDate) return false;
        return customer.yardReceivedDate.includes(yardDateFilter);
      });
    }

    // 온세일접수일 필터 적용
    if (onsaleDateFilter.trim()) {
      filtered = filtered.filter(customer => {
        if (!customer.onSaleReceivedDate) return false;
        return customer.onSaleReceivedDate.includes(onsaleDateFilter);
      });
    }

    // 사무실별 필터 적용
    if (officeFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const agentInfo = agentOfficeData.agentInfo[customer.manager];
        return agentInfo && agentInfo.office === officeFilter;
      });
    }

    // 소속별 필터 적용
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(customer => {
        const agentInfo = agentOfficeData.agentInfo[customer.manager];
        return agentInfo && agentInfo.department === departmentFilter;
      });
    }

    setFilteredCustomerList(filtered);
  }, [customerList, debouncedSearchQuery, assignmentFilter, activationFilter, receptionFilter, yardDateFilter, onsaleDateFilter, officeFilter, departmentFilter, agentOfficeData]);

  // 검색 기능 (최적화)
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
    setReceptionFilter('all');
    setYardDateFilter('');
    setOnsaleDateFilter('');
    setOfficeFilter('all');
    setDepartmentFilter('all');
  }, []);

  // 캐시 새로고침
  const refreshCache = useCallback(async () => {
    clearAllCustomerCache();
    await loadAllCustomerList();
    
    // 재고배정 상태도 함께 로드
    try {
      setLoadingAssignment(true);
      const response = await fetch(`${getApiUrl()}/api/inventory/assignment-status`);
      
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
  }, [loadAllCustomerList]);

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
      // XLSX 라이브러리 동적 import (에러 처리 강화)
      let XLSX;
      try {
        XLSX = await import('xlsx');
      } catch (importError) {
        console.error('XLSX 라이브러리 로드 실패:', importError);
        throw new Error('엑셀 라이브러리를 불러올 수 없습니다.');
      }
      
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
        '접수자',
        '취소체크'
      ];

      // 데이터 준비
      const excelData = filteredCustomerList.map((customer, index) => {
        const status = assignmentStatus[customer.reservationNumber];
        const isCancelChecked = cancelCheckedItems.includes(customer.reservationNumber);
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
          customer.receiver || '',
          isCancelChecked ? '체크됨' : ''
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
        { wch: 10 },  // 접수자
        { wch: 10 }   // 취소체크
      ];
      ws['!cols'] = colWidths;

      // 워크시트를 워크북에 추가
      XLSX.utils.book_append_sheet(wb, ws, '사전예약고객리스트');

      // 파일명 생성
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const fileName = `사전예약고객리스트_${timestamp}.xlsx`;

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

  // 재고배정 상태 로드 함수 (최적화)
  const loadAssignmentStatus = useCallback(async () => {
    try {
      setLoadingAssignment(true);
      const response = await fetch(`${getApiUrl()}/api/inventory/assignment-status`);
      
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

  // 개통 상태 로드 함수 (최적화)
  const loadActivationStatus = useCallback(async () => {
    try {
      setLoadingActivation(true);
      const response = await fetch(`${getApiUrl()}/api/inventory/activation-status`);
      
      if (response.ok) {
        const result = await response.json();
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
        }
      }
    } catch (error) {
      console.error('개통 상태 로드 오류:', error);
    } finally {
      setLoadingActivation(false);
    }
  }, []);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([
          loadAllCustomerList(),
          loadAgentOfficeData(),
          loadAssignmentStatus(),
          loadActivationStatus(),
          loadCancelCheckData()
        ]);
      } catch (error) {
        setError('데이터 로드 중 오류가 발생했습니다.');
      }
    };
    
    initializeData();
  }, [loadAllCustomerList, loadAgentOfficeData, loadAssignmentStatus, loadActivationStatus]);

  // 필터 변경 시 적용 (디바운스된 검색어 사용)
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // assignmentStatus 변경 시 필터 재적용
  useEffect(() => {
    if (Object.keys(assignmentStatus).length > 0) {
      applyFilters();
    }
  }, [assignmentStatus, applyFilters]);

  // 캐시 통계 주기적 업데이트
  useEffect(() => {
    updateCacheStats();
    const interval = setInterval(updateCacheStats, 10000); // 10초마다 업데이트
    return () => clearInterval(interval);
  }, [updateCacheStats]);

  // 사무실별 재고 현황 로드 (마운트 시 자동)
  const loadInventoryStatus = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/office-inventory`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setInventoryStatus(result);
        }
      }
    } catch (error) {
      console.error('사무실별 재고 현황 로드 오류:', error);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  // 미매칭 데이터 로드
  const loadUnmatchedData = useCallback(async () => {
    setLoadingUnmatched(true);
    try {
      console.log('🔄 [미매칭] 데이터 로드 시작');
      const response = await fetch(`${getApiUrl()}/api/unmatched-customers`);
      console.log('📡 [미매칭] API 응답 상태:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('📊 [미매칭] API 응답 데이터:', result);
        
        if (result.success) {
          setUnmatchedData(result.data);
          console.log(`✅ [미매칭] 데이터 로드 완료:`, {
            yard: result.data.yard?.length || 0,
            onSale: result.data.onSale?.length || 0,
            mobile: result.data.mobile?.length || 0,
            total: (result.data.yard?.length || 0) + (result.data.onSale?.length || 0) + (result.data.mobile?.length || 0)
          });
        } else {
          console.error('❌ [미매칭] API 응답 실패:', result.message);
          setUnmatchedData({ yard: [], onSale: [], mobile: [] });
          setError(`미매칭 데이터 로드 실패: ${result.message}`);
        }
      } else {
        console.error('❌ [미매칭] API 응답 오류:', response.status, response.statusText);
        setUnmatchedData({ yard: [], onSale: [], mobile: [] });
        setError(`미매칭 데이터 로드 실패: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ [미매칭] 데이터 로드 오류:', error);
      setUnmatchedData({ yard: [], onSale: [], mobile: [] });
      setError(`미매칭 데이터 로드 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setLoadingUnmatched(false);
    }
  }, []);

  // 미매칭건 확인 다이얼로그 열기
  const handleShowUnmatched = useCallback(async () => {
    setShowUnmatchedDialog(true);
    await loadUnmatchedData();
  }, [loadUnmatchedData]);

  // 미매칭 데이터 엑셀 다운로드
  const [downloadingUnmatchedExcel, setDownloadingUnmatchedExcel] = useState(false);
  
  const downloadUnmatchedExcel = useCallback(async () => {
    setDownloadingUnmatchedExcel(true);
    try {
      console.log('🔄 [미매칭] 엑셀 다운로드 시작');
      const response = await fetch(`${getApiUrl()}/api/unmatched-customers/excel`);
      console.log('📡 [미매칭] 엑셀 다운로드 응답 상태:', response.status);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `미매칭고객현황_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('✅ [미매칭] 엑셀 다운로드 완료');
      } else {
        console.error('❌ [미매칭] 엑셀 다운로드 실패:', response.status, response.statusText);
        setError('엑셀 파일 다운로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ [미매칭] 엑셀 다운로드 오류:', error);
      setError('엑셀 파일 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingUnmatchedExcel(false);
    }
  }, []);

  // 취소 체크 데이터 로드
  const loadCancelCheckData = async () => {
    setLoadingCancelData(true);
    try {
      console.log('🔄 [취소체크] 데이터 로드 시작');
      const response = await fetch(`${getApiUrl()}/api/cancel-check/list`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setCancelCheckedItems(result.data);
          console.log(`✅ [취소체크] 데이터 로드 완료: ${result.data.length}건`);
        } else {
          console.error('❌ [취소체크] 데이터 로드 실패:', result.message);
          setCancelCheckedItems([]); // 실패 시 빈 배열로 초기화
        }
      } else {
        console.error('❌ [취소체크] API 응답 오류:', response.status);
        setCancelCheckedItems([]); // 오류 시 빈 배열로 초기화
      }
    } catch (error) {
      console.error('❌ [취소체크] 데이터 로드 오류:', error);
      setCancelCheckedItems([]); // 오류 시 빈 배열로 초기화
    } finally {
      setLoadingCancelData(false);
    }
  };

  // 취소 체크 토글 (즉시 저장/삭제)
  const handleCancelCheckToggle = async (reservationNumber) => {
    // 이미 처리 중이면 무시
    if (processingCancelCheck.has(reservationNumber)) {
      return;
    }
    
    setProcessingCancelCheck(prev => new Set(prev).add(reservationNumber));
    
    try {
      const isCurrentlyChecked = cancelCheckedItems.includes(reservationNumber);
      
      if (isCurrentlyChecked) {
        // 체크 해제 - 시트에서 삭제
        const response = await fetch(`${getApiUrl()}/api/cancel-check/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationNumbers: [reservationNumber]
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // 성공 시에만 상태 업데이트
          setCancelCheckedItems(prev => prev.filter(item => item !== reservationNumber));
          setError('');
          console.log(`✅ 취소 체크 해제 완료: ${reservationNumber} (삭제된 건수: ${result.deletedCount})`);
        } else {
          setError(result.message || '취소 체크 해제에 실패했습니다.');
          console.error('❌ 취소 체크 해제 실패:', result.message);
        }
      } else {
        // 체크 - 시트에 저장
        const response = await fetch(`${getApiUrl()}/api/cancel-check/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reservationNumbers: [reservationNumber]
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // 성공 시에만 상태 업데이트
          setCancelCheckedItems(prev => [...prev, reservationNumber]);
          setError('');
          console.log(`✅ 취소 체크 저장 완료: ${reservationNumber}`);
        } else {
          setError(result.message || '취소 체크 저장에 실패했습니다.');
          console.error('❌ 취소 체크 저장 실패:', result.message);
        }
      }
    } catch (error) {
      console.error('❌ 취소 체크 토글 오류:', error);
      setError('취소 체크 처리 중 오류가 발생했습니다.');
    } finally {
      // 처리 중 상태 제거
      setProcessingCancelCheck(prev => {
        const newSet = new Set(prev);
        newSet.delete(reservationNumber);
        return newSet;
      });
    }
  };



  // 사무실별 재고 현황 자동 로드
  useEffect(() => {
    loadInventoryStatus();
  }, [loadInventoryStatus]);

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
  }, [cacheStats, customerList.length, filteredCustomerList.length]);

  return (
    <Container 
      maxWidth={false} 
      sx={{ 
        py: 3,
        px: { xs: 2, sm: 3, md: 4 },
        width: '100%',
        maxWidth: '100%'
      }}
    >
      {/* 헤더 */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#ff9a9e' }}>
            사전예약고객리스트
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
          사전예약 고객 정보를 확인하고 검색할 수 있습니다 (모델/용량/색상)
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
            <Chip 
              label={`취소체크: ${cancelCheckedItems.length}건`} 
              variant="outlined" 
              size="small" 
              color="error"
            />
          </Box>
        )}
      </Box>



      {/* 수동 배정 및 재고 현황 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Button
              variant="text"
              startIcon={inventoryExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setInventoryExpanded((prev) => !prev)}
              sx={{ fontWeight: 'bold', fontSize: '1rem', color: '#ff9a9e' }}
            >
              {inventoryExpanded ? '사무실별 보유재고 접기' : '사무실별 보유재고 보기'}
            </Button>
          </Box>
          {inventoryExpanded && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
                  📱 사무실별 보유재고 현황
                </Typography>
                {inventoryStatus?.lastUpdated && (
                  <Typography variant="caption" color="text.secondary">
                    마지막 업데이트: {new Date(inventoryStatus.lastUpdated).toLocaleString()}
                  </Typography>
                )}
              </Box>
              
              {/* 로딩 상태 */}
              {loadingInventory && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              )}
              
              {/* 에러 상태 */}
              {!loadingInventory && inventoryStatus && !inventoryStatus.success && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  재고 데이터를 불러오는데 실패했습니다. 다시 시도해주세요.
                </Alert>
              )}
              
              {/* 데이터가 있을 때만 표시 */}
              {!loadingInventory && inventoryStatus?.success && inventoryStatus?.officeInventory && (
                <>
                  {/* 전체 통계 */}
              {inventoryStatus.stats && (
                <Box sx={{ mb: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#666' }}>
                    📊 전체 통계 (정규화작업시트 C열 기준)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                    <Chip 
                      label={`총 재고: ${inventoryStatus.stats.totalInventory}대`} 
                      color="primary" 
                      variant="outlined"
                    />
                    <Chip 
                      label={`허용 모델: ${inventoryStatus.stats.allowedModelsCount}종`} 
                      color="info" 
                      variant="outlined"
                    />
                    <Chip 
                      label={`처리: ${inventoryStatus.stats.processedCount}개`} 
                      color="success" 
                      variant="outlined"
                    />
                    {inventoryStatus.stats.filteredCount > 0 && (
                      <Chip 
                        label={`필터링: ${inventoryStatus.stats.filteredCount}개`} 
                        color="warning" 
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {Object.entries(inventoryStatus.stats.officeStats).map(([office, stats]) => (
                      <Chip
                        key={office}
                        label={`${office}: ${stats.totalInventory}대 (${stats.modelCount}종)`}
                        color="secondary"
                        variant="outlined"
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>
              )}
              {/* 사무실별 간결한 재고 현황 */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
                {Object.entries(inventoryStatus.officeInventory).map(([officeName, models]) => {
                  const totalCount = Object.values(models).reduce((sum, count) => sum + count, 0);
                  const modelCount = Object.keys(models).length;
                  return (
                    <Card key={officeName} sx={{ 
                      p: 2, 
                      border: '1px solid #e0e0e0',
                      minHeight: '160px',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        transform: 'translateY(-2px)',
                        transition: 'all 0.2s ease'
                      }
                    }}>
                      {/* 사무실 헤더 */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        mb: 1.5,
                        pb: 1,
                        borderBottom: '2px solid #f0f0f0'
                      }}>
                        <Typography variant="subtitle1" sx={{ 
                          fontWeight: 'bold', 
                          color: '#333',
                          fontSize: '1rem'
                        }}>
                          🏢 {officeName}
                        </Typography>
                        <Chip 
                          label={`${totalCount}대`} 
                          color="primary" 
                          size="small"
                          sx={{ 
                            fontSize: '0.8rem', 
                            height: '24px',
                            fontWeight: 'bold'
                          }}
                        />
                      </Box>
                      {Object.keys(models).length > 0 ? (
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {(() => {
                            // 모델명용량별로 그룹화 및 정렬
                            const groupedModels = {};
                            Object.entries(models).forEach(([model, count]) => {
                              const [modelCapacity, color] = model.split(' | ');
                              if (!groupedModels[modelCapacity]) {
                                groupedModels[modelCapacity] = [];
                              }
                              groupedModels[modelCapacity].push({ color, count });
                            });
                            const sortedModelCapacities = Object.keys(groupedModels).sort();
                            const displayModels = expandedModels[officeName] 
                              ? sortedModelCapacities 
                              : sortedModelCapacities.slice(0, 3);
                            return displayModels.map((modelCapacity) => {
                              const colorItems = groupedModels[modelCapacity];
                              const modelTotal = colorItems.reduce((sum, item) => sum + item.count, 0);
                              return (
                                <Box key={modelCapacity} sx={{ 
                                  border: '1px solid #e8e8e8',
                                  borderRadius: 1.5,
                                  p: 1,
                                  bgcolor: '#fafafa'
                                }}>
                                  <Typography variant="body2" sx={{ 
                                    fontWeight: 'bold',
                                    color: '#555',
                                    fontSize: '0.85rem',
                                    display: 'block',
                                    mb: 0.8
                                  }}>
                                    📱 {modelCapacity}
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {colorItems.slice(0, expandedColors[modelCapacity] ? colorItems.length : 2).map(({ color, count }) => {
                                      const getColorStyle = (colorName) => {
                                        const colorLower = colorName.toLowerCase();
                                        if (colorLower.includes('블랙') || colorLower.includes('제트블랙')) {
                                          return { bg: '#2c2c2c', text: '#ffffff' };
                                        } else if (colorLower.includes('화이트') || colorLower.includes('실버')) {
                                          return { bg: '#f5f5f5', text: '#333333' };
                                        } else if (colorLower.includes('블루')) {
                                          return { bg: '#e3f2fd', text: '#1565c0' };
                                        } else if (colorLower.includes('레드') || colorLower.includes('코랄')) {
                                          return { bg: '#ffebee', text: '#c62828' };
                                        } else if (colorLower.includes('그린')) {
                                          return { bg: '#e8f5e8', text: '#2e7d32' };
                                        } else if (colorLower.includes('골드')) {
                                          return { bg: '#fff8e1', text: '#f57f17' };
                                        } else if (colorLower.includes('퍼플')) {
                                          return { bg: '#f3e5f5', text: '#7b1fa2' };
                                        } else {
                                          return { bg: '#f8f9fa', text: '#495057' };
                                        }
                                      };
                                      const colorStyle = getColorStyle(color);
                                      const isAvailable = count > 0;
                                      return (
                                        <Box key={color} sx={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          p: 0.5,
                                          bgcolor: isAvailable ? colorStyle.bg : '#f8f8f8',
                                          borderRadius: 0.5,
                                          border: `1px solid ${isAvailable ? colorStyle.text + '30' : '#e0e0e0'}`
                                        }}>
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Box sx={{ 
                                              width: 8, 
                                              height: 8, 
                                              borderRadius: '50%',
                                              bgcolor: isAvailable ? colorStyle.text : '#ccc'
                                            }} />
                                            <Typography variant="body2" sx={{ 
                                              fontWeight: 'medium',
                                              color: isAvailable ? colorStyle.text : '#999',
                                              fontSize: '0.75rem'
                                            }}>
                                              {color}
                                            </Typography>
                                          </Box>
                                          <Chip
                                            label={`${count}대`}
                                            size="small"
                                            sx={{
                                              bgcolor: isAvailable ? colorStyle.text : '#ccc',
                                              color: isAvailable ? colorStyle.bg : '#fff',
                                              fontSize: '0.7rem',
                                              height: '20px',
                                              fontWeight: 'bold'
                                            }}
                                          />
                                        </Box>
                                      );
                                    })}
                                    {colorItems.length > 2 && (
                                      <Button
                                        variant="text"
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation(); // 부모 카드의 클릭 이벤트 방지
                                          setExpandedColors(prev => ({
                                            ...prev,
                                            [modelCapacity]: !prev[modelCapacity]
                                          }));
                                        }}
                                        sx={{
                                          textTransform: 'none',
                                          fontSize: '0.7rem',
                                          color: '#1976d2',
                                          '&:hover': {
                                            textDecoration: 'underline'
                                          }
                                        }}
                                      >
                                        {expandedColors[modelCapacity] ? '접기' : `+${colorItems.length - 2}개 색상 더...`}
                                      </Button>
                                    )}
                                  </Box>
                                </Box>
                              );
                            });
                          })()}
                          {(() => {
                            const groupedModels = {};
                            Object.entries(models).forEach(([model, count]) => {
                              const [modelCapacity] = model.split(' | ');
                              if (!groupedModels[modelCapacity]) {
                                groupedModels[modelCapacity] = [];
                              }
                              groupedModels[modelCapacity].push({ model, count });
                            });
                            const modelCount = Object.keys(groupedModels).length;
                            if (modelCount > 3) {
                              return (
                                <Button
                                  variant="text"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedModels(prev => ({
                                      ...prev,
                                      [officeName]: !prev[officeName]
                                    }));
                                  }}
                                  sx={{
                                    textTransform: 'none',
                                    fontSize: '0.75rem',
                                    color: '#666',
                                    fontStyle: 'italic',
                                    mt: 1,
                                    '&:hover': {
                                      textDecoration: 'underline',
                                      color: '#1976d2'
                                    }
                                  }}
                                >
                                  {expandedModels[officeName] ? '접기' : `외 ${modelCount - 3}개 모델 더...`}
                                </Button>
                              );
                            }
                            return null;
                          })()}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          textAlign: 'center', 
                          py: 2,
                          fontSize: '0.8rem'
                        }}>
                          보유 재고 없음
                        </Typography>
                      )}
                    </Card>
                  );
                })}
              </Box>
                </>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

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
              // 성능 최적화를 위한 props
              inputProps={{
                autoComplete: 'off',
                'aria-autocomplete': 'none'
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

            {/* 미매칭건 확인 버튼 */}
            <Button
              variant="outlined"
              color="warning"
              onClick={handleShowUnmatched}
              disabled={loadingUnmatched}
              sx={{ 
                borderColor: '#ff9800',
                color: '#ff9800',
                '&:hover': { 
                  borderColor: '#f57c00',
                  backgroundColor: '#fff3e0'
                }
              }}
            >
              {loadingUnmatched ? <CircularProgress size={16} /> : '미매칭건 확인하기'}
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

              {/* 접수 상태 필터 */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>접수상태</InputLabel>
                <Select
                  value={receptionFilter}
                  label="접수상태"
                  onChange={(e) => setReceptionFilter(e.target.value)}
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="yard">마당접수만</MenuItem>
                  <MenuItem value="onsale">온세일접수만</MenuItem>
                  <MenuItem value="both">양쪽접수</MenuItem>
                  <MenuItem value="either">둘중한곳접수</MenuItem>
                </Select>
              </FormControl>

              {/* 마당접수일 필터 */}
              <TextField
                size="small"
                placeholder="마당접수일"
                value={yardDateFilter}
                onChange={(e) => setYardDateFilter(e.target.value)}
                sx={{ minWidth: 120 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                        마당
                      </Typography>
                    </InputAdornment>
                  )
                }}
              />

              {/* 온세일접수일 필터 */}
              <TextField
                size="small"
                placeholder="온세일접수일"
                value={onsaleDateFilter}
                onChange={(e) => setOnsaleDateFilter(e.target.value)}
                sx={{ minWidth: 120 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                        온세일
                      </Typography>
                    </InputAdornment>
                  )
                }}
              />

              {/* 사무실별 필터 */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>사무실</InputLabel>
                <Select
                  value={officeFilter}
                  label="사무실"
                  onChange={(e) => {
                    setOfficeFilter(e.target.value);
                    setDepartmentFilter('all'); // 사무실 변경 시 소속 필터 초기화
                  }}
                  disabled={loadingAgentData}
                >
                  <MenuItem value="all">전체</MenuItem>
                  {agentOfficeData.offices.map((office) => (
                    <MenuItem key={office} value={office}>{office}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 소속별 필터 */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>소속</InputLabel>
                <Select
                  value={departmentFilter}
                  label="소속"
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  disabled={loadingAgentData || officeFilter === 'all'}
                >
                  <MenuItem value="all">전체</MenuItem>
                  {officeFilter !== 'all' && agentOfficeData.departments[officeFilter]?.map((department) => (
                    <MenuItem key={department} value={department}>{department}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* 필터 초기화 버튼 */}
              {(assignmentFilter !== 'all' || activationFilter !== 'all' || receptionFilter !== 'all' || officeFilter !== 'all' || departmentFilter !== 'all' || searchQuery || yardDateFilter || onsaleDateFilter) && (
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
              {debouncedSearchQuery && debouncedSearchQuery !== searchQuery && (
                <span style={{ color: '#ff9800' }}> (검색 중...)</span>
              )}
            </Typography>
            {debouncedSearchQuery && (
              <Chip
                label={`검색어: "${debouncedSearchQuery}"`}
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
            <Box sx={{ 
              height: { xs: 400, sm: 500, md: 600 },
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
              overflow: 'hidden'
            }}>
              {/* 테이블 헤더 */}
              <Box sx={{ 
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #dee2e6',
                display: 'flex',
                position: 'sticky',
                top: 0,
                zIndex: 1
              }}>
                <Box sx={{ width: '60px', p: 1.5, textAlign: 'center', fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>순번</Box>
                <Box sx={{ width: '120px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>고객명</Box>
                <Box sx={{ width: '100px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>예약번호</Box>
                <Box sx={{ width: '120px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>사이트예약</Box>
                <Box sx={{ width: '120px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>마당접수일</Box>
                <Box sx={{ width: '120px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>온세일접수일</Box>
                <Box sx={{ width: '150px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>모델/용량/색상</Box>
                <Box sx={{ width: '80px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>유형</Box>
                <Box sx={{ width: '100px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>대리점</Box>
                <Box sx={{ width: '100px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>담당자</Box>
                <Box sx={{ width: '100px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>POS명</Box>
                <Box sx={{ width: '100px', p: 1.5, textAlign: 'center', fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>재고배정</Box>
                <Box sx={{ width: '100px', p: 1.5, textAlign: 'center', fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>개통완료</Box>
                <Box sx={{ width: '200px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>사이트메모</Box>
                <Box sx={{ width: '200px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>마당메모</Box>
                <Box sx={{ width: '80px', p: 1.5, fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>접수자</Box>
                <Box sx={{ width: '60px', p: 1.5, textAlign: 'center', fontWeight: 700, color: '#1a237e', fontSize: '0.85rem' }}>취소체크</Box>
              </Box>
              {/* 가상화된 테이블 바디 */}
              <List
                height={Math.min(filteredCustomerList.length * 50, 500)}
                itemCount={filteredCustomerList.length}
                itemSize={50}
                itemData={{ 
                  filteredCustomerList, 
                  assignmentStatus, 
                  loadingAssignment, 
                  cancelCheckedItems, 
                  onCancelCheckToggle: handleCancelCheckToggle,
                  processingCancelCheck,
                  loadingCancelData
                }}
                width="100%"
                style={{ backgroundColor: '#fff' }}
              >
                {VirtualizedTableRow}
              </List>
            </Box>
          ) : (
            <Alert severity="info">
              {searchQuery ? '검색 결과가 없습니다.' : '고객 리스트 데이터가 없습니다. 새로고침 버튼을 클릭하여 데이터를 로드해주세요.'}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 미매칭 데이터 다이얼로그 */}
      <Dialog 
        open={showUnmatchedDialog} 
        onClose={() => setShowUnmatchedDialog(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle sx={{ 
          backgroundColor: '#fff3e0', 
          borderBottom: '2px solid #ff9800',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6" sx={{ color: '#e65100', fontWeight: 'bold' }}>
            📋 미매칭 고객 현황
          </Typography>
          <Chip 
            label={`총 ${unmatchedData.yard.length + unmatchedData.onSale.length + unmatchedData.mobile.length}건`}
            color="warning"
            variant="outlined"
          />
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          <Tabs 
            value={unmatchedTab} 
            onChange={(e, newValue) => setUnmatchedTab(newValue)}
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              backgroundColor: '#fafafa'
            }}
          >
            <Tab 
              label={`마당접수 미매칭 (${unmatchedData.yard.length}건)`}
              sx={{ 
                color: '#d32f2f',
                fontWeight: 'bold',
                '&.Mui-selected': { color: '#d32f2f' }
              }}
            />
            <Tab 
              label={`온세일 미매칭 (${unmatchedData.onSale.length}건)`}
              sx={{ 
                color: '#1976d2',
                fontWeight: 'bold',
                '&.Mui-selected': { color: '#1976d2' }
              }}
            />
            <Tab 
              label={`모바일가입내역 미매칭 (${unmatchedData.mobile.length}건)`}
              sx={{ 
                color: '#388e3c',
                fontWeight: 'bold',
                '&.Mui-selected': { color: '#388e3c' }
              }}
            />
          </Tabs>

          <Box sx={{ p: 2, maxHeight: 500, overflow: 'auto' }}>
            {loadingUnmatched ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* 마당접수 미매칭 */}
                {unmatchedTab === 0 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2, color: '#d32f2f', fontWeight: 'bold' }}>
                      🏢 마당접수에서만 확인되는 고객 ({unmatchedData.yard.length}건)
                    </Typography>
                    {unmatchedData.yard.length > 0 ? (
                      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: '#ffebee' }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>고객명</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>전화번호</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>접수일</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>모델</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>메모</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {unmatchedData.yard.map((customer, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(even)': { backgroundColor: '#fafafa' } }}>
                                <TableCell>{customer.customerName || '-'}</TableCell>
                                <TableCell>{customer.phoneNumber || '-'}</TableCell>
                                <TableCell>{customer.receptionDate || '-'}</TableCell>
                                <TableCell>{customer.model || '-'}</TableCell>
                                <TableCell>{customer.memo || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="success">마당접수 미매칭 고객이 없습니다.</Alert>
                    )}
                  </Box>
                )}

                {/* 온세일 미매칭 */}
                {unmatchedTab === 1 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2, color: '#1976d2', fontWeight: 'bold' }}>
                      💻 온세일에서만 확인되는 고객 ({unmatchedData.onSale.length}건)
                    </Typography>
                    {unmatchedData.onSale.length > 0 ? (
                      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>고객명</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>전화번호</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>접수일</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>모델</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>메모</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {unmatchedData.onSale.map((customer, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(even)': { backgroundColor: '#fafafa' } }}>
                                <TableCell>{customer.customerName || '-'}</TableCell>
                                <TableCell>{customer.phoneNumber || '-'}</TableCell>
                                <TableCell>{customer.receptionDate || '-'}</TableCell>
                                <TableCell>{customer.model || '-'}</TableCell>
                                <TableCell>{customer.memo || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="success">온세일 미매칭 고객이 없습니다.</Alert>
                    )}
                  </Box>
                )}

                {/* 모바일가입내역 미매칭 */}
                {unmatchedTab === 2 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2, color: '#388e3c', fontWeight: 'bold' }}>
                      📱 모바일가입내역에서만 확인되는 고객 ({unmatchedData.mobile.length}건)
                    </Typography>
                    {unmatchedData.mobile.length > 0 ? (
                      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: '#e8f5e8' }}>
                              <TableCell sx={{ fontWeight: 'bold' }}>고객명</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>전화번호</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>가입일</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>모델</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>메모</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {unmatchedData.mobile.map((customer, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(even)': { backgroundColor: '#fafafa' } }}>
                                <TableCell>{customer.customerName || '-'}</TableCell>
                                <TableCell>{customer.phoneNumber || '-'}</TableCell>
                                <TableCell>{customer.joinDate || '-'}</TableCell>
                                <TableCell>{customer.model || '-'}</TableCell>
                                <TableCell>{customer.memo || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="success">모바일가입내역 미매칭 고객이 없습니다.</Alert>
                    )}
                  </Box>
                )}
              </>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, backgroundColor: '#fafafa' }}>
          <Button 
            onClick={downloadUnmatchedExcel}
            disabled={downloadingUnmatchedExcel || loadingUnmatched}
            variant="outlined"
            startIcon={downloadingUnmatchedExcel ? <CircularProgress size={16} /> : <DownloadIcon />}
            sx={{ 
              borderColor: '#4caf50',
              color: '#4caf50',
              '&:hover': { 
                borderColor: '#388e3c',
                backgroundColor: '#e8f5e8'
              },
              '&:disabled': {
                borderColor: '#ccc',
                color: '#ccc'
              }
            }}
          >
            {downloadingUnmatchedExcel ? '다운로드 중...' : '엑셀 다운로드'}
          </Button>
          <Button 
            onClick={() => setShowUnmatchedDialog(false)}
            variant="contained"
            sx={{ 
              backgroundColor: '#ff9800',
              '&:hover': { backgroundColor: '#f57c00' }
            }}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default AllCustomerListScreen;