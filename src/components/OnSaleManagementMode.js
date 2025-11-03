import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  TablePagination,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  Update as UpdateIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';
import PolicyBoardModal from './PolicyBoardModal';
import PolicyViewModal from './PolicyViewModal';

// TabPanel 컴포넌트
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const OnSaleManagementMode = ({ 
  loggedInStore, 
  onLogout, 
  onModeChange, 
  availableModes 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 링크 목록 상태
  const [links, setLinks] = useState([]);
  
  // 링크 추가/수정 다이얼로그 상태
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [linkForm, setLinkForm] = useState({
    url: '',
    buttonName: '',
    hideAgentInfo: false,
    isActive: true,
    useActivationForm: false,
    activationSheetId: '',
    activationSheetName: ''
  });

  // 개통정보 목록 관련 상태
  const [activationList, setActivationList] = useState([]);
  const [activationLoading, setActivationLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLink, setSelectedLink] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 탭 상태 관리
  const [tabValue, setTabValue] = useState(0);
  const [activationTabValue, setActivationTabValue] = useState(0);
  
  // 월별 필터링 (관리모드에서는 전체 데이터 표시)
  const [selectedMonth, setSelectedMonth] = useState(null); // null = 전체

  // 보류함 관리
  const [selectedRows, setSelectedRows] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  
  // 정책게시판 관련 상태
  const [policies, setPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policySearchTerm, setPolicySearchTerm] = useState('');
  const [policySearchType, setPolicySearchType] = useState('title'); // title, content, all
  const [policyPage, setPolicyPage] = useState(0);
  const [policyRowsPerPage, setPolicyRowsPerPage] = useState(10);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showPolicyViewModal, setShowPolicyViewModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  
  const API_URL = process.env.REACT_APP_API_URL;

  // 탭 핸들러 함수들
  const handleTabChange = (event, newValue) => {
    // 정책게시판 권한이 없는데 정책게시판 탭을 선택하려고 하면 막기
    const hasPolicyPermission = loggedInStore?.modePermissions?.onSalePolicy || loggedInStore?.onSalePolicy;
    if (newValue === 2 && !hasPolicyPermission) {
      setTabValue(0); // 개통정보 목록 탭으로 이동
      return;
    }
    setTabValue(newValue);
  };

  const handleActivationTabChange = (event, newValue) => {
    setActivationTabValue(newValue);
  };

  const handleMonthChange = (event) => {
    const value = event.target.value;
    console.log('📅 온세일관리모드 월별 필터 변경:', value);
    
    // 상태 초기화
    setActivationList([]);
    
    if (value === 'all') {
      setSelectedMonth(null); // 전체 선택 시 null로 설정
    } else {
      setSelectedMonth(value);
    }
  };

  // 체크박스 핸들러
  const handleRowSelect = (rowIndex) => {
    console.log('🔍 [행선택] handleRowSelect 호출:', {
      rowIndex,
      page,
      rowsPerPage,
      actualIndex: rowIndex,
      displayNumber: rowIndex + 1
    });
    
    setSelectedRows(prev => {
      const newSelection = prev.includes(rowIndex) 
        ? prev.filter(index => index !== rowIndex)
        : [...prev, rowIndex];
      
      console.log('🔍 [행선택] 선택된 행 업데이트:', {
        previous: prev,
        new: newSelection
      });
      
      return newSelection;
    });
  };

  const handleMoveToHold = async () => {
    try {
      setLoading(true);
      
      // 필터링된 데이터에서 선택된 항목들을 찾기
      const itemsToMove = selectedRows.map(selectedIndex => {
        const filteredIndex = selectedIndex;
        const actualActivation = filteredActivations[filteredIndex];
        
        // 전체 activationList에서 해당 항목의 실제 인덱스 찾기
        const actualIndex = activationList.findIndex(item => 
          item.sheetId === actualActivation.sheetId && 
          item.rowIndex === actualActivation.rowIndex
        );
        
        return {
          ...actualActivation,
          actualIndex
        };
      });
      
      console.log('🔍 [보류처리] 선택된 행들:', selectedRows);
      console.log('🔍 [보류처리] 필터링된 데이터:', filteredActivations.map((item, index) => ({
        index,
        customerName: item.customerName,
        rowIndex: item.rowIndex,
        sheetId: item.sheetId
      })));
      console.log('🔍 [보류처리] 이동할 항목들:', itemsToMove.map(item => ({
        customerName: item.customerName,
        rowIndex: item.rowIndex,
        sheetId: item.sheetId,
        actualIndex: item.actualIndex
      })));
      
      // 각 항목에 대해 보류 처리 API 호출
      for (const item of itemsToMove) {
        console.log(`⏸️ [보류처리] API 호출: ${item.customerName}, 시트=${item.sheetId}, 행=${item.rowIndex}`);
        
        const response = await fetch(
          `${API_URL}/api/onsale/activation-info/${item.sheetId}/${item.rowIndex}/pending`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pendingBy: loggedInStore.name })
          }
        );
        
        const result = await response.json();
        if (!result.success) {
          console.error('보류 처리 실패:', item.customerName, result.error);
        } else {
          console.log(`✅ [보류처리] 성공: ${item.customerName}`);
        }
      }
      
      setSuccess(`${itemsToMove.length}건이 보류함으로 이동되었습니다.`);
      setSelectedRows([]);
      fetchActivationList(); // 목록 새로고침
      
    } catch (error) {
      console.error('보류함 이동 실패:', error);
      setError('보류함 이동에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 보류 해제 핸들러 추가
  const handleRemoveFromHold = async (activation) => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${API_URL}/api/onsale/activation-info/${activation.sheetId}/${activation.rowIndex}/unpending`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('보류가 해제되었습니다.');
        fetchActivationList(); // 목록 새로고침
      } else {
        setError(result.error || '보류 해제에 실패했습니다.');
      }
      
    } catch (error) {
      console.error('보류 해제 실패:', error);
      setError('보류 해제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 업데이트 팝업 자동 표시
  useEffect(() => {
    // 모드 진입 시 업데이트 팝업 표시
    setShowUpdatePopup(true);
  }, []);

  // 링크 목록 불러오기
  useEffect(() => {
    fetchLinks();
    fetchActivationList(); // 개통정보 목록도 함께 불러오기
  }, []);

  // 정책게시판 탭일 때 정책 목록 불러오기
  useEffect(() => {
    if (tabValue === 2) {
      fetchPolicies();
    }
  }, [tabValue]);

  // 월별 필터링 변경 시 목록 새로고침
  useEffect(() => {
    fetchActivationList();
  }, [selectedMonth]);

  // 수정 완료 메시지 리스너
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'ACTIVATION_UPDATED') {
        console.log('🔄 수정 완료 알림 받음, 목록 새로고침');
        fetchActivationList();
      }
      if (event.data && event.data.type === 'ACTIVATION_COMPLETED') {
        console.log('🔄 개통완료 알림 받음, 목록 새로고침');
        fetchActivationList();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/onsale/links`);
      const data = await response.json();
      
      if (data.success) {
        setLinks(data.links);
      } else {
        setError(data.error || '링크 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('링크 조회 실패:', error);
      setError('링크 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLink = () => {
    setEditingLink(null);
    setLinkForm({
      url: '',
      buttonName: '',
      hideAgentInfo: false,
      isActive: true,
      useActivationForm: false,
      activationSheetId: '',
      activationSheetName: ''
    });
    setShowLinkDialog(true);
  };

  const handleEditLink = (link) => {
    setEditingLink(link);
    setLinkForm({
      url: link.url,
      buttonName: link.buttonName,
      hideAgentInfo: link.hideAgentInfo,
      isActive: link.isActive,
      useActivationForm: link.useActivationForm || false,
      activationSheetId: link.activationSheetId || '',
      activationSheetName: link.activationSheetName || ''
    });
    setShowLinkDialog(true);
  };

  const handleSaveLink = async () => {
    try {
      // 유효성 검사
      if (!linkForm.url || !linkForm.buttonName) {
        setError('URL과 버튼명은 필수입니다.');
        return;
      }
      
      // 개통양식 사용 시 시트 정보 필수
      if (linkForm.useActivationForm && (!linkForm.activationSheetId || !linkForm.activationSheetName)) {
        setError('개통양식을 사용할 경우 시트 ID와 시트 이름을 모두 입력해주세요.');
        return;
      }

      setLoading(true);
      setError(null);

      const url = editingLink 
        ? `${API_URL}/api/onsale/links/${editingLink.rowIndex}`
        : `${API_URL}/api/onsale/links`;
      
      const method = editingLink ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(linkForm),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(editingLink ? '링크가 수정되었습니다.' : '링크가 추가되었습니다.');
        setShowLinkDialog(false);
        fetchLinks();
        
        // 성공 메시지 3초 후 제거
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('링크 저장 실패:', error);
      setError('링크 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLink = async (link) => {
    if (!window.confirm(`"${link.buttonName}" 링크를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/onsale/links/${link.rowIndex}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('링크가 삭제되었습니다.');
        fetchLinks();
        
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('링크 삭제 실패:', error);
      setError('링크 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 개통정보 목록 불러오기
  const fetchActivationList = async () => {
    try {
      setActivationLoading(true);
      const params = new URLSearchParams();
      if (selectedLink !== 'all') {
        const link = links.find(l => l.buttonName === selectedLink);
        if (link && link.activationSheetId) {
          params.append('sheetId', link.activationSheetId);
        }
      } else {
        params.append('allSheets', 'true');
      }
      
      // 월별 필터링 추가
      if (selectedMonth) {
        params.append('month', selectedMonth);
      }
      
      const response = await fetch(`${API_URL}/api/onsale/activation-list?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        // 데이터를 제출일시 기준으로 내림차순 정렬 (최신순)
        const sortedData = result.data.sort((a, b) => {
          const dateA = new Date(a.submittedAt || 0);
          const dateB = new Date(b.submittedAt || 0);
          return dateB - dateA; // 최신순
        });
        
        console.log('🔍 [온세일관리] 정렬된 데이터:', sortedData.map((item, index) => ({
          index,
          customerName: item.customerName,
          submittedAt: item.submittedAt,
          rowIndex: item.rowIndex
        })));
        
        setActivationList(sortedData);
      } else {
        setError('개통정보 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('개통정보 목록 로드 실패:', error);
      setError('개통정보 목록을 불러오는데 실패했습니다.');
    } finally {
      setActivationLoading(false);
    }
  };

  // 개통정보 수정
  const handleEditActivation = (activation) => {
    const editUrl = `/activation-info?editMode=true&sheetId=${activation.sheetId}&rowIndex=${activation.rowIndex}&vipCompany=${encodeURIComponent(loggedInStore.name)}&activationSheetId=${activation.sheetId}`;
    window.location.href = editUrl;
  };

  const handleViewActivation = (activation) => {
    const viewUrl = `/activation-info?viewMode=true&sheetId=${activation.sheetId}&rowIndex=${activation.rowIndex}&vipCompany=${encodeURIComponent(loggedInStore.name)}&activationSheetId=${activation.sheetId}`;
    window.location.href = viewUrl;
  };

  // 개통정보 취소
  const handleCancelActivation = async (activation) => {
    if (!window.confirm('이 개통정보를 취소 처리하시겠습니까?')) {
      return;
    }
    
    try {
      setActivationLoading(true);
      const response = await fetch(`${API_URL}/api/onsale/activation-info/${activation.sheetId}/${activation.rowIndex}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelledBy: loggedInStore.name
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccess('개통정보가 취소되었습니다.');
        fetchActivationList(); // 목록 새로고침
      } else {
        setError(result.error || '개통정보 취소에 실패했습니다.');
      }
    } catch (error) {
      console.error('개통정보 취소 실패:', error);
      setError('개통정보 취소에 실패했습니다.');
    } finally {
      setActivationLoading(false);
    }
  };

  // 검색 및 함별 필터링
  const filteredActivations = activationList.filter(activation => {
    // 검색 필터링
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        activation.customerName?.toLowerCase().includes(searchLower) ||
        activation.phoneNumber?.includes(searchTerm) ||
        activation.modelName?.toLowerCase().includes(searchLower) ||
        activation.plan?.toLowerCase().includes(searchLower) ||
        activation.storeName?.toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }
    
    // 함별 필터링
    switch (activationTabValue) {
      case 0: // 수신함: 완료/보류/취소되지 않은 데이터만
        return !activation.isCompleted && !activation.isCancelled && !activation.isPending;
      case 1: // 보류함: 보류된 데이터만
        if (activation.isPending) {
          console.log('⏸️ 보류함:', activation.customerName, 'G열:', activation.isPending, '보류일:', activation.pendingAt);
        }
        return activation.isPending;
      case 2: // 취소함: 취소된 데이터만
        if (activation.isCancelled) {
          console.log('❌ 취소함:', activation.customerName, 'D열:', activation.isCancelled, '취소일:', activation.cancelledAt);
        }
        return activation.isCancelled;
      case 3: // 완료함: 개통 완료된 데이터만
        if (activation.isCompleted) {
          console.log('✅ 완료함:', activation.customerName, 'A열:', activation.isCompleted, '완료일:', activation.completedAt);
        }
        return activation.isCompleted;
      default:
        return true;
    }
  });

  // 페이지네이션
  const paginatedActivations = filteredActivations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // 정책 목록 불러오기
  const fetchPolicies = async () => {
    try {
      setPoliciesLoading(true);
      const response = await fetch(`${API_URL}/api/onsale/policies`);
      const data = await response.json();
      
      if (data.success) {
        setPolicies(data.policies || []);
      } else {
        setError('정책 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('정책 목록 조회 실패:', error);
      setError('정책 목록을 불러오는데 실패했습니다.');
    } finally {
      setPoliciesLoading(false);
    }
  };

  // 정책 등록/수정
  const handleSavePolicy = async (policyData, policyId) => {
    // M 권한 체크
    if (!loggedInStore?.modePermissions?.onSalePolicy && !loggedInStore?.onSalePolicy) {
      setError('정책게시판 등록 권한이 없습니다.');
      return;
    }

    try {
      setLoading(true);
      const url = policyId 
        ? `${API_URL}/api/onsale/policies/${policyId}`
        : `${API_URL}/api/onsale/policies`;
      const method = policyId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policyData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(policyId ? '정책이 수정되었습니다.' : '정책이 등록되었습니다.');
        fetchPolicies();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || '정책 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('정책 저장 실패:', error);
      setError('정책 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 정책 삭제
  const handleDeletePolicy = async (policy) => {
    // M 권한 체크
    if (!loggedInStore?.modePermissions?.onSalePolicy && !loggedInStore?.onSalePolicy) {
      setError('정책게시판 삭제 권한이 없습니다.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/onsale/policies/${policy.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('정책이 삭제되었습니다.');
        fetchPolicies();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || '정책 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('정책 삭제 실패:', error);
      setError('정책 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 정책 검색 필터링
  const filteredPolicies = policies.filter(policy => {
    if (!policySearchTerm) return true;
    const searchLower = policySearchTerm.toLowerCase();
    
    switch (policySearchType) {
      case 'title':
        return policy.title?.toLowerCase().includes(searchLower);
      case 'content':
        return policy.content?.toLowerCase().includes(searchLower);
      case 'all':
        return (
          policy.title?.toLowerCase().includes(searchLower) ||
          policy.content?.toLowerCase().includes(searchLower)
        );
      default:
        return true;
    }
  });

  // 정책 페이지네이션
  const paginatedPolicies = filteredPolicies.slice(
    policyPage * policyRowsPerPage,
    policyPage * policyRowsPerPage + policyRowsPerPage
  );


  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ 
        bgcolor: 'transparent',
        background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <Toolbar>
          <LinkIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            온세일 관리 모드
          </Typography>
          
          <Button
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={fetchLinks}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
            }}
          >
            새로고침
          </Button>
          
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={() => setShowUpdatePopup(true)}
            sx={{
              ml: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
            }}
          >
            업데이트 확인
          </Button>
          
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              startIcon={<RefreshIcon />}
              onClick={onModeChange}
              sx={{
                ml: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
              }}
            >
              모드 변경
            </Button>
          )}
          
          <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 컨텐츠 */}
      <Box sx={{ p: 3 }}>
        {/* 에러 메시지 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 성공 메시지 */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* 메인 탭 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="개통정보 목록" />
            <Tab label="온세일 링크 관리" />
            {(loggedInStore?.modePermissions?.onSalePolicy || loggedInStore?.onSalePolicy) && (
              <Tab label="정책게시판" />
            )}
          </Tabs>
        </Box>

        {/* 정책게시판 권한이 없을 때 탭 인덱스 조정 */}
        {!(loggedInStore?.modePermissions?.onSalePolicy || loggedInStore?.onSalePolicy) && tabValue === 2 && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography color="textSecondary">정책게시판 탭이 존재하지 않습니다.</Typography>
          </Box>
        )}

        {/* 개통정보 목록 탭 */}
        <TabPanel value={tabValue} index={0}>
          {/* 개통정보 하위 탭 */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activationTabValue} onChange={handleActivationTabChange}>
              <Tab label="수신함" />
              <Tab label="보류함" />
              <Tab label="취소함" />
              <Tab label="완료함" />
            </Tabs>
          </Box>

          {/* 월별 필터링 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>월별 필터</InputLabel>
              <Select
                value={selectedMonth || 'all'}
                label="월별 필터"
                onChange={handleMonthChange}
              >
                <MenuItem value="all">전체</MenuItem>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - i);
                  const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
                  return (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            
            {/* 강제 새로고침 버튼 */}
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                console.log('🔄 온세일관리모드 강제 새로고침 시작');
                setActivationList([]); // 상태 초기화
                fetchActivationList(); // 데이터 다시 가져오기
              }}
              disabled={loading}
              sx={{ ml: 2 }}
            >
              새로고침
            </Button>

            {activationTabValue === 0 && selectedRows.length > 0 && (
              <Button
                variant="contained"
                color="warning"
                onClick={handleMoveToHold}
                sx={{ ml: 2 }}
              >
                보류함으로 이동 ({selectedRows.length})
              </Button>
            )}
          </Box>

          {/* 개통정보 목록 테이블 */}
          <TableContainer 
            component={Paper} 
            sx={{ 
              mb: 2, 
              maxHeight: 600,
              overflow: 'auto'
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {activationTabValue === 0 && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedRows.length > 0 && selectedRows.length < filteredActivations.length}
                        checked={filteredActivations.length > 0 && selectedRows.length === filteredActivations.length}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedRows(filteredActivations.map((_, index) => index));
                          } else {
                            setSelectedRows([]);
                          }
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                  <TableCell>제출일시</TableCell>
                  <TableCell>작업자</TableCell>
                  <TableCell>매장명</TableCell>
                  <TableCell>개통유형</TableCell>
                  <TableCell>고객명</TableCell>
                  <TableCell>개통번호</TableCell>
                  <TableCell>생년월일</TableCell>
                  <TableCell>모델명</TableCell>
                  <TableCell>일련번호</TableCell>
                  <TableCell>유심모델명</TableCell>
                  <TableCell>유심일련번호</TableCell>
                  <TableCell>요금제</TableCell>
                  <TableCell>개통완료</TableCell>
                  <TableCell>개통시간</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {activationLoading ? (
                  <TableRow>
                    <TableCell colSpan={activationTabValue === 0 ? 18 : 17} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : filteredActivations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activationTabValue === 0 ? 18 : 17} align="center">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActivations
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((activation, index) => (
                      <TableRow
                        key={index}
                        onClick={() => handleViewActivation(activation)}
                        sx={{ 
                          backgroundColor: activation.isCompleted ? '#e3f2fd' : 
                                         activation.isCancelled ? '#fce4ec' : 
                                         activation.lastEditor ? '#f1f8e9' : 'inherit',
                          opacity: activation.isCancelled ? 0.7 : 1,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: activation.isCompleted ? '#bbdefb' : 
                                           activation.isCancelled ? '#f8bbd9' : 
                                           activation.lastEditor ? '#dcedc8' : '#f8f9fa'
                          }
                        }}
                      >
                        {activationTabValue === 0 && (
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedRows.includes(page * rowsPerPage + index)}
                              onChange={() => {
                                const actualIndex = page * rowsPerPage + index;
                                console.log('🔍 [체크박스] 클릭:', {
                                  index,
                                  page,
                                  rowsPerPage,
                                  actualIndex,
                                  customerName: activation.customerName,
                                  displayNumber: actualIndex + 1
                                });
                                handleRowSelect(actualIndex);
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          #{page * rowsPerPage + index + 1}
                        </TableCell>
                        <TableCell>{activation.submittedAt}</TableCell>
                        <TableCell>
                          {activation.completedBy ? (
                            <Box sx={{ fontSize: '0.8rem', color: 'success.main', fontWeight: 'bold' }}>
                              개통: {activation.completedBy}
                            </Box>
                          ) : activation.cancelledBy ? (
                            <Box sx={{ fontSize: '0.8rem', color: 'error.main' }}>
                              취소: {activation.cancelledBy}
                            </Box>
                          ) : activation.pendingBy ? (
                            <Box sx={{ fontSize: '0.8rem', color: 'warning.main', fontWeight: 'bold' }}>
                              보류: {activation.pendingBy}
                            </Box>
                          ) : activation.lastEditor ? (
                            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              수정: {activation.lastEditor}
                            </Box>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{activation.storeName}</TableCell>
                        <TableCell>{activation.activationType}</TableCell>
                        <TableCell>{activation.customerName}</TableCell>
                        <TableCell>{activation.phoneNumber}</TableCell>
                        <TableCell>{activation.birthDate}</TableCell>
                        <TableCell>{activation.modelName}</TableCell>
                        <TableCell>{activation.deviceSerial}</TableCell>
                        <TableCell>{activation.simModel}</TableCell>
                        <TableCell>{activation.simSerial}</TableCell>
                        <TableCell>{activation.plan}</TableCell>
                        <TableCell>
                          {activation.isCompleted ? (
                            <Box>
                              <Box sx={{ fontSize: '0.8rem', color: 'success.main', fontWeight: 'bold' }}>
                                완료: {activation.completedBy}
                              </Box>
                            </Box>
                          ) : (
                            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              미완료
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          {activation.completedAt ? (
                            <Box sx={{ fontSize: '0.8rem', color: 'text.primary' }}>
                              {activation.completedAt}
                            </Box>
                          ) : (
                            <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                              -
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          {activation.isCancelled ? (
                            <Chip label="취소됨" color="error" size="small" />
                          ) : (
                            <Chip label="정상" color="success" size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VisibilityIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewActivation(activation);
                              }}
                            >
                              보기
                            </Button>
                            {activationTabValue === 1 ? (
                              // 보류함 탭: 보류 해제 버튼
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={<RefreshIcon />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromHold(activation);
                                }}
                              >
                                보류 해제
                              </Button>
                            ) : (
                              // 다른 탭: 수정/취소 버튼
                              <>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<EditIcon />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditActivation(activation);
                                  }}
                                >
                                  수정
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  startIcon={<CancelIcon />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelActivation(activation);
                                  }}
                                >
                                  취소
                                </Button>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 페이지네이션 */}
          <TablePagination
            component="div"
            count={filteredActivations.length}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="페이지당 행 수:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
        </TabPanel>

        {/* 온세일 링크 관리 탭 */}
        <TabPanel value={tabValue} index={1}>
          {/* 상단 액션 바 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: '0 2px 4px rgba(142, 36, 170, 0.2)',
                mb: 3
              }}
            >
              📱 온세일 링크 관리
            </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchLinks}
              sx={{ mr: 1 }}
              disabled={loading}
            >
              새로고침
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddLink}
              disabled={loading}
              sx={{ 
                background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)'
                },
                boxShadow: '0 4px 15px rgba(142, 36, 170, 0.3)'
              }}
            >
              링크 추가
            </Button>
          </Box>
        </Box>

        {/* 링크 목록 테이블 */}
        <Paper sx={{ 
          background: 'linear-gradient(135deg, #f8f9ff 0%, #e8eaf6 100%)',
          border: '1px solid #e1bee7',
          boxShadow: '0 4px 20px rgba(142, 36, 170, 0.1)',
          borderRadius: 3
        }}>
          {loading && links.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress sx={{ color: '#8e24aa' }} />
            </Box>
          ) : links.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: '#8e24aa', fontSize: '1.1rem' }}>
                📝 등록된 링크가 없습니다.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ 
                    background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                    '& .MuiTableCell-head': { color: 'white', fontWeight: 'bold' }
                  }}>
                    <TableCell><strong>🔗 버튼명</strong></TableCell>
                    <TableCell><strong>🌐 링크 URL</strong></TableCell>
                    <TableCell align="center"><strong>대리점정보숨김</strong></TableCell>
                    <TableCell align="center"><strong>개통양식</strong></TableCell>
                    <TableCell align="center"><strong>활성화</strong></TableCell>
                    <TableCell align="center"><strong>작업</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {links.map((link) => (
                    <TableRow key={link.rowIndex}>
                      <TableCell>{link.buttonName}</TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            maxWidth: 400, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {link.url}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={link.hideAgentInfo ? 'O' : 'X'} 
                          color={link.hideAgentInfo ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={link.useActivationForm ? '사용' : '미사용'} 
                          color={link.useActivationForm ? 'secondary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={link.isActive ? 'O' : 'X'} 
                          color={link.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton 
                          size="small" 
                          onClick={() => handleEditLink(link)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteLink(link)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
        </TabPanel>

        {/* 정책게시판 탭 - M 권한이 있는 경우에만 표시 */}
        {(loggedInStore?.modePermissions?.onSalePolicy || loggedInStore?.onSalePolicy) && (
          <TabPanel value={tabValue} index={2}>
            {/* 상단 액션 바 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1 }}>
                {/* 검색 타입 선택 */}
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <Select
                    value={policySearchType}
                    onChange={(e) => setPolicySearchType(e.target.value)}
                  >
                    <MenuItem value="title">제목</MenuItem>
                    <MenuItem value="content">내용</MenuItem>
                    <MenuItem value="all">제목+내용</MenuItem>
                  </Select>
                </FormControl>
                
                {/* 검색 필드 */}
                <TextField
                  size="small"
                  placeholder="검색어를 입력하세요"
                  value={policySearchTerm}
                  onChange={(e) => setPolicySearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    )
                  }}
                  sx={{ flex: 1, maxWidth: 400 }}
                />
              </Box>
              
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={fetchPolicies}
                  sx={{ mr: 1 }}
                  disabled={policiesLoading}
                >
                  새로고침
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingPolicy(null);
                    setShowPolicyModal(true);
                  }}
                  disabled={policiesLoading}
                  sx={{ 
                    background: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
                    '&:hover': { 
                      background: 'linear-gradient(135deg, #7b1fa2 0%, #4a2c7a 100%)'
                    }
                  }}
                >
                  정책등록
                </Button>
              </Box>
            </Box>

          {/* 정책 목록 테이블 */}
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>번호</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>제목</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>그룹</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>등록자</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>확인자</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>등록일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {policiesLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : paginatedPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      {policySearchTerm ? '검색 결과가 없습니다.' : '등록된 정책이 없습니다.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPolicies.map((policy) => (
                    <TableRow
                      key={policy.id}
                      onClick={() => {
                        setSelectedPolicy(policy);
                        setShowPolicyViewModal(true);
                      }}
                      sx={{ 
                        cursor: 'pointer',
                        backgroundColor: policy.isPinned ? '#fff3e0' : 'inherit',
                        '&:hover': { backgroundColor: policy.isPinned ? '#ffe0b2' : '#f5f5f5' }
                      }}
                    >
                      <TableCell>
                        {policy.isPinned && (
                          <Chip label="중요!" color="warning" size="small" sx={{ mr: 1 }} />
                        )}
                        {policy.number || policy.id}
                      </TableCell>
                      <TableCell>{policy.title}</TableCell>
                      <TableCell>
                        {policy.groups && policy.groups.length > 0 
                          ? policy.groups.join(', ') 
                          : '-'}
                      </TableCell>
                      <TableCell>{policy.createdBy}</TableCell>
                      <TableCell>
                        {policy.viewCount || 0}개
                        {policy.firstViewDate && (
                          <Box sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {policy.firstViewDate}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>{policy.createdAt}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 페이지네이션 */}
          <TablePagination
            component="div"
            count={filteredPolicies.length}
            page={policyPage}
            onPageChange={(event, newPage) => setPolicyPage(newPage)}
            rowsPerPage={policyRowsPerPage}
            onRowsPerPageChange={(event) => {
              setPolicyRowsPerPage(parseInt(event.target.value, 10));
              setPolicyPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage="페이지당 행 수:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
          />
          </TabPanel>
        )}
      </Box>

      {/* 정책 등록/수정 모달 */}
      <PolicyBoardModal
        open={showPolicyModal}
        onClose={() => {
          setShowPolicyModal(false);
          setEditingPolicy(null);
        }}
        onSave={handleSavePolicy}
        policy={editingPolicy}
        loggedInStore={loggedInStore}
      />

      {/* 정책 상세보기 모달 */}
      <PolicyViewModal
        open={showPolicyViewModal}
        onClose={() => {
          setShowPolicyViewModal(false);
          setSelectedPolicy(null);
        }}
        policy={selectedPolicy}
        onEdit={(policy) => {
          setEditingPolicy(policy);
          setShowPolicyViewModal(false);
          setShowPolicyModal(true);
        }}
        onDelete={handleDeletePolicy}
        loggedInStore={loggedInStore}
      />

      {/* 링크 추가/수정 다이얼로그 */}
      <Dialog open={showLinkDialog} onClose={() => setShowLinkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingLink ? '링크 수정' : '새 링크 추가'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="URL"
              value={linkForm.url}
              onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="https://example.com"
            />
            <TextField
              fullWidth
              label="버튼명"
              value={linkForm.buttonName}
              onChange={(e) => setLinkForm({ ...linkForm, buttonName: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="가입 신청하기"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={linkForm.hideAgentInfo}
                  onChange={(e) => setLinkForm({ ...linkForm, hideAgentInfo: e.target.checked })}
                />
              }
              label="대리점정보숨김"
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={linkForm.isActive}
                  onChange={(e) => setLinkForm({ ...linkForm, isActive: e.target.checked })}
                />
              }
              label="활성화"
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={linkForm.useActivationForm}
                  onChange={(e) => setLinkForm({ ...linkForm, useActivationForm: e.target.checked })}
                />
              }
              label="개통양식 사용"
              sx={{ mb: 2 }}
            />
            
            {linkForm.useActivationForm && (
              <>
                <TextField
                  fullWidth
                  label="개통양식 시트 ID"
                  value={linkForm.activationSheetId}
                  onChange={(e) => setLinkForm({ ...linkForm, activationSheetId: e.target.value })}
                  sx={{ mb: 2 }}
                  placeholder="Google Sheets ID"
                />
                <TextField
                  fullWidth
                  label="개통양식 시트 이름"
                  value={linkForm.activationSheetName}
                  onChange={(e) => setLinkForm({ ...linkForm, activationSheetName: e.target.value })}
                  sx={{ mb: 2 }}
                  placeholder="시트 탭 이름"
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLinkDialog(false)}>취소</Button>
          <Button onClick={handleSaveLink} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : (editingLink ? '수정' : '추가')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 업데이트 팝업 */}
      {showUpdatePopup && (
        <AppUpdatePopup
          open={showUpdatePopup}
          onClose={() => setShowUpdatePopup(false)}
          mode="onSaleManagement"
          loggedInStore={loggedInStore}
          updateData={{
            version: "1.0.0",
            description: "온세일 관리 모드가 업데이트되었습니다.",
            features: [
              "링크 관리 기능 개선",
              "개통정보 목록 조회 기능 추가",
              "UI/UX 개선"
            ]
          }}
        />
      )}
    </Box>
  );
};

export default OnSaleManagementMode;
