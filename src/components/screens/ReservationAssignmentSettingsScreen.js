import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Checkbox,
  LinearProgress,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  InputAdornment
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Preview as PreviewIcon,
  BarChart as BarChartIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  Print as PrintIcon,
  ExpandMore as ExpandMoreIcon,
  Help as HelpIcon,
  Share as ShareIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  PriorityHigh as PriorityHighIcon
} from '@mui/icons-material';
import { calculateReservationAssignment, clearReservationAssignmentCache, getSelectedReservationTargets, extractAvailableModels } from '../../utils/reservationAssignmentUtils';
import AssignmentVisualization from '../AssignmentVisualization';
import { getColorsForModel, getModelInventorySummary } from '../../utils/modelUtils';
import { addAssignmentCompletedNotification, addSettingsChangedNotification } from '../../utils/notificationUtils';
import { saveAssignmentHistory, createHistoryItem } from '../../utils/assignmentHistory';
import { 
  getCachedHierarchicalStructure, 
  getCachedAvailableModels, 
  getCachedAgents, 
  getCachedStores,
  getCachedAssignmentCalculation,
  clearReservationCache,
  getCacheStats
} from '../../utils/reservationAssignmentCache';

// API 기본 URL 설정
const API_BASE_URL = process.env.REACT_APP_API_URL;

// 환경변수 검증
if (!API_BASE_URL) {
  console.error('REACT_APP_API_URL 환경변수가 설정되지 않았습니다.');
}

