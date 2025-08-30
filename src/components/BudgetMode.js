import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Button,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  AccountBalance as BudgetIcon,
  Construction as ConstructionIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Update as UpdateIcon,
  SwapHoriz as SwapHorizIcon,
  ContentPaste as PasteIcon,
  Save as SaveIcon,
  Calculate as CalculateIcon,
  Add as AddIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';
import { budgetMonthSheetAPI, budgetUserSheetAPI, budgetPolicyGroupAPI, budgetSummaryAPI } from '../api';

function BudgetMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 액면예산 서브메뉴 상태
  const [faceValueSubMenu, setFaceValueSubMenu] = useState('Ⅰ'); // Ⅰ, Ⅱ, 종합
  const [showFaceValueDropdown, setShowFaceValueDropdown] = useState(false);
  
  // 액면예산 관련 상태
  const [budgetData, setBudgetData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // 액면예산 종합 관련 상태
  const [summaryData, setSummaryData] = useState({
    totalRemainingBudget: 0,
    totalSecuredBudget: 0,
    totalUsedBudget: 0
  });
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  
  // 예산금액 설정 상태 (예산 타입에 따라 다른 기본값)
  const getDefaultBudgetAmounts = () => {
    const defaultAmount = faceValueSubMenu === 'Ⅱ' ? 0 : 40000;
    return {
      S군: defaultAmount,
      A군: defaultAmount,
      B군: defaultAmount,
      C군: defaultAmount,
      D군: defaultAmount,
      E군: defaultAmount
    };
  };
  
  const [budgetAmounts, setBudgetAmounts] = useState(getDefaultBudgetAmounts());
  
  // 시트 설정 관련 상태
  const [targetMonth, setTargetMonth] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [canEditSheetId, setCanEditSheetId] = useState(false);
  const [monthSheetMappings, setMonthSheetMappings] = useState({}); // 월별 시트 ID 매핑
  const [detailedMonthData, setDetailedMonthData] = useState({}); // 상세 데이터 (수정일시, 수정자 포함)
  
  // 저장된 데이터 목록 관련 상태
  const [userSheets, setUserSheets] = useState([]);
  const [showSheetList, setShowSheetList] = useState(false);
  const [showMonthSheetList, setShowMonthSheetList] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  // 날짜/시간 입력 상태
  const [dateRange, setDateRange] = useState({
    receiptStartDate: '',
    receiptStartTime: '10:00',
    receiptEndDate: '',
    receiptEndTime: '23:59',
    activationStartDate: '',
    activationStartTime: '10:00',
    activationEndDate: '',
    activationEndTime: '23:59'
  });
  
  // 접수일 적용 여부
  const [applyReceiptDate, setApplyReceiptDate] = useState(false);

  // 정책그룹 관련 상태
  const [policyGroups, setPolicyGroups] = useState([]);
  const [selectedPolicyGroups, setSelectedPolicyGroups] = useState([]);
  const [policyGroupSettings, setPolicyGroupSettings] = useState([]);
  const [showPolicyGroupModal, setShowPolicyGroupModal] = useState(false);
  const [showSaveSettingsModal, setShowSaveSettingsModal] = useState(false);
  const [showLoadSettingsModal, setShowLoadSettingsModal] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleFaceValueSubMenuChange = (subMenu) => {
    setFaceValueSubMenu(subMenu);
    setShowFaceValueDropdown(false);
    // 서브메뉴 변경 시 사용자 시트 목록 새로고침
    if (showSheetList) {
      loadUserSheets(subMenu); // 새로운 subMenu 값을 직접 전달
    }
  };

  // 컴포넌트 마운트 시 업데이트 팝업 표시
  useEffect(() => {
    setShowUpdatePopup(true);
    
    // 권한 레벨 확인 - 다양한 필드에서 SS 레벨 확인
    const userRole = loggedInStore?.userRole || loggedInStore?.agentInfo?.userRole || loggedInStore?.level || '';
    console.log('예산모드 권한 확인:', { 
      userRole, 
      loggedInStore,
      userRole_direct: loggedInStore?.userRole,
      agentInfo: loggedInStore?.agentInfo,
      level: loggedInStore?.level
    });
    setCanEditSheetId(userRole === 'SS');
    
    // 구글시트에서 월별 시트 ID 매핑 불러오기
    loadMonthSheetMappings();
    
    // 사용자 시트 목록 불러오기
    loadUserSheets();
    
    // 정책그룹 목록 불러오기
    loadPolicyGroups();
    
    // 정책그룹 설정 목록 불러오기
    loadPolicyGroupSettings();
  }, [loggedInStore]);

  // 액면예산 타입 변경 시 예산금액 초기화 및 시트 목록 재로드
  useEffect(() => {
    // 명시적으로 현재 faceValueSubMenu 값에 따른 기본값 설정
    const defaultAmount = faceValueSubMenu === 'Ⅱ' ? 0 : 40000;
    const newBudgetAmounts = {
      S군: defaultAmount,
      A군: defaultAmount,
      B군: defaultAmount,
      C군: defaultAmount,
      D군: defaultAmount,
      E군: defaultAmount
    };
    setBudgetAmounts(newBudgetAmounts);
    
    // 타입 변경 시 즉시 기존 목록 초기화 후 새로 로드
    setUserSheets([]); // 기존 목록 즉시 초기화
    if (targetMonth) {
      // 명시적으로 현재 faceValueSubMenu 값을 전달하여 상태 업데이트 타이밍 문제 방지
      loadUserSheets(faceValueSubMenu);
    }
  }, [faceValueSubMenu]);

  // 대상월 변경 시 시트 목록 새로고침
  useEffect(() => {
    if (targetMonth) {
      loadUserSheets();
    }
  }, [targetMonth]);

  // selectedPolicyGroups 상태 변화 모니터링
  useEffect(() => {
    console.log('selectedPolicyGroups state changed:', selectedPolicyGroups);
  }, [selectedPolicyGroups]);

  // 정책그룹 설정 불러오기 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (showLoadSettingsModal) {
      console.log('정책그룹 설정 불러오기 모달이 열림, 데이터 로드 시작');
      loadPolicyGroupSettings();
    }
  }, [showLoadSettingsModal]);

  // 정책그룹 선택 모달이 열릴 때 상태 확인
  useEffect(() => {
    if (showPolicyGroupModal) {
      console.log('정책그룹 선택 모달이 열림, 현재 selectedPolicyGroups:', selectedPolicyGroups);
    }
  }, [showPolicyGroupModal, selectedPolicyGroups]);

  // 업데이트 팝업 강제 열기
  const handleForceShowUpdatePopup = () => {
    // "오늘 하루 보지 않기" 설정을 임시로 제거
    localStorage.removeItem(`hideUpdate_budget`);
    setShowUpdatePopup(true);
  };

  // 구글시트에서 월별 시트 ID 매핑 불러오기
  const loadMonthSheetMappings = async () => {
    try {
      const data = await budgetMonthSheetAPI.getMonthSheets();
      const mappings = {};
      const detailedData = {};
      data.forEach(item => {
        mappings[item.month] = item.sheetId;
        detailedData[item.month] = {
          sheetId: item.sheetId,
          updatedAt: item.updatedAt,
          updatedBy: item.updatedBy
        };
      });
      setMonthSheetMappings(mappings);
      setDetailedMonthData(detailedData);
    } catch (error) {
      console.error('월별 시트 ID 로드 실패:', error);
      setSnackbar({ open: true, message: '월별 시트 ID 로드에 실패했습니다.', severity: 'error' });
    }
  };

  // 사용자 시트 목록 불러오기
  const loadUserSheets = async (currentSubMenu = null) => {
    try {
      const userId = loggedInStore?.id || loggedInStore?.agentInfo?.id || 'unknown';
      // 현재 서브메뉴 값 사용 (파라미터가 있으면 우선, 없으면 state 값 사용)
      const activeSubMenu = currentSubMenu || faceValueSubMenu;
      // 액면예산(Ⅰ)에서는 모든 사용자의 정책을 볼 수 있도록 설정
      // 액면예산(Ⅱ)에서는 본인의 정책만 볼 수 있도록 설정
      const showAllUsers = activeSubMenu === 'Ⅰ';
      // 예산 타입별 필터링을 위해 budgetType 전달
      const budgetType = activeSubMenu; // 'Ⅰ', 'Ⅱ', '종합'
      
      console.log('🔍 [Frontend] loadUserSheets 호출:', {
        activeSubMenu,
        faceValueSubMenu,
        userId,
        targetMonth,
        showAllUsers,
        budgetType
      });
      
      const data = await budgetUserSheetAPI.getUserSheets(userId, targetMonth, showAllUsers, budgetType);
      
      setUserSheets(data);
    } catch (error) {
      console.error('사용자 시트 목록 로드 실패:', error);
      setSnackbar({ open: true, message: '저장된 데이터 목록 로드에 실패했습니다.', severity: 'error' });
    }
  };

  // 정책그룹 목록 불러오기
  const loadPolicyGroups = async () => {
    try {
      const data = await budgetPolicyGroupAPI.getPolicyGroups();
      setPolicyGroups(data.policyGroups || []);
    } catch (error) {
      console.error('정책그룹 목록 로드 실패:', error);
      setSnackbar({ open: true, message: '정책그룹 목록 로드에 실패했습니다.', severity: 'error' });
    }
  };

  // 정책그룹 설정 목록 불러오기
  const loadPolicyGroupSettings = async () => {
    try {
      console.log('loadPolicyGroupSettings 호출됨');
      const data = await budgetPolicyGroupAPI.getPolicyGroupSettings();
      console.log('정책그룹 설정 데이터:', data);
      setPolicyGroupSettings(data.settings || []);
      console.log('policyGroupSettings 상태 설정됨:', data.settings || []);
    } catch (error) {
      console.error('정책그룹 설정 목록 로드 실패:', error);
      setSnackbar({ open: true, message: '정책그룹 설정 목록 로드에 실패했습니다.', severity: 'error' });
    }
  };

  // 정책그룹 선택/해제
  const handlePolicyGroupToggle = (group) => {
    console.log('Toggling policy group:', group, 'Current selectedPolicyGroups:', selectedPolicyGroups);
    setSelectedPolicyGroups(prev => {
      const currentGroups = prev || [];
      const newState = currentGroups.includes(group) 
        ? currentGroups.filter(g => g !== group)
        : [...currentGroups, group];
      console.log('New selectedPolicyGroups state:', newState);
      return newState;
    });
  };

  // 정책그룹 설정 저장
  const handleSavePolicyGroupSettings = async () => {
    if (!settingsName.trim()) {
      setSnackbar({ open: true, message: '저장이름을 입력해주세요.', severity: 'warning' });
      return;
    }

    try {
      await budgetPolicyGroupAPI.savePolicyGroupSettings(settingsName.trim(), selectedPolicyGroups);
      setSnackbar({ open: true, message: '정책그룹 설정이 저장되었습니다.', severity: 'success' });
      setShowSaveSettingsModal(false);
      setSettingsName('');
      loadPolicyGroupSettings(); // 목록 새로고침
    } catch (error) {
      console.error('정책그룹 설정 저장 실패:', error);
      setSnackbar({ open: true, message: '정책그룹 설정 저장에 실패했습니다.', severity: 'error' });
    }
  };

  // 정책그룹 설정 불러오기
  const handleLoadPolicyGroupSettings = async (setting) => {
    try {
      console.log('Loading policy group setting:', setting);
      console.log('Setting selectedPolicyGroups to:', setting.groups);
      setSelectedPolicyGroups(setting.groups);
      setShowLoadSettingsModal(false);
      setSnackbar({ open: true, message: '정책그룹 설정을 불러왔습니다.', severity: 'success' });
    } catch (error) {
      console.error('정책그룹 설정 불러오기 실패:', error);
      setSnackbar({ open: true, message: '정책그룹 설정 불러오기에 실패했습니다.', severity: 'error' });
    }
  };

  // 정책그룹 설정 삭제
  const handleDeletePolicyGroupSettings = async (settingName) => {
    try {
      await budgetPolicyGroupAPI.deletePolicyGroupSettings(settingName);
      setSnackbar({ open: true, message: '정책그룹 설정이 삭제되었습니다.', severity: 'success' });
      loadPolicyGroupSettings(); // 목록 새로고침
    } catch (error) {
      console.error('정책그룹 설정 삭제 실패:', error);
      setSnackbar({ open: true, message: '정책그룹 설정 삭제에 실패했습니다.', severity: 'error' });
    }
  };

  // 전체 재계산 함수
  const handleRecalculateAll = async () => {
    if (isRecalculating) return;
    
    setIsRecalculating(true);
    try {
      console.log('🔄 [Frontend] 전체 재계산 시작');
      
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://jegomap2-server.onrender.com';
      const response = await fetch(`${API_BASE_URL}/api/budget/recalculate-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.message) {
        setSnackbar({ 
          open: true, 
          message: `전체 재계산이 완료되었습니다. (${result.processedSheets || 0}개 시트 처리)`, 
          severity: 'success' 
        });
        
        // 성공한 시트들의 결과 로그
        console.log('✅ [Frontend] 재계산 성공 결과:', result);
        
        // 목록 새로고침
        if (showSheetList) {
          loadUserSheets();
        }
      } else {
        throw new Error(result.error || '재계산 중 오류가 발생했습니다.');
      }
      
    } catch (error) {
      console.error('❌ [Frontend] 전체 재계산 실패:', error);
      setSnackbar({ 
        open: true, 
        message: `전체 재계산 실패: ${error.message}`, 
        severity: 'error' 
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // 미리보기 열기 (축소 테이블 데이터 로드)
  const openPreview = async (sheet) => {
    setPreviewData(sheet);
    setShowPreviewModal(true);
    setIsLoadingPreview(true);
    setPreviewRows([]);
    try {
      const userName = sheet.userName || sheet.creator || loggedInStore?.name || loggedInStore?.agentInfo?.name || 'unknown';
      const currentUserId = loggedInStore?.id || loggedInStore?.agentInfo?.id || loggedInStore?.contactId;
      const result = await budgetUserSheetAPI.loadBudgetData(sheet.id, userName, currentUserId, faceValueSubMenu);
      const rows = [];
      if (result?.data && Array.isArray(result.data)) {
        const modelGroups = {};
        result.data.forEach(item => {
          if (!modelGroups[item.modelName]) {
            modelGroups[item.modelName] = {
              modelName: item.modelName,
              expenditureValues: new Array(18).fill(0)
            };
          }
          const armyIndex = ['S군', 'A군', 'B군', 'C군', 'D군', 'E군'].indexOf(item.armyType);
          const categoryIndex = ['신규', 'MNP', '보상'].indexOf(item.categoryType);
          if (armyIndex !== -1 && categoryIndex !== -1) {
            const columnIndex = armyIndex * 3 + categoryIndex;
            modelGroups[item.modelName].expenditureValues[columnIndex] = Math.round((item.usedBudget || 0) / 10000);
          }
        });
        // 최대 10개 모델만 미리보기
        const compact = Object.values(modelGroups).slice(0, 10);
        setPreviewRows(compact);
      }
    } catch (e) {
      console.error('미리보기 데이터 로드 실패:', e);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 액면예산 종합 데이터 로드
  const loadSummaryData = async () => {
    if (!targetMonth) {
      setSnackbar({ open: true, message: '대상월을 먼저 선택해주세요.', severity: 'warning' });
      return;
    }
    
    try {
      setIsLoadingSummary(true);
      const userId = loggedInStore?.id || loggedInStore?.agentInfo?.id || 'unknown';
      const result = await budgetSummaryAPI.getSummary(targetMonth, userId);
      
      if (result.success) {
        setSummaryData(result.summary);
        setSnackbar({ open: true, message: '액면예산 종합 데이터를 로드했습니다.', severity: 'success' });
      }
    } catch (error) {
      console.error('액면예산 종합 데이터 로드 실패:', error);
      setSnackbar({ open: true, message: '액면예산 종합 데이터 로드에 실패했습니다.', severity: 'error' });
    } finally {
      setIsLoadingSummary(false);
    }
  };



  // 저장된 사용자 시트 데이터 불러오기
  const handleLoadUserSheet = async (sheet) => {
    try {
      setIsProcessing(true);
      const userName = sheet.userName || sheet.creator || loggedInStore?.name || loggedInStore?.agentInfo?.name || 'unknown';
      const currentUserId = loggedInStore?.id || loggedInStore?.agentInfo?.id || loggedInStore?.contactId;
      
      const result = await budgetUserSheetAPI.loadBudgetData(sheet.id, userName, currentUserId, faceValueSubMenu);
      
      console.log('Loaded budget data result:', result);
      console.log('Parsed data:', result.data);
      console.log('First few items with budget values:', result.data?.slice(0, 3).map(item => ({
        id: item.id,
        modelName: item.modelName,
        securedBudget: { value: item.securedBudget, type: typeof item.securedBudget },
        usedBudget: { value: item.usedBudget, type: typeof item.usedBudget },
        remainingBudget: { value: item.remainingBudget, type: typeof item.remainingBudget }
      })));
      
      // 서버 데이터를 프론트엔드 테이블 형식으로 변환
      const transformedData = [];
      if (result.data && Array.isArray(result.data)) {
        // 모델별로 그룹화
        const modelGroups = {};
        
        result.data.forEach(item => {
          if (!modelGroups[item.modelName]) {
            modelGroups[item.modelName] = {
              modelName: item.modelName,
              expenditureValues: new Array(18).fill(0) // 18개 컬럼 초기화
            };
          }
          
          // 군과 유형에 따라 해당 컬럼 인덱스 찾기
          const armyIndex = ['S군', 'A군', 'B군', 'C군', 'D군', 'E군'].indexOf(item.armyType);
          const categoryIndex = ['신규', 'MNP', '보상'].indexOf(item.categoryType);
          
          if (armyIndex !== -1 && categoryIndex !== -1) {
            const columnIndex = armyIndex * 3 + categoryIndex;
            // 사용된 예산을 1만원 단위로 변환 (원 단위 -> 1만원 단위)
            modelGroups[item.modelName].expenditureValues[columnIndex] = Math.round(item.usedBudget / 10000);
          }
        });
        
        // 그룹화된 데이터를 배열로 변환
        transformedData.push(...Object.values(modelGroups));
      }
      
      console.log('Transformed data for table:', transformedData);
      
      // 변환된 데이터를 화면에 설정
      setBudgetData(transformedData);
      
      // 날짜 범위 설정 - 새로운 4개 날짜 컬럼 구조
      if (result.data && result.data.length > 0) {
        // 첫 번째 행에서 날짜 정보 가져오기
        const firstRow = result.data[0];
        if (firstRow.receiptStartDate && firstRow.receiptEndDate && firstRow.activationStartDate && firstRow.activationEndDate) {
          // 날짜와 시간 분리
          const receiptStartMatch = firstRow.receiptStartDate?.match(/^(.+?)\s+(.+)$/);
          const receiptEndMatch = firstRow.receiptEndDate?.match(/^(.+?)\s+(.+)$/);
          const activationStartMatch = firstRow.activationStartDate?.match(/^(.+?)\s+(.+)$/);
          const activationEndMatch = firstRow.activationEndDate?.match(/^(.+?)\s+(.+)$/);
          
          setDateRange({
            receiptStartDate: receiptStartMatch ? receiptStartMatch[1] : '',
            receiptStartTime: receiptStartMatch ? receiptStartMatch[2] : '10:00',
            receiptEndDate: receiptEndMatch ? receiptEndMatch[1] : '',
            receiptEndTime: receiptEndMatch ? receiptEndMatch[2] : '23:59',
            activationStartDate: activationStartMatch ? activationStartMatch[1] : '',
            activationStartTime: activationStartMatch ? activationStartMatch[2] : '10:00',
            activationEndDate: activationEndMatch ? activationEndMatch[1] : '',
            activationEndTime: activationEndMatch ? activationEndMatch[2] : '23:59'
          });
        }
      }
      
      // 정책그룹 설정
      if (result.selectedPolicyGroups) {
        console.log('Loading selected policy groups:', result.selectedPolicyGroups);
        setSelectedPolicyGroups(result.selectedPolicyGroups);
      } else {
        console.log('No selected policy groups found in result');
        setSelectedPolicyGroups([]);
      }
      
      // 시트 ID 설정
      setSheetId(sheet.id);
      
      // 대상월 설정 (시트 이름에서 추출) - 날짜 형식 경고 해결
      const monthMatch = sheet.name?.match(/액면_(.+)/);
      if (monthMatch) {
        const extractedName = monthMatch[1];
        // 한글 이름이 아닌 실제 월 형식인지 확인
        if (extractedName.match(/^\d{4}-\d{2}$/)) {
          setTargetMonth(extractedName);
        } else {
          // 한글 이름인 경우 현재 월로 설정
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          setTargetMonth(currentMonth);
        }
      }
      
      setSnackbar({ open: true, message: '데이터를 성공적으로 불러왔습니다.', severity: 'success' });
    } catch (error) {
      console.error('사용자 시트 데이터 불러오기 실패:', error);
      setSnackbar({ open: true, message: '데이터 불러오기에 실패했습니다.', severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 대상월 변경 시 해당 월의 시트 ID 표시
  const handleMonthChange = (event) => {
    const month = event.target.value;
    setTargetMonth(month);
    
    // 해당 월의 저장된 시트 ID가 있으면 표시
    if (month && monthSheetMappings[month]) {
      setSheetId(monthSheetMappings[month]);
    } else {
      setSheetId(''); // 새로운 월이면 빈 값으로 초기화
    }
    
    // 대상월이 변경되면 저장된 데이터 목록도 새로고침 (목록이 보이는 상태가 아니어도 새로고침)
    loadUserSheets();
  };

  // 시트 ID 저장
  const handleSheetIdSave = async () => {
    if (!targetMonth || !sheetId.trim()) {
      setSnackbar({ open: true, message: '대상월과 시트 ID를 모두 입력해주세요.', severity: 'warning' });
      return;
    }
    
    try {
      await budgetMonthSheetAPI.saveMonthSheet(
        targetMonth, 
        sheetId.trim(), 
        loggedInStore?.name || 'Unknown'
      );
      
      // 성공 시 목록 다시 로드
      await loadMonthSheetMappings();
      
      setSnackbar({ open: true, message: `${targetMonth} 시트 ID가 저장되었습니다.`, severity: 'success' });
    } catch (error) {
      console.error('시트 ID 저장 실패:', error);
      setSnackbar({ open: true, message: '시트 ID 저장에 실패했습니다.', severity: 'error' });
    }
  };

  // 시트 ID 삭제
  const handleSheetIdDelete = async () => {
    if (!targetMonth) {
      setSnackbar({ open: true, message: '삭제할 대상월을 선택해주세요.', severity: 'warning' });
      return;
    }
    
    try {
      await budgetMonthSheetAPI.deleteMonthSheet(targetMonth);
      
      // 성공 시 목록 다시 로드
      await loadMonthSheetMappings();
      
      setSheetId('');
      setSnackbar({ open: true, message: `${targetMonth} 시트 ID가 삭제되었습니다.`, severity: 'info' });
    } catch (error) {
      console.error('시트 ID 삭제 실패:', error);
      setSnackbar({ open: true, message: '시트 ID 삭제에 실패했습니다.', severity: 'error' });
    }
  };

  // 엑셀 테이블 데이터 처리
  const handleTableDataChange = (rowIndex, colIndex, value) => {
    const newData = [...budgetData];
    if (!newData[rowIndex]) {
      newData[rowIndex] = {
        id: `row-${rowIndex}`,
        modelName: '',
        securedBudget: 0,
        usedBudget: 0,
        remainingBudget: 0,
        status: '정상',
        appliedDate: new Date().toISOString().split('T')[0],
        inputUser: loggedInStore?.name || 'Unknown',
        userLevel: loggedInStore?.level || 1,
        armyType: '',
        categoryType: '',
        budgetValues: Array(18).fill(0), // 18개 컬럼의 개별 값 저장 (지출예산)
        expenditureValues: Array(18).fill(0) // 18개 컬럼의 지출예산 값 저장
      };
    }

    if (colIndex === 0) {
      // 모델명
      newData[rowIndex].modelName = value;
    } else {
      // 지출예산 값 (1-18번 컬럼) - 복사 붙여넣기한 숫자들
      const expenditureValue = parseFloat(value) || 0;
      newData[rowIndex].expenditureValues[colIndex - 1] = expenditureValue;
      newData[rowIndex].usedBudget = expenditureValue;
      
      // 군/유형 매핑
      const armyType = getArmyType(colIndex);
      const categoryType = getCategoryType(colIndex);
      newData[rowIndex].armyType = armyType;
      newData[rowIndex].categoryType = categoryType;
    }

    setBudgetData(newData);
  };

  // 클립보드 붙여넣기 처리
  const handlePaste = async (event, startRowIndex, startColIndex) => {
    event.preventDefault();
    
    try {
      const clipboardData = await navigator.clipboard.readText();
      const rows = clipboardData.trim().split('\n');
      
      const newData = [...budgetData];
      
      rows.forEach((row, rowOffset) => {
        const cells = row.split('\t');
        const currentRowIndex = startRowIndex + rowOffset;
        
        // 행 데이터 초기화
        if (!newData[currentRowIndex]) {
          newData[currentRowIndex] = {
            id: `row-${currentRowIndex}`,
            modelName: '',
            securedBudget: 0,
            usedBudget: 0,
            remainingBudget: 0,
            status: '정상',
            appliedDate: new Date().toISOString().split('T')[0],
            inputUser: loggedInStore?.name || 'Unknown',
            userLevel: loggedInStore?.level || 1,
            armyType: '',
            categoryType: '',
            budgetValues: Array(18).fill(0), // 18개 컬럼의 개별 값 저장 (예산금액)
            expenditureValues: Array(18).fill(0) // 18개 컬럼의 지출예산 값 저장
          };
        }
        
        cells.forEach((cell, colOffset) => {
          const currentColIndex = startColIndex + colOffset;
          const value = cell.trim();
          
          if (currentColIndex === 0) {
            // 모델명
            newData[currentRowIndex].modelName = value;
          } else if (currentColIndex >= 3 && currentColIndex <= 20) {
            // 지출예산 값 (3-20번 컬럼) - 펫네임, 출고가 포함하여 모든 데이터 처리
            // 빈 셀이나 숫자가 아닌 값은 0으로 처리
            const numValue = value === '' || value === null || value === undefined ? 0 : (parseFloat(value) || 0);
            const actualColIndex = currentColIndex - 3; // 펫네임, 출고가를 포함한 실제 인덱스
            newData[currentRowIndex].expenditureValues[actualColIndex] = numValue;
            newData[currentRowIndex].usedBudget = numValue;
            
            // 군/유형 매핑
            const armyType = getArmyType(actualColIndex + 1);
            const categoryType = getCategoryType(actualColIndex + 1);
            newData[currentRowIndex].armyType = armyType;
            newData[currentRowIndex].categoryType = categoryType;
          }
        });
      });
      
      setBudgetData(newData);
      
      setSnackbar({ 
        open: true, 
        message: `${rows.length}행의 데이터가 붙여넣기되었습니다. 저장 버튼을 클릭하여 저장하세요.`, 
        severity: 'success' 
      });
      
    } catch (error) {
      console.error('붙여넣기 실패:', error);
      setSnackbar({ 
        open: true, 
        message: '붙여넣기에 실패했습니다. 클립보드 접근 권한을 확인해주세요.', 
        severity: 'error' 
      });
    }
  };

  // 수동 저장 함수
  const handleManualSave = async () => {
    if (!targetMonth) {
      setSnackbar({ open: true, message: '대상월을 먼저 선택해주세요.', severity: 'warning' });
      return;
    }
    
    if (budgetData.length === 0 || budgetData.every(row => !row || (!row.modelName && !row.budgetValue))) {
      setSnackbar({ open: true, message: '저장할 데이터가 없습니다.', severity: 'warning' });
      return;
    }
    
    setIsProcessing(true);
    try {
      const result = await autoSaveToUserSheet(budgetData);
      
      // 저장 후 사용자 시트의 사용예산을 액면예산 C열에서 업데이트
      if (result && result.sheet && result.sheet.id && selectedPolicyGroups.length > 0) {
        const userName = loggedInStore?.name || loggedInStore?.agentInfo?.name || 'unknown';
        
        // 날짜 범위를 서버가 기대하는 형식으로 변환
        const serverDateRange = {
          startDate: applyReceiptDate && dateRange.receiptStartDate 
            ? `${dateRange.receiptStartDate} ${dateRange.receiptStartTime}` 
            : `${dateRange.activationStartDate} ${dateRange.activationStartTime}`,
          endDate: applyReceiptDate && dateRange.receiptEndDate 
            ? `${dateRange.receiptEndDate} ${dateRange.receiptEndTime}` 
            : `${dateRange.activationEndDate} ${dateRange.activationEndTime}`
        };
        
        await budgetUserSheetAPI.updateUserSheetUsage(
          result.sheet.id, 
          selectedPolicyGroups, 
          serverDateRange, 
          userName,
          faceValueSubMenu
        );
      }
      
      setSnackbar({ open: true, message: '데이터가 성공적으로 저장되었습니다.', severity: 'success' });
      
      // 저장 후 사용자 시트 목록 새로고침
      await loadUserSheets();
    } catch (error) {
      console.error('저장 실패:', error);
      setSnackbar({ open: true, message: '저장에 실패했습니다.', severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 본인 시트 확인 함수
  const isOwnSheet = (sheet) => {
    const currentUserId = loggedInStore?.id || loggedInStore?.agentInfo?.id;
    const currentUserName = loggedInStore?.name || loggedInStore?.agentInfo?.name;
    
    // userId 또는 작성자 이름으로 비교
    return sheet.userId === currentUserId || 
           sheet.createdBy === currentUserName ||
           sheet.userName === currentUserName ||
           sheet.creator === currentUserName;
  };

  // 사용자 시트 삭제 함수
  const handleDeleteUserSheet = async (sheet) => {
    if (!sheet.uuid) {
      setSnackbar({ open: true, message: '삭제할 수 없는 시트입니다. (UUID 없음)', severity: 'error' });
      return;
    }

    const confirmed = window.confirm(`정말로 시트 "${sheet.name}"을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmed) return;

    try {
      const userId = loggedInStore?.id || loggedInStore?.agentInfo?.id;
      await budgetUserSheetAPI.deleteUserSheet(sheet.uuid, userId);
      
      setSnackbar({ 
        open: true, 
        message: `시트 "${sheet.name}"이 성공적으로 삭제되었습니다.`, 
        severity: 'success' 
      });
      
      // 목록 새로고침
      await loadUserSheets();
      
    } catch (error) {
      console.error('시트 삭제 실패:', error);
      setSnackbar({ 
        open: true, 
        message: `시트 삭제에 실패했습니다: ${error.message}`, 
        severity: 'error' 
      });
    }
  };

  // 자동 저장 함수
  const autoSaveToUserSheet = async (data) => {
    try {
      const userId = loggedInStore?.id || loggedInStore?.agentInfo?.id || 'unknown';
      const userName = loggedInStore?.name || 'Unknown';
      const userLevel = loggedInStore?.userRole || loggedInStore?.agentInfo?.userRole || loggedInStore?.level || 'SS';
      
      // 대상월이 선택되어 있는지 확인
      if (!targetMonth) {
        setSnackbar({ open: true, message: '대상월을 먼저 선택해주세요.', severity: 'warning' });
        return;
      }
      
      // 새 API 사용하여 시트 생성 (날짜 범위 정보 포함)
      const saveDateRange = {
        receiptStartDate: applyReceiptDate ? `${dateRange.receiptStartDate} ${dateRange.receiptStartTime}` : '',
        receiptEndDate: applyReceiptDate ? `${dateRange.receiptEndDate} ${dateRange.receiptEndTime}` : '',
        activationStartDate: `${dateRange.activationStartDate} ${dateRange.activationStartTime}`,
        activationEndDate: `${dateRange.activationEndDate} ${dateRange.activationEndTime}`,
        applyReceiptDate: applyReceiptDate
      };
      
      const result = await budgetUserSheetAPI.createUserSheet(userId, userName, targetMonth, selectedPolicyGroups, faceValueSubMenu, saveDateRange);
      const targetSheetId = result.sheet.id;
      setSnackbar({ open: true, message: `시트 "액면_${userName}"에 데이터가 저장되었습니다. (UUID: ${result.sheet.uuid?.slice(0,8)}...)`, severity: 'success' });
      
      // 예산금액 설정과 budgetType도 함께 전달
      await budgetUserSheetAPI.saveBudgetData(targetSheetId, data, saveDateRange, userName, userLevel, budgetAmounts, faceValueSubMenu);
      
      // 생성된 시트 정보 반환
      return result;
      
    } catch (error) {
      console.error('자동 저장 실패:', error);
      setSnackbar({ open: true, message: '자동 저장에 실패했습니다.', severity: 'warning' });
      throw error;
    }
  };

  // 군별 타입 매핑
  const getArmyType = (columnIndex) => {
    const armyTypes = ['S군', 'S군', 'S군', 'A군', 'A군', 'A군', 'B군', 'B군', 'B군', 'C군', 'C군', 'C군', 'D군', 'D군', 'D군', 'E군', 'E군', 'E군'];
    return armyTypes[columnIndex - 1] || 'Unknown';
  };

  // 카테고리 타입 매핑
  const getCategoryType = (columnIndex) => {
    const categoryTypes = ['신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상'];
    return categoryTypes[columnIndex - 1] || 'Unknown';
  };

  // 예산 계산
  const calculateBudget = (rowId = null) => {
    if (rowId) {
      // 개별 행 계산
      setSnackbar({ open: true, message: `행 ${rowId}의 예산 계산이 완료되었습니다.`, severity: 'success' });
    } else {
      // 전체 계산
      setSnackbar({ open: true, message: '전체 예산 계산이 완료되었습니다.', severity: 'success' });
    }
    // TODO: 실제 예산 계산 로직 구현
  };

  // 시트설정 렌더링
  const renderSheetSettings = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, color: '#795548', fontWeight: 'bold' }}>
        ⚙️ 시트설정
      </Typography>
      
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            📋 저장된 월별 시트 ID 관리
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            액면예산(Ⅰ)과 액면예산(Ⅱ)에서 사용할 시트를 생성하고 관리합니다.
          </Typography>
          
          {/* 기존 월별 시트 설정 UI를 여기에 이동 */}
          <Grid container spacing={2} alignItems="flex-start">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="대상월"
                type="month"
                value={targetMonth}
                onChange={handleMonthChange}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="구글시트 ID"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                disabled={!canEditSheetId}
                helperText={canEditSheetId ? "시트 ID를 입력하세요" : "권한이 없습니다 (SS 레벨만 수정 가능)"}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSheetIdSave}
                  disabled={!canEditSheetId || !targetMonth || !sheetId.trim()}
                  sx={{ backgroundColor: '#795548', minWidth: '60px' }}
                >
                  저장
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSheetIdDelete}
                  disabled={!canEditSheetId || !targetMonth}
                  sx={{ borderColor: '#795548', color: '#795548', minWidth: '60px' }}
                >
                  삭제
                </Button>
              </Box>
            </Grid>
          </Grid>
          
          {/* 저장된 월별 시트 ID 목록 */}
          {Object.keys(monthSheetMappings).length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#795548', fontWeight: 'bold' }}>
                  📋 저장된 월별 시트 ID
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowMonthSheetList(!showMonthSheetList)}
                  sx={{ borderColor: '#795548', color: '#795548', fontSize: '0.7rem' }}
                >
                  {showMonthSheetList ? '숨기기' : '보기'}
                </Button>
              </Box>
              {showMonthSheetList && (
                <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          대상월
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          시트 ID
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          수정일시
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          수정자
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(monthSheetMappings)
                        .sort(([a], [b]) => new Date(b) - new Date(a)) // 최신 월부터 정렬
                        .map(([month, id]) => {
                        const detail = detailedMonthData[month];
                        return (
                          <TableRow key={month} hover>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{month}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{id}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>
                              {detail?.lastModified || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>
                              {detail?.modifiedBy || 'N/A'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  // 액면예산(종합) 렌더링
  const renderFaceValueSummary = () => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, color: '#795548', fontWeight: 'bold' }}>
        💰 액면예산(종합) 관리
      </Typography>
      
      {/* 대상월 선택 및 데이터 로드 */}
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            📅 대상월 선택
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="대상월"
                type="month"
                value={targetMonth}
                onChange={handleMonthChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="contained"
                onClick={loadSummaryData}
                disabled={!targetMonth || isLoadingSummary}
                startIcon={isLoadingSummary ? <CircularProgress size={20} /> : <CalculateIcon />}
                sx={{ backgroundColor: '#795548' }}
              >
                {isLoadingSummary ? '로딩 중...' : '종합 데이터 로드'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* 최종 예산 잔액 */}
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0', backgroundColor: '#f8f9fa' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548', textAlign: 'center' }}>
            🎯 최종 예산 잔액
          </Typography>
          <Typography variant="h4" sx={{ textAlign: 'center', color: '#2e7d32', fontWeight: 'bold' }}>
            {summaryData.totalRemainingBudget.toLocaleString()}원
          </Typography>
          <Typography variant="body2" sx={{ textAlign: 'center', color: '#666', mt: 1 }}>
            F열 합계 - (별도추가 + 부가추가지원 + 부가차감지원 사용예산)
          </Typography>
        </CardContent>
      </Card>

      {/* 액면예산(종합) 상세 */}
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            📊 액면예산(종합)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Card sx={{ backgroundColor: '#e8f5e8' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="primary">
                    확보예산
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                    {summaryData.totalSecuredBudget.toLocaleString()}원
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>
                    G열(합계계산금액)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ backgroundColor: '#fff3e0' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="warning.main">
                    사용예산
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#f57c00' }}>
                    {summaryData.totalUsedBudget.toLocaleString()}원
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>
                    H열(합계계산금액)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ backgroundColor: '#fce4ec' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="error">
                    예산잔액
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                    {summaryData.totalRemainingBudget.toLocaleString()}원
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#666' }}>
                    F열(합계계산금액)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 향후 확장 항목들 */}
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            🔮 향후 확장 예정
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Card sx={{ backgroundColor: '#f3e5f5' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="secondary">
                    별도추가
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#666' }}>
                    0원
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ backgroundColor: '#e1f5fe' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="info.main">
                    부가추가지원
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#666' }}>
                    0원
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ backgroundColor: '#fff8e1' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" color="warning.main">
                    부가차감지원
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#666' }}>
                    0원
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );

  // 액면예산 탭 렌더링
  const renderFaceValueBudget = (type = 'Ⅰ') => (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 3, color: '#795548', fontWeight: 'bold' }}>
        💰 액면예산({type}) 관리
      </Typography>
      
      {/* 시트 설정 안내 */}
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0', backgroundColor: '#f8f9fa' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            ⚙️ 시트 설정 안내
          </Typography>
          <Typography variant="body2" sx={{ color: '#666' }}>
            시트 생성 및 관리는 <strong>시트설정</strong> 탭에서 진행해주세요.
            액면예산(Ⅰ)과 액면예산(Ⅱ)에서 사용할 시트를 먼저 생성한 후 데이터를 입력하실 수 있습니다.
          </Typography>
        </CardContent>
      </Card>
      
      {/* 시트 ID 설정 */}
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            🔗 시트 ID 설정
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="대상월"
                type="month"
                value={targetMonth}
                onChange={handleMonthChange}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="구글시트 ID"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                disabled={!canEditSheetId}
                helperText={canEditSheetId ? "시트 ID를 입력하세요" : "권한이 없습니다 (SS 레벨만 수정 가능)"}
                sx={{ mb: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSheetIdSave}
                  disabled={!canEditSheetId || !targetMonth || !sheetId.trim()}
                  sx={{ backgroundColor: '#795548', minWidth: '60px' }}
                >
                  저장
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSheetIdDelete}
                  disabled={!canEditSheetId || !targetMonth}
                  sx={{ borderColor: '#795548', color: '#795548', minWidth: '60px' }}
                >
                  삭제
                </Button>
              </Box>
            </Grid>
          </Grid>
          
          {/* 저장된 월별 시트 ID 목록 */}
          {Object.keys(monthSheetMappings).length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#795548', fontWeight: 'bold' }}>
                  📋 저장된 월별 시트 ID
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowMonthSheetList(!showMonthSheetList)}
                  sx={{ borderColor: '#795548', color: '#795548', fontSize: '0.7rem' }}
                >
                  {showMonthSheetList ? '숨기기' : '보기'}
                </Button>
              </Box>
              {showMonthSheetList && (
                <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          대상월
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          시트 ID
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          수정일시
                        </TableCell>
                        <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                          수정자
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(monthSheetMappings)
                        .sort(([a], [b]) => new Date(b) - new Date(a)) // 최신 월부터 정렬
                        .map(([month, id]) => {
                        const detail = detailedMonthData[month];
                        return (
                          <TableRow 
                            key={month} 
                            hover
                            onClick={() => {
                              setTargetMonth(month);
                              setSheetId(id);
                            }}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell sx={{ fontSize: '0.8rem' }}>{month}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{id}</TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>
                              {detail?.updatedAt ? new Date(detail.updatedAt).toLocaleString('ko-KR') : '-'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.8rem' }}>{detail?.updatedBy || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
          
          {!canEditSheetId && (
            <Alert severity="info" sx={{ mt: 1 }}>
              현재 사용자 권한: {loggedInStore?.userRole || loggedInStore?.agentInfo?.userRole || loggedInStore?.level || 'Unknown'} - 시트 ID 수정 권한이 없습니다.
            </Alert>
          )}
        </CardContent>
      </Card>

       {/* 날짜/시간 입력 영역 */}
       <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
         <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: '#795548' }}>
            📅 접수일 및 개통일 범위 설정
          </Typography>
          
          {/* 정책그룹 선택 버튼 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
              📊 정책그룹 선택
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  console.log('Opening policy group modal, selectedPolicyGroups:', selectedPolicyGroups);
                  setShowPolicyGroupModal(true);
                }}
                sx={{ borderColor: '#795548', color: '#795548' }}
              >
                정책그룹 선택
              </Button>
              {selectedPolicyGroups.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    선택됨:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedPolicyGroups.slice(0, 3).map((group) => (
                      <Chip
                        key={group}
                        label={group}
                        size="small"
                        sx={{ backgroundColor: '#e3f2fd', fontSize: '0.7rem' }}
                      />
                    ))}
                    {selectedPolicyGroups.length > 3 && (
                      <Chip
                        label={`+${selectedPolicyGroups.length - 3}개`}
                        size="small"
                        sx={{ backgroundColor: '#f5f5f5', fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
          
          {/* 접수일 적용 여부 체크박스 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
              ⚙️ 접수일 적용 설정
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input
                type="checkbox"
                id="applyReceiptDate"
                checked={applyReceiptDate}
                onChange={(e) => setApplyReceiptDate(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="applyReceiptDate" style={{ fontSize: '0.9rem', color: '#666' }}>
                접수일 기준으로 예산 계산 (미체크 시 개통일 기준으로 자동 계산)
              </label>
            </Box>
          </Box>
          
          <Grid container spacing={3}>
            {/* 접수일 범위 - 체크 시에만 표시 */}
            {applyReceiptDate && (
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
                  📅 접수일 범위
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="시작일"
                      type="date"
                      value={dateRange.receiptStartDate}
                      onChange={(e) => setDateRange({
                        ...dateRange,
                        receiptStartDate: e.target.value
                      })}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="시작시간"
                       type="time"
                       value={dateRange.receiptStartTime}
                       onChange={(e) => setDateRange({
                         ...dateRange,
                         receiptStartTime: e.target.value
                       })}
                       InputLabelProps={{ shrink: true }}
                     />
                   </Grid>
                   <Grid item xs={6}>
                     <TextField
                       fullWidth
                       label="종료일"
                       type="date"
                       value={dateRange.receiptEndDate}
                       onChange={(e) => setDateRange({
                         ...dateRange,
                         receiptEndDate: e.target.value
                       })}
                       InputLabelProps={{ shrink: true }}
                     />
                   </Grid>
                   <Grid item xs={6}>
                     <TextField
                       fullWidth
                       label="종료시간"
                       type="time"
                       value={dateRange.receiptEndTime}
                       onChange={(e) => setDateRange({
                         ...dateRange,
                         receiptEndTime: e.target.value
                       })}
                       InputLabelProps={{ shrink: true }}
                     />
                   </Grid>
                 </Grid>
               </Grid>
             )}
             
             <Grid item xs={12} sm={applyReceiptDate ? 6 : 12}>
               <Typography variant="subtitle2" sx={{ mb: 1, color: '#795548', fontWeight: 'bold' }}>
                 📅 개통일 범위 {!applyReceiptDate && '(기준)'}
               </Typography>
               <Grid container spacing={2}>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="시작일"
                     type="date"
                     value={dateRange.activationStartDate}
                     onChange={(e) => setDateRange({
                       ...dateRange,
                       activationStartDate: e.target.value
                     })}
                     InputLabelProps={{ shrink: true }}
                   />
                 </Grid>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="시작시간"
                     type="time"
                     value={dateRange.activationStartTime}
                     onChange={(e) => setDateRange({
                       ...dateRange,
                       activationStartTime: e.target.value
                     })}
                     InputLabelProps={{ shrink: true }}
                   />
                 </Grid>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="종료일"
                     type="date"
                     value={dateRange.activationEndDate}
                     onChange={(e) => setDateRange({
                       ...dateRange,
                       activationEndDate: e.target.value
                     })}
                     InputLabelProps={{ shrink: true }}
                   />
                 </Grid>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="종료시간"
                     type="time"
                     value={dateRange.activationEndTime}
                     onChange={(e) => setDateRange({
                       ...dateRange,
                       activationEndTime: e.target.value
                     })}
                     InputLabelProps={{ shrink: true }}
                   />
                 </Grid>
               </Grid>
               {!applyReceiptDate && (
                 <Typography variant="caption" sx={{ color: '#666', mt: 1, display: 'block' }}>
                   💡 접수일 미적용 시 개통일 기준으로 자동 계산됩니다.
                 </Typography>
               )}
             </Grid>
           </Grid>
         </CardContent>
       </Card>

       {/* 엑셀형 예산 데이터 테이블 */}
       <Card sx={{ mb: 3, border: '2px solid #795548' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#795548' }}>
              📊 예산 데이터 입력 (엑셀 형식)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleManualSave}
                disabled={isProcessing || !targetMonth || budgetData.length === 0}
                sx={{ 
                  backgroundColor: '#795548',
                  '&:hover': { backgroundColor: '#5D4037' }
                }}
              >
                {isProcessing ? '저장 중...' : '저장'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={() => {
                  setBudgetData([]);
                  setSnackbar({ open: true, message: '테이블 데이터가 초기화되었습니다.', severity: 'info' });
                }}
                sx={{ 
                  borderColor: '#795548',
                  color: '#795548',
                  '&:hover': { 
                    borderColor: '#5D4037',
                    backgroundColor: 'rgba(121, 85, 72, 0.04)'
                  }
                }}
              >
                초기화
              </Button>
            </Box>
          </Box>
          
          <TableContainer 
            component={Paper} 
            sx={{ maxHeight: 600, overflowX: 'auto' }}
            onPaste={(e) => handlePaste(e, 0, 0)}
            tabIndex={0}
          >
            <Table stickyHeader size="small">
              <TableHead>
                                {/* 첫 번째 헤더 행: 예산금액 헤더 */}
                <TableRow>
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#795548', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd',
                      minWidth: 100
                    }}
                  >
                    예산금액
                  </TableCell>
                  {/* 펫네임 더미 컬럼 */}
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#A1887F', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd',
                      minWidth: 240
                    }}
                  >
                    펫네임
                  </TableCell>
                  {/* 출고가 더미 컬럼 */}
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#A1887F', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd',
                      minWidth: 100
                    }}
                  >
                    출고가
                  </TableCell>
                  {['S군', 'A군', 'B군', 'C군', 'D군', 'E군'].map((army, armyIndex) => (
                    <TableCell 
                      key={army}
                      colSpan={3}
                      sx={{ 
                        backgroundColor: '#8D6E63', 
                        color: 'white', 
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '1px solid #ddd',
                        minWidth: 60
                      }}
                    >
                     <TextField
                       size="small"
                       type="number"
                       value={budgetAmounts[army]}
                       onChange={(e) => {
                         const newAmounts = { ...budgetAmounts };
                         newAmounts[army] = parseFloat(e.target.value) || 0;
                         setBudgetAmounts(newAmounts);
                       }}
                       placeholder="40000"
                       sx={{
                         '& .MuiOutlinedInput-root': {
                           fontSize: '0.8rem',
                           backgroundColor: 'white',
                           '& fieldset': {
                             border: 'none'
                           },
                             '& input': {
                               textAlign: 'center',
                               color: '#8D6E63',
                               fontWeight: 'bold'
                             }
                           }
                         }}
                       />
                    </TableCell>
                  ))}
                </TableRow>
                 
                                 {/* 두 번째 헤더 행: 정책군 헤더 */}
                <TableRow>
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#795548', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd'
                    }}
                  >
                    정책군
                  </TableCell>
                  {/* 펫네임 더미 컬럼 */}
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#A1887F', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd',
                      minWidth: 240
                    }}
                  >
                    펫네임
                  </TableCell>
                  {/* 출고가 더미 컬럼 */}
                  <TableCell 
                    sx={{ 
                      backgroundColor: '#A1887F', 
                      color: 'white', 
                      fontWeight: 'bold',
                      textAlign: 'center',
                      border: '1px solid #ddd',
                      minWidth: 100
                    }}
                  >
                    출고가
                  </TableCell>
                  {['S군', 'A군', 'B군', 'C군', 'D군', 'E군'].map((army, armyIndex) => (
                    <TableCell 
                      key={army}
                      colSpan={3}
                      sx={{ 
                        backgroundColor: '#8D6E63', 
                        color: 'white', 
                        fontWeight: 'bold',
                        textAlign: 'center',
                        border: '1px solid #ddd'
                      }}
                    >
                      {army}
                    </TableCell>
                  ))}
                </TableRow>
                 
                 {/* 세 번째 헤더 행: 카테고리 헤더 */}
                 <TableRow>
                   <TableCell 

                     sx={{ 
                       backgroundColor: '#795548', 
                       color: 'white', 
                       fontWeight: 'bold',
                       textAlign: 'center',
                       border: '1px solid #ddd',
                       minWidth: 100
                     }}
                   >
                     모델명
                   </TableCell>
                   <TableCell 
                     sx={{ 
                       backgroundColor: '#A1887F', 
                       color: 'white', 
                       fontWeight: 'bold',
                       textAlign: 'center',
                       border: '1px solid #ddd',
                       minWidth: 240
                     }}
                   >
                     펫네임
                   </TableCell>
                   <TableCell 
                     sx={{ 
                       backgroundColor: '#A1887F', 
                       color: 'white', 
                       fontWeight: 'bold',
                       textAlign: 'center',
                       border: '1px solid #ddd',
                       minWidth: 100
                     }}
                   >
                     출고가
                   </TableCell>
                   {['신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상', '신규', 'MNP', '보상'].map((category, index) => (
                     <TableCell 
                       key={index}
                       sx={{ 
                         backgroundColor: '#A1887F', 
                         color: 'white', 
                         fontWeight: 'bold',
                         textAlign: 'center',
                         border: '1px solid #ddd',
                         minWidth: 60
                       }}
                     >
                       {category}
                     </TableCell>
                   ))}
                 </TableRow>
               </TableHead>
              
                             <TableBody>
                 {/* 데이터 행들 (최대 60행) */}
                 {Array.from({ length: 60 }, (_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {/* 모델명 셀 */}
                    <TableCell 
                      sx={{ 
                        border: '1px solid #ddd',
                        padding: '4px'
                      }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        value={budgetData[rowIndex]?.modelName || ''}
                        onChange={(e) => handleTableDataChange(rowIndex, 0, e.target.value)}
                        placeholder="모델명"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            fontSize: '0.8rem',
                            '& fieldset': {
                              border: 'none'
                            }
                          }
                        }}
                      />
                    </TableCell>
                    
                    {/* 펫네임 셀 (더미) */}
                    <TableCell 
                      sx={{ 
                        border: '1px solid #ddd',
                        padding: '4px',
                        backgroundColor: '#f5f5f5'
                      }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="펫네임"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            fontSize: '0.8rem',
                            '& fieldset': {
                              border: 'none'
                            }
                          }
                        }}
                      />
                    </TableCell>
                    
                    {/* 출고가 셀 (더미) */}
                    <TableCell 
                      sx={{ 
                        border: '1px solid #ddd',
                        padding: '4px',
                        backgroundColor: '#f5f5f5'
                      }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="출고가"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            fontSize: '0.8rem',
                            '& fieldset': {
                              border: 'none'
                            }
                          }
                        }}
                      />
                    </TableCell>
                    
                    {/* 지출예산 값 셀들 (18개) */}
                     {Array.from({ length: 18 }, (_, colIndex) => (
                       <TableCell 
                         key={colIndex}
                         sx={{ 
                           border: '1px solid #ddd',
                           padding: '4px'
                         }}
                       >
                         <TextField
                           fullWidth
                           size="small"
                           type="number"
                           value={budgetData[rowIndex]?.expenditureValues?.[colIndex] || ''}
                           onChange={(e) => handleTableDataChange(rowIndex, colIndex + 1, e.target.value)}
                           placeholder="0"
                           sx={{
                             '& .MuiOutlinedInput-root': {
                               fontSize: '0.8rem',
                               '& fieldset': {
                                 border: 'none'
                               }
                             }
                           }}
                         />
                       </TableCell>
                     ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
                                 <Box sx={{ mt: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ color: '#666', fontSize: '0.8rem' }}>
                💡 <strong>사용법:</strong> 
                <br/>• <strong>예산금액 설정:</strong> 상단 헤더에서 각 군별 예산금액을 설정할 수 있습니다 (액면예산(Ⅰ): 40,000원, 액면예산(Ⅱ): 0원).
                <br/>• <strong>직접 입력:</strong> 각 셀을 클릭하여 모델명과 지출예산 값을 직접 입력할 수 있습니다.
                <br/>• <strong>엑셀 붙여넣기:</strong> 엑셀에서 데이터를 복사한 후 테이블 영역을 클릭하고 Ctrl+V로 붙여넣기하면 한 번에 여러 행의 데이터가 입력됩니다.
                <br/>• <strong>저장:</strong> 데이터 입력 후 상단의 "저장" 버튼을 클릭하여 Google Sheet에 저장합니다.
                <br/>• <strong>데이터 형식:</strong> 첫 번째 열은 모델명, 두 번째와 세 번째 열은 펫네임과 출고가(더미), 나머지 18개 열은 각 군별(신규/MNP/보상) 지출예산 값입니다.
                <br/>• <strong>계산 방식:</strong> 예산잔액 = 설정된 예산금액 - 지출예산
              </Typography>
            </Box>
        </CardContent>
      </Card>

      {/* 저장된 데이터 목록 */}
      <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: '#795548' }}>
              📋 저장된 데이터 목록
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setShowSheetList(!showSheetList);
                  if (!showSheetList) {
                    loadUserSheets();
                  }
                }}
                sx={{ borderColor: '#795548', color: '#795548' }}
              >
                {showSheetList ? '숨기기' : '보기'}
              </Button>
              <Button
                variant="contained"
                size="small"
                color="primary"
                onClick={handleRecalculateAll}
                disabled={isRecalculating}
                startIcon={isRecalculating ? <CircularProgress size={16} /> : <CalculateIcon />}
                sx={{ 
                  backgroundColor: '#1976D2',
                  '&:hover': { backgroundColor: '#1565C0' }
                }}
              >
                {isRecalculating ? '재계산 중...' : '전체 재계산'}
              </Button>
            </Box>
          </Box>
          
          {showSheetList && (
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      예산적용일
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      확보예산
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      사용예산
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      예산잔액
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      작업자
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      마지막수정
                    </TableCell>
                    <TableCell sx={{ backgroundColor: '#795548', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                      작업
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userSheets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: '#666' }}>
                        저장된 데이터가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    userSheets.map((sheet, index) => (
                      <TableRow key={index} hover>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                          <div 
                            dangerouslySetInnerHTML={{
                              __html: sheet.summary?.dateRange || '날짜 미설정'
                            }}
                            style={{ 
                              whiteSpace: 'pre-line',
                              lineHeight: '1.4'
                            }}
                          />
                          {sheet.summary?.applyReceiptDate && (
                            <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>
                              (접수일 적용)
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: '#2E7D32' }}>
                          {(sheet.summary?.totalSecuredBudget || 0).toLocaleString()}원
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: '#D32F2F' }}>
                          {(sheet.summary?.totalUsedBudget || 0).toLocaleString()}원
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', color: '#1976D2' }}>
                          {(sheet.summary?.totalRemainingBudget || 0).toLocaleString()}원
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {sheet.createdBy || 'Unknown'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.8rem' }}>
                          {sheet.summary?.lastUpdated ? 
                            new Date(sheet.summary.lastUpdated).toLocaleString('ko-KR') : 
                            new Date(sheet.createdAt).toLocaleString('ko-KR')
                          }
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {faceValueSubMenu === 'Ⅰ' && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => openPreview(sheet)}
                                sx={{ fontSize: '0.7rem', borderColor: '#795548', color: '#795548' }}
                              >
                                미리보기
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleLoadUserSheet(sheet)}
                              sx={{ fontSize: '0.7rem', borderColor: '#795548', color: '#795548' }}
                            >
                              불러오기
                            </Button>
                            {/* 작성자 본인만 삭제 가능 */}
                            {sheet.uuid && isOwnSheet(sheet) && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleDeleteUserSheet(sheet)}
                                sx={{ 
                                  fontSize: '0.7rem', 
                                  borderColor: '#d32f2f', 
                                  color: '#d32f2f',
                                  '&:hover': {
                                    backgroundColor: '#ffebee',
                                    borderColor: '#d32f2f'
                                  }
                                }}
                              >
                                삭제
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                        </TableRow>
                      ))
                    )}
                 </TableBody>
               </Table>
             </TableContainer>
           )}
         </CardContent>
       </Card>

       {/* 로딩 상태 */}
       {isProcessing && (
         <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
           <CircularProgress sx={{ color: '#795548' }} />
         </Box>
       )}

       {/* 정책그룹 선택 모달 */}
       <Dialog 
         open={showPolicyGroupModal} 
         onClose={() => setShowPolicyGroupModal(false)}
         maxWidth="md"
         fullWidth
       >
         <DialogTitle>
           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <Typography variant="h6">정책그룹 선택</Typography>
             <Box>
               <Button
                 size="small"
                 variant="outlined"
                 onClick={() => setShowSaveSettingsModal(true)}
                 sx={{ mr: 1 }}
               >
                 저장
               </Button>
               <Button
                 size="small"
                 variant="outlined"
                 onClick={() => {
                   console.log('불러오기 버튼 클릭됨');
                   setShowLoadSettingsModal(true);
                   // 모달이 열릴 때 정책그룹 설정 목록을 로드
                   loadPolicyGroupSettings();
                 }}
               >
                 불러오기
               </Button>
             </Box>
           </Box>
         </DialogTitle>
         <DialogContent>
           <Box sx={{ mb: 2 }}>
             <TextField
               fullWidth
               size="small"
               placeholder="정책그룹 검색..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               sx={{ mb: 2 }}
             />
           </Box>
           
           <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1 }}>
             {console.log('Current selectedPolicyGroups in dialog:', selectedPolicyGroups)}
             {policyGroups
               .filter(group => group.toLowerCase().includes(searchTerm.toLowerCase()))
               .map((group) => {
                 const isSelected = selectedPolicyGroups && selectedPolicyGroups.includes(group);
                 return (
                   <Box
                     key={group}
                     sx={{
                       p: 1,
                       border: '1px solid #ddd',
                       borderRadius: 1,
                       cursor: 'pointer',
                       backgroundColor: isSelected ? '#e3f2fd' : 'white',
                       '&:hover': {
                         backgroundColor: isSelected ? '#bbdefb' : '#f5f5f5'
                       }
                     }}
                     onClick={() => handlePolicyGroupToggle(group)}
                   >
                     <Box sx={{ display: 'flex', alignItems: 'center' }}>
                       <input
                         type="checkbox"
                         checked={isSelected}
                         onChange={() => handlePolicyGroupToggle(group)}
                         style={{ marginRight: 8 }}
                       />
                       <Typography variant="body2">{group}</Typography>
                     </Box>
                   </Box>
                 );
               })}
           </Box>
           
           {selectedPolicyGroups && selectedPolicyGroups.length > 0 && (
             <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
               <Typography variant="subtitle2" sx={{ mb: 1 }}>
                 선택된 정책그룹 ({selectedPolicyGroups.length}개):
               </Typography>
               <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                 {selectedPolicyGroups.map((group) => (
                   <Chip
                     key={group}
                     label={group}
                     size="small"
                     onDelete={() => handlePolicyGroupToggle(group)}
                     sx={{ backgroundColor: '#e3f2fd' }}
                   />
                 ))}
               </Box>
             </Box>
           )}
         </DialogContent>
         <DialogActions>
           <Button onClick={() => setShowPolicyGroupModal(false)}>닫기</Button>
         </DialogActions>
       </Dialog>

       {/* 정책그룹 설정 저장 모달 */}
       <Dialog 
         open={showSaveSettingsModal} 
         onClose={() => setShowSaveSettingsModal(false)}
         maxWidth="sm"
         fullWidth
       >
         <DialogTitle>정책그룹 설정 저장</DialogTitle>
         <DialogContent>
           <TextField
             fullWidth
             label="저장이름"
             value={settingsName}
             onChange={(e) => setSettingsName(e.target.value)}
             placeholder="예: VIP고객, 일반고객 등"
             sx={{ mt: 1 }}
           />
         </DialogContent>
         <DialogActions>
           <Button onClick={() => setShowSaveSettingsModal(false)}>취소</Button>
           <Button onClick={handleSavePolicyGroupSettings} variant="contained">
             저장
           </Button>
         </DialogActions>
       </Dialog>

       {/* 정책그룹 설정 불러오기 모달 */}
       <Dialog 
         open={showLoadSettingsModal} 
         onClose={() => setShowLoadSettingsModal(false)}
         maxWidth="sm"
         fullWidth
       >
         <DialogTitle>정책그룹 설정 불러오기</DialogTitle>
         <DialogContent>
           {policyGroupSettings.length === 0 ? (
             <Typography sx={{ py: 2, textAlign: 'center', color: '#666' }}>
               저장된 설정이 없습니다.
             </Typography>
           ) : (
             <Box sx={{ mt: 1 }}>
               {policyGroupSettings.map((setting, index) => (
                 <Box
                   key={index}
                   sx={{
                     p: 2,
                     border: '1px solid #ddd',
                     borderRadius: 1,
                     mb: 1,
                     cursor: 'pointer',
                     '&:hover': {
                       backgroundColor: '#f5f5f5'
                     }
                   }}
                   onClick={() => handleLoadPolicyGroupSettings(setting)}
                 >
                   <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <Box>
                       <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                         {setting.name}
                       </Typography>
                       <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
                         {setting.groups.join(', ')}
                       </Typography>
                     </Box>
                     <Button
                       size="small"
                       color="error"
                       onClick={(e) => {
                         e.stopPropagation();
                         handleDeletePolicyGroupSettings(setting.name);
                       }}
                     >
                       삭제
                     </Button>
                   </Box>
                 </Box>
               ))}
             </Box>
           )}
         </DialogContent>
         <DialogActions>
           <Button onClick={() => setShowLoadSettingsModal(false)}>닫기</Button>
         </DialogActions>
       </Dialog>

       {/* 미리보기 모달 */}
       <Dialog 
         open={showPreviewModal} 
         onClose={() => setShowPreviewModal(false)}
         maxWidth="md"
         fullWidth
       >
          <DialogTitle>
            <Typography variant="h6">📊 예산 데이터 입력 (엑셀 형식) - 미리보기</Typography>
          </DialogTitle>
          <DialogContent>
            {isLoadingPreview && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {previewData && !isLoadingPreview && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#666' }}>
                  {previewData.name} · {previewData.createdBy}
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 360, border: '1px solid #e0e0e0' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ backgroundColor: '#795548', color: '#fff', fontWeight: 'bold', textAlign: 'center', minWidth: 120 }}>모델명</TableCell>
                        {['S군','A군','B군','C군','D군','E군'].map((army) => (
                          ['신규','MNP','보상'].map((cat, ci) => (
                            <TableCell key={`${army}-${cat}`} sx={{ backgroundColor: '#795548', color: '#fff', fontWeight: 'bold', textAlign: 'center', minWidth: 70 }}>
                              {army}<br/>{cat}
                            </TableCell>
                          ))
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={19} sx={{ textAlign: 'center', color: '#666' }}>표시할 데이터가 없습니다.</TableCell>
                        </TableRow>
                      ) : (
                        previewRows.map((row) => (
                          <TableRow key={row.modelName}>
                            <TableCell sx={{ fontWeight: 'bold' }}>{row.modelName}</TableCell>
                            {row.expenditureValues.map((val, idx) => (
                              <TableCell key={idx} sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                {val ? val.toLocaleString() : ''}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
         <DialogActions>
           <Button onClick={() => setShowPreviewModal(false)}>닫기</Button>
         </DialogActions>
       </Dialog>
    </Box>
  );

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static" sx={{ backgroundColor: '#795548' }}>
        <Toolbar>
          <BudgetIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            예산 모드
          </Typography>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={onModeChange}
              startIcon={<SwapHorizIcon />}
              sx={{ 
                mr: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              모드 변경
            </Button>
          )}
          
          {/* 업데이트 확인 버튼 */}
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={handleForceShowUpdatePopup}
            sx={{ 
              mr: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)'
              }
            }}
          >
            업데이트 확인
          </Button>
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 콘텐츠 */}
      <Box sx={{ 
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#f5f5f5'
      }}>
        {/* 탭 메뉴 */}
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: '#e0e0e0', 
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          px: 2
        }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            sx={{
              flexGrow: 1,
              '& .MuiTab-root': {
                color: '#666666',
                fontWeight: 'bold',
                '&.Mui-selected': {
                  color: '#795548'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#795548'
              }
            }}
          >
            <Tab label="액면예산" icon={<BudgetIcon />} iconPosition="start" />
            <Tab label="별도추가" icon={<AnalyticsIcon />} iconPosition="start" />
            <Tab label="부가추가지원" icon={<SettingsIcon />} iconPosition="start" />
            <Tab label="부가차감지원" icon={<TimelineIcon />} iconPosition="start" />
            <Tab label="시트설정" icon={<SettingsIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* 탭별 콘텐츠 */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            {/* 액면예산 서브메뉴 드롭다운 */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>액면예산 서브메뉴</InputLabel>
                <Select
                  value={faceValueSubMenu}
                  onChange={(e) => handleFaceValueSubMenuChange(e.target.value)}
                  label="액면예산 서브메뉴"
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#795548'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#5d4037'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#795548'
                    }
                  }}
                >
                  <MenuItem value="Ⅰ">액면예산(Ⅰ)</MenuItem>
                  <MenuItem value="Ⅱ">액면예산(Ⅱ)</MenuItem>
                  <MenuItem value="종합">액면예산(종합)</MenuItem>
                </Select>
              </FormControl>
            </Box>
            
            {/* 서브메뉴별 콘텐츠 */}
            {faceValueSubMenu === 'Ⅰ' && renderFaceValueBudget('Ⅰ')}
            {faceValueSubMenu === 'Ⅱ' && renderFaceValueBudget('Ⅱ')}
            {faceValueSubMenu === '종합' && renderFaceValueSummary()}
          </Box>
        )}
        {activeTab === 1 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#795548', mb: 2 }}>
              🚧 별도추가 준비중
            </Typography>
          </Box>
        )}
        {activeTab === 2 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#795548', mb: 2 }}>
              🚧 부가추가지원 준비중
            </Typography>
          </Box>
        )}
        {activeTab === 3 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ color: '#795548', mb: 2 }}>
              🚧 부가차감지원 준비중
            </Typography>
          </Box>
        )}
        {activeTab === 4 && renderSheetSettings()}

        {/* 업데이트 팝업 */}
        <AppUpdatePopup
          open={showUpdatePopup}
          onClose={() => setShowUpdatePopup(false)}
          mode="budget"
          loggedInStore={loggedInStore}
          onUpdateAdded={() => {
            console.log('예산모드 새 업데이트가 추가되었습니다.');
          }}
        />

        {/* 스낵바 */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert 
            onClose={() => setSnackbar({ ...snackbar, open: false })} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );

}

export default BudgetMode; 