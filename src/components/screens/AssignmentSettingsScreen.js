import React, { useState, useEffect, useMemo } from 'react';
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
  Slider,
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
  ListItemSecondaryAction
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
  Person as PersonIcon
} from '@mui/icons-material';
import { calculateFullAssignment, clearAssignmentCache, getSelectedTargets } from '../../utils/assignmentUtils';
import AssignmentVisualization from '../AssignmentVisualization';
import { extractAvailableModels, getColorsForModel, getModelInventorySummary } from '../../utils/modelUtils';
import { addAssignmentCompletedNotification, addSettingsChangedNotification } from '../../utils/notificationUtils';
import { saveAssignmentHistory, createHistoryItem } from '../../utils/assignmentHistory';

// API 기본 URL 설정
const API_BASE_URL = process.env.REACT_APP_API_URL;

// 환경변수 검증
if (!API_BASE_URL) {
  console.error('REACT_APP_API_URL 환경변수가 설정되지 않았습니다.');
}

function AssignmentSettingsScreen({ data, onBack, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [assignmentSettings, setAssignmentSettings] = useState({
    ratios: {
      turnoverRate: 30,    // 회전율 30%
      storeCount: 25,      // 거래처수 25%
      remainingInventory: 25, // 잔여재고 25%
      salesVolume: 20      // 판매량 20%
    },
    models: {},
    targets: {
      offices: {},
      departments: {},
      agents: {}
    }
  });
  
  const [editingAgent, setEditingAgent] = useState(null);
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [newModel, setNewModel] = useState({ name: '', color: '', quantity: 0, bulkQuantities: {} });
  const [availableModels, setAvailableModels] = useState({ models: [], colors: [], modelColors: new Map() });
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: 설정, 1: 미리보기, 2: 시각화
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [previewSubTab, setPreviewSubTab] = useState(0);
  const [showSharedSettingsDialog, setShowSharedSettingsDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // 담당자 데이터 및 사용 가능한 모델 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('AssignmentSettingsScreen: 데이터 로드 시작');
        
        // 담당자 데이터 로드
        console.log('담당자 데이터 로드 중...');
        let agentDataLoaded = false;
        
        try {
          const agentResponse = await fetch(`${API_BASE_URL}/api/agents`);
          console.log('담당자 API 응답 상태:', agentResponse.status);
          console.log('담당자 API 응답 헤더:', agentResponse.headers.get('content-type'));
          
          if (agentResponse.ok) {
            const contentType = agentResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const agentData = await agentResponse.json();
              console.log('담당자 데이터 로드 완료:', agentData.length, '명');
              console.log('담당자 데이터 샘플:', agentData.slice(0, 3));
              
              if (agentData && Array.isArray(agentData) && agentData.length > 0) {
                setAgents(agentData);
                agentDataLoaded = true;
                console.log('✅ 실제 담당자 데이터 로드 성공');
              } else {
                console.warn('담당자 데이터가 비어있거나 유효하지 않음');
              }
            } else {
              console.error('담당자 API가 JSON이 아닌 응답을 반환:', contentType);
              const responseText = await agentResponse.text();
              console.error('응답 내용:', responseText.substring(0, 200));
            }
          } else {
            console.error('담당자 API 응답 실패:', agentResponse.status, agentResponse.statusText);
            const responseText = await agentResponse.text();
            console.error('에러 응답 내용:', responseText.substring(0, 200));
          }
        } catch (agentError) {
          console.error('담당자 API 호출 실패:', agentError);
          console.error('네트워크 에러 상세:', agentError.message);
        }
        
        // 실제 데이터 로드에 실패한 경우에만 샘플 데이터 사용
        if (!agentDataLoaded) {
          console.warn('⚠️ 실제 담당자 데이터 로드 실패, 샘플 데이터 사용');
          const sampleAgents = [
            { target: '김영업', contactId: 'kim001', office: '서울지사', department: '영업1팀' },
            { target: '이매니저', contactId: 'lee002', office: '부산지사', department: '영업2팀' },
            { target: '박대리', contactId: 'park003', office: '대구지사', department: '영업3팀' }
          ];
          setAgents(sampleAgents);
        }

        // 매장 데이터에서 사용 가능한 모델 추출
        let storeData = null;
        let storeDataLoaded = false;
        
        if (data && Array.isArray(data)) {
          console.log('Props로 받은 매장 데이터:', data.length, '개');
          storeData = data;
          storeDataLoaded = true;
          console.log('✅ Props로 받은 매장 데이터 사용');
        } else {
          console.log('Props로 받은 데이터가 없거나 배열이 아님, API에서 가져오기 시도');
          // 데이터가 없으면 API에서 직접 가져오기
          try {
            const storeResponse = await fetch(`${API_BASE_URL}/api/stores`);
            console.log('매장 API 응답 상태:', storeResponse.status);
            console.log('매장 API 응답 헤더:', storeResponse.headers.get('content-type'));
            
            if (storeResponse.ok) {
              const contentType = storeResponse.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const responseData = await storeResponse.json();
                console.log('API에서 가져온 매장 데이터:', responseData.stores?.length || 0, '개');
                if (responseData.stores && Array.isArray(responseData.stores)) {
                  storeData = responseData.stores;
                  storeDataLoaded = true;
                  console.log('✅ API에서 매장 데이터 로드 성공');
                } else {
                  console.error('API 응답에 stores 배열이 없음:', responseData);
                }
              } else {
                console.error('매장 API가 JSON이 아닌 응답을 반환:', contentType);
                const responseText = await storeResponse.text();
                console.error('응답 내용:', responseText.substring(0, 200));
              }
            } else {
              console.error('매장 API 응답 실패:', storeResponse.status, storeResponse.statusText);
              const responseText = await storeResponse.text();
              console.error('에러 응답 내용:', responseText.substring(0, 200));
            }
          } catch (apiError) {
            console.error('API에서 데이터 가져오기 실패:', apiError);
            console.error('네트워크 에러 상세:', apiError.message);
          }
        }
        
        // 모델 추출
        if (storeData && Array.isArray(storeData)) {
          console.log('모델 추출 시작, 매장 수:', storeData.length);
          const models = extractAvailableModels(storeData);
          console.log('추출된 모델 결과:', models);
          console.log('사용 가능한 모델 수:', models.models.length);
          console.log('사용 가능한 색상 수:', models.colors.length);
          setAvailableModels(models);
          console.log('✅ 실제 모델 데이터 설정 완료');
        } else {
          console.warn('⚠️ 매장 데이터가 없어 모델 추출 불가, 샘플 모델 사용');
          // 샘플 모델 데이터 사용
          const sampleModels = {
            models: ['Galaxy S24', 'Galaxy A55', 'iPhone 15', 'iPhone 14'],
            colors: ['블랙', '화이트', '블루', '그린', '레드'],
            modelColors: new Map([
              ['Galaxy S24', ['블랙', '화이트', '블루']],
              ['Galaxy A55', ['블랙', '화이트', '그린']],
              ['iPhone 15', ['블랙', '화이트', '레드']],
              ['iPhone 14', ['블랙', '화이트', '블루']]
            ])
          };
          setAvailableModels(sampleModels);
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error);
        // 전체 에러 시에도 기본 데이터 설정
        setAgents([
          { target: '김영업', contactId: 'kim001', office: '서울지사', department: '영업1팀' },
          { target: '이매니저', contactId: 'lee002', office: '부산지사', department: '영업2팀' }
        ]);
        setAvailableModels({
          models: ['Galaxy S24', 'Galaxy A55'],
          colors: ['블랙', '화이트'],
          modelColors: new Map([
            ['Galaxy S24', ['블랙', '화이트']],
            ['Galaxy A55', ['블랙', '화이트']]
          ])
        });
      }
    };
    
    loadData();
  }, [data]);

  // 컴포넌트 마운트 시 저장된 설정 로드
  useEffect(() => {
    loadSettings();
  }, []);

  // 설정이 변경될 때마다 자동 저장
  useEffect(() => {
    // 초기 로드 시에는 저장하지 않음
    if (assignmentSettings.ratios.turnoverRate !== 25) {
      saveSettings();
    }
  }, [assignmentSettings, agents, selectedModel, selectedColor, newModel, activeTab]);

  // 설정 저장 (사용자별로 로컬 스토리지에 모든 설정 저장)
  const saveSettings = () => {
    // 현재 로그인한 사용자 ID 가져오기
    const loginState = JSON.parse(localStorage.getItem('loginState') || '{}');
    const currentUserId = loginState.inventoryUserName || 'unknown';
    
    // 모든 설정을 사용자별로 로컬 스토리지에 저장
    const settingsToSave = {
      assignmentSettings,
      agents,
      selectedModel,
      selectedColor,
      newModel,
      activeTab
    };
    
    localStorage.setItem(`assignmentSettingsData_${currentUserId}`, JSON.stringify(settingsToSave));
    

    
    // 현재 설정을 이전 설정으로 저장
    localStorage.setItem(`previousAssignmentSettings_${currentUserId}`, JSON.stringify(settingsToSave));
    
    console.log(`${currentUserId} 사용자의 설정이 로컬 스토리지에 저장되었습니다.`);
  };

  // 설정 로드 (사용자별로 로컬 스토리지에서 모든 설정 복원)
  const loadSettings = () => {
    try {
      // 현재 로그인한 사용자 ID 가져오기
      const loginState = JSON.parse(localStorage.getItem('loginState') || '{}');
      const currentUserId = loginState.inventoryUserName || 'unknown';
      
      const savedData = localStorage.getItem(`assignmentSettingsData_${currentUserId}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        if (parsedData.assignmentSettings) {
          setAssignmentSettings(parsedData.assignmentSettings);
        }
        if (parsedData.agents) {
          setAgents(parsedData.agents);
        }
        if (parsedData.selectedModel) {
          setSelectedModel(parsedData.selectedModel);
        }
        if (parsedData.selectedColor) {
          setSelectedColor(parsedData.selectedColor);
        }
        if (parsedData.newModel) {
          setNewModel(parsedData.newModel);
        }
        if (parsedData.activeTab !== undefined) {
          setActiveTab(parsedData.activeTab);
        }
        
        console.log(`${currentUserId} 사용자의 저장된 설정을 로컬 스토리지에서 복원했습니다.`);
      } else {
        // 사용자별 설정이 없으면 기본값 설정
        console.log(`${currentUserId} 사용자의 설정이 없어 기본값을 설정합니다.`);
        setDefaultSettings();
      }
    } catch (error) {
      console.error('설정 로드 중 오류:', error);
      setDefaultSettings();
    }
  };

  // 기본 설정 설정
  const setDefaultSettings = () => {
    const loginState = JSON.parse(localStorage.getItem('loginState') || '{}');
    const currentUserId = loginState.inventoryUserName || 'unknown';
    
    const defaultSettings = {
      assignmentSettings: {
        ratios: {
          turnoverRate: 30,
          storeCount: 25,
          remainingInventory: 25,
          salesVolume: 20
        },
        models: {},
        targets: {
          offices: {},
          departments: {},
          agents: {}
        }
      },
      agents: [],
      selectedModel: '',
      selectedColor: '',
      newModel: {
        name: '',
        color: '',
        quantity: 1
      },
      activeTab: 0
    };
    
    // 기본 설정을 사용자별로 저장
    localStorage.setItem(`assignmentSettingsData_${currentUserId}`, JSON.stringify(defaultSettings));
    localStorage.setItem(`previousAssignmentSettings_${currentUserId}`, JSON.stringify(defaultSettings));
    
    // 상태 업데이트
    setAssignmentSettings(defaultSettings.assignmentSettings);
    setSelectedModel(defaultSettings.selectedModel);
    setSelectedColor(defaultSettings.selectedColor);
    setNewModel(defaultSettings.newModel);
    setActiveTab(defaultSettings.activeTab);
  };

  // 모든 설정 초기화 (사용자별)
  const handleResetAllSettings = () => {
    const loginState = JSON.parse(localStorage.getItem('loginState') || '{}');
    const currentUserId = loginState.inventoryUserName || 'unknown';
    
    if (window.confirm('모든 배정 설정을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      // 사용자별 로컬 스토리지에서 설정 삭제
      localStorage.removeItem(`assignmentSettingsData_${currentUserId}`);
      localStorage.removeItem(`previousAssignmentSettings_${currentUserId}`);
      
      // 기본 설정으로 초기화
      setDefaultSettings();
      
      // 담당자 데이터는 컴포넌트 마운트 시 자동으로 로드되므로 별도 호출 불필요
      
      alert('모든 배정 설정이 초기화되었습니다.');
    }
  };

  // 담당자 데이터가 로드되면 배정 대상 초기화 (사무실과 소속이 있는 담당자만)
  useEffect(() => {
    if (agents.length > 0) {
      setAssignmentSettings(prev => {
        const newSettings = { ...prev };
        
        // 사무실과 소속이 모두 있는 담당자만 필터링
        const validAgents = agents.filter(agent => 
          agent.office && agent.office.trim() !== '' && 
          agent.department && agent.department.trim() !== ''
        );
        
        console.log(`전체 담당자: ${agents.length}명, 유효한 담당자: ${validAgents.length}명`);
        
        // 사무실별 배정 대상 초기화
        const offices = new Set();
        validAgents.forEach(agent => {
          if (agent.office) offices.add(agent.office);
        });
        
        offices.forEach(office => {
          if (!newSettings.targets.offices.hasOwnProperty(office)) {
            newSettings.targets.offices[office] = false; // 기본값: 선택되지 않음
          }
        });

        // 소속별 배정 대상 초기화
        const departments = new Set();
        validAgents.forEach(agent => {
          if (agent.department) departments.add(agent.department);
        });
        
        departments.forEach(department => {
          if (!newSettings.targets.departments.hasOwnProperty(department)) {
            newSettings.targets.departments[department] = false; // 기본값: 선택되지 않음
          }
        });

        // 영업사원별 배정 대상 초기화 (유효한 담당자만)
        validAgents.forEach(agent => {
          if (!newSettings.targets.agents.hasOwnProperty(agent.contactId)) {
            newSettings.targets.agents[agent.contactId] = false; // 기본값: 선택되지 않음
          }
        });

        return newSettings;
      });
    }
  }, [agents]);

  // 배정 미리보기
  const handlePreviewAssignment = async () => {
    console.log('배정 미리보기 시작');
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('agents:', agents.length);
    console.log('assignmentSettings:', assignmentSettings);
    
    setIsLoadingPreview(true);
    setProgress(0);
    setProgressMessage('배정 계산을 시작합니다...');
    
    try {
      // 진행률 업데이트
      setProgress(10);
      setProgressMessage('매장 데이터를 로드하는 중...');
      
      if (!API_BASE_URL) {
        throw new Error('API_BASE_URL이 설정되지 않았습니다.');
      }
      
      // 배정 대상 확인
      const { eligibleAgents } = getSelectedTargets(agents, assignmentSettings);
      console.log('선택된 배정 대상:', eligibleAgents.length, '명');
      console.log('선택된 대상 상세:', eligibleAgents);
      
      if (eligibleAgents.length === 0) {
        throw new Error('배정할 대상이 선택되지 않았습니다. 배정 설정에서 사무실, 소속, 또는 영업사원을 선택해주세요.');
      }
      
      // 모델 확인
      const modelCount = Object.keys(assignmentSettings.models).length;
      console.log('설정된 모델 수:', modelCount);
      
      if (modelCount === 0) {
        throw new Error('배정할 모델이 설정되지 않았습니다. 모델을 추가해주세요.');
      }
      
      // 매장 데이터 가져오기 (재고 정보용)
      console.log('매장 데이터 요청 중:', `${API_BASE_URL}/api/stores`);
      const storeResponse = await fetch(`${API_BASE_URL}/api/stores`);
      
      if (!storeResponse.ok) {
        throw new Error(`매장 데이터 요청 실패: ${storeResponse.status} ${storeResponse.statusText}`);
      }
      
      const storeData = await storeResponse.json();
      console.log('매장 데이터 로드 완료:', storeData.stores?.length || 0, '개 매장');
      
      setProgress(30);
      setProgressMessage('개통실적 데이터를 로드하는 중...');
      
      // 새로운 배정 로직으로 계산
      console.log('배정 계산 시작');
      const preview = await calculateFullAssignment(agents, assignmentSettings, storeData);
      console.log('배정 계산 완료:', preview);
      
      setProgress(90);
      setProgressMessage('결과를 정리하는 중...');
      
      setPreviewData(preview);
      
      // 미리보기에서는 알림을 전송하지 않음 (실제 배정 확정 시에만 전송)
      
      setProgress(100);
      setProgressMessage('배정 계산이 완료되었습니다!');
      
      // 1초 후 진행률 초기화
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
      }, 1000);
      
    } catch (error) {
      console.error('배정 미리보기 실패:', error);
      console.error('에러 상세:', error.message);
      setProgressMessage(`배정 계산 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 캐시 정리
  const handleClearCache = () => {
    clearAssignmentCache();
    setPreviewData(null);
  };

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyPress = (event) => {
      // 입력 필드나 다이얼로그가 활성화된 경우 단축키 비활성화
      const activeElement = document.activeElement;
      const isInputField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.contentEditable === 'true'
      );
      
      if (isInputField) {
        return;
      }
      
      // Ctrl/Cmd + S: 설정 저장
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveSettings();
      }
      
      // Ctrl/Cmd + P: 배정 미리보기
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
        event.preventDefault();
        if (!isLoadingPreview) {
          handlePreviewAssignment();
        }
      }
      
      // Ctrl/Cmd + R: 캐시 정리
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        handleClearCache();
      }
      
      // 숫자 키로 탭 전환 (입력 필드가 아닌 경우에만)
      if (event.key >= '1' && event.key <= '3') {
        const tabIndex = parseInt(event.key) - 1;
        setActiveTab(tabIndex);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isLoadingPreview]);

  // 담당자 정보 수정
  const handleAgentEdit = (agent) => {
    setEditingAgent({ ...agent });
  };

  const handleAgentSave = () => {
    if (editingAgent) {
      setAgents(prev => prev.map(agent => 
        agent.contactId === editingAgent.contactId ? editingAgent : agent
      ));
      setEditingAgent(null);
    }
  };

  const handleAgentCancel = () => {
    setEditingAgent(null);
  };

  // 비율 변경 (합계 100% 제한)
  const handleRatioChange = (type, value) => {
    setAssignmentSettings(prev => {
      // 현재 다른 항목들의 합계 계산
      const otherSum = Object.entries(prev.ratios)
        .filter(([key, _]) => key !== type)
        .reduce((sum, [_, ratioValue]) => sum + ratioValue, 0);
      
      // 최대 허용값 계산
      const maxAllowed = 100 - otherSum;
      
      // 합계가 100%를 초과하지 않는 경우에만 변경 허용
      const newValue = Math.min(value, maxAllowed);
      
      return {
        ...prev,
        ratios: {
          ...prev.ratios,
          [type]: newValue
        }
      };
    });
  };

  // 각 슬라이더의 최대값 계산
  const getSliderMaxValue = (type) => {
    const otherSum = Object.entries(assignmentSettings.ratios)
      .filter(([key, _]) => key !== type)
      .reduce((sum, [_, ratioValue]) => sum + ratioValue, 0);
    
    return 100 - otherSum;
  };

  // 각 슬라이더의 비활성화 상태 계산
  const getSliderDisabled = (type) => {
    const maxValue = getSliderMaxValue(type);
    return maxValue <= 0;
  };

  // 모델 추가 (일괄 입력)
  const handleAddModel = () => {
    const modelName = selectedModel || newModel.name;
    
    if (modelName && newModel.bulkQuantities && Object.keys(newModel.bulkQuantities || {}).length > 0) {
      // 일괄 입력된 수량이 있는 경우
      const validColors = Object.entries(newModel.bulkQuantities || {})
        .filter(([color, quantity]) => quantity > 0)
        .map(([color, quantity]) => ({ name: color, quantity }));
      
      if (validColors.length > 0) {
        setAssignmentSettings(prev => {
          const existingModel = prev.models[modelName];
          
          if (existingModel) {
            // 기존 모델이 있으면 색상과 수량을 병합
            const existingColors = [...existingModel.colors];
            
            validColors.forEach(newColor => {
              const existingColorIndex = existingColors.findIndex(color => color.name === newColor.name);
              
              if (existingColorIndex >= 0) {
                // 기존 색상이 있으면 수량 처리 (편집 모드: 교체, 추가 모드: 더하기)
                const currentQuantity = existingColors[existingColorIndex].quantity;
                const newQuantity = isEditMode ? newColor.quantity : currentQuantity + newColor.quantity;
                
                existingColors[existingColorIndex] = {
                  ...existingColors[existingColorIndex],
                  quantity: newQuantity
                };
              } else {
                // 새로운 색상 추가
                existingColors.push(newColor);
              }
            });
            
            return {
              ...prev,
              models: {
                ...prev.models,
                [modelName]: {
                  ...existingModel,
                  colors: existingColors
                }
              }
            };
          } else {
            // 새로운 모델 생성
            return {
              ...prev,
              models: {
                ...prev.models,
                [modelName]: {
                  colors: validColors
                }
              }
            };
          }
        });
        
        setNewModel({ name: '', color: '', quantity: 0, bulkQuantities: {} });
        setSelectedModel('');
        setSelectedColor('');
        setIsEditMode(false);
        setShowModelDialog(false);
      }
    } else if (modelName && selectedColor && newModel.quantity > 0) {
      // 기존 방식 (단일 색상 입력)
      const modelColor = selectedColor;
      
      setAssignmentSettings(prev => {
        const existingModel = prev.models[modelName];
        
        if (existingModel) {
          const existingColorIndex = existingModel.colors.findIndex(color => color.name === modelColor);
          
          if (existingColorIndex >= 0) {
            const updatedColors = [...existingModel.colors];
            const currentQuantity = updatedColors[existingColorIndex].quantity;
            const newQuantity = isEditMode ? newModel.quantity : currentQuantity + newModel.quantity;
            
            updatedColors[existingColorIndex] = {
              ...updatedColors[existingColorIndex],
              quantity: newQuantity
            };
            
            return {
              ...prev,
              models: {
                ...prev.models,
                [modelName]: {
                  ...existingModel,
                  colors: updatedColors
                }
              }
            };
          } else {
            return {
              ...prev,
              models: {
                ...prev.models,
                [modelName]: {
                  ...existingModel,
                  colors: [
                    ...existingModel.colors,
                    { name: modelColor, quantity: newModel.quantity }
                  ]
                }
              }
            };
          }
        } else {
          return {
            ...prev,
            models: {
              ...prev.models,
              [modelName]: {
                colors: [{ name: modelColor, quantity: newModel.quantity }]
              }
            }
          };
        }
      });
      
      setNewModel({ name: '', color: '', quantity: 0, bulkQuantities: {} });
      setSelectedModel('');
      setSelectedColor('');
      setIsEditMode(false);
      setShowModelDialog(false);
    }
  };

  // 일괄 수량 적용
  const handleBulkQuantityApply = (quantity) => {
    if (selectedModel && quantity > 0) {
      const colors = getColorsForModel(availableModels.modelColors, selectedModel);
      const bulkQuantities = {};
      
      colors.forEach(color => {
        bulkQuantities[color] = quantity;
      });
      
      setNewModel(prev => ({
        ...prev,
        bulkQuantities: bulkQuantities
      }));
    }
  };

  // 색상별 수량 변경
  const handleColorQuantityChange = (color, quantity) => {
    setNewModel(prev => ({
      ...prev,
      bulkQuantities: {
        ...(prev.bulkQuantities || {}),
        [color]: parseInt(quantity) || 0
      }
    }));
  };

  // 모델 삭제
  const handleDeleteModel = (modelName) => {
    setAssignmentSettings(prev => {
      const newModels = { ...prev.models };
      delete newModels[modelName];
      return { ...prev, models: newModels };
    });
  };

  // 초기화 (모든 체크박스 해제)
  const handleReset = (type) => {
    setAssignmentSettings(prev => {
      const newTargets = { ...prev.targets };
      Object.keys(newTargets[type]).forEach(key => {
        newTargets[type][key] = false;
      });
      return {
        ...prev,
        targets: newTargets
      };
    });
  };

  // 담당자 데이터 분석하여 계층 구조 생성
  const getHierarchicalStructure = useMemo(() => {
    const structure = {
      offices: {},
      departments: {},
      agents: {}
    };

    // 유효한 담당자만 필터링
    const validAgents = agents.filter(agent => 
      agent.office && agent.office.trim() !== '' && 
      agent.department && agent.department.trim() !== ''
    );

    validAgents.forEach(agent => {
      const office = agent.office.trim();
      const department = agent.department.trim();
      const agentId = agent.contactId;

      // 사무실별 구조
      if (!structure.offices[office]) {
        structure.offices[office] = {
          departments: new Set(),
          agents: new Set()
        };
      }
      structure.offices[office].departments.add(department);
      structure.offices[office].agents.add(agentId);

      // 소속별 구조
      if (!structure.departments[department]) {
        structure.departments[department] = {
          office: office,
          agents: new Set()
        };
      }
      structure.departments[department].agents.add(agentId);

      // 영업사원별 구조
      structure.agents[agentId] = {
        name: agent.target,
        office: office,
        department: department
      };
    });

    return structure;
  }, [agents]);

  // 계층적 배정 대상 변경
  const handleHierarchicalTargetChange = (type, target, checked) => {
    setAssignmentSettings(prev => {
      const newTargets = { ...prev.targets };
      
      if (type === 'offices') {
        // 사무실 선택/해제 시 해당 소속과 영업사원도 함께 처리
        newTargets.offices[target] = checked;
        
        if (getHierarchicalStructure.offices[target]) {
          const officeData = getHierarchicalStructure.offices[target];
          
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
        
        if (getHierarchicalStructure.departments[target]) {
          const deptData = getHierarchicalStructure.departments[target];
          
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
      }

      return {
        ...prev,
        targets: newTargets
      };
    });
  };

  // 계층적 전체 선택/해제
  const handleHierarchicalSelectAll = (type, checked) => {
    setAssignmentSettings(prev => {
      const newTargets = { ...prev.targets };
      
      if (type === 'offices') {
        // 사무실 전체 선택/해제
        Object.keys(newTargets.offices).forEach(office => {
          newTargets.offices[office] = checked;
          
          if (getHierarchicalStructure.offices[office]) {
            const officeData = getHierarchicalStructure.offices[office];
            
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
          
          if (getHierarchicalStructure.departments[dept]) {
            const deptData = getHierarchicalStructure.departments[dept];
            
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
      }

      return {
        ...prev,
        targets: newTargets
      };
    });
  };

  // 계층적 초기화
  const handleHierarchicalReset = (type) => {
    setAssignmentSettings(prev => {
      const newTargets = { ...prev.targets };
      
      if (type === 'offices') {
        // 사무실 전체 해제 시 모든 하위 항목도 해제
        Object.keys(newTargets.offices).forEach(office => {
          newTargets.offices[office] = false;
          
          if (getHierarchicalStructure.offices[office]) {
            const officeData = getHierarchicalStructure.offices[office];
            
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
          
          if (getHierarchicalStructure.departments[dept]) {
            const deptData = getHierarchicalStructure.departments[dept];
            
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
      }

      return {
        ...prev,
        targets: newTargets
      };
    });
  };

  // 배정 확정
  const handleConfirmAssignment = async () => {
    if (!previewData) {
      alert('배정 미리보기를 먼저 실행해주세요.');
      return;
    }

    // 현재 로그인한 사용자 정보 가져오기 (함수 시작 부분으로 이동)
    const loginState = JSON.parse(localStorage.getItem('loginState') || '{}');
    const currentUser = loginState.inventoryUserName || '재고관리자';

    try {
      // 실제 배정 데이터에서 대상자 정보 추출
      console.log('previewData 구조 확인:', previewData);
      console.log('previewData.agents 구조 확인:', previewData.agents);
      
      const targetOffices = Object.keys(previewData.offices || {});
      
      // agents 구조에 따라 department와 agentName 추출 방식 수정
      let targetDepartments = [];
      let targetAgents = [];
      
      if (previewData.agents) {
        Object.entries(previewData.agents).forEach(([contactId, agentData]) => {
          console.log(`담당자 정보 확인 - contactId: ${contactId}, agentData:`, agentData);
          
          // agentData가 객체인 경우 (모델별 데이터가 들어있음)
          if (typeof agentData === 'object' && agentData !== null) {
            // 각 모델별 데이터에서 담당자 정보 추출
            Object.entries(agentData).forEach(([modelName, modelData]) => {
              console.log(`모델 ${modelName} 데이터:`, modelData);
              
              if (typeof modelData === 'object' && modelData !== null) {
                const department = modelData.department || modelData.departmentName || modelData.소속 || modelData.부서;
                const agentName = modelData.agentName || modelData.name || modelData.target || modelData.담당자;
                
                console.log(`모델 ${modelName}에서 추출된 정보 - department: ${department}, agentName: ${agentName}`);
                
                if (department && !targetDepartments.includes(department)) {
                  targetDepartments.push(department);
                  console.log(`부서 추가: ${department}`);
                }
                if (agentName && !targetAgents.includes(agentName)) {
                  targetAgents.push(agentName);
                  console.log(`담당자 추가: ${agentName}`);
                }
              }
            });
          }
        });
      }
      
      // 만약 여전히 비어있다면, 다른 구조 시도
      if (targetDepartments.length === 0 && targetAgents.length === 0) {
        console.log('중첩 구조에서 추출 실패, 다른 구조 시도');
        
        // agents 배열이 있는지 확인
        if (Array.isArray(previewData.agents)) {
          previewData.agents.forEach(agent => {
            if (agent.department) {
              targetDepartments.push(agent.department);
              console.log(`배열에서 부서 추가: ${agent.department}`);
            }
            if (agent.agentName || agent.name || agent.target) {
              targetAgents.push(agent.agentName || agent.name || agent.target);
              console.log(`배열에서 담당자 추가: ${agent.agentName || agent.name || agent.target}`);
            }
          });
        }
      }
      
      // 중복 제거
      targetDepartments = [...new Set(targetDepartments)];
      targetAgents = [...new Set(targetAgents)];
      
      console.log('추출된 대상자 정보:', {
        targetOffices,
        targetDepartments,
        targetAgents
      });
      
      // 배정된 총 수량 계산
      const totalAssignedQuantity = Object.values(previewData.agents || {}).reduce((sum, agent) => {
        return sum + Object.values(agent).reduce((agentSum, model) => {
          return agentSum + (typeof model === 'object' && model.quantity ? model.quantity : 0);
        }, 0);
      }, 0);
      
      // 배정된 모델들 추출
      const assignedModels = Object.keys(previewData.models || {});

      // 배정 정보를 서버로 전송
      const assignmentData = {
        assigner: currentUser, // 현재 로그인한 사용자
        model: assignedModels.join(', '), // 실제 배정된 모든 모델
        color: '전체', // 또는 실제 배정된 색상들
        quantity: totalAssignedQuantity,
        target_office: targetOffices.join(', '),
        target_department: targetDepartments.join(', '),
        target_agent: targetAgents.join(', '),
        // 배정 대상자 목록 추가
        target_offices: targetOffices,
        target_departments: targetDepartments,
        target_agents: targetAgents
      };

      // 서버에 배정 완료 요청 전송
      const response = await fetch(`${API_BASE_URL}/api/assignment/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignmentData)
      });

      if (response.ok) {
        console.log('배정 완료 및 알림 전송 성공');
        console.log('배정 대상자:', {
          offices: targetOffices,
          departments: targetDepartments,
          agents: targetAgents
        });
      } else {
        console.error('배정 완료 요청 실패:', response.status);
      }
    } catch (error) {
      console.error('배정 완료 처리 중 오류:', error);
    }

    // 배정 히스토리 아이템 생성
    const historyItem = createHistoryItem(
      previewData, // 배정 결과 데이터
      assignmentSettings, // 배정 설정
      agents, // 담당자 목록
      {
        assigner: currentUser, // 배정자 정보 추가
        totalAgents: Object.keys(previewData.agents).length,
        totalModels: Object.keys(previewData.models).length,
        totalAssigned: Object.values(previewData.agents).reduce((sum, agent) => {
          return sum + Object.values(agent).reduce((agentSum, model) => agentSum + (model.quantity || 0), 0);
        }, 0),
        totalQuantity: Object.values(previewData.models).reduce((sum, model) => {
          return sum + model.colors.reduce((colorSum, color) => colorSum + (color.quantity || 0), 0);
        }, 0),
        screenType: 'assignment_settings'
      }
    );

    // 히스토리 저장
    const result = saveAssignmentHistory(historyItem);
    
    if (result) {
      alert('배정이 확정되어 히스토리에 저장되었습니다.\n관리자모드 접속자들에게 알림이 전송되었습니다.');
      
      // 설정 저장
      saveSettings();
      
    } else {
      alert('배정 확정에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 인쇄 기능
  const handlePrint = (type) => {
    const printWindow = window.open('', '_blank');
    
    let printContent = '';
    const currentDate = new Date().toLocaleDateString('ko-KR');
    const currentTime = new Date().toLocaleTimeString('ko-KR');
    
    // 공통 헤더
    const header = `
      <html>
        <head>
          <title>배정 현황 - ${type}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 10px auto; max-width: 1200px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .company-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            .company-logo { width: 80px; height: 80px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
            .company-details { text-align: right; }
            .company-name { font-size: 18px; font-weight: bold; color: #1976d2; margin-bottom: 5px; }
            .document-title { font-size: 24px; font-weight: bold; color: #333; margin: 20px 0; }
            .document-info { display: flex; justify-content: space-between; margin: 15px 0; font-size: 14px; color: #666; }
            .summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 8px; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 15px; }
            .signature-section { margin-top: 30px; display: flex; justify-content: space-between; }
            .signature-box { width: 200px; text-align: center; }
            .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 10px; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <div class="company-logo">
                <img src="/login.png" alt="VIP PLUS" style="width: 100%; height: 100%; object-fit: contain;">
              </div>
              <div class="company-details">
                <div class="company-name">(주)브이아이피플러스</div>
                <div>재고 배정 관리 시스템</div>
                <div>문서번호: ASG-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}</div>
              </div>
            </div>
            <div class="document-title">재고 배정 현황 보고서</div>
            <div class="document-info">
              <div>
                <strong>출력일시:</strong> ${currentDate} ${currentTime}
              </div>
              <div>
                <strong>문서유형:</strong> ${type === 'agent' ? '영업사원별' : type === 'office' ? '사무실별' : type === 'department' ? '소속별' : '모델별'} 배정 현황
              </div>
            </div>
            <div style="margin: 15px 0; padding: 10px; background-color: #e3f2fd; border-radius: 5px; font-size: 14px;">
              <strong>배정 비율 설정:</strong> 회전율 ${assignmentSettings.ratios.turnoverRate}% | 거래처수 ${assignmentSettings.ratios.storeCount}% | 잔여재고 ${assignmentSettings.ratios.remainingInventory}% | 판매량 ${assignmentSettings.ratios.salesVolume}%
            </div>
          </div>
    `;
    
    const footer = `
          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">담당자</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">검토자</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">승인자</div>
            </div>
          </div>
          <div class="footer">
            <p><strong>(주)브이아이피플러스</strong> | 재고 배정 관리 시스템</p>
            <p>※ 이 문서는 시스템에서 자동 생성되었으며, 배정 비율은 각 영업사원의 성과 지표를 종합적으로 고려하여 계산됩니다.</p>
            <p>※ 본 문서는 회사 내부 업무용으로만 사용되며, 외부 유출을 금지합니다.</p>
          </div>
        </body>
      </html>
    `;
    
    if (type === 'summary') {
      // 모델별 배정 현황 인쇄
      printContent = header + `
        <div class="summary">
          <h2>모델별 배정 현황</h2>
          <table>
            <thead>
              <tr>
                <th>모델명</th>
                <th>전체 수량</th>
                <th>배정 수량</th>
                <th>배정률</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(previewData.models).map(model => `
                <tr>
                  <td>${model.name}</td>
                  <td>${model.totalQuantity}개</td>
                  <td>${model.assignedQuantity}개</td>
                  <td>${model.totalQuantity > 0 ? Math.round((model.assignedQuantity / model.totalQuantity) * 100) : 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` + footer;
    } else if (type === 'office') {
      // 사무실별 배정 현황 인쇄
      printContent = header + `
        <div class="summary">
          <h2>사무실별 배정 현황</h2>
          <table>
            <thead>
              <tr>
                <th>모델/색상</th>
                <th>총 배정량</th>
                <th>평균 배정량</th>
                ${Object.entries(previewData.offices)
                  .sort(([officeNameA, a], [officeNameB, b]) => officeNameA.localeCompare(officeNameB))
                  .map(([officeName, officeData]) => `<th>${officeName}<br/><small>${officeData.agentCount}명</small></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.entries(previewData.models).map(([modelName, modelData]) => 
                modelData.colors.map((color, colorIndex) => {
                  // 해당 모델/색상의 총 배정량 계산
                  const totalQuantity = Object.values(previewData.agents).reduce((sum, agentData) => {
                    const modelAssignment = agentData[modelName];
                    if (modelAssignment && modelAssignment.colorQuantities) {
                      return sum + (modelAssignment.colorQuantities[color.name] || 0);
                    }
                    return sum;
                  }, 0);
                  
                  // 해당 모델/색상의 평균 배정량 계산
                  const avgQuantity = totalQuantity / Object.keys(previewData.offices).length;
                  
                  return `
                    <tr>
                      <td><strong>${modelName}</strong><br/><span style="color: ${colorIndex % 2 === 0 ? '#1976d2' : '#d32f2f'}; font-weight: bold;">${color.name}</span></td>
                      <td><strong>${totalQuantity}개</strong></td>
                      <td>${Math.round(avgQuantity)}개</td>
                      ${Object.entries(previewData.offices)
                        .sort(([officeNameA, a], [officeNameB, b]) => officeNameA.localeCompare(officeNameB))
                        .map(([officeName, officeData]) => {
                          // 해당 사무실의 모델/색상별 배정량 계산
                          let officeQuantity = 0;
                          
                          officeData.agents.forEach(agent => {
                            const agentAssignments = previewData.agents[agent.contactId];
                            if (agentAssignments && agentAssignments[modelName] && agentAssignments[modelName].colorQuantities) {
                              officeQuantity += agentAssignments[modelName].colorQuantities[color.name] || 0;
                            }
                          });
                          
                          return `<td style="background-color: ${colorIndex % 2 === 0 ? '#f5f5f5' : '#fafafa'}; font-weight: ${officeQuantity > 0 ? 'bold' : 'normal'}; color: ${officeQuantity > 0 ? '#1976d2' : '#666'};">
                            ${officeQuantity > 0 ? officeQuantity + '개' : '-'}
                          </td>`;
                        }).join('')}
                    </tr>
                  `;
                }).join('')
              ).join('')}
            </tbody>
          </table>
        </div>
      ` + footer;
    } else if (type === 'agent') {
      // 영업사원별 배정 현황 인쇄
      printContent = header + `
        <div class="summary">
          <h2>영업사원별 배정 현황 (전체 ${Object.keys(previewData.agents).length}명)</h2>
          <table>
            <thead>
              <tr>
                <th>모델/색상</th>
                <th>총 배정량</th>
                <th>평균 배정점수</th>
                ${Object.entries(previewData.agents)
                  .sort(([agentIdA, a], [agentIdB, b]) => {
                    const agentA = agents.find(agent => agent.contactId === agentIdA);
                    const agentB = agents.find(agent => agent.contactId === agentIdB);
                    
                    const officeCompare = (agentA?.office || '').localeCompare(agentB?.office || '');
                    if (officeCompare !== 0) return officeCompare;
                    
                    const deptCompare = (agentA?.department || '').localeCompare(agentB?.department || '');
                    if (deptCompare !== 0) return deptCompare;
                    
                    return (agentA?.target || '').localeCompare(agentB?.target || '');
                  })
                  .map(([agentId, agentData]) => {
                    const agent = agents.find(a => a.contactId === agentId);
                    return `<th>${agent?.office || '미지정'}<br/>${agent?.department || '미지정'}<br/><strong>${agent?.target || agentId}</strong></th>`;
                  }).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.entries(previewData.models).map(([modelName, modelData]) => 
                modelData.colors.map((color, colorIndex) => {
                  // 해당 모델/색상의 총 배정량 계산
                  const totalQuantity = Object.values(previewData.agents).reduce((sum, agentData) => {
                    const modelAssignment = agentData[modelName];
                    if (modelAssignment && modelAssignment.colorQuantities) {
                      return sum + (modelAssignment.colorQuantities[color.name] || 0);
                    }
                    return sum;
                  }, 0);
                  
                  // 해당 모델/색상의 평균 점수 계산
                  const scores = Object.values(previewData.agents).map(agentData => {
                    const modelAssignment = agentData[modelName];
                    if (modelAssignment && modelAssignment.colorScores && modelAssignment.colorScores[color.name]) {
                      return modelAssignment.colorScores[color.name].averageScore || 0;
                    }
                    return 0;
                  }).filter(score => score > 0);
                  
                  const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
                  
                  return `
                    <tr>
                      <td><strong>${modelName}</strong><br/><span style="color: ${colorIndex % 2 === 0 ? '#1976d2' : '#d32f2f'}; font-weight: bold;">${color.name}</span></td>
                      <td><strong>${totalQuantity}개</strong></td>
                      <td>${Math.round(avgScore)}점</td>
                      ${Object.entries(previewData.agents)
                        .sort(([agentIdA, a], [agentIdB, b]) => {
                          const agentA = agents.find(agent => agent.contactId === agentIdA);
                          const agentB = agents.find(agent => agent.contactId === agentIdB);
                          
                          const officeCompare = (agentA?.office || '').localeCompare(agentB?.office || '');
                          if (officeCompare !== 0) return officeCompare;
                          
                          const deptCompare = (agentA?.department || '').localeCompare(agentB?.department || '');
                          if (deptCompare !== 0) return deptCompare;
                          
                          return (agentA?.target || '').localeCompare(agentB?.target || '');
                        })
                        .map(([agentId, agentData]) => {
                          const modelAssignment = agentData[modelName];
                          let assignedQuantity = 0;
                          
                          if (modelAssignment && modelAssignment.colorQuantities) {
                            assignedQuantity = modelAssignment.colorQuantities[color.name] || 0;
                          }
                          
                          return `<td style="background-color: ${colorIndex % 2 === 0 ? '#f5f5f5' : '#fafafa'}; font-weight: ${assignedQuantity > 0 ? 'bold' : 'normal'}; color: ${assignedQuantity > 0 ? '#1976d2' : '#666'};">
                            ${assignedQuantity > 0 ? assignedQuantity + '개' : '-'}
                          </td>`;
                        }).join('')}
                    </tr>
                  `;
                }).join('')
              ).join('')}
            </tbody>
          </table>
        </div>
      ` + footer;
    } else if (type === 'department') {
      // 소속별 배정 현황 인쇄
      printContent = header + `
        <div class="summary">
          <h2>소속별 배정 현황</h2>
          <table>
            <thead>
              <tr>
                <th>모델/색상</th>
                <th>총 배정량</th>
                <th>평균 배정량</th>
                ${Object.entries(previewData.departments)
                  .sort(([deptNameA, a], [deptNameB, b]) => deptNameA.localeCompare(deptNameB))
                  .map(([deptName, deptData]) => `<th>${deptName || '미지정'}<br/><small>${deptData.agentCount}명</small></th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.entries(previewData.models).map(([modelName, modelData]) => 
                modelData.colors.map((color, colorIndex) => {
                  // 해당 모델/색상의 총 배정량 계산
                  const totalQuantity = Object.values(previewData.agents).reduce((sum, agentData) => {
                    const modelAssignment = agentData[modelName];
                    if (modelAssignment && modelAssignment.colorQuantities) {
                      return sum + (modelAssignment.colorQuantities[color.name] || 0);
                    }
                    return sum;
                  }, 0);
                  
                  // 해당 모델/색상의 평균 배정량 계산
                  const avgQuantity = totalQuantity / Object.keys(previewData.departments).length;
                  
                  return `
                    <tr>
                      <td><strong>${modelName}</strong><br/><span style="color: ${colorIndex % 2 === 0 ? '#1976d2' : '#d32f2f'}; font-weight: bold;">${color.name}</span></td>
                      <td><strong>${totalQuantity}개</strong></td>
                      <td>${Math.round(avgQuantity)}개</td>
                      ${Object.entries(previewData.departments)
                        .sort(([deptNameA, a], [deptNameB, b]) => deptNameA.localeCompare(deptNameB))
                        .map(([deptName, deptData]) => {
                          // 해당 소속의 모델/색상별 배정량 계산
                          let deptQuantity = 0;
                          
                          deptData.agents.forEach(agent => {
                            const agentAssignments = previewData.agents[agent.contactId];
                            if (agentAssignments && agentAssignments[modelName] && agentAssignments[modelName].colorQuantities) {
                              deptQuantity += agentAssignments[modelName].colorQuantities[color.name] || 0;
                            }
                          });
                          
                          return `<td style="background-color: ${colorIndex % 2 === 0 ? '#f5f5f5' : '#fafafa'}; font-weight: ${deptQuantity > 0 ? 'bold' : 'normal'}; color: ${deptQuantity > 0 ? '#1976d2' : '#666'};">
                            ${deptQuantity > 0 ? deptQuantity + '개' : '-'}
                          </td>`;
                        }).join('')}
                    </tr>
                  `;
                }).join('')
              ).join('')}
            </tbody>
          </table>
        </div>
      ` + footer;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // 인쇄 다이얼로그 표시
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // 사용자별 설정 공유 기능
  const handleShareSettings = () => {
    const loginState = JSON.parse(localStorage.getItem('loginState') || '{}');
    const currentUserId = loginState.inventoryUserName || 'unknown';
    const currentSettings = assignmentSettings;
    
    // 공유할 설정 정보 생성
    const shareData = {
      sharedBy: currentUserId,
      timestamp: new Date().toISOString(),
      ratios: currentSettings.ratios,
      modelCount: Object.keys(currentSettings.models).length,
      targetCount: {
        offices: Object.keys(currentSettings.targets.offices).filter(key => currentSettings.targets.offices[key]).length,
        departments: Object.keys(currentSettings.targets.departments).filter(key => currentSettings.targets.departments[key]).length,
        agents: Object.keys(currentSettings.targets.agents).filter(key => currentSettings.targets.agents[key]).length
      }
    };
    
    // 공유 설정을 로컬 스토리지에 저장 (다른 사용자들이 볼 수 있도록)
    const sharedSettings = JSON.parse(localStorage.getItem('sharedAssignmentSettings') || '[]');
    sharedSettings.unshift(shareData);
    
    // 최대 10개까지만 유지
    if (sharedSettings.length > 10) {
      sharedSettings.splice(10);
    }
    
    localStorage.setItem('sharedAssignmentSettings', JSON.stringify(sharedSettings));
    
    // 공유 알림 추가
    addSettingsChangedNotification({
      ratios: currentSettings.ratios,
      sharedBy: currentUserId,
      isShared: true,
      modelCount: shareData.modelCount,
      targetCount: shareData.targetCount
    });
    
    alert('배정 비율 설정이 공유되었습니다. 다른 사용자들이 알림센터에서 확인할 수 있습니다.');
  };

  // 공유된 설정 불러오기
  const handleLoadSharedSettings = () => {
    const sharedSettings = JSON.parse(localStorage.getItem('sharedAssignmentSettings') || '[]');
    
    if (sharedSettings.length === 0) {
      alert('공유된 설정이 없습니다.');
      return;
    }
    
    // 공유 설정 목록 다이얼로그 열기
    setShowSharedSettingsDialog(true);
  };

  // 공유 설정 삭제
  const handleDeleteSharedSetting = (index) => {
    const loginState = JSON.parse(localStorage.getItem('loginState') || '{}');
    const currentUserId = loginState.inventoryUserName || 'unknown';
    
    const sharedSettings = JSON.parse(localStorage.getItem('sharedAssignmentSettings') || '[]');
    const settingToDelete = sharedSettings[index];
    
    // 본인이 공유한 설정인지 확인
    if (settingToDelete.sharedBy !== currentUserId) {
      alert('본인이 공유한 설정만 삭제할 수 있습니다.');
      return;
    }
    
    if (window.confirm('이 공유 설정을 삭제하시겠습니까?')) {
      // 해당 설정 삭제
      sharedSettings.splice(index, 1);
      localStorage.setItem('sharedAssignmentSettings', JSON.stringify(sharedSettings));
      
      alert('공유 설정이 삭제되었습니다.');
      // 다이얼로그를 닫았다가 다시 열어서 목록 갱신
      setShowSharedSettingsDialog(false);
      setTimeout(() => setShowSharedSettingsDialog(true), 100);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <SettingsIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            배정셋팅
          </Typography>
          <Button 
            color="inherit" 
            onClick={handleResetAllSettings}
            sx={{ mr: 2 }}
            title="모든 배정 설정 초기화"
          >
            설정 초기화
          </Button>
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          py: 1,
          // 모바일에서 탭 버튼 크기 조정
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Button
            variant={activeTab === 0 ? 'contained' : 'text'}
            onClick={() => setActiveTab(0)}
            startIcon={<SettingsIcon />}
            sx={{ mx: 1 }}
            title="키보드 단축키: 1"
          >
            설정
          </Button>
          <Button
            variant={activeTab === 1 ? 'contained' : 'text'}
            onClick={() => setActiveTab(1)}
            startIcon={<PreviewIcon />}
            sx={{ mx: 1 }}
            title="키보드 단축키: 2"
          >
            배정확정으로가기
          </Button>
          <Button
            variant={activeTab === 2 ? 'contained' : 'text'}
            onClick={() => setActiveTab(2)}
            startIcon={<BarChartIcon />}
            sx={{ mx: 1 }}
            title="키보드 단축키: 3"
          >
            시각화
          </Button>
          
          {/* 키보드 단축키 안내 */}
          <Box sx={{ 
            ml: { sm: 3 }, 
            mt: { xs: 1, sm: 0 },
            display: 'flex', 
            alignItems: 'center', 
            gap: 1 
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              단축키: Ctrl+S(저장) | Ctrl+P(배정준비) | Ctrl+R(캐시정리) | 1,2,3(탭전환)
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 콘텐츠 */}
      <Box sx={{ 
        flex: 1, 
        p: 3, 
        overflow: 'auto',
        // 모바일에서 하단 메뉴와 겹치지 않도록 여백 추가
        pb: { xs: 8, sm: 3 }
      }}>
        {activeTab === 0 && (
          <Grid container spacing={3}>
          
          {/* 담당자 관리 */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    담당자 관리
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Chip 
                      label={`전체: ${agents.length}명`} 
                      color="default" 
                      variant="outlined" 
                      size="small"
                    />
                    <Chip 
                      label={`유효: ${agents.filter(agent => agent.office && agent.office.trim() !== '' && agent.department && agent.department.trim() !== '').length}명`} 
                      color="primary" 
                      variant="outlined" 
                      size="small"
                    />
                  </Box>
                </Box>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>담당자</TableCell>
                        <TableCell>사무실</TableCell>
                        <TableCell>소속</TableCell>
                        <TableCell>작업</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const validAgents = agents.filter(agent => 
                          agent.office && agent.office.trim() !== '' && 
                          agent.department && agent.department.trim() !== ''
                        );
                        console.log('담당자 테이블 렌더링:', {
                          total: agents.length,
                          valid: validAgents.length,
                          agents: agents.slice(0, 3),
                          validAgents: validAgents.slice(0, 3)
                        });
                        return validAgents.map((agent) => (
                          <TableRow key={agent.contactId}>
                            <TableCell>{agent.target}</TableCell>
                            <TableCell>
                              {editingAgent?.contactId === agent.contactId ? (
                                <TextField
                                  size="small"
                                  value={editingAgent.office}
                                  onChange={(e) => setEditingAgent(prev => ({
                                    ...prev,
                                    office: e.target.value
                                  }))}
                                />
                              ) : (
                                agent.office || '미지정'
                              )}
                            </TableCell>
                            <TableCell>
                              {editingAgent?.contactId === agent.contactId ? (
                                <TextField
                                  size="small"
                                  value={editingAgent.department}
                                  onChange={(e) => setEditingAgent(prev => ({
                                    ...prev,
                                    department: e.target.value
                                  }))}
                                />
                              ) : (
                                agent.department || '미지정'
                              )}
                            </TableCell>
                            <TableCell>
                              {editingAgent?.contactId === agent.contactId ? (
                                <>
                                  <IconButton size="small" onClick={handleAgentSave}>
                                    <SaveIcon />
                                  </IconButton>
                                  <IconButton size="small" onClick={handleAgentCancel}>
                                    <CancelIcon />
                                  </IconButton>
                                </>
                              ) : (
                                <IconButton size="small" onClick={() => handleAgentEdit(agent)}>
                                  <EditIcon />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* 배정 비율 설정 */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  배정 비율 설정
                </Typography>
                <Box sx={{ p: 2 }}>
                  {/* 현재 합계 표시 */}
                  <Box sx={{ mb: 2, p: 1, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary" align="center">
                      현재 합계: <strong>{Object.values(assignmentSettings.ratios).reduce((sum, ratio) => sum + ratio, 0)}%</strong>
                      {Object.values(assignmentSettings.ratios).reduce((sum, ratio) => sum + ratio, 0) === 100 && (
                        <span style={{ color: 'green', marginLeft: 8 }}>✓ 완료</span>
                      )}
                    </Typography>
                  </Box>

                  <Typography gutterBottom>
                    회전율: {assignmentSettings.ratios.turnoverRate}%
                    {getSliderDisabled('turnoverRate') && <span style={{ color: 'red', marginLeft: 8 }}>(최대)</span>}
                  </Typography>
                  <Slider
                    value={assignmentSettings.ratios.turnoverRate}
                    onChange={(e, value) => handleRatioChange('turnoverRate', value)}
                    min={0}
                    max={getSliderMaxValue('turnoverRate')}
                    disabled={getSliderDisabled('turnoverRate')}
                    valueLabelDisplay="auto"
                    sx={{ 
                      mb: 3,
                      '& .MuiSlider-track': { 
                        backgroundColor: getSliderDisabled('turnoverRate') ? 'grey' : 'primary.main' 
                      },
                      '& .MuiSlider-thumb': { 
                        backgroundColor: getSliderDisabled('turnoverRate') ? 'grey' : 'primary.main' 
                      }
                    }}
                  />
                  
                  <Typography gutterBottom>
                    거래처수: {assignmentSettings.ratios.storeCount}%
                    {getSliderDisabled('storeCount') && <span style={{ color: 'red', marginLeft: 8 }}>(최대)</span>}
                  </Typography>
                  <Slider
                    value={assignmentSettings.ratios.storeCount}
                    onChange={(e, value) => handleRatioChange('storeCount', value)}
                    min={0}
                    max={getSliderMaxValue('storeCount')}
                    disabled={getSliderDisabled('storeCount')}
                    valueLabelDisplay="auto"
                    sx={{ 
                      mb: 3,
                      '& .MuiSlider-track': { 
                        backgroundColor: getSliderDisabled('storeCount') ? 'grey' : 'secondary.main' 
                      },
                      '& .MuiSlider-thumb': { 
                        backgroundColor: getSliderDisabled('storeCount') ? 'grey' : 'secondary.main' 
                      }
                    }}
                  />
                  
                  <Typography gutterBottom>
                    잔여재고: {assignmentSettings.ratios.remainingInventory}%
                    {getSliderDisabled('remainingInventory') && <span style={{ color: 'red', marginLeft: 8 }}>(최대)</span>}
                  </Typography>
                  <Slider
                    value={assignmentSettings.ratios.remainingInventory}
                    onChange={(e, value) => handleRatioChange('remainingInventory', value)}
                    min={0}
                    max={getSliderMaxValue('remainingInventory')}
                    disabled={getSliderDisabled('remainingInventory')}
                    valueLabelDisplay="auto"
                    sx={{ 
                      mb: 3,
                      '& .MuiSlider-track': { 
                        backgroundColor: getSliderDisabled('remainingInventory') ? 'grey' : 'warning.main' 
                      },
                      '& .MuiSlider-thumb': { 
                        backgroundColor: getSliderDisabled('remainingInventory') ? 'grey' : 'warning.main' 
                      }
                    }}
                  />
                  
                  <Typography gutterBottom>
                    판매량: {assignmentSettings.ratios.salesVolume}%
                    {getSliderDisabled('salesVolume') && <span style={{ color: 'red', marginLeft: 8 }}>(최대)</span>}
                  </Typography>
                  <Slider
                    value={assignmentSettings.ratios.salesVolume}
                    onChange={(e, value) => handleRatioChange('salesVolume', value)}
                    min={0}
                    max={getSliderMaxValue('salesVolume')}
                    disabled={getSliderDisabled('salesVolume')}
                    valueLabelDisplay="auto"
                    sx={{ 
                      mb: 3,
                      '& .MuiSlider-track': { 
                        backgroundColor: getSliderDisabled('salesVolume') ? 'grey' : 'info.main' 
                      },
                      '& .MuiSlider-thumb': { 
                        backgroundColor: getSliderDisabled('salesVolume') ? 'grey' : 'info.main' 
                      }
                    }}
                  />
                  
                  {/* 설정 공유 버튼들 */}
                  <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleShareSettings}
                      startIcon={<ShareIcon />}
                      sx={{ borderRadius: 1 }}
                    >
                      설정 공유
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleLoadSharedSettings}
                      startIcon={<DownloadIcon />}
                      sx={{ borderRadius: 1 }}
                    >
                      공유 설정 불러오기
                    </Button>
                  </Box>
                  
                  {/* 진행률 표시 */}
                  {isLoadingPreview && (
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {progressMessage}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {progress}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={progress} 
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={saveSettings}
                      startIcon={<SaveIcon />}
                      sx={{ flex: 1 }}
                    >
                      설정 저장
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handlePreviewAssignment}
                      startIcon={isLoadingPreview ? <CircularProgress size={16} /> : <PreviewIcon />}
                      disabled={isLoadingPreview}
                      sx={{ flex: 1 }}
                    >
                      {isLoadingPreview ? '계산중...' : '배정 준비하기'}
                    </Button>
                  </Box>

                  {/* 캐시 관리 */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <Button
                      variant="text"
                      onClick={handleClearCache}
                      startIcon={<RefreshIcon />}
                      size="small"
                      sx={{ flex: 1 }}
                    >
                      캐시 정리
                    </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* 배정 대상 선택 */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    배정 대상 선택
                  </Typography>
                  <Chip 
                    label="계층적 선택" 
                    color="info" 
                    variant="outlined" 
                    size="small"
                    icon={<InfoIcon />}
                  />
                </Box>
                
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    <strong>계층적 선택:</strong> 사무실 선택 시 해당 소속과 영업사원이 자동 선택됩니다. 
                    소속 선택 시 해당 영업사원이 자동 선택됩니다.
                  </Typography>
                </Alert>
                
                <Grid container spacing={3}>
                  {/* 사무실별 배정 대상 */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          사무실별 배정
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleHierarchicalReset('offices')}
                          >
                            초기화
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleHierarchicalSelectAll('offices', true)}
                          >
                            전체선택
                          </Button>
                        </Box>
                      </Box>
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {Object.entries(assignmentSettings.targets.offices).map(([office, checked]) => {
                          const officeData = getHierarchicalStructure.offices[office];
                          const deptCount = officeData ? officeData.departments.size : 0;
                          const agentCount = officeData ? officeData.agents.size : 0;
                          
                          return (
                            <Box key={office} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Checkbox
                                checked={checked}
                                onChange={(e) => handleHierarchicalTargetChange('offices', office, e.target.checked)}
                                icon={<CheckBoxOutlineBlankIcon />}
                                checkedIcon={<CheckBoxIcon />}
                                size="small"
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2">
                                  {office}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  소속 {deptCount}개, 영업사원 {agentCount}명
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>
                  </Grid>

                  {/* 소속별 배정 대상 */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          소속별 배정
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleHierarchicalReset('departments')}
                          >
                            초기화
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleHierarchicalSelectAll('departments', true)}
                          >
                            전체선택
                          </Button>
                        </Box>
                      </Box>
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {Object.entries(assignmentSettings.targets.departments).map(([department, checked]) => {
                          const deptData = getHierarchicalStructure.departments[department];
                          const agentCount = deptData ? deptData.agents.size : 0;
                          const office = deptData ? deptData.office : '';
                          
                          return (
                            <Box key={department} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Checkbox
                                checked={checked}
                                onChange={(e) => handleHierarchicalTargetChange('departments', department, e.target.checked)}
                                icon={<CheckBoxOutlineBlankIcon />}
                                checkedIcon={<CheckBoxIcon />}
                                size="small"
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2">
                                  {department}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {office} • 영업사원 {agentCount}명
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>
                  </Grid>

                  {/* 영업사원별 배정 대상 */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          영업사원별 배정
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleHierarchicalReset('agents')}
                          >
                            초기화
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleHierarchicalSelectAll('agents', true)}
                          >
                            전체선택
                          </Button>
                        </Box>
                      </Box>
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {Object.entries(assignmentSettings.targets.agents).map(([agentId, checked]) => {
                          const agent = agents.find(a => a.contactId === agentId);
                          const agentData = getHierarchicalStructure.agents[agentId];
                          
                          return (
                            <Box key={agentId} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Checkbox
                                checked={checked}
                                onChange={(e) => handleHierarchicalTargetChange('agents', agentId, e.target.checked)}
                                icon={<CheckBoxOutlineBlankIcon />}
                                checkedIcon={<CheckBoxIcon />}
                                size="small"
                              />
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2">
                                  {agent ? agent.target : agentId}
                                </Typography>
                                {agentData && (
                                  <Typography variant="caption" color="text.secondary">
                                    {agentData.office} • {agentData.department}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* 모델 관리 */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  mb: 2,
                  // 모바일에서 버튼 크기 조정
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: { xs: 1, sm: 0 }
                }}>
                  <Typography variant="h6">
                    모델 관리
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setIsEditMode(false);
                      setSelectedModel('');
                      setNewModel({ name: '', color: '', quantity: 0, bulkQuantities: {} });
                      setShowModelDialog(true);
                    }}
                    size="small"
                    sx={{ 
                      minWidth: { xs: '100%', sm: 'auto' },
                      fontSize: { xs: '0.8rem', sm: '0.875rem' }
                    }}
                  >
                    모델 추가
                  </Button>
                </Box>
                
                <Grid container spacing={2}>
                  {Object.entries(assignmentSettings.models).map(([modelName, modelData]) => (
                    <Grid item xs={12} sm={6} md={4} key={modelName}>
                      <Paper 
                        sx={{ 
                          p: 2, 
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                            boxShadow: 2
                          }
                        }}
                        onClick={() => {
                          setSelectedModel(modelName);
                          setIsEditMode(true);
                          setNewModel(prev => ({
                            ...prev,
                            name: modelName,
                            bulkQuantities: {}
                          }));
                          // 기존 색상 데이터를 bulkQuantities로 변환
                          const bulkQuantities = {};
                          modelData.colors.forEach(color => {
                            bulkQuantities[color.name] = color.quantity;
                          });
                          setNewModel(prev => ({
                            ...prev,
                            bulkQuantities
                          }));
                          setShowModelDialog(true);
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {modelName}
                          </Typography>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModel(modelName);
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            색상별 수량:
                          </Typography>
                          <Box sx={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '6px',
                            padding: '10px',
                            backgroundColor: '#e3f2fd',
                            borderRadius: '6px',
                            border: '1px solid #bbdefb'
                          }}>
                            {modelData.colors.map((color, index) => (
                              <Box
                                key={index}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#fff',
                                  border: '1px solid #e0e0e0',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Box
                                    sx={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      backgroundColor: color.name.toLowerCase().includes('블랙') ? '#000' :
                                                     color.name.toLowerCase().includes('화이트') ? '#fff' :
                                                     color.name.toLowerCase().includes('실버') ? '#c0c0c0' :
                                                     color.name.toLowerCase().includes('블루') ? '#0066cc' :
                                                     color.name.toLowerCase().includes('골드') ? '#ffd700' :
                                                     color.name.toLowerCase().includes('핑크') ? '#ff69b4' :
                                                     color.name.toLowerCase().includes('그린') ? '#228b22' :
                                                     color.name.toLowerCase().includes('레드') ? '#dc143c' :
                                                     '#ddd',
                                      border: '1px solid #ccc',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                    }}
                                  />
                                  <Typography variant="body2" sx={{ 
                                    fontSize: '0.8rem',
                                    fontWeight: '500',
                                    color: '#424242'
                                  }}>
                                    {color.name}
                                  </Typography>
                                </Box>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontWeight: 'bold',
                                    color: '#1976d2',
                                    backgroundColor: '#f3e5f5',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    border: '1px solid #e1bee7'
                                  }}
                                >
                                  {color.quantity}개
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        </Box>
                        <Typography variant="body2" color="primary" sx={{ mt: 1, fontWeight: 'bold' }}>
                          총 수량: {modelData.colors.reduce((sum, color) => sum + (color.quantity || 0), 0)}개
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>


        </Grid>
        )}

        {/* 미리보기 탭 */}
        {activeTab === 1 && (
          <Box>
            {!previewData ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    배정 미리보기
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    배정 설정을 완료한 후 미리보기를 실행하세요.
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={handlePreviewAssignment}
                    startIcon={<PreviewIcon />}
                    disabled={isLoadingPreview}
                  >
                    {isLoadingPreview ? '계산중...' : '배정 준비하기'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Box>
                {/* 배정 비율 설명 */}
                <Accordion sx={{ mb: 3 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HelpIcon color="primary" />
                      <Typography variant="h6">
                        배정 비율 계산 방식 안내
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" gutterBottom>
                          현재 설정된 배정 비율
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Chip 
                            label={`회전율: ${assignmentSettings.ratios.turnoverRate}%`} 
                            color="primary" 
                            variant="outlined"
                          />
                          <Chip 
                            label={`거래처수: ${assignmentSettings.ratios.storeCount}%`} 
                            color="secondary" 
                            variant="outlined"
                          />
                          <Chip 
                            label={`잔여재고: ${assignmentSettings.ratios.remainingInventory}%`} 
                            color="warning" 
                            variant="outlined"
                          />
                          <Chip 
                            label={`판매량: ${assignmentSettings.ratios.salesVolume}%`} 
                            color="info" 
                            variant="outlined"
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle1" gutterBottom>
                          점수 계산 방식
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Typography variant="body2">
                            • <strong>회전율:</strong> 높을수록 높은 점수 (재고 회전이 빠른 영업사원 우선)
                          </Typography>
                          <Typography variant="body2">
                            • <strong>거래처수:</strong> 많을수록 높은 점수 (거래처가 많은 영업사원 우선)
                          </Typography>
                          <Typography variant="body2">
                            • <strong>잔여재고:</strong> 적을수록 높은 점수 (재고가 적은 영업사원 우선)
                          </Typography>
                          <Typography variant="body2">
                            • <strong>판매량:</strong> 높을수록 높은 점수 (판매 실적이 좋은 영업사원 우선)
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Alert severity="info">
                      <Typography variant="body2">
                        <strong>배정 원칙:</strong> 각 영업사원의 종합 점수에 따라 재고를 배정하며, 
                        자투리 재고는 판매량과 거래처수가 많은 영업사원에게 우선적으로 재배정됩니다.
                      </Typography>
                    </Alert>
                  </AccordionDetails>
                </Accordion>

                {/* 배정 확정 버튼 */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="h6" gutterBottom>
                          배정 확정
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          현재 배정 결과를 확정하여 히스토리에 저장합니다.
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        onClick={handleConfirmAssignment}
                        startIcon={<CheckIcon />}
                        sx={{ 
                          px: 4, 
                          py: 1.5,
                          fontSize: '1.1rem',
                          fontWeight: 'bold'
                        }}
                      >
                        배정 확정
                      </Button>
                    </Box>
                  </CardContent>
                </Card>

                {/* 모델별 배정 현황 */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        모델별 배정 현황
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        onClick={() => handlePrint('summary')}
                        size="small"
                      >
                        인쇄
                      </Button>
                    </Box>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>모델명</TableCell>
                            <TableCell align="center">전체 수량</TableCell>
                            <TableCell align="center">배정 수량</TableCell>
                            <TableCell align="center">배정률</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.values(previewData.models).map((model) => (
                            <TableRow key={model.name}>
                              <TableCell>{model.name}</TableCell>
                              <TableCell align="center">{model.totalQuantity}개</TableCell>
                              <TableCell align="center">{model.assignedQuantity}개</TableCell>
                              <TableCell align="center">
                                {model.totalQuantity > 0 
                                  ? Math.round((model.assignedQuantity / model.totalQuantity) * 100)
                                  : 0}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* 배정 상세 현황 서브탭 */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      배정 상세 현황
                    </Typography>
                    
                    {/* 서브탭 네비게이션 */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                      <Tabs 
                        value={previewSubTab} 
                        onChange={(e, newValue) => setPreviewSubTab(newValue)}
                        aria-label="배정 상세 현황 탭"
                      >
                        <Tab label="사무실별" />
                        <Tab label="영업사원별" />
                        <Tab label="소속별" />
                      </Tabs>
                    </Box>

                    {/* 사무실별 배정 현황 */}
                    {previewSubTab === 0 && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1">
                            사무실별 모델/색상 배정 현황
                          </Typography>
                          <Button
                            variant="outlined"
                            startIcon={<PrintIcon />}
                            onClick={() => handlePrint('office')}
                            size="small"
                          >
                            인쇄
                          </Button>
                        </Box>
                        
                        {/* 모델별 색상별 배정량 테이블 */}
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600, overflow: 'auto' }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  모델/색상
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  총 배정량
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  평균 배정량
                                </TableCell>
                                {/* 사무실별 헤더 */}
                                {Object.entries(previewData.offices)
                                  .sort(([officeNameA, a], [officeNameB, b]) => officeNameA.localeCompare(officeNameB))
                                  .map(([officeName, officeData]) => (
                                    <TableCell key={officeName} align="center" sx={{ 
                                      fontWeight: 'bold',
                                      fontSize: '0.75rem',
                                      minWidth: '120px'
                                    }}>
                                      <div style={{ fontWeight: 'bold', color: '#1976d2' }}>
                                        {officeName}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                        {officeData.agentCount}명
                                      </div>
                                    </TableCell>
                                  ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {/* 모델별 색상별 행 */}
                              {Object.entries(previewData.models).map(([modelName, modelData]) => 
                                modelData.colors.map((color, colorIndex) => {
                                  // 해당 모델/색상의 총 배정량 계산
                                  const totalQuantity = Object.values(previewData.agents).reduce((sum, agentData) => {
                                    const modelAssignment = agentData[modelName];
                                    if (modelAssignment && modelAssignment.colorQuantities) {
                                      return sum + (modelAssignment.colorQuantities[color.name] || 0);
                                    }
                                    return sum;
                                  }, 0);
                                  
                                  // 해당 모델/색상의 평균 배정량 계산
                                  const avgQuantity = totalQuantity / Object.keys(previewData.offices).length;
                                  
                                  return (
                                    <TableRow key={`${modelName}-${color.name}`}>
                                      <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                                          {modelName}
                                        </div>
                                        <div style={{ 
                                          fontSize: '0.8rem',
                                          color: colorIndex % 2 === 0 ? '#1976d2' : '#d32f2f',
                                          fontWeight: 'bold'
                                        }}>
                                          {color.name}
                                        </div>
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        <strong>{totalQuantity}개</strong>
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        {Math.round(avgQuantity)}개
                                      </TableCell>
                                      {/* 사무실별 배정량 */}
                                      {Object.entries(previewData.offices)
                                        .sort(([officeNameA, a], [officeNameB, b]) => officeNameA.localeCompare(officeNameB))
                                        .map(([officeName, officeData]) => {
                                          // 해당 사무실의 모델/색상별 배정량 계산
                                          let officeQuantity = 0;
                                          
                                          officeData.agents.forEach(agent => {
                                            const agentAssignments = previewData.agents[agent.contactId];
                                            if (agentAssignments && agentAssignments[modelName] && agentAssignments[modelName].colorQuantities) {
                                              officeQuantity += agentAssignments[modelName].colorQuantities[color.name] || 0;
                                            }
                                          });
                                          
                                          return (
                                            <TableCell key={`${officeName}-${modelName}-${color.name}`} align="center" sx={{ 
                                              backgroundColor: colorIndex % 2 === 0 ? 'grey.50' : 'grey.100',
                                              fontWeight: officeQuantity > 0 ? 'bold' : 'normal',
                                              color: officeQuantity > 0 ? 'primary.main' : 'text.secondary'
                                            }}>
                                              {officeQuantity > 0 ? `${officeQuantity}개` : '-'}
                                            </TableCell>
                                          );
                                        })}
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        
                        {/* 테이블 설명 */}
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            • 각 셀은 해당 사무실이 배정받은 모델/색상별 수량을 표시합니다.<br/>
                            • '-' 표시는 해당 모델/색상에 배정되지 않았음을 의미합니다.<br/>
                            • 색상별 배정량은 영업사원별 배정량을 균등 분배하여 계산됩니다.
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* 영업사원별 배정 현황 */}
                    {previewSubTab === 1 && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1">
                            영업사원별 모델/색상 배정 현황 (전체 {Object.keys(previewData.agents).length}명)
                          </Typography>
                          <Button
                            variant="outlined"
                            startIcon={<PrintIcon />}
                            onClick={() => handlePrint('agent')}
                            size="small"
                          >
                            인쇄
                          </Button>
                        </Box>
                        
                        {/* 모델별 색상별 배정량 테이블 */}
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600, overflow: 'auto' }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  모델/색상
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  총 배정량
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  평균 배정점수
                                </TableCell>
                                {/* 영업사원별 헤더 */}
                                {Object.entries(previewData.agents)
                                  .sort(([agentIdA, a], [agentIdB, b]) => {
                                    const agentA = agents.find(agent => agent.contactId === agentIdA);
                                    const agentB = agents.find(agent => agent.contactId === agentIdB);
                                    
                                    const officeCompare = (agentA?.office || '').localeCompare(agentB?.office || '');
                                    if (officeCompare !== 0) return officeCompare;
                                    
                                    const deptCompare = (agentA?.department || '').localeCompare(agentB?.department || '');
                                    if (deptCompare !== 0) return deptCompare;
                                    
                                    return (agentA?.target || '').localeCompare(agentB?.target || '');
                                  })
                                  .map(([agentId, agentData]) => {
                                    const agent = agents.find(a => a.contactId === agentId);
                                    return (
                                      <TableCell key={agentId} align="center" sx={{ 
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        minWidth: '120px'
                                      }}>
                                        <div>{agent?.office || '미지정'}</div>
                                        <div>{agent?.department || '미지정'}</div>
                                        <div style={{ fontWeight: 'bold', color: '#1976d2' }}>
                                          {agent?.target || agentId}
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {/* 모델별 색상별 행 */}
                              {Object.entries(previewData.models).map(([modelName, modelData]) => 
                                modelData.colors.map((color, colorIndex) => {
                                  // 해당 모델/색상의 총 배정량 계산
                                  const totalQuantity = Object.values(previewData.agents).reduce((sum, agentData) => {
                                    const modelAssignment = agentData[modelName];
                                    if (modelAssignment && modelAssignment.colorQuantities) {
                                      return sum + (modelAssignment.colorQuantities[color.name] || 0);
                                    }
                                    return sum;
                                  }, 0);
                                  
                                  // 해당 모델/색상의 평균 점수 계산
                                  const scores = Object.values(previewData.agents).map(agentData => {
                                    const modelAssignment = agentData[modelName];
                                    if (modelAssignment && modelAssignment.colorScores && modelAssignment.colorScores[color.name]) {
                                      return modelAssignment.colorScores[color.name].averageScore || 0;
                                    }
                                    return 0;
                                  }).filter(score => score > 0);
                                  
                                  const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
                                  
                                  return (
                                    <TableRow key={`${modelName}-${color.name}`}>
                                      <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                                          {modelName}
                                        </div>
                                        <div style={{ 
                                          fontSize: '0.8rem',
                                          color: colorIndex % 2 === 0 ? '#1976d2' : '#d32f2f',
                                          fontWeight: 'bold'
                                        }}>
                                          {color.name}
                                        </div>
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        <strong>{totalQuantity}개</strong>
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        {Math.round(avgScore)}점
                                      </TableCell>
                                      {/* 영업사원별 배정량 */}
                                      {Object.entries(previewData.agents)
                                        .sort(([agentIdA, a], [agentIdB, b]) => {
                                          const agentA = agents.find(agent => agent.contactId === agentIdA);
                                          const agentB = agents.find(agent => agent.contactId === agentIdB);
                                          
                                          const officeCompare = (agentA?.office || '').localeCompare(agentB?.office || '');
                                          if (officeCompare !== 0) return officeCompare;
                                          
                                          const deptCompare = (agentA?.department || '').localeCompare(agentB?.department || '');
                                          if (deptCompare !== 0) return deptCompare;
                                          
                                          return (agentA?.target || '').localeCompare(agentB?.target || '');
                                        })
                                        .map(([agentId, agentData]) => {
                                          const modelAssignment = agentData[modelName];
                                          let assignedQuantity = 0;
                                          
                                          if (modelAssignment && modelAssignment.colorQuantities) {
                                            assignedQuantity = modelAssignment.colorQuantities[color.name] || 0;
                                          }
                                          
                                          return (
                                            <TableCell key={`${agentId}-${modelName}-${color.name}`} align="center" sx={{ 
                                              backgroundColor: colorIndex % 2 === 0 ? 'grey.50' : 'grey.100',
                                              fontWeight: assignedQuantity > 0 ? 'bold' : 'normal',
                                              color: assignedQuantity > 0 ? 'primary.main' : 'text.secondary'
                                            }}>
                                              {assignedQuantity > 0 ? `${assignedQuantity}개` : '-'}
                                            </TableCell>
                                          );
                                        })}
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        
                        {/* 테이블 설명 */}
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            • 각 셀은 해당 영업사원이 배정받은 모델/색상별 수량을 표시합니다.<br/>
                            • '-' 표시는 해당 모델/색상에 배정되지 않았음을 의미합니다.<br/>
                            • 총 배정량은 모든 모델/색상의 배정량 합계입니다.
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* 소속별 배정 현황 */}
                    {previewSubTab === 2 && (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="subtitle1">
                            소속별 모델/색상 배정 현황
                          </Typography>
                          <Button
                            variant="outlined"
                            startIcon={<PrintIcon />}
                            onClick={() => handlePrint('department')}
                            size="small"
                          >
                            인쇄
                          </Button>
                        </Box>
                        
                        {/* 모델별 색상별 배정량 테이블 */}
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600, overflow: 'auto' }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  모델/색상
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  총 배정량
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                  평균 배정량
                                </TableCell>
                                {/* 소속별 헤더 */}
                                {Object.entries(previewData.departments)
                                  .sort(([deptNameA, a], [deptNameB, b]) => deptNameA.localeCompare(deptNameB))
                                  .map(([deptName, deptData]) => (
                                    <TableCell key={deptName} align="center" sx={{ 
                                      fontWeight: 'bold',
                                      fontSize: '0.75rem',
                                      minWidth: '120px'
                                    }}>
                                      <div style={{ fontWeight: 'bold', color: '#1976d2' }}>
                                        {deptName}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                        {deptData.agentCount}명
                                      </div>
                                    </TableCell>
                                  ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {/* 모델별 색상별 행 */}
                              {Object.entries(previewData.models).map(([modelName, modelData]) => 
                                modelData.colors.map((color, colorIndex) => {
                                  // 해당 모델/색상의 총 배정량 계산
                                  const totalQuantity = Object.values(previewData.agents).reduce((sum, agentData) => {
                                    const modelAssignment = agentData[modelName];
                                    if (modelAssignment && modelAssignment.colorQuantities) {
                                      return sum + (modelAssignment.colorQuantities[color.name] || 0);
                                    }
                                    return sum;
                                  }, 0);
                                  
                                  // 해당 모델/색상의 평균 배정량 계산
                                  const avgQuantity = totalQuantity / Object.keys(previewData.departments).length;
                                  
                                  return (
                                    <TableRow key={`${modelName}-${color.name}`}>
                                      <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                                          {modelName}
                                        </div>
                                        <div style={{ 
                                          fontSize: '0.8rem',
                                          color: colorIndex % 2 === 0 ? '#1976d2' : '#d32f2f',
                                          fontWeight: 'bold'
                                        }}>
                                          {color.name}
                                        </div>
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        <strong>{totalQuantity}개</strong>
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        {Math.round(avgQuantity)}개
                                      </TableCell>
                                      {/* 소속별 배정량 */}
                                      {Object.entries(previewData.departments)
                                        .sort(([deptNameA, a], [deptNameB, b]) => deptNameA.localeCompare(deptNameB))
                                        .map(([deptName, deptData]) => {
                                          // 해당 소속의 모델/색상별 배정량 계산
                                          let deptQuantity = 0;
                                          
                                          deptData.agents.forEach(agent => {
                                            const agentAssignments = previewData.agents[agent.contactId];
                                            if (agentAssignments && agentAssignments[modelName] && agentAssignments[modelName].colorQuantities) {
                                              deptQuantity += agentAssignments[modelName].colorQuantities[color.name] || 0;
                                            }
                                          });
                                          
                                          return (
                                            <TableCell key={`${deptName}-${modelName}-${color.name}`} align="center" sx={{ 
                                              backgroundColor: colorIndex % 2 === 0 ? 'grey.50' : 'grey.100',
                                              fontWeight: deptQuantity > 0 ? 'bold' : 'normal',
                                              color: deptQuantity > 0 ? 'primary.main' : 'text.secondary'
                                            }}>
                                              {deptQuantity > 0 ? `${deptQuantity}개` : '-'}
                                            </TableCell>
                                          );
                                        })}
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        
                        {/* 테이블 설명 */}
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            • 각 셀은 해당 소속이 배정받은 모델/색상별 수량을 표시합니다.<br/>
                            • '-' 표시는 해당 모델/색상에 배정되지 않았음을 의미합니다.<br/>
                            • 색상별 배정량은 영업사원별 배정량을 균등 분배하여 계산됩니다.
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>
            )}
          </Box>
        )}

        {/* 시각화 탭 */}
        {activeTab === 2 && (
          <AssignmentVisualization 
            assignmentData={previewData} 
            agents={agents}
          />
        )}
      </Box>

      {/* 모델 추가 다이얼로그 */}
      <Dialog open={showModelDialog} onClose={() => setShowModelDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {isEditMode ? `모델 편집: ${selectedModel}` : '모델 추가'}
            </Typography>
            <Button
              size="small"
              onClick={() => {
                setSelectedModel('');
                setSelectedColor('');
                setNewModel({ name: '', color: '', quantity: 0, bulkQuantities: {} });
                setIsEditMode(false);
              }}
            >
              초기화
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* 모델 검색 및 선택 */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                📱 모델 선택
              </Typography>
              <FormControl fullWidth>
                <InputLabel>모델명</InputLabel>
                <Select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setSelectedColor('');
                    setNewModel(prev => ({ ...prev, name: e.target.value, color: '' }));
                  }}
                  label="모델명"
                >
                  <MenuItem value="">
                    <em>모델을 선택하세요</em>
                  </MenuItem>
                  {(() => {
                    console.log('모델 선택 다이얼로그 렌더링:', {
                      availableModels,
                      modelsCount: availableModels.models.length,
                      colorsCount: availableModels.colors.length
                    });
                    
                    if (availableModels.models.length === 0) {
                      return (
                        <MenuItem disabled>
                          <em>사용 가능한 모델이 없습니다. 매장 데이터를 확인해주세요.</em>
                        </MenuItem>
                      );
                    }
                    
                    return availableModels.models
                      .sort()
                      .map((model) => (
                        <MenuItem key={model} value={model}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                            <span>{model}</span>
                            <Chip 
                              size="small" 
                              label={getColorsForModel(availableModels.modelColors, model).length} 
                              color="primary" 
                              variant="outlined"
                            />
                          </Box>
                        </MenuItem>
                      ));
                  })()}
                </Select>
              </FormControl>
              
              {/* 모델별 색상 개수 요약 */}
              {!selectedModel && (
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary">
                    총 {availableModels.models.length}개 모델, {availableModels.colors.length}개 색상
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* 색상 선택 */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                🎨 색상 선택
              </Typography>
              {selectedModel ? (
                <FormControl fullWidth>
                  <InputLabel>색상</InputLabel>
                  <Select
                    value={selectedColor}
                    onChange={(e) => {
                      setSelectedColor(e.target.value);
                      setNewModel(prev => ({ ...prev, color: e.target.value }));
                    }}
                    label="색상"
                  >
                    <MenuItem value="">
                      <em>색상을 선택하세요</em>
                    </MenuItem>
                    {getColorsForModel(availableModels.modelColors, selectedModel)
                      .sort()
                      .map((color) => (
                        <MenuItem key={color} value={color}>
                          <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                            <span>{color}</span>
                            <Chip 
                              size="small" 
                              label="재고확인" 
                              color="secondary" 
                              variant="outlined"
                            />
                          </Box>
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
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

            {/* 선택된 모델/색상의 상세 재고 현황 */}
            {selectedModel && selectedColor && (
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ backgroundColor: '#f8f9fa' }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      📊 {selectedModel} - {selectedColor} 재고 현황
                    </Typography>
                    {(() => {
                      const summary = getModelInventorySummary(data, selectedModel, selectedColor);
                      return (
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box textAlign="center">
                              <Typography variant="h6" color="primary">
                                {summary.totalQuantity}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                총 수량
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box textAlign="center">
                              <Typography variant="h6" color="secondary">
                                {summary.storeCount}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                보유 매장
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box textAlign="center">
                              <Typography variant="h6" color="success.main">
                                {summary.avgQuantity}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                매장당 평균
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Box textAlign="center">
                              <Typography variant="h6" color="warning.main">
                                {summary.maxQuantity}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                최대 보유량
                              </Typography>
                            </Box>
                          </Grid>
                          {summary.stores.length > 0 && (
                            <Grid item xs={12}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>주요 보유 매장:</strong> {summary.stores.slice(0, 5).map(s => s.name).join(', ')}
                                {summary.stores.length > 5 && ` 외 ${summary.stores.length - 5}개`}
                              </Typography>
                            </Grid>
                          )}
                        </Grid>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* 선택된 모델의 일괄 입고수량 입력 */}
            {selectedModel && (
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ backgroundColor: '#e3f2fd' }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      📦 {selectedModel} 일괄 입고수량 설정
                    </Typography>
                    
                    {/* 일괄 수량 적용 */}
                    <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                      <TextField
                        type="number"
                        label="모든 색상에 적용할 수량"
                        size="small"
                        sx={{ width: 200 }}
                        inputProps={{ min: 1 }}
                        placeholder="수량 입력"
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          const input = document.querySelector('input[placeholder="수량 입력"]');
                          if (input && input.value) {
                            handleBulkQuantityApply(parseInt(input.value));
                          }
                        }}
                      >
                        일괄 적용
                      </Button>
                    </Box>
                    
                    {/* 색상별 수량 입력 테이블 */}
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>색상</TableCell>
                            <TableCell align="center">입고 수량</TableCell>
                            <TableCell align="center">재고 현황</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {getColorsForModel(availableModels.modelColors, selectedModel).map((color) => {
                            const summary = getModelInventorySummary(data, selectedModel, color);
                            return (
                              <TableRow key={color}>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box
                                      sx={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        backgroundColor: color.toLowerCase().includes('블랙') ? '#000' :
                                                       color.toLowerCase().includes('화이트') ? '#fff' :
                                                       color.toLowerCase().includes('실버') ? '#c0c0c0' :
                                                       color.toLowerCase().includes('블루') ? '#0066cc' :
                                                       color.toLowerCase().includes('골드') ? '#ffd700' :
                                                       color.toLowerCase().includes('핑크') ? '#ff69b4' :
                                                       color.toLowerCase().includes('그린') ? '#228b22' :
                                                       color.toLowerCase().includes('레드') ? '#dc143c' :
                                                       '#ddd',
                                        border: '1px solid #ccc'
                                      }}
                                    />
                                    {color}
                                  </Box>
                                </TableCell>
                                <TableCell align="center">
                                  <TextField
                                    type="number"
                                    size="small"
                                    value={(newModel.bulkQuantities && newModel.bulkQuantities[color]) || 0}
                                    onChange={(e) => handleColorQuantityChange(color, e.target.value)}
                                    inputProps={{ min: 0 }}
                                    sx={{ width: 80 }}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Typography variant="body2" color="text.secondary">
                                    {summary.totalQuantity}개
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        • 일괄 적용 버튼을 사용하여 모든 색상에 동일한 수량을 설정할 수 있습니다.<br/>
                        • 개별 색상의 수량을 조정하려면 각 행의 입력 필드를 사용하세요.<br/>
                        • 재고 현황은 현재 매장 데이터를 기반으로 계산됩니다.
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* 수동 입력 섹션 */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    ✏️ 수동 입력 (선택사항)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    위에서 모델과 색상을 선택했거나, 직접 입력할 수 있습니다.
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="모델명"
                        value={newModel.name}
                        onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="모델명을 입력하세요"
                        helperText={selectedModel ? `선택됨: ${selectedModel}` : ''}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="색상"
                        value={newModel.color}
                        onChange={(e) => setNewModel(prev => ({ ...prev, color: e.target.value }))}
                        placeholder="색상을 입력하세요"
                        helperText={selectedColor ? `선택됨: ${selectedColor}` : ''}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        type="number"
                        label="입고 수량"
                        value={newModel.quantity}
                        onChange={(e) => setNewModel(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                        placeholder="수량을 입력하세요"
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowModelDialog(false);
            setSelectedModel('');
            setSelectedColor('');
            setNewModel({ name: '', color: '', quantity: 0, bulkQuantities: {} });
          }}>
            취소
          </Button>
          <Button 
            onClick={handleAddModel} 
            variant="contained"
            disabled={!(
              (selectedModel && newModel.bulkQuantities && Object.values(newModel.bulkQuantities || {}).some(qty => qty > 0)) ||
              (selectedModel && selectedColor && newModel.quantity > 0) ||
              (newModel.name && newModel.color && newModel.quantity > 0)
            )}
            startIcon={<AddIcon />}
          >
            모델 추가
          </Button>
        </DialogActions>
      </Dialog>

      {/* 공유 설정 목록 다이얼로그 */}
      <Dialog
        open={showSharedSettingsDialog}
        onClose={() => setShowSharedSettingsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShareIcon color="primary" />
            <Typography variant="h6">공유된 배정 설정 목록</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {(() => {
              const sharedSettings = JSON.parse(localStorage.getItem('sharedAssignmentSettings') || '[]');
              
              if (sharedSettings.length === 0) {
                return (
                  <Alert severity="info">
                    공유된 배정 설정이 없습니다.
                  </Alert>
                );
              }
              
              return (
                <List>
                  {sharedSettings.map((setting, index) => {
                    const loginState = JSON.parse(localStorage.getItem('loginState') || '{}');
                    const currentUserId = loginState.inventoryUserName || 'unknown';
                    const isMySharedSetting = setting.sharedBy === currentUserId;
                    
                    return (
                      <ListItem key={index} divider>
                        <ListItemIcon>
                          <PersonIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                                {setting.sharedBy}님이 공유한 설정
                              </Typography>
                              <Chip 
                                label={new Date(setting.timestamp).toLocaleString('ko-KR')} 
                                size="small" 
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                <Chip label={`회전율: ${setting.ratios.turnoverRate}%`} size="small" color="primary" />
                                <Chip label={`거래처수: ${setting.ratios.storeCount}%`} size="small" color="secondary" />
                                <Chip label={`잔여재고: ${setting.ratios.remainingInventory}%`} size="small" color="warning" />
                                <Chip label={`판매량: ${setting.ratios.salesVolume}%`} size="small" color="info" />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                모델: {setting.modelCount}개 | 사무실: {setting.targetCount.offices}개 | 
                                소속: {setting.targetCount.departments}개 | 영업사원: {setting.targetCount.agents}명
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setAssignmentSettings(prev => ({
                                  ...prev,
                                  ratios: setting.ratios
                                }));
                                setShowSharedSettingsDialog(false);
                                alert('공유된 배정 비율이 적용되었습니다.');
                              }}
                            >
                              적용
                            </Button>
                            {isMySharedSetting && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleDeleteSharedSetting(index)}
                                startIcon={<DeleteIcon />}
                              >
                                삭제
                              </Button>
                            )}
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    );
                  })}
                </List>
              );
            })()}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSharedSettingsDialog(false)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AssignmentSettingsScreen; 