function ReservationAssignmentSettingsScreen({ data, onBack, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [stores, setStores] = useState([]);
  const [assignmentSettings, setAssignmentSettings] = useState({
    priorities: {
      onSaleReceipt: 1,    // 온세일접수 1순위
      yardReceipt: 2,      // 마당접수 2순위
      reservationSite: 3   // 사전예약사이트 3순위
    },
    models: {},
    targets: {
      stores: {},
      agents: {},
      departments: {},
      offices: {}
    }
  });
  
  const [editingAgent, setEditingAgent] = useState(null);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [newModel, setNewModel] = useState({ name: '', capacity: '', color: '', quantity: 0, bulkQuantities: {} });
  const [availableModels, setAvailableModels] = useState({ models: [], capacities: [], colors: [], modelCapacityColors: new Map() });
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: 설정, 1: 미리보기, 2: 시각화
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [previewSubTab, setPreviewSubTab] = useState(0);
  const [showSharedSettingsDialog, setShowSharedSettingsDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedColors, setExpandedColors] = useState({}); // 색상별 접기/펼치기 상태 (기본값: 모두 닫힘)
  const [expandedLogicDetails, setExpandedLogicDetails] = useState({}); // 로직 세부사항 접기/펼치기 상태 (기본값: 모두 닫힘)
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDetails, setErrorDetails] = useState(''); // 배정 로직 세부사항 접기/펼치기 상태
  const [showCacheStatsDialog, setShowCacheStatsDialog] = useState(false);
  const [cacheStats, setCacheStats] = useState(null);

  // 캐시된 계층 구조 생성
  const [hierarchicalStructure, setHierarchicalStructure] = useState({
    offices: {},
    departments: {},
    agents: {},
    stores: {}
  });

  // 계층 구조 캐시 로드
  useEffect(() => {
    const loadHierarchicalStructure = async () => {
      if (agents.length > 0) {
        try {
          const structure = await getCachedHierarchicalStructure(agents, data);
          setHierarchicalStructure(structure);
        } catch (error) {
          console.error('계층 구조 캐시 로드 실패:', error);
        }
      }
    };

    loadHierarchicalStructure();
  }, [agents, data]);

  // 캐시된 데이터 로드
  useEffect(() => {
    const loadCachedData = async () => {
      try {
        console.log('🔄 캐시된 데이터 로드 시작');
        
        // 담당자 데이터 캐시 로드
        console.log('담당자 데이터 캐시 로드 중...');
        try {
          const agentData = await getCachedAgents(API_BASE_URL);
          console.log('✅ 캐시된 담당자 데이터 로드 완료:', agentData.length, '명');
          setAgents(agentData);
        } catch (agentError) {
          console.error('담당자 데이터 캐시 로드 실패:', agentError);
          setAgents([]);
        }
        
        // 매장 데이터 캐시 로드
        console.log('매장 데이터 캐시 로드 중...');
        try {
          const storeData = await getCachedStores(data, API_BASE_URL);
          console.log('✅ 캐시된 매장 데이터 로드 완료:', storeData.length, '개');
          setStores(storeData);
        } catch (storeError) {
          console.error('매장 데이터 캐시 로드 실패:', storeError);
          setStores([]);
        }
        
        // 사용 가능한 모델 캐시 로드
        console.log('사용 가능한 모델 캐시 로드 중...');
        try {
          const modelData = await getCachedAvailableModels();
          console.log('✅ 캐시된 모델 데이터 로드 완료');
          setAvailableModels(modelData);
        } catch (modelError) {
          console.error('모델 데이터 캐시 로드 실패:', modelError);
          setAvailableModels({
            models: [],
            capacities: [],
            colors: [],
            modelCapacityColors: new Map()
          });
        }
        
        // 저장된 설정 로드
        console.log('저장된 설정 로드 중...');
        try {
          await loadSettings();
          console.log('✅ 저장된 설정 로드 성공');
        } catch (settingsError) {
          console.error('설정 로드 실패:', settingsError);
          setDefaultSettings();
        }
        
        console.log('✅ 모든 캐시된 데이터 로드 완료');
        
      } catch (error) {
        console.error('캐시된 데이터 로드 중 오류 발생:', error);
      }
    };
    
    loadCachedData();
  }, [data]);

  // 설정이 변경될 때마다 자동 저장
  useEffect(() => {
    // 초기 로드 시에는 저장하지 않음 (loadSettings에서 이미 로드됨)
    const isInitialLoad = localStorage.getItem('reservationAssignmentSettings') === null;
    if (!isInitialLoad) {
      saveSettings();
    }
  }, [assignmentSettings]);

  // 키보드 단축키 처리 - 의존성 배열에서 assignmentSettings 제거
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            saveSettings();
            break;
          case 'p':
            event.preventDefault();
            handlePreviewAssignment();
            break;
          case 'r':
            event.preventDefault();
            handleResetAllSettings();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []); // 빈 의존성 배열로 변경

  // 메모이제이션된 설정 저장
  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem('reservationAssignmentSettings', JSON.stringify(assignmentSettings));
      console.log('✅ 사전예약 배정 설정 저장 완료');
      addSettingsChangedNotification('사전예약 배정 설정이 저장되었습니다.');
    } catch (error) {
      console.error('설정 저장 실패:', error);
    }
  }, [assignmentSettings]);

  // 메모이제이션된 설정 로드
  const loadSettings = useCallback(async () => {
    try {
      const savedSettings = localStorage.getItem('reservationAssignmentSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setAssignmentSettings(parsedSettings);
        console.log('✅ 저장된 사전예약 배정 설정 로드 완료');
      } else {
        console.log('저장된 설정이 없음, 기본 설정 사용');
        setDefaultSettings();
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
      setDefaultSettings();
    }
  }, []);

  // 메모이제이션된 기본 설정 설정
  const setDefaultSettings = useCallback(() => {
    const defaultSettings = {
      priorities: {
        onSaleReceipt: 1,    // 온세일접수 1순위
        yardReceipt: 2,      // 마당접수 2순위
        reservationSite: 3   // 사전예약사이트 3순위
      },
      models: {},
      targets: {
        stores: {},
        agents: {},
        departments: {},
        offices: {}
      }
    };
    setAssignmentSettings(defaultSettings);
    console.log('✅ 기본 사전예약 배정 설정 적용');
  }, []);

  // 모든 설정 초기화
  const handleResetAllSettings = () => {
    if (window.confirm('모든 사전예약 배정 설정을 초기화하시겠습니까?')) {
      setDefaultSettings();
      localStorage.removeItem('reservationAssignmentSettings');
      console.log('✅ 모든 사전예약 배정 설정 초기화 완료');
      addSettingsChangedNotification('모든 사전예약 배정 설정이 초기화되었습니다.');
    }
  };

  // 캐시된 미리보기 배정 실행
  const handlePreviewAssignment = useCallback(async () => {
    setIsLoadingPreview(true);
    setProgress(0);
    setProgressMessage('사전예약 배정 미리보기 준비 중...');
    
    try {
      console.log('🔄 캐시된 사전예약 배정 미리보기 시작');
      
      // 선택된 대상자 확인
      const selectedTargets = getSelectedReservationTargets(assignmentSettings.targets, agents);
      console.log('선택된 대상자:', selectedTargets);
      
      if (selectedTargets.length === 0) {
        setErrorDetails('배정 대상자가 선택되지 않았습니다. 대상자를 선택해주세요.');
        setShowErrorDialog(true);
        return;
      }
      
      // 모델 확인
      const selectedModels = Object.keys(assignmentSettings.models).filter(model => 
        assignmentSettings.models[model].enabled
      );
      
      if (selectedModels.length === 0) {
        setErrorDetails('배정할 모델이 선택되지 않았습니다. 모델을 추가해주세요.');
        setShowErrorDialog(true);
        return;
      }
      
      setProgress(20);
      setProgressMessage('사전예약 데이터 수집 중...');
      
      // 캐시된 사전예약 배정 계산
      const result = await getCachedAssignmentCalculation(
        assignmentSettings,
        selectedTargets,
        (progress, message) => {
          setProgress(progress);
          setProgressMessage(message);
        }
      );
      
      setProgress(100);
      setProgressMessage('사전예약 배정 미리보기 완료');
      
      if (result.success) {
        setPreviewData(result.data);
        setActiveTab(1); // 미리보기 탭으로 이동
        console.log('✅ 캐시된 사전예약 배정 미리보기 완료');
        addSettingsChangedNotification('사전예약 배정 미리보기가 완료되었습니다.');
      } else {
        setErrorDetails(result.error || '사전예약 배정 미리보기 중 오류가 발생했습니다.');
        setShowErrorDialog(true);
      }
      
    } catch (error) {
      console.error('캐시된 사전예약 배정 미리보기 실패:', error);
      setErrorDetails(`사전예약 배정 미리보기 실패: ${error.message}`);
      setShowErrorDialog(true);
    } finally {
      setIsLoadingPreview(false);
      setProgress(0);
      setProgressMessage('');
    }
  }, [assignmentSettings, agents]);

  // 캐시 클리어
  const handleClearCache = useCallback(() => {
    if (window.confirm('사전예약 배정 캐시를 클리어하시겠습니까?')) {
      clearReservationCache();
      console.log('✅ 사전예약 배정 캐시 클리어 완료');
      addSettingsChangedNotification('사전예약 배정 캐시가 클리어되었습니다.');
    }
  }, []);

  // 캐시 통계 보기
  const handleShowCacheStats = useCallback(() => {
    const stats = getCacheStats();
    setCacheStats(stats);
    setShowCacheStatsDialog(true);
  }, []);

  // 담당자 편집 관련 함수들
  const handleAgentEdit = (agent) => {
    setEditingAgent({ ...agent });
  };

  const handleAgentSave = () => {
    // 담당자 정보 저장 로직
    setEditingAgent(null);
  };

  const handleAgentCancel = () => {
    setEditingAgent(null);
  };

  // 우선순위 변경 처리
  const handlePriorityChange = (type, value) => {
    setAssignmentSettings(prev => ({
      ...prev,
      priorities: {
        ...prev.priorities,
        [type]: value
      }
    }));
  };

  // 모델 추가
  const handleAddModel = () => {
    if (selectedModel && selectedCapacity && selectedColor) {
      const modelKey = `${selectedModel}|${selectedCapacity}|${selectedColor}`;
      setAssignmentSettings(prev => {
        const newSettings = {
          ...prev,
          models: {
            ...prev.models,
            [modelKey]: {
              name: selectedModel,
              capacity: selectedCapacity,
              color: selectedColor,
              enabled: true,
              quantity: newModel.quantity,
              bulkQuantities: { ...newModel.bulkQuantities }
            }
          }
        };
        
        // 즉시 저장
        try {
          localStorage.setItem('reservationAssignmentSettings', JSON.stringify(newSettings));
          console.log('✅ 모델 추가 후 즉시 저장 완료');
        } catch (error) {
          console.error('모델 추가 후 저장 실패:', error);
        }
        
        return newSettings;
      });
      
      setNewModel({ name: '', capacity: '', color: '', quantity: 0, bulkQuantities: {} });
      setSelectedModel('');
      setSelectedCapacity('');
      setSelectedColor('');
      setShowModelDialog(false);
      console.log('✅ 모델 추가 완료:', modelKey);
    }
  };

  // 모델 삭제
  const handleDeleteModel = (modelKey) => {
    if (window.confirm('이 모델을 삭제하시겠습니까?')) {
      setAssignmentSettings(prev => {
        const newModels = { ...prev.models };
        delete newModels[modelKey];
        
        const newSettings = {
          ...prev,
          models: newModels
        };
        
        // 즉시 저장
        try {
          localStorage.setItem('reservationAssignmentSettings', JSON.stringify(newSettings));
          console.log('✅ 모델 삭제 후 즉시 저장 완료');
        } catch (error) {
          console.error('모델 삭제 후 저장 실패:', error);
        }
        
        return newSettings;
      });
      console.log('✅ 모델 삭제 완료:', modelKey);
    }
  };

  // 캐시된 계층적 대상자 변경 처리
  const handleHierarchicalTargetChange = useCallback((type, target, checked) => {
    setAssignmentSettings(prev => {
      const newTargets = { ...prev.targets };
      
      if (type === 'offices') {
        // 사무실 선택/해제 시 해당 소속과 영업사원도 함께 처리
        newTargets.offices[target] = checked;
        
        if (hierarchicalStructure.offices[target]) {
          const officeData = hierarchicalStructure.offices[target];
          
          // 해당 사무실의 소속들 처리
          officeData.departments.forEach(dept => {
            if (newTargets.departments[dept] !== undefined) {
              newTargets.departments[dept] = checked;
            }
          });
          
          // 해당 사무실의 영업사원들 처리
          officeData.agents.forEach(agentId => {
            if (newTargets.agents[agentId] !== undefined) {
              newTargets.agents[agentId] = checked;
            }
          });
        }
      } else if (type === 'departments') {
        // 소속 선택/해제 시 해당 영업사원도 함께 처리
        newTargets.departments[target] = checked;
        
        if (hierarchicalStructure.departments[target]) {
          const deptData = hierarchicalStructure.departments[target];
          
          // 해당 소속의 영업사원들 처리
          deptData.agents.forEach(agentId => {
            if (newTargets.agents[agentId] !== undefined) {
              newTargets.agents[agentId] = checked;
            }
          });
        }
      } else if (type === 'agents') {
        // 영업사원 개별 선택/해제
        newTargets.agents[target] = checked;
      } else if (type === 'stores') {
        // 매장 개별 선택/해제
        newTargets.stores[target] = checked;
        
        // 해당 매장의 담당자들도 함께 처리
        if (hierarchicalStructure.stores[target]) {
          const storeData = hierarchicalStructure.stores[target];
          
          // 해당 매장의 담당자들 처리
          storeData.agents.forEach(agentId => {
            if (newTargets.agents[agentId] !== undefined) {
              newTargets.agents[agentId] = checked;
            }
          });
        }
      }

      const newSettings = {
        ...prev,
        targets: newTargets
      };
      
      // 즉시 저장
      try {
        localStorage.setItem('reservationAssignmentSettings', JSON.stringify(newSettings));
        console.log('✅ 대상자 선택 변경 후 즉시 저장 완료');
      } catch (error) {
        console.error('대상자 선택 변경 후 저장 실패:', error);
      }
      
      return newSettings;
    });
  }, [hierarchicalStructure]);

  // 캐시된 계층적 전체 선택/해제
  const handleHierarchicalSelectAll = useCallback((type, checked) => {
    setAssignmentSettings(prev => {
      const newTargets = { ...prev.targets };
      
      if (type === 'offices') {
        // 사무실 전체 선택/해제
        Object.keys(newTargets.offices).forEach(office => {
          newTargets.offices[office] = checked;
          
          if (hierarchicalStructure.offices[office]) {
            const officeData = hierarchicalStructure.offices[office];
            
            // 해당 사무실의 소속들 처리
            officeData.departments.forEach(dept => {
              if (newTargets.departments[dept] !== undefined) {
                newTargets.departments[dept] = checked;
              }
            });
            
            // 해당 사무실의 영업사원들 처리
            officeData.agents.forEach(agentId => {
              if (newTargets.agents[agentId] !== undefined) {
                newTargets.agents[agentId] = checked;
              }
            });
          }
        });
      } else if (type === 'departments') {
        // 소속 전체 선택/해제
        Object.keys(newTargets.departments).forEach(dept => {
          newTargets.departments[dept] = checked;
          
          if (hierarchicalStructure.departments[dept]) {
            const deptData = hierarchicalStructure.departments[dept];
            
            // 해당 소속의 영업사원들 처리
            deptData.agents.forEach(agentId => {
              if (newTargets.agents[agentId] !== undefined) {
                newTargets.agents[agentId] = checked;
              }
            });
          }
        });
      } else if (type === 'agents') {
        // 영업사원 전체 선택/해제
        Object.keys(newTargets.agents).forEach(agentId => {
          newTargets.agents[agentId] = checked;
        });
      } else if (type === 'stores') {
        // 매장 전체 선택/해제
        Object.keys(newTargets.stores).forEach(storeName => {
          newTargets.stores[storeName] = checked;
          
          // 해당 매장의 담당자들도 함께 처리
          if (hierarchicalStructure.stores[storeName]) {
            const storeData = hierarchicalStructure.stores[storeName];
            
            storeData.agents.forEach(agentId => {
              if (newTargets.agents[agentId] !== undefined) {
                newTargets.agents[agentId] = checked;
              }
            });
          }
        });
      }

      const newSettings = {
        ...prev,
        targets: newTargets
      };
      
      // 즉시 저장
      try {
        localStorage.setItem('reservationAssignmentSettings', JSON.stringify(newSettings));
        console.log('✅ 전체 선택/해제 후 즉시 저장 완료');
      } catch (error) {
        console.error('전체 선택/해제 후 저장 실패:', error);
      }
      
      return newSettings;
    });
  }, [hierarchicalStructure]);

  // 캐시된 계층적 초기화
  const handleHierarchicalReset = useCallback((type) => {
    if (window.confirm(`${type === 'offices' ? '사무실' : type === 'departments' ? '소속' : type === 'stores' ? '매장' : '담당자'} 선택을 초기화하시겠습니까?`)) {
      setAssignmentSettings(prev => {
        const newTargets = { ...prev.targets };
        
        if (type === 'offices') {
          // 사무실 전체 해제 시 모든 하위 항목도 해제
          Object.keys(newTargets.offices).forEach(office => {
            newTargets.offices[office] = false;
            
            if (hierarchicalStructure.offices[office]) {
              const officeData = hierarchicalStructure.offices[office];
              
              officeData.departments.forEach(dept => {
                if (newTargets.departments[dept] !== undefined) {
                  newTargets.departments[dept] = false;
                }
              });
              
              officeData.agents.forEach(agentId => {
                if (newTargets.agents[agentId] !== undefined) {
                  newTargets.agents[agentId] = false;
                }
              });
            }
          });
        } else if (type === 'departments') {
          // 소속 전체 해제 시 해당 영업사원들도 해제
          Object.keys(newTargets.departments).forEach(dept => {
            newTargets.departments[dept] = false;
            
            if (hierarchicalStructure.departments[dept]) {
              const deptData = hierarchicalStructure.departments[dept];
              
              deptData.agents.forEach(agentId => {
                if (newTargets.agents[agentId] !== undefined) {
                  newTargets.agents[agentId] = false;
                }
              });
            }
          });
        } else if (type === 'agents') {
          // 영업사원 전체 해제
          Object.keys(newTargets.agents).forEach(agentId => {
            newTargets.agents[agentId] = false;
          });
        } else if (type === 'stores') {
          // 매장 전체 해제
          Object.keys(newTargets.stores).forEach(storeName => {
            newTargets.stores[storeName] = false;
            
            // 해당 매장의 담당자들도 함께 해제
            if (hierarchicalStructure.stores[storeName]) {
              const storeData = hierarchicalStructure.stores[storeName];
              
              storeData.agents.forEach(agentId => {
                if (newTargets.agents[agentId] !== undefined) {
                  newTargets.agents[agentId] = false;
                }
              });
            }
          });
        }

        const newSettings = {
          ...prev,
          targets: newTargets
        };
        
        // 즉시 저장
        try {
          localStorage.setItem('reservationAssignmentSettings', JSON.stringify(newSettings));
          console.log('✅ 초기화 후 즉시 저장 완료');
        } catch (error) {
          console.error('초기화 후 저장 실패:', error);
        }
        
        return newSettings;
      });
    }
  }, [hierarchicalStructure]);

  // 배정 확인 및 실행
  const handleConfirmAssignment = async () => {
    if (!previewData) {
      alert('먼저 미리보기를 실행해주세요.');
      return;
    }
    
    if (window.confirm('사전예약 배정을 실행하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      try {
        console.log('사전예약 배정 실행 시작');
        
        // 배정 히스토리 저장
        const historyItem = createHistoryItem({
          type: 'reservation_assignment',
          settings: assignmentSettings,
          results: previewData,
          timestamp: new Date().toISOString()
        });
        
        await saveAssignmentHistory(historyItem);
        
        // 배정 완료 알림
        addAssignmentCompletedNotification('사전예약 배정이 완료되었습니다.');
        
        console.log('✅ 사전예약 배정 실행 완료');
        
        // 성공 메시지 표시
        alert('사전예약 배정이 성공적으로 완료되었습니다.');
        
      } catch (error) {
        console.error('사전예약 배정 실행 실패:', error);
        alert('사전예약 배정 실행 중 오류가 발생했습니다.');
      }
    }
  };

  // 로직 이모지 반환
  const getLogicEmoji = (logicType) => {
    switch (logicType) {
      case 'priority': return '🏆';
      case 'time': return '⏰';
      default: return '📊';
    }
  };

  // 메모이제이션된 점수 표시 컴포넌트
  const ScoreDisplay = useMemo(() => {
    return React.memo(({ scores, modelName, colorName }) => {
      if (!scores) return null;
      
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            {modelName} {colorName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(scores).map(([key, value]) => (
              <Chip
                key={key}
                label={`${key}: ${value}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.6rem', height: 20 }}
              />
            ))}
          </Box>
        </Box>
      );
    });
  }, []);

  // 인쇄 처리
  const handlePrint = (type) => {
    if (type === 'settings') {
      window.print();
    } else if (type === 'preview' && previewData) {
      // 미리보기 데이터 인쇄
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>사전예약 배정 미리보기</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .header { text-align: center; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>사전예약 배정 미리보기</h1>
              <p>생성일시: ${new Date().toLocaleString()}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>담당자</th>
                  <th>모델</th>
                  <th>색상</th>
                  <th>수량</th>
                  <th>우선순위</th>
                </tr>
              </thead>
              <tbody>
                ${previewData.assignments.map(assignment => `
                  <tr>
                    <td>${assignment.agent}</td>
                    <td>${assignment.model}</td>
                    <td>${assignment.color}</td>
                    <td>${assignment.quantity}</td>
                    <td>${assignment.priority}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // 설정 공유
  const handleShareSettings = () => {
    const settingsToShare = {
      ...assignmentSettings,
      sharedAt: new Date().toISOString(),
      sharedBy: '사용자' // 실제 사용자 정보로 교체
    };
    
    const sharedSettings = JSON.parse(localStorage.getItem('sharedReservationAssignmentSettings') || '[]');
    sharedSettings.push(settingsToShare);
    localStorage.setItem('sharedReservationAssignmentSettings', JSON.stringify(sharedSettings));
    
    setShowSharedSettingsDialog(true);
    console.log('✅ 사전예약 배정 설정 공유 완료');
  };

  // 공유 설정 로드
  const handleLoadSharedSettings = () => {
    const sharedSettings = JSON.parse(localStorage.getItem('sharedReservationAssignmentSettings') || '[]');
    if (sharedSettings.length > 0) {
      const latestSettings = sharedSettings[sharedSettings.length - 1];
      setAssignmentSettings(latestSettings);
      console.log('✅ 공유된 사전예약 배정 설정 로드 완료');
    }
  };

  // 공유 설정 삭제
  const handleDeleteSharedSetting = (index) => {
    const sharedSettings = JSON.parse(localStorage.getItem('sharedReservationAssignmentSettings') || '[]');
    sharedSettings.splice(index, 1);
    localStorage.setItem('sharedReservationAssignmentSettings', JSON.stringify(sharedSettings));
    setShowSharedSettingsDialog(false);
    console.log('✅ 공유된 사전예약 배정 설정 삭제 완료');
  };

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 앱바 */}
      <AppBar position="static" sx={{ backgroundColor: '#ff9a9e' }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={onBack}
            sx={{ mr: 2 }}
          >
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🏆 사전예약 배정 설정
          </Typography>
          <Button
            color="inherit"
            onClick={onLogout}
            sx={{ ml: 2 }}
          >
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 메인 컨텐츠 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {/* 진행률 표시 */}
        {isLoadingPreview && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {progressMessage}
            </Typography>
          </Box>
        )}

        {/* 탭 네비게이션 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="설정" icon={<SettingsIcon />} />
            <Tab label="미리보기" icon={<PreviewIcon />} disabled={!previewData} />
            <Tab label="시각화" icon={<BarChartIcon />} disabled={!previewData} />
          </Tabs>
        </Box>

        {/* 설정 탭 */}
        {activeTab === 0 && (
          <Grid container spacing={3}>
            {/* 우선순위 설정 */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
                    🏆 우선순위 설정
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      사전예약 배정 우선순위를 설정하세요. 각 항목 내에서는 접수시간이 빠른 순서대로 배정됩니다.
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="1순위" color="primary" size="small" />
                      <Typography variant="body1">온세일접수</Typography>
                      <Chip label="접수시간 우선" color="success" size="small" />
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="2순위" color="secondary" size="small" />
                      <Typography variant="body1">마당접수</Typography>
                      <Chip label="접수시간 우선" color="success" size="small" />
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Chip label="3순위" color="warning" size="small" />
                      <Typography variant="body1">사전예약사이트</Typography>
                      <Chip label="접수시간 우선" color="success" size="small" />
                    </Box>
                  </Box>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>배정 로직:</strong> 1순위부터 차례로 확인하여 접수시간이 빠른 순서대로 배정합니다.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>

            {/* 모델 설정 */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
                      📱 모델 설정
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => setShowModelDialog(true)}
                      sx={{ 
                        backgroundColor: '#ff9a9e',
                        '&:hover': { backgroundColor: '#ff8a8e' }
                      }}
                    >
                      모델 추가
                    </Button>
                  </Box>

                  {Object.keys(assignmentSettings.models).length === 0 ? (
                    <Alert severity="info">
                      배정할 모델을 추가해주세요.
                    </Alert>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {Object.entries(assignmentSettings.models).map(([modelKey, modelData]) => (
                        <Box key={modelKey} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Checkbox
                            checked={modelData.enabled}
                            onChange={(e) => {
                              setAssignmentSettings(prev => {
                                const newSettings = {
                                  ...prev,
                                  models: {
                                    ...prev.models,
                                    [modelKey]: {
                                      ...prev.models[modelKey],
                                      enabled: e.target.checked
                                    }
                                  }
                                };
                                
                                // 즉시 저장
                                try {
                                  localStorage.setItem('reservationAssignmentSettings', JSON.stringify(newSettings));
                                  console.log('✅ 모델 활성화/비활성화 후 즉시 저장 완료');
                                } catch (error) {
                                  console.error('모델 활성화/비활성화 후 저장 실패:', error);
                                }
                                
                                return newSettings;
                              });
                            }}
                          />
                          <Chip
                            label={`${modelData.name} ${modelData.capacity} ${modelData.color}`}
                            color="primary"
                            size="small"
                          />
                          <Typography variant="body2">
                            수량: {modelData.quantity}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteModel(modelKey)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* 대상자 설정 */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
                    👥 대상
                  </Typography>

                  <Tabs value={previewSubTab} onChange={(e, newValue) => setPreviewSubTab(newValue)}>
                    <Tab label="매장별" />
                    <Tab label="담당자별" />
                    <Tab label="소속별" />
                    <Tab label="사무실별" />
                  </Tabs>

                  <Box sx={{ mt: 2 }}>
                    {previewSubTab === 0 && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1">매장별 선택</Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip
                              label={`선택됨: ${Object.values(assignmentSettings.targets.stores || {}).filter(Boolean).length}/${stores.length}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalSelectAll('stores', true)}
                            >
                              전체 선택
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalSelectAll('stores', false)}
                            >
                              전체 해제
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalReset('stores')}
                            >
                              초기화
                            </Button>
                          </Box>
                        </Box>
                        
                        <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                          {stores.map(store => (
                            <Box key={store.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, p: 1, borderRadius: 1, '&:hover': { backgroundColor: '#f5f5f5' } }}>
                              <Checkbox
                                checked={assignmentSettings.targets.stores?.[store.id] || false}
                                onChange={(e) => handleHierarchicalTargetChange('stores', store.id, e.target.checked)}
                                size="small"
                                sx={{ mr: 1 }}
                              />
                              <Typography variant="body2" sx={{ flex: 1 }}>
                                {store.name}
                              </Typography>
                              {assignmentSettings.targets.stores?.[store.id] && (
                                <Chip
                                  label="선택됨"
                                  size="small"
                                  color="primary"
                                  sx={{ fontSize: '0.7rem', height: 20 }}
                                />
                              )}
                            </Box>
                          ))}
                          {stores.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                              매장 데이터를 불러오는 중...
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )}

                    {previewSubTab === 1 && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1">담당자별 선택</Typography>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip
                              label={`선택됨: ${Object.values(assignmentSettings.targets.agents || {}).filter(Boolean).length}/${agents.length}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalSelectAll('agents', true)}
                            >
                              전체 선택
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalSelectAll('agents', false)}
                            >
                              전체 해제
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalReset('agents')}
                            >
                              초기화
                            </Button>
                          </Box>
                        </Box>
                        
                        <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, p: 1 }}>
                          {agents.map(agent => (
                            <Box key={agent.contactId} sx={{ display: 'flex', alignItems: 'center', mb: 1, p: 1, borderRadius: 1, '&:hover': { backgroundColor: '#f5f5f5' } }}>
                              <Checkbox
                                checked={assignmentSettings.targets.agents[agent.contactId] || false}
                                onChange={(e) => handleHierarchicalTargetChange('agents', agent.contactId, e.target.checked)}
                                size="small"
                                sx={{ mr: 1 }}
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2">
                                  {agent.target || agent.contactId}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {agent.office} • {agent.department}
                                </Typography>
                              </Box>
                              {assignmentSettings.targets.agents[agent.contactId] && (
                                <Chip
                                  label="선택됨"
                                  size="small"
                                  color="primary"
                                  sx={{ fontSize: '0.7rem', height: 20 }}
                                />
                              )}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}

                    {previewSubTab === 2 && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1">소속별 선택</Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalSelectAll('departments', true)}
                            >
                              전체 선택
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalSelectAll('departments', false)}
                            >
                              전체 해제
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalReset('departments')}
                            >
                              초기화
                            </Button>
                          </Box>
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {[...new Set(agents.map(agent => agent.department))].filter(department => department).map(department => (
                            <Chip
                              key={department}
                              label={department}
                              color={assignmentSettings.targets.departments[department] ? 'primary' : 'default'}
                              onClick={() => handleHierarchicalTargetChange('departments', department, !assignmentSettings.targets.departments[department])}
                              sx={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {previewSubTab === 3 && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1">사무실별 선택</Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalSelectAll('offices', true)}
                            >
                              전체 선택
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalSelectAll('offices', false)}
                            >
                              전체 해제
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleHierarchicalReset('offices')}
                            >
                              초기화
                            </Button>
                          </Box>
                        </Box>
                        
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {[...new Set(agents.map(agent => agent.office))].filter(office => office).map(office => (
                            <Chip
                              key={office}
                              label={office}
                              color={assignmentSettings.targets.offices[office] ? 'primary' : 'default'}
                              onClick={() => handleHierarchicalTargetChange('offices', office, !assignmentSettings.targets.offices[office])}
                              sx={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* 미리보기 탭 */}
        {activeTab === 1 && previewData && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: '#ff9a9e', fontWeight: 'bold' }}>
                📊 사전예약 배정 미리보기
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={() => handlePrint('preview')}
                >
                  인쇄
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CheckIcon />}
                  onClick={handleConfirmAssignment}
                  sx={{ 
                    backgroundColor: '#ff9a9e',
                    '&:hover': { backgroundColor: '#ff8a8e' }
                  }}
                >
                  배정 실행
                </Button>
              </Box>
            </Box>

            {/* 미리보기 서브탭 */}
            <Tabs value={previewSubTab} onChange={(e, newValue) => setPreviewSubTab(newValue)} sx={{ mb: 2 }}>
              <Tab label="상세 배정" />
              <Tab label="POS별 합산" />
              <Tab label="담당자별 합산" />
              <Tab label="소속별 합산" />
              <Tab label="사무실별 합산" />
            </Tabs>

            {/* 상세 배정 탭 */}
            {previewSubTab === 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                                          <TableRow>
                        <TableCell>담당자</TableCell>
                        <TableCell>모델/용량</TableCell>
                        <TableCell>색상</TableCell>
                        <TableCell align="center">수량</TableCell>
                        <TableCell align="center">우선순위</TableCell>
                        <TableCell>출처</TableCell>
                        <TableCell>접수시간</TableCell>
                      </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.assignments.map((assignment, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{assignment.agent}</TableCell>
                        <TableCell>{assignment.model} {assignment.capacity}</TableCell>
                        <TableCell>{assignment.color}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={assignment.quantity}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={assignment.priority === 1 ? '온세일' : assignment.priority === 2 ? '마당접수' : '사전예약'}
                            color={assignment.priority === 1 ? 'error' : assignment.priority === 2 ? 'warning' : 'info'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={assignment.source === 'onSale' ? '온세일' : assignment.source === 'yard' ? '마당접수' : '사전예약'}
                            color={assignment.source === 'onSale' ? 'error' : assignment.source === 'yard' ? 'warning' : 'info'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{assignment.receiptTime}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* POS별 합산 탭 */}
            {previewSubTab === 1 && (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>POS명</TableCell>
                      <TableCell>모델/용량</TableCell>
                      <TableCell>색상</TableCell>
                      <TableCell align="center">총 수량</TableCell>
                      <TableCell align="center">담당자 수</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {generatePOSSummary(previewData.assignments, agents).map((pos, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{pos.posName}</TableCell>
                        <TableCell>{pos.model} {pos.capacity}</TableCell>
                        <TableCell>{pos.color}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={pos.totalQuantity}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={pos.agentCount}
                            color="secondary"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 담당자별 합산 탭 */}
            {previewSubTab === 2 && (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>담당자</TableCell>
                      <TableCell>POS명</TableCell>
                      <TableCell>모델/용량</TableCell>
                      <TableCell>색상</TableCell>
                      <TableCell align="center">총 수량</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {generateAgentSummary(previewData.assignments, agents).map((agent, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{agent.agentName}</TableCell>
                        <TableCell>{agent.posName}</TableCell>
                        <TableCell>{agent.model} {agent.capacity}</TableCell>
                        <TableCell>{agent.color}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={agent.totalQuantity}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 소속별 합산 탭 */}
            {previewSubTab === 3 && (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>소속</TableCell>
                      <TableCell>모델/용량</TableCell>
                      <TableCell>색상</TableCell>
                      <TableCell align="center">총 수량</TableCell>
                      <TableCell align="center">담당자 수</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {generateDepartmentSummary(previewData.assignments, agents).map((dept, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{dept.department}</TableCell>
                        <TableCell>{dept.model} {dept.capacity}</TableCell>
                        <TableCell>{dept.color}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={dept.totalQuantity}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={dept.agentCount}
                            color="secondary"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 사무실별 합산 탭 */}
            {previewSubTab === 4 && (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>사무실</TableCell>
                      <TableCell>모델/용량</TableCell>
                      <TableCell>색상</TableCell>
                      <TableCell align="center">총 수량</TableCell>
                      <TableCell align="center">담당자 수</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {generateOfficeSummary(previewData.assignments, agents).map((office, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{office.office}</TableCell>
                        <TableCell>{office.model} {office.capacity}</TableCell>
                        <TableCell>{office.color}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={office.totalQuantity}
                            color="primary"
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={office.agentCount}
                            color="secondary"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* 시각화 탭 */}
        {activeTab === 2 && previewData && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              📈 사전예약 배정 시각화
            </Typography>
            <AssignmentVisualization data={previewData} />
          </Box>
        )}
      </Box>

      {/* 하단 액션 버튼 */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={saveSettings}
            >
              설정 저장 (Ctrl+S)
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleResetAllSettings}
            >
              초기화 (Ctrl+R)
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleClearCache}
            >
              캐시 클리어
            </Button>
            <Button
              variant="outlined"
              startIcon={<InfoIcon />}
              onClick={handleShowCacheStats}
            >
              캐시 통계
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={handleShareSettings}
            >
              설정 공유
            </Button>
            <Button
              variant="contained"
              startIcon={<PreviewIcon />}
              onClick={handlePreviewAssignment}
              disabled={isLoadingPreview}
              sx={{ 
                backgroundColor: '#ff9a9e',
                '&:hover': { backgroundColor: '#ff8a8e' }
              }}
            >
              {isLoadingPreview ? <CircularProgress size={16} /> : '미리보기 (Ctrl+P)'}
            </Button>
          </Box>
        </Box>
      </Box>

      {/* 모델 추가 다이얼로그 */}
      <Dialog open={showModelDialog} onClose={() => setShowModelDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">📱 모델 추가</Typography>
            <Button
              size="small"
              onClick={() => {
                setSelectedModel('');
                setSelectedCapacity('');
                setSelectedColor('');
                setNewModel({ name: '', capacity: '', color: '', quantity: 0, bulkQuantities: {} });
              }}
            >
              초기화
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* 모델 선택 */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" gutterBottom>
                📱 모델 선택
              </Typography>
              <Autocomplete
                value={selectedModel}
                onChange={(event, newValue) => {
                  setSelectedModel(newValue || '');
                  setSelectedCapacity('');
                  setSelectedColor('');
                  setNewModel(prev => ({ ...prev, name: newValue || '', capacity: '', color: '' }));
                }}
                options={availableModels.models.sort()}
                getOptionLabel={(option) => option || ''}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="모델명"
                    placeholder="모델명을 입력하거나 선택하세요"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">📱</InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                      <span>{option}</span>
                      <Chip 
                        size="small" 
                        label={availableModels.modelCapacityColors.get(option)?.size || 0} 
                        color="primary" 
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                )}
                noOptionsText="사용 가능한 모델이 없습니다. 사전예약 데이터를 확인해주세요."
                loading={availableModels.models.length === 0}
                loadingText="모델 데이터 로딩 중..."
                freeSolo
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
              />
            </Grid>

            {/* 용량 선택 */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" gutterBottom>
                💾 용량 선택
              </Typography>
              {selectedModel ? (
                <Autocomplete
                  value={selectedCapacity}
                  onChange={(event, newValue) => {
                    setSelectedCapacity(newValue || '');
                    setSelectedColor('');
                    setNewModel(prev => ({ ...prev, capacity: newValue || '', color: '' }));
                  }}
                  options={Array.from(availableModels.modelCapacityColors.get(selectedModel)?.keys() || []).sort()}
                  getOptionLabel={(option) => option || ''}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="용량"
                      placeholder="용량을 입력하거나 선택하세요"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">💾</InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                        <span>{option}</span>
                        <Chip 
                          size="small" 
                          label={availableModels.modelCapacityColors.get(selectedModel)?.get(option)?.length || 0} 
                          color="secondary" 
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  )}
                  noOptionsText="사용 가능한 용량이 없습니다. 모델을 먼저 선택해주세요."
                  loading={!availableModels.modelCapacityColors.get(selectedModel)}
                  loadingText="용량 데이터 로딩 중..."
                  freeSolo
                  selectOnFocus
                  clearOnBlur
                  handleHomeEndKeys
                />
              ) : (
                <Box 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center" 
                  height="56px"
                  border="1px dashed #ccc"
                  borderRadius="4px"
                >
                  <Typography variant="body2" color="text.secondary">
                    모델을 먼저 선택해주세요
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* 색상 선택 */}
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" gutterBottom>
                🎨 색상 선택
              </Typography>
              {selectedModel && selectedCapacity ? (
                <Autocomplete
                  value={selectedColor}
                  onChange={(event, newValue) => {
                    setSelectedColor(newValue || '');
                    setNewModel(prev => ({ ...prev, color: newValue || '' }));
                  }}
                  options={availableModels.modelCapacityColors.get(selectedModel)?.get(selectedCapacity)?.sort() || []}
                  getOptionLabel={(option) => option || ''}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="색상"
                      placeholder="색상을 입력하거나 선택하세요"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">🎨</InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                        <span>{option}</span>
                        <Chip 
                          size="small" 
                          label="사전예약" 
                          color="success" 
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  )}
                  noOptionsText="사용 가능한 색상이 없습니다. 모델과 용량을 먼저 선택해주세요."
                  loading={!availableModels.modelCapacityColors.get(selectedModel)?.get(selectedCapacity)}
                  loadingText="색상 데이터 로딩 중..."
                  freeSolo
                  selectOnFocus
                  clearOnBlur
                  handleHomeEndKeys
                />
              ) : (
                <Box 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center" 
                  height="56px"
                  border="1px dashed #ccc"
                  borderRadius="4px"
                >
                  <Typography variant="body2" color="text.secondary">
                    {!selectedModel ? '모델을 먼저 선택해주세요' : '용량을 먼저 선택해주세요'}
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* 수량 입력 */}
            <Grid item xs={12}>
              <TextField
                label="수량"
                type="number"
                value={newModel.quantity}
                onChange={(e) => setNewModel(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start">📦</InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowModelDialog(false)}>취소</Button>
          <Button onClick={handleAddModel} variant="contained">추가</Button>
        </DialogActions>
      </Dialog>

      {/* 오류 다이얼로그 */}
      <Dialog open={showErrorDialog} onClose={() => setShowErrorDialog(false)}>
        <DialogTitle>오류 발생</DialogTitle>
        <DialogContent>
          <Typography>{errorDetails}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowErrorDialog(false)}>확인</Button>
        </DialogActions>
      </Dialog>

      {/* 공유 설정 다이얼로그 */}
      <Dialog open={showSharedSettingsDialog} onClose={() => setShowSharedSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>설정 공유</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            사전예약 배정 설정이 공유되었습니다.
          </Typography>
          
          <Button
            variant="contained"
            onClick={handleLoadSharedSettings}
            sx={{ mr: 1 }}
          >
            최신 설정 로드
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSharedSettingsDialog(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* 캐시 통계 다이얼로그 */}
      <Dialog open={showCacheStatsDialog} onClose={() => setShowCacheStatsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <InfoIcon color="primary" />
            캐시 통계
          </Box>
        </DialogTitle>
        <DialogContent>
          {cacheStats && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1">캐시 항목 수:</Typography>
                <Chip 
                  label={`${cacheStats.size} / ${cacheStats.maxSize}`} 
                  color={cacheStats.size > cacheStats.maxSize * 0.8 ? 'warning' : 'primary'}
                />
              </Box>
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body1">사용률:</Typography>
                <Typography variant="body1" color="primary">
                  {Math.round((cacheStats.size / cacheStats.maxSize) * 100)}%
                </Typography>
              </Box>
              
              <Divider />
              
              <Typography variant="subtitle2" gutterBottom>
                캐시된 데이터 타입:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {cacheStats.keys.map((key, index) => {
                  const type = key.split(':')[0];
                  return (
                    <Chip
                      key={index}
                      label={type}
                      size="small"
                      variant="outlined"
                      color="secondary"
                    />
                  );
                })}
              </Box>
              
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  캐시는 성능 향상을 위해 자주 사용되는 데이터를 메모리에 저장합니다.
                  캐시가 가득 차면 가장 오래된 항목이 자동으로 제거됩니다.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCacheStatsDialog(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  // 메모이제이션된 POS별 합산 계산
  const generatePOSSummary = useCallback((assignments, agents) => {
    const posMap = new Map();
    
    assignments.forEach(assignment => {
      const agent = agents.find(a => a.name === assignment.agent);
      if (agent && agent.store) {
        const key = `${agent.store}_${assignment.model}_${assignment.capacity}_${assignment.color}`;
        if (!posMap.has(key)) {
          posMap.set(key, {
            posName: agent.store,
            model: assignment.model,
            capacity: assignment.capacity,
            color: assignment.color,
            totalQuantity: 0,
            agentCount: 0,
            agents: new Set()
          });
        }
        
        const posData = posMap.get(key);
        posData.totalQuantity += assignment.quantity;
        posData.agents.add(assignment.agent);
        posData.agentCount = posData.agents.size;
      }
    });
    
    return Array.from(posMap.values()).sort((a, b) => a.posName.localeCompare(b.posName));
  }, []);

  // 메모이제이션된 담당자별 합산 계산
  const generateAgentSummary = useCallback((assignments, agents) => {
    const agentMap = new Map();
    
    assignments.forEach(assignment => {
      const agent = agents.find(a => a.name === assignment.agent);
      if (agent) {
        const key = `${assignment.agent}_${assignment.model}_${assignment.capacity}_${assignment.color}`;
        if (!agentMap.has(key)) {
          agentMap.set(key, {
            agentName: assignment.agent,
            posName: agent.store || '-',
            model: assignment.model,
            capacity: assignment.capacity,
            color: assignment.color,
            totalQuantity: 0
          });
        }
        
        agentMap.get(key).totalQuantity += assignment.quantity;
      }
    });
    
    return Array.from(agentMap.values()).sort((a, b) => a.agentName.localeCompare(b.agentName));
  }, []);

  // 메모이제이션된 소속별 합산 계산
  const generateDepartmentSummary = useCallback((assignments, agents) => {
    const deptMap = new Map();
    
    assignments.forEach(assignment => {
      const agent = agents.find(a => a.name === assignment.agent);
      if (agent && agent.department) {
        const key = `${agent.department}_${assignment.model}_${assignment.capacity}_${assignment.color}`;
        if (!deptMap.has(key)) {
          deptMap.set(key, {
            department: agent.department,
            model: assignment.model,
            capacity: assignment.capacity,
            color: assignment.color,
            totalQuantity: 0,
            agentCount: 0,
            agents: new Set()
          });
        }
        
        const deptData = deptMap.get(key);
        deptData.totalQuantity += assignment.quantity;
        deptData.agents.add(assignment.agent);
        deptData.agentCount = deptData.agents.size;
      }
    });
    
    return Array.from(deptMap.values()).sort((a, b) => a.department.localeCompare(b.department));
  }, []);

  // 메모이제이션된 사무실별 합산 계산
  const generateOfficeSummary = useCallback((assignments, agents) => {
    const officeMap = new Map();
    
    assignments.forEach(assignment => {
      const agent = agents.find(a => a.name === assignment.agent);
      if (agent && agent.office) {
        const key = `${agent.office}_${assignment.model}_${assignment.capacity}_${assignment.color}`;
        if (!officeMap.has(key)) {
          officeMap.set(key, {
            office: agent.office,
            model: assignment.model,
            capacity: assignment.capacity,
            color: assignment.color,
            totalQuantity: 0,
            agentCount: 0,
            agents: new Set()
          });
        }
        
        const officeData = officeMap.get(key);
        officeData.totalQuantity += assignment.quantity;
        officeData.agents.add(assignment.agent);
        officeData.agentCount = officeData.agents.size;
      }
    });
    
    return Array.from(officeMap.values()).sort((a, b) => a.office.localeCompare(b.office));
  }, []);
}

export default ReservationAssignmentSettingsScreen; 