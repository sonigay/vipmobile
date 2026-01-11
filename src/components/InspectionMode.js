import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Tooltip,
  Switch,
  FormControlLabel,
  Autocomplete
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  SwapHoriz as SwapHorizIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  AutoFixHigh as NormalizeIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Update as UpdateIcon
} from '@mui/icons-material';
import { Tabs, Tab } from '@mui/material';
import {
  fetchInspectionData,
  updateInspectionCompletion,
  saveNormalizationData,
  updateSystemData,
  fetchFieldValues,
  fetchAvailableFields,
  getDifferenceTypeColor,
  getDifferenceTypeLabel,
  filterDifferences,
  extractAssignedAgents,
  calculateStatistics,
  fetchColumnSettings,
  updateColumnSettings,
  updateModificationComplete,
  updateModificationNotes
} from '../utils/inspectionUtils';
import AppUpdatePopup from './AppUpdatePopup';

// 탭별 검수 항목 정의 (배열로 변경하여 인덱스 접근 안정성 확보)
const INSPECTION_TABS = [
  {
    key: 'GENERAL',
    label: '일반검수항목',
    items: [
      '대리점코드',
      '개통일시분', 
      '모델명(일련번호)',
      '개통유형',
      '실판매POS',
      '요금제',
      '출고가상이', 
      '지원금 및 약정상이', 
      '프리할부상이',
      '유통망지원금 상이'
    ]
  },
  {
    key: 'ADDITIONAL',
    label: '추가검수항목',
    items: ['유플레이 유치 추가', 'V컬러링 음악감상 플러스 유치', '폰교체 패스 유치', '폰교체 슬림 유치', '폰 안심패스 유치', '통화연결음 유치', '청소년요금제추가정책(1)유치', '청소년요금제추가정책(2)유치', '유통망지원금 활성화정책']
  },
  {
    key: 'DEDUCTION',
    label: '차감검수항목',
    items: ['유플레이 미유치 차감', '통화연결음 미유치', '보험 미유치', '115군 선택약정 차감', '선택약정 S721(010신규) 차감', '선택약정 S931,S938,S937(MNP) 차감', '선택약정 아이폰16류전체(MNP) 차감', 'A166 44군 대상외요금제(MNP) 차감', 'A166 44군 대상외요금제(기변) 차감', '정책기변 차감', '기변 C타겟 차감', '33군미만, 시니어1군시 차감', '온세일 전략온라인POS 차감']
  }
];

// 통계 카드 컴포넌트 (함수 컴포넌트 외부로 이동하여 호이스팅 문제 방지)
const StatCard = ({ title, value, color, icon, securityNote }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {icon}
        <Typography variant="h6" component="div" sx={{ ml: 1 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h4" component="div" sx={{ color }}>
        {value}
      </Typography>
      {securityNote && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
          {securityNote}
        </Typography>
      )}
    </CardContent>
  </Card>
);

function InspectionMode({ onLogout, loggedInStore, onModeChange, availableModes, presentationMode = false, initialTab = 0, detailOptions }) {
  // 상태 관리
  const [currentView, setCurrentView] = useState('personal'); // 'personal' | 'overview'
  
  const [inspectionData, setInspectionData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc' - 기본값을 오름차순으로 설정
  const [selectedTab, setSelectedTab] = useState(initialTab);
  const [selectedField, setSelectedField] = useState(detailOptions?.selectedField || 'all');

  
  // 필터 상태
  const [filters, setFilters] = useState({
    searchTerm: '',
    type: 'mismatch', // 초기값을 '값 불일치'로 변경
    duplicateType: 'all', // 중복 타입 필터 추가
    assignedAgent: 'all',
    completionStatus: 'all'
  });
  
  // 정규화 다이얼로그 상태
  const [normalizeDialog, setNormalizeDialog] = useState({
    open: false,
    item: null,
    normalizedValue: '',
    fieldValues: [],
    isLoadingValues: false
  });
  
  // 완료된 항목 추적 (해시화된 ID 사용)
  const [completedItems, setCompletedItems] = useState(new Set());
  
  // 수정완료 상태 추적 (먼저 선언하여 loadModificationCompletionStatus에서 사용 가능하도록)
  const [modificationCompletedItems, setModificationCompletedItems] = useState(new Set());
  
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  // 완료 상태 로드
  const loadCompletionStatus = useCallback(async () => {
    if (!loggedInStore?.contactId) return;
    
    try {
      // 검수결과 시트에서 완료 상태 로드
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/inspection/completion-status?userId=${loggedInStore.contactId}`);
      if (response.ok) {
        const data = await response.json();
        const completedSet = new Set(data.completedItems || []);
        setCompletedItems(completedSet);
      }
    } catch (error) {
      console.error('완료 상태 로드 오류:', error);
    }
  }, [loggedInStore?.contactId]);

  // 수정완료 상태 로드
  const loadModificationCompletionStatus = useCallback(async () => {
    if (!loggedInStore?.contactId) return;
    
    try {
      // currentView 직접 사용 (ref 제거)
      const view = currentView;
      // 현재 뷰에 따라 수정완료 상태 로드
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/inspection/modification-completion-status?userId=${loggedInStore.contactId}&view=${view}`);
      if (response.ok) {
        const data = await response.json();
        const completedSet = new Set(data.completedItems || []);
        setModificationCompletedItems(completedSet);
        
        // 내용 데이터도 함께 로드하여 inspectionData에 업데이트
        // inspectionData는 함수형 업데이트를 사용하여 의존성 제거
        setInspectionData(prev => {
          if (data.notes && prev?.differences) {
            return {
              ...prev,
              differences: prev.differences.map(diff => ({
                ...diff,
                notes: data.notes[diff.originalKey || diff.key] || ''
              }))
            };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('수정완료 상태 로드 오류:', error);
    }
  }, [loggedInStore?.contactId, currentView]);



  // 탭 기반 검수 항목 상태 (props에서 받은 값으로 초기화)
  const [fieldOptions, setFieldOptions] = useState([]);
  
  // 컬럼 설정 상태
  const [columnSettings, setColumnSettings] = useState(null);
  const [columnSettingsDialog, setColumnSettingsDialog] = useState({
    open: false,
    settings: null,
    isEditing: false
  });

  // 컬럼 설정 로드
  const loadColumnSettings = useCallback(async () => {
    try {
      const response = await fetchColumnSettings();
      if (response.success) {
        setColumnSettings(response.settings);
      }
    } catch (error) {
      console.error('컬럼 설정 로드 오류:', error);
    }
  }, []);

  // 데이터 로딩 (필드 변경 시 재로딩)
  const loadInspectionData = useCallback(async () => {
    if (!loggedInStore?.contactId) return;
    
    setIsLoading(true);
    setError(null);
    
    // currentView 직접 사용 (ref 제거)
    const view = currentView;
    
    // presentation mode에서는 detailOptions의 selectedField 사용
    const fieldToUse = presentationMode && detailOptions?.selectedField 
      ? detailOptions.selectedField 
      : selectedField;
    
    try {
      const response = await fetchInspectionData(
        view, 
        view === 'personal' ? loggedInStore.contactId : null,
        fieldToUse !== 'all' ? fieldToUse : undefined
      );
      
      if (response.success) {
        setInspectionData(response.data);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('검수 데이터 로딩 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [loggedInStore?.contactId, currentView, selectedField, presentationMode, detailOptions]);

  // 필드 목록 불러오기
  useEffect(() => {
    async function loadFields() {
      const response = await fetchAvailableFields();
      if (response.success) {
        setFieldOptions([{ key: 'all', name: '전체' }, ...response.data.fields]);
      } else {
        setFieldOptions([{ key: 'all', name: '전체' }]);
      }
    }
    loadFields();
    loadColumnSettings();
  }, [loadColumnSettings]);

  // 사용자 권한 확인
  const hasOverviewPermission = loggedInStore?.modePermissions?.inspectionOverview;

  // initialTab과 detailOptions가 변경되면 상태 업데이트 및 데이터 재로딩
  useEffect(() => {
    if (initialTab !== undefined && initialTab !== selectedTab) {
      setSelectedTab(initialTab);
    }
  }, [initialTab, selectedTab]);
  
  useEffect(() => {
    if (detailOptions?.selectedField !== undefined && detailOptions.selectedField !== selectedField) {
      setSelectedField(detailOptions.selectedField);
    }
  }, [detailOptions?.selectedField, selectedField]);
  
  // presentation mode에서 initialTab이나 detailOptions가 변경되면 데이터 재로딩
  useEffect(() => {
    if (presentationMode && (initialTab !== undefined || detailOptions?.selectedField !== undefined)) {
      loadInspectionData();
    }
  }, [presentationMode, initialTab, detailOptions?.selectedField, loadInspectionData]);

  // 데이터 로딩 통합: 초기 마운트 및 상태 변경 시
  useEffect(() => {
    if (!loggedInStore?.contactId) return;
    
    const loadAllData = async () => {
      try {
        await Promise.all([
          loadInspectionData(),
          loadCompletionStatus(),
          loadModificationCompletionStatus()
        ]);
      } catch (error) {
        console.error('데이터 로딩 오류:', error);
      }
    };
    
    loadAllData();
  }, [
    loggedInStore?.contactId,
    selectedField,
    selectedTab,
    currentView,
    loadInspectionData,
    loadCompletionStatus,
    loadModificationCompletionStatus
  ]);

  // 검수모드 진입 시 업데이트 팝업 표시 (숨김 설정 확인 후)
  useEffect(() => {
    // 오늘 하루 보지 않기 설정 확인
    const hideUntil = localStorage.getItem('hideUpdate_inspection');
    const shouldShowPopup = !(hideUntil && new Date() < new Date(hideUntil));
    
    if (shouldShowPopup) {
      // 숨김 설정이 없거나 만료된 경우에만 팝업 표시
      setShowUpdatePopup(true);
    }
  }, []);

  // 뷰 변경은 위의 통합 useEffect에서 처리되므로 별도 useEffect 제거

  // 필터링된 데이터 (해시화된 ID 사용)
  const filteredData = useMemo(() => {
    if (!inspectionData?.differences) return [];
    
    // 완료 상태를 포함한 데이터 (수정완료 상태도 포함)
    const differencesWithCompletion = inspectionData.differences.map(diff => ({
      ...diff,
              completed: completedItems.has(diff.id || diff.originalKey) || modificationCompletedItems.has(`${diff.originalKey || diff.key}_${diff.incorrectValue || ''}_${diff.correctValue || ''}`)
    }));
    
    let filtered = filterDifferences(differencesWithCompletion, filters);
    
    // 탭별 필터링 적용
    const currentTabItems = INSPECTION_TABS[selectedTab]?.items || [];
    if (currentTabItems.length > 0) {
      filtered = filtered.filter(diff => 
        currentTabItems.includes(diff.field)
      );
    }
    
    // 가입번호 기준 정렬
    filtered.sort((a, b) => {
      const keyA = (a.originalKey || a.key || '').toString();
      const keyB = (b.originalKey || b.key || '').toString();
      
      if (sortOrder === 'asc') {
        return keyA.localeCompare(keyB);
      } else {
        return keyB.localeCompare(keyA);
      }
    });
    
    return filtered;
  }, [inspectionData, filters, completedItems, modificationCompletedItems, sortOrder, selectedTab]);

  // 통계 계산
  const statistics = useMemo(() => {
    if (!inspectionData?.differences) return null;
    
    // 완료 상태를 포함한 통계 계산 (수정완료 상태도 포함)
    const differencesWithCompletion = inspectionData.differences.map(diff => ({
      ...diff,
              completed: completedItems.has(diff.key) || modificationCompletedItems.has(`${diff.originalKey || diff.key}_${diff.incorrectValue || ''}_${diff.correctValue || ''}`)
    }));
    
    // 탭별 필터링 적용
    const currentTabItems = INSPECTION_TABS[selectedTab]?.items || [];
    let filteredDifferences = differencesWithCompletion;
    if (currentTabItems.length > 0) {
      filteredDifferences = differencesWithCompletion.filter(diff => 
        currentTabItems.includes(diff.field)
      );
    }
    
    return calculateStatistics(filteredDifferences);
  }, [inspectionData, completedItems, modificationCompletedItems, selectedTab]);

  // 처리자 목록
  const assignedAgents = useMemo(() => {
    if (!inspectionData?.differences) return [];
    return extractAssignedAgents(inspectionData.differences);
  }, [inspectionData]);

  // 수정완료 상태 처리 (서버에 저장)
  const handleModificationComplete = async (item, isCompleted) => {
    if (!loggedInStore?.contactId) return;
    
    try {
      // 고유키 생성
      const uniqueKey = `${item.originalKey || item.key}_${item.incorrectValue || ''}_${item.correctValue || ''}`;
      
      // 서버에 상태 업데이트
      await updateModificationComplete(
        item.originalKey || item.key, 
        loggedInStore.contactId, 
        isCompleted,
        item.subscriptionNumber || item.originalKey || item.key,
        item.incorrectValue || '',
        item.correctValue || ''
      );
      
      // 로컬 상태 업데이트
      setModificationCompletedItems(prev => {
        const newSet = new Set(prev);
        if (isCompleted) {
          newSet.add(uniqueKey);
        } else {
          newSet.delete(uniqueKey);
        }
        return newSet;
      });
    } catch (error) {
      console.error('수정완료 상태 업데이트 오류:', error);
      alert('수정완료 상태 업데이트에 실패했습니다.');
    }
  };

  // 내용 편집 모드 시작
  const handleEditNotes = (item) => {
    setInspectionData(prev => {
      if (!prev?.differences) return prev;
      
      // 고유키 생성
      const itemUniqueKey = `${item.originalKey || item.key}_${item.incorrectValue || ''}_${item.correctValue || ''}`;
      
      return {
        ...prev,
        differences: prev.differences.map(diff => {
          const diffUniqueKey = `${diff.originalKey || diff.key}_${diff.incorrectValue || ''}_${diff.correctValue || ''}`;
          return diffUniqueKey === itemUniqueKey
            ? { ...diff, isEditingNotes: true }
            : diff;
        })
      };
    });
  };

  // 내용 저장
  const handleSaveNotes = async (item) => {
    if (!loggedInStore?.contactId) return;
    
    try {
      // 서버에 내용 업데이트
      await updateModificationNotes(
        item.originalKey || item.key, 
        loggedInStore.contactId, 
        item.notes || '',
        item.subscriptionNumber || item.originalKey || item.key,
        item.incorrectValue || '',
        item.correctValue || ''
      );
      
      // 편집 모드 종료
      setInspectionData(prev => {
        if (!prev?.differences) return prev;
        
        // 고유키 생성
        const itemUniqueKey = `${item.originalKey || item.key}_${item.incorrectValue || ''}_${item.correctValue || ''}`;
        
        return {
          ...prev,
          differences: prev.differences.map(diff => {
            const diffUniqueKey = `${diff.originalKey || diff.key}_${diff.incorrectValue || ''}_${diff.correctValue || ''}`;
            return diffUniqueKey === itemUniqueKey
              ? { ...diff, isEditingNotes: false }
              : diff;
          })
        };
      });
    } catch (error) {
      console.error('내용 업데이트 오류:', error);
      alert('내용 업데이트에 실패했습니다.');
    }
  };

  // 내용 편집 취소
  const handleCancelNotes = (item) => {
    setInspectionData(prev => {
      if (!prev?.differences) return prev;
      
      // 고유키 생성
      const itemUniqueKey = `${item.originalKey || item.key}_${item.incorrectValue || ''}_${item.correctValue || ''}`;
      
      return {
        ...prev,
        differences: prev.differences.map(diff => {
          const diffUniqueKey = `${diff.originalKey || diff.key}_${diff.incorrectValue || ''}_${diff.correctValue || ''}`;
          return diffUniqueKey === itemUniqueKey
            ? { ...diff, isEditingNotes: false }
            : diff;
        })
      };
    });
  };

  // 내용 변경 처리 (로컬 상태만 업데이트)
  const handleNotesChange = (item, notes) => {
    setInspectionData(prev => {
      if (!prev?.differences) return prev;
      
      // 고유키 생성
      const itemUniqueKey = `${item.originalKey || item.key}_${item.incorrectValue || ''}_${item.correctValue || ''}`;
      
      return {
        ...prev,
        differences: prev.differences.map(diff => {
          const diffUniqueKey = `${diff.originalKey || diff.key}_${diff.incorrectValue || ''}_${diff.correctValue || ''}`;
          return diffUniqueKey === itemUniqueKey
            ? { ...diff, notes }
            : diff;
        })
      };
    });
  };

  // 컬럼 설정 다이얼로그 열기
  const handleOpenColumnSettings = (fieldKey = null) => {
    if (columnSettings) {
      // 특정 필드의 설정만 필터링
      let filteredSettings = columnSettings;
      if (fieldKey) {
        const filteredMappings = columnSettings.dynamicMappings?.filter(
          mapping => mapping.key === fieldKey
        ) || [];
        filteredSettings = {
          ...columnSettings,
          dynamicMappings: filteredMappings
        };
      }
      
      setColumnSettingsDialog({
        open: true,
        settings: filteredSettings,
        isEditing: false,
        selectedField: fieldKey
      });
    }
  };

  // 컬럼 설정 저장
  const handleSaveColumnSettings = async (settings) => {
    try {
      await updateColumnSettings(settings);
      setColumnSettings(settings);
      setColumnSettingsDialog({ open: false, settings: null, isEditing: false });
      // 데이터 재로딩
      loadInspectionData();
    } catch (error) {
      console.error('컬럼 설정 저장 오류:', error);
      alert('컬럼 설정 저장에 실패했습니다.');
    }
  };



  // 정규화 다이얼로그 열기
  const handleNormalize = async (item) => {
    setNormalizeDialog(prev => ({
      ...prev,
      open: true,
      item,
      normalizedValue: item.correctValue || item.incorrectValue || '',
      fieldValues: [],
      isLoadingValues: true
    }));

    // 필드값 로드
    try {
      const response = await fetchFieldValues(item.field);
      if (response.success) {
        setNormalizeDialog(prev => ({
          ...prev,
          fieldValues: response.data.values || [],
          isLoadingValues: false
        }));
      } else {
        setNormalizeDialog(prev => ({
          ...prev,
          fieldValues: [],
          isLoadingValues: false
        }));
      }
    } catch (error) {
      console.error('필드값 로드 오류:', error);
      setNormalizeDialog(prev => ({
        ...prev,
        fieldValues: [],
        isLoadingValues: false
      }));
    }
  };

  // 폰클개통데이터 수정 처리 (해시화된 ID 사용)
  const handleUpdateSystemData = async (item) => {
    if (!loggedInStore?.contactId || !item.systemRow) return;
    
    try {
      const response = await updateSystemData(
        item.id || item.originalKey, // 해시화된 ID 사용
        loggedInStore.contactId,
        item.field,
        item.correctValue,
        item.systemRow
      );
      
      if (response.success) {
        // 성공 메시지 표시
        setError(null);
        // 데이터 다시 로드
        loadInspectionData();
      } else {
        setError('폰클개통데이터 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('폰클개통데이터 수정 오류:', error);
      setError('폰클개통데이터 수정 중 오류가 발생했습니다.');
    }
  };

  // 정규화 저장 (해시화된 ID 사용)
  const handleSaveNormalization = async () => {
    const { item, normalizedValue } = normalizeDialog;
    
    if (!normalizedValue.trim() || !loggedInStore?.contactId) return;
    
    try {
      const response = await saveNormalizationData(
        item.id || item.originalKey, // 해시화된 ID 사용
        loggedInStore.contactId,
        item.correctValue || item.incorrectValue,
        normalizedValue.trim(),
        item.field
      );
      
      if (response.success) {
        setNormalizeDialog({ open: false, item: null, normalizedValue: '', fieldValues: [], isLoadingValues: false });
        // 완료 상태 다시 로드
        loadCompletionStatus();
      } else {
        setError('정규화 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('정규화 저장 오류:', error);
      setError('정규화 저장 중 오류가 발생했습니다.');
    }
  };

  // 필터 변경
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // 뷰 전환
  const handleViewChange = (view) => {
    setCurrentView(view);
    setFilters({
      searchTerm: '',
      type: 'mismatch', // 값 불일치로 변경
      duplicateType: 'all', // 중복 타입 필터 추가
      assignedAgent: 'all',
      completionStatus: 'all'
    });
  };

  // 탭 변경 핸들러 (presentation mode에서는 탭 변경 불가)
  const handleTabChange = useCallback((event, newValue) => {
    if (presentationMode) return; // presentation mode에서는 탭 변경 불가
    if (newValue === selectedTab) return; // 같은 탭이면 변경하지 않음
    
    setSelectedTab(newValue);
    setSelectedField('all'); // 탭 변경 시 필드 선택 초기화
    // 탭 변경 시 데이터는 useEffect에서 자동으로 재로딩됨
  }, [presentationMode, selectedTab]);

  // 중복 타입 관련 함수들
  const getDuplicateTypeLabel = (duplicateType) => {
    switch (duplicateType) {
      case 'manual_duplicate':
        return '수기초중복';
      case 'system_duplicate':
        return '폰클중복';
      case 'both_duplicate':
        return '양쪽중복';
      case 'no_duplicate':
        return ''; // 빈 공란
      default:
        return '';
    }
  };

  const getDuplicateTypeColor = (duplicateType) => {
    switch (duplicateType) {
      case 'manual_duplicate':
        return 'info';
      case 'system_duplicate':
        return 'warning';
      case 'both_duplicate':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 - presentation mode에서는 숨김 */}
      {!presentationMode && (
        <AppBar position="static" sx={{ backgroundColor: '#1976d2' }}>
          <Toolbar>
          <AssignmentIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            검수 모드
            {loggedInStore?.name && (
              <Typography variant="body2" component="span" sx={{ ml: 2, opacity: 0.8 }}>
                ({loggedInStore.name})
              </Typography>
            )}
          </Typography>
          
          {/* 뷰 전환 버튼 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            <Button
              variant={currentView === 'personal' ? 'contained' : 'outlined'}
              onClick={() => handleViewChange('personal')}
              size="small"
              sx={{ color: 'white', borderColor: 'white' }}
            >
              <PersonIcon sx={{ mr: 1 }} />
              개인 담당
            </Button>
            <Button
              variant={currentView === 'overview' ? 'contained' : 'outlined'}
              onClick={() => handleViewChange('overview')}
              size="small"
              disabled={!hasOverviewPermission}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              <BusinessIcon sx={{ mr: 1 }} />
              전체 현황
            </Button>
          </Box>
          
          {/* 새로고침 버튼 */}
          <IconButton 
            color="inherit" 
            onClick={loadInspectionData}
            disabled={isLoading}
            sx={{ mr: 2 }}
          >
            <RefreshIcon />
          </IconButton>
          
          {/* 업데이트 확인 버튼 */}
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={() => setShowUpdatePopup(true)}
            sx={{ mr: 2 }}
          >
            업데이트 확인
          </Button>
          
          {/* 모드 전환 버튼 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={onModeChange}
              startIcon={<SwapHorizIcon />}
              sx={{ mr: 2 }}
            >
              모드 변경
            </Button>
          )}
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
        </AppBar>
      )}

      {/* 메인 콘텐츠 */}
      <Container maxWidth="xl" sx={{ flex: 1, py: 2, overflow: 'auto' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 로딩 상태 표시 */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                검수 데이터를 불러오는 중...
              </Typography>
            </Box>
          </Box>
        )}

        {/* 데이터 없음 상태 표시 */}
        {!isLoading && (!inspectionData || !inspectionData.differences) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <InfoIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                검수할 데이터가 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                수기초와 폰클개통데이터를 비교할 차이점이 없거나 데이터를 불러올 수 없습니다.
              </Typography>
              <Button 
                variant="outlined" 
                onClick={loadInspectionData}
                startIcon={<RefreshIcon />}
              >
                다시 시도
              </Button>
            </Box>
          </Box>
        )}

        {/* 검수 항목 탭 - presentation mode에서는 숨김 */}
        {!presentationMode && !isLoading && inspectionData && inspectionData.differences && (
          <Paper sx={{ mb: 2 }}>
            <Tabs 
              value={selectedTab} 
              onChange={handleTabChange}
              sx={{ 
                borderBottom: 1, 
                borderColor: 'divider',
                backgroundColor: '#fafafa'
              }}
            >
              <Tab 
                label={INSPECTION_TABS[0].label}
                sx={{ 
                  fontWeight: 'bold',
                  '&.Mui-selected': { color: '#1976d2' }
                }}
              />
              <Tab 
                label={INSPECTION_TABS[1].label}
                sx={{ 
                  fontWeight: 'bold',
                  '&.Mui-selected': { color: '#2e7d32' }
                }}
              />
              <Tab 
                label={INSPECTION_TABS[2].label}
                sx={{ 
                  fontWeight: 'bold',
                  '&.Mui-selected': { color: '#d32f2f' }
                }}
              />
            </Tabs>
          </Paper>
        )}

        {/* 세부 필터 (탭 내에서 특정 항목 선택) - presentation mode에서는 숨김 */}
        {!presentationMode && !isLoading && inspectionData && inspectionData.differences && (
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>세부 항목</InputLabel>
              <Select
                value={selectedField}
                label="세부 항목"
                onChange={e => setSelectedField(e.target.value)}
              >
                <MenuItem value="all">모든 항목</MenuItem>
                {fieldOptions
                  .filter(option => {
                    const currentTabItems = INSPECTION_TABS[selectedTab]?.items || [];
                    return currentTabItems.includes(option.name);
                  })
                  .map(option => (
                    <MenuItem key={option.key} value={option.key}>
                      <Box>
                        <Typography variant="body2">{option.name}</Typography>
                        {option.description && (
                          <Typography variant="caption" color="text.secondary">
                            {option.description}
                          </Typography>
                        )}
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            
            {selectedField !== 'all' && (
              <Typography variant="body2" color="text.secondary">
                {fieldOptions.find(f => f.key === selectedField)?.description}
              </Typography>
            )}
          </Box>
        )}

        {/* 통계 카드 */}
        {!isLoading && statistics && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="전체"
                value={statistics.total}
                color="#1976d2"
                icon={<InfoIcon color="primary" />}
                securityNote={inspectionData?.securityNote}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="완료"
                value={statistics.completed}
                color="#2e7d32"
                icon={<CheckCircleIcon color="success" />}
                securityNote={inspectionData?.securityNote}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="대기"
                value={statistics.pending}
                color="#ed6c02"
                icon={<WarningIcon color="warning" />}
                securityNote={inspectionData?.securityNote}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="완료율"
                value={`${statistics.completionRate}%`}
                color="#1976d2"
                icon={<TrendingUpIcon color="primary" />}
                securityNote={inspectionData?.securityNote}
              />
            </Grid>
          </Grid>
        )}

        {/* 진행률 바 */}
        {!isLoading && statistics && statistics.total > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ mr: 1 }}>
                검수 진행률
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statistics.completed} / {statistics.total}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={statistics.completionRate} 
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {/* 필터 패널 */}
        {!isLoading && inspectionData && inspectionData.differences && (
          <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="검색..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>중복 타입</InputLabel>
                <Select
                  value={filters.duplicateType}
                  onChange={(e) => handleFilterChange('duplicateType', e.target.value)}
                  label="중복 타입"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="no_duplicate">중복 없음</MenuItem>
                  <MenuItem value="manual_duplicate">수기초중복</MenuItem>
                  <MenuItem value="system_duplicate">폰클중복</MenuItem>
                  <MenuItem value="both_duplicate">양쪽중복</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>타입</InputLabel>
                <Select
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                  label="타입"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="manual_only">수기초내용없음</MenuItem>
                  <MenuItem value="system_only">폰클내용없음</MenuItem>
                  <MenuItem value="mismatch">값 불일치</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {currentView === 'overview' && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>처리자</InputLabel>
                  <Select
                    value={filters.assignedAgent}
                    onChange={(e) => handleFilterChange('assignedAgent', e.target.value)}
                    label="처리자"
                  >
                    <MenuItem value="all">전체</MenuItem>
                    {assignedAgents.map(agent => (
                      <MenuItem key={agent} value={agent}>{agent}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>완료 상태</InputLabel>
                <Select
                  value={filters.completionStatus}
                  onChange={(e) => handleFilterChange('completionStatus', e.target.value)}
                  label="완료 상태"
                >
                  <MenuItem value="all">전체</MenuItem>
                  <MenuItem value="completed">완료</MenuItem>
                  <MenuItem value="pending">대기</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
        )}



        {/* 데이터 테이블 */}
        {!isLoading && inspectionData && inspectionData.differences && (
          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      가입번호
                      <IconButton
                        size="small"
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        sx={{ p: 0.5 }}
                      >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </IconButton>
                    </Box>
                  </TableCell>
                  <TableCell>가입번호중복</TableCell>
                  <TableCell>타입</TableCell>
                  <TableCell>수기초값</TableCell>
                  <TableCell>폰클데이터값</TableCell>
                  <TableCell>처리자</TableCell>
                  <TableCell>수정완료</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>내용</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      데이터가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item, index) => (
                    <TableRow 
                      key={`${item.originalKey || item.key}-${index}`}
                      sx={{ 
                        backgroundColor: item.isDuplicate && item.duplicateType !== 'no_duplicate' ? 
                          (item.duplicateType === 'manual_duplicate' ? '#e3f2fd' :
                           item.duplicateType === 'system_duplicate' ? '#fff3e0' :
                           item.duplicateType === 'both_duplicate' ? '#ffebee' : 'inherit') : 'inherit',
                        '&:hover': {
                          backgroundColor: item.isDuplicate && item.duplicateType !== 'no_duplicate' ? 
                            (item.duplicateType === 'manual_duplicate' ? '#bbdefb' :
                             item.duplicateType === 'system_duplicate' ? '#ffe0b2' :
                             item.duplicateType === 'both_duplicate' ? '#ffcdd2' : 'inherit') : 'inherit'
                        }
                      }}
                    >
                      <TableCell>{item.originalKey || item.key}</TableCell>
                      <TableCell>
                        {item.isDuplicate && item.duplicateType !== 'no_duplicate' && (
                          <Box>
                            <Chip
                              label={getDuplicateTypeLabel(item.duplicateType)}
                              size="small"
                              color={getDuplicateTypeColor(item.duplicateType)}
                              sx={{ fontWeight: 'bold', mb: 1 }}
                            />
                            {item.duplicateInfo && (
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  display: 'block', 
                                  fontSize: '0.7rem',
                                  color: 'text.secondary',
                                  wordBreak: 'break-word',
                                  maxWidth: 200
                                }}
                              >
                                {item.duplicateInfo}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getDifferenceTypeLabel(item.type)}
                          size="small"
                          sx={{ 
                            backgroundColor: getDifferenceTypeColor(item.type),
                            color: 'white'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, wordBreak: 'break-word', color: 'success.main', fontWeight: 'bold' }}>
                        {item.fieldKey === 'activation_datetime' ? 
                          `수기초: ${item.correctValue}` : 
                          item.correctValue}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, wordBreak: 'break-word', color: 'error.main' }}>
                        {item.fieldKey === 'activation_datetime' ? 
                          `폰클: ${item.incorrectValue}` : 
                          item.incorrectValue}
                      </TableCell>
                      <TableCell>{item.assignedAgent}</TableCell>
                      <TableCell>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={modificationCompletedItems.has(`${item.originalKey || item.key}_${item.incorrectValue || ''}_${item.correctValue || ''}`)}
                              onChange={(e) => handleModificationComplete(item, e.target.checked)}
                              size="small"
                            />
                          }
                          label=""
                        />
                      </TableCell>
                      <TableCell>
                        {modificationCompletedItems.has(`${item.originalKey || item.key}_${item.incorrectValue || ''}_${item.correctValue || ''}`) ? (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label="완료"
                            color="success"
                            size="small"
                          />
                        ) : (
                          <Chip
                            label="대기"
                            color="warning"
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {item.notes ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-word' }}>
                              {item.notes}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => handleEditNotes(item)}
                              sx={{ p: 0.5 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <IconButton
                            size="small"
                            onClick={() => handleEditNotes(item)}
                            sx={{ p: 0.5 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                        {item.isEditingNotes && (
                          <Box sx={{ mt: 1 }}>
                            <TextField
                              size="small"
                              placeholder="수정 불가 사유 등"
                              value={item.notes || ''}
                              onChange={(e) => handleNotesChange(item, e.target.value)}
                              multiline
                              rows={2}
                              fullWidth
                              sx={{ mb: 1 }}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleSaveNotes(item)}
                              >
                                확인
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleCancelNotes(item)}
                              >
                                취소
                              </Button>
                            </Box>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        )}
      </Container>

      {/* 컬럼 설정 다이얼로그 */}
      <Dialog 
        open={columnSettingsDialog.open} 
        onClose={() => setColumnSettingsDialog({ open: false, settings: null, isEditing: false })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {columnSettingsDialog.selectedField === 'store_code' ? '대리점코드 설정' :
           columnSettingsDialog.selectedField === 'activation_datetime' ? '개통일시분 설정' :
           '컬럼 설정'}
          {!columnSettingsDialog.isEditing && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setColumnSettingsDialog(prev => ({ ...prev, isEditing: true }))}
              sx={{ ml: 2 }}
            >
              수정
            </Button>
          )}
        </DialogTitle>
        <DialogContent>
          {columnSettingsDialog.settings && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>기본 컬럼 설정</Typography>
                  
                  <TextField
                    fullWidth
                    label="수기초 가입번호 컬럼"
                    value={columnSettingsDialog.settings.manualKeyColumn}
                    disabled={!columnSettingsDialog.isEditing}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="수기초 가입번호 컬럼명"
                    value={columnSettingsDialog.settings.manualKeyColumnName}
                    disabled={!columnSettingsDialog.isEditing}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="폰클개통데이터 메모1 컬럼"
                    value={columnSettingsDialog.settings.systemKeyColumn}
                    disabled={!columnSettingsDialog.isEditing}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="폰클개통데이터 메모1 컬럼명"
                    value={columnSettingsDialog.settings.systemKeyColumnName}
                    disabled={!columnSettingsDialog.isEditing}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>추가 컬럼 설정</Typography>
                  
                  <TextField
                    fullWidth
                    label="폰클개통데이터 등록직원 컬럼"
                    value={columnSettingsDialog.settings.systemAgentColumn}
                    disabled={!columnSettingsDialog.isEditing}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="폰클개통데이터 등록직원 컬럼명"
                    value={columnSettingsDialog.settings.systemAgentColumnName}
                    disabled={!columnSettingsDialog.isEditing}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="폰클개통데이터 메모2 컬럼"
                    value={columnSettingsDialog.settings.systemMemo2Column}
                    disabled={!columnSettingsDialog.isEditing}
                    sx={{ mb: 2 }}
                  />
                  
                  <TextField
                    fullWidth
                    label="폰클개통데이터 메모2 컬럼명"
                    value={columnSettingsDialog.settings.systemMemo2ColumnName}
                    disabled={!columnSettingsDialog.isEditing}
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 2 }}>동적 매칭 설정</Typography>
                  {columnSettingsDialog.settings.dynamicMappings?.map((mapping, index) => (
                    <Paper key={index} sx={{ p: 2, mb: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        {mapping.description}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="수기초 컬럼"
                            value={mapping.manualColumn}
                            disabled={!columnSettingsDialog.isEditing}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="폰클개통데이터 컬럼"
                            value={mapping.systemColumn}
                            disabled={!columnSettingsDialog.isEditing}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setColumnSettingsDialog({ open: false, settings: null, isEditing: false })}
          >
            닫기
          </Button>
          {columnSettingsDialog.isEditing && (
            <Button 
              onClick={() => handleSaveColumnSettings(columnSettingsDialog.settings)}
              variant="contained"
            >
              저장
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* 정규화 다이얼로그 */}
      <Dialog 
        open={normalizeDialog.open} 
        onClose={() => setNormalizeDialog({ open: false, item: null, normalizedValue: '', fieldValues: [], isLoadingValues: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>데이터 정규화</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              가입번호: {normalizeDialog.item?.originalKey || normalizeDialog.item?.key}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              필드: {normalizeDialog.item?.field}
            </Typography>
            <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
              정확한 값 (수기초): {normalizeDialog.item?.correctValue}
            </Typography>
            <Typography variant="body2" color="error.main">
              잘못된 값 (폰클개통데이터): {normalizeDialog.item?.incorrectValue}
            </Typography>
          </Box>
          {normalizeDialog.isLoadingValues ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Autocomplete
              freeSolo
              options={normalizeDialog.fieldValues}
              value={normalizeDialog.normalizedValue}
              onChange={(event, newValue) => {
                setNormalizeDialog(prev => ({
                  ...prev,
                  normalizedValue: newValue || ''
                }));
              }}
              onInputChange={(event, newInputValue) => {
                setNormalizeDialog(prev => ({
                  ...prev,
                  normalizedValue: newInputValue
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="정규화된 값"
                  placeholder="기존 값에서 선택하거나 새로 입력하세요..."
                  multiline
                  rows={3}
                />
              )}
              loading={normalizeDialog.isLoadingValues}
              noOptionsText="일치하는 값이 없습니다"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setNormalizeDialog({ open: false, item: null, normalizedValue: '', fieldValues: [], isLoadingValues: false })}
          >
            취소
          </Button>
          <Button 
            onClick={handleSaveNormalization}
            variant="contained"
            disabled={!normalizeDialog.normalizedValue.trim()}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* 업데이트 진행 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="inspection"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          // 업데이트 추가 시 처리 (필요시 로직 추가)
        }}
      />
      
    </Box>
  );
}

export default InspectionMode; 