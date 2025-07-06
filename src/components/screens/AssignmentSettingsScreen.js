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
  AccordionDetails
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
  Help as HelpIcon
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
  const [newModel, setNewModel] = useState({ name: '', color: '', quantity: 0 });
  const [availableModels, setAvailableModels] = useState({ models: [], colors: [], modelColors: new Map() });
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: 설정, 1: 미리보기, 2: 시각화
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [previewSubTab, setPreviewSubTab] = useState(0);

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

  // 로컬 스토리지에서 설정 로드
  useEffect(() => {
    const savedSettings = localStorage.getItem('assignmentSettings');
    if (savedSettings) {
      setAssignmentSettings(JSON.parse(savedSettings));
    }
  }, []);

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

  // 설정 저장
  const saveSettings = () => {
    localStorage.setItem('assignmentSettings', JSON.stringify(assignmentSettings));
    
    // 설정 변경 알림 추가
    addSettingsChangedNotification({
      ratios: assignmentSettings.ratios,
      modelCount: Object.keys(assignmentSettings.models).length,
      targetCount: {
        offices: Object.keys(assignmentSettings.targets.offices).filter(key => assignmentSettings.targets.offices[key]).length,
        departments: Object.keys(assignmentSettings.targets.departments).filter(key => assignmentSettings.targets.departments[key]).length,
        agents: Object.keys(assignmentSettings.targets.agents).filter(key => assignmentSettings.targets.agents[key]).length
      }
    });
  };

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
      
      // 배정 완료 알림 추가
      const totalAgents = Object.keys(preview.agents).length;
      const totalQuantity = Object.values(preview.agents).reduce((sum, agent) => sum + (agent.quantity || 0), 0);
      const models = Object.keys(assignmentSettings.models);
      
      addAssignmentCompletedNotification({
        totalAgents,
        totalQuantity,
        models,
        preview
      });
      
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

  // 비율 변경
  const handleRatioChange = (type, value) => {
    setAssignmentSettings(prev => ({
      ...prev,
      ratios: {
        ...prev.ratios,
        [type]: value
      }
    }));
  };

  // 모델 추가
  const handleAddModel = () => {
    // 선택된 모델과 색상이 있으면 그것을 사용, 없으면 수동 입력된 값을 사용
    const modelName = selectedModel || newModel.name;
    const modelColor = selectedColor || newModel.color;
    
    if (modelName && modelColor && newModel.quantity > 0) {
      setAssignmentSettings(prev => {
        const existingModel = prev.models[modelName];
        
        // 기존 모델이 있으면 색상과 수량을 추가, 없으면 새로 생성
        if (existingModel) {
          // 기존 색상이 있는지 확인
          const existingColorIndex = existingModel.colors.findIndex(color => color.name === modelColor);
          
          if (existingColorIndex >= 0) {
            // 기존 색상이 있으면 수량만 업데이트
            const updatedColors = [...existingModel.colors];
            updatedColors[existingColorIndex] = {
              ...updatedColors[existingColorIndex],
              quantity: newModel.quantity
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
            // 새로운 색상 추가
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
          // 새로운 모델 생성
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
      
      setNewModel({ name: '', color: '', quantity: 0 });
      setSelectedModel('');
      setSelectedColor('');
      setShowModelDialog(false);
    }
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

    try {
      // 실제 배정 데이터에서 대상자 정보 추출
      const targetOffices = Object.keys(previewData.offices || {});
      const targetDepartments = [...new Set(Object.values(previewData.agents || {}).map(agent => agent.department).filter(Boolean))];
      const targetAgents = Object.values(previewData.agents || {}).map(agent => agent.agentName).filter(Boolean);
      
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
        assigner: '재고관리자', // 실제로는 로그인한 사용자 정보 사용
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
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { margin: 20px 0; padding: 10px; background-color: #f9f9f9; }
            .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #666; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>재고 배정 현황</h1>
            <p>출력일시: ${currentDate} ${currentTime}</p>
            <p>배정 비율: 회전율 ${assignmentSettings.ratios.turnoverRate}% | 거래처수 ${assignmentSettings.ratios.storeCount}% | 잔여재고 ${assignmentSettings.ratios.remainingInventory}% | 판매량 ${assignmentSettings.ratios.salesVolume}%</p>
          </div>
    `;
    
    const footer = `
          <div class="footer">
            <p>※ 이 문서는 시스템에서 자동 생성되었습니다.</p>
            <p>※ 배정 비율은 각 영업사원의 성과 지표를 종합적으로 고려하여 계산됩니다.</p>
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
                <th>사무실</th>
                <th>영업사원 수</th>
                <th>총 배정량</th>
                <th>평균 배정량</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(previewData.offices).map(([officeName, officeData]) => `
                <tr>
                  <td>${officeName}</td>
                  <td>${officeData.agentCount}명</td>
                  <td><strong>${officeData.totalQuantity}개</strong></td>
                  <td>${officeData.agentCount > 0 ? Math.round(officeData.totalQuantity / officeData.agentCount) : 0}개</td>
                </tr>
              `).join('')}
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
                <th>영업사원</th>
                <th>사무실</th>
                <th>소속</th>
                <th>총 배정량</th>
                <th>평균 점수</th>
                ${Object.keys(previewData.models).map(modelName => `
                  <th>${modelName}</th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.entries(previewData.agents).map(([agentId, agentData]) => `
                <tr>
                  <td>${agentData.agentName}</td>
                  <td>${agentData.office}</td>
                  <td>${agentData.department}</td>
                  <td><strong>${Object.values(agentData).filter(item => typeof item === 'object' && item.quantity).reduce((sum, model) => sum + (model.quantity || 0), 0)}개</strong></td>
                  <td>${Math.round(agentData.averageScore || 0)}점</td>
                  ${Object.keys(previewData.models).map(modelName => `
                    <td>${agentData[modelName]?.quantity || '-'}</td>
                  `).join('')}
                </tr>
              `).join('')}
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
                <th>소속</th>
                <th>영업사원 수</th>
                <th>총 배정량</th>
                <th>평균 배정량</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(previewData.departments).map(([departmentName, departmentData]) => `
                <tr>
                  <td>${departmentName}</td>
                  <td>${departmentData.agentCount}명</td>
                  <td><strong>${departmentData.totalQuantity}개</strong></td>
                  <td>${departmentData.agentCount > 0 ? Math.round(departmentData.totalQuantity / departmentData.agentCount) : 0}개</td>
                </tr>
              `).join('')}
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
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 1 }}>
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
            미리보기
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
          <Box sx={{ ml: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              단축키: Ctrl+S(저장) | Ctrl+P(미리보기) | Ctrl+R(캐시정리) | 1,2,3(탭전환)
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
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
                  <Typography gutterBottom>회전율: {assignmentSettings.ratios.turnoverRate}%</Typography>
                  <Slider
                    value={assignmentSettings.ratios.turnoverRate}
                    onChange={(e, value) => handleRatioChange('turnoverRate', value)}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    sx={{ mb: 3 }}
                  />
                  
                  <Typography gutterBottom>거래처수: {assignmentSettings.ratios.storeCount}%</Typography>
                  <Slider
                    value={assignmentSettings.ratios.storeCount}
                    onChange={(e, value) => handleRatioChange('storeCount', value)}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    sx={{ mb: 3 }}
                  />
                  
                  <Typography gutterBottom>잔여재고: {assignmentSettings.ratios.remainingInventory}%</Typography>
                  <Slider
                    value={assignmentSettings.ratios.remainingInventory}
                    onChange={(e, value) => handleRatioChange('remainingInventory', value)}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    sx={{ mb: 3 }}
                  />
                  
                  <Typography gutterBottom>판매량: {assignmentSettings.ratios.salesVolume}%</Typography>
                  <Slider
                    value={assignmentSettings.ratios.salesVolume}
                    onChange={(e, value) => handleRatioChange('salesVolume', value)}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    sx={{ mb: 3 }}
                  />
                  
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
                      {isLoadingPreview ? '계산중...' : '배정 미리보기'}
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    모델 관리
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setShowModelDialog(true)}
                  >
                    모델 추가
                  </Button>
                </Box>
                
                <Grid container spacing={2}>
                  {Object.entries(assignmentSettings.models).map(([modelName, modelData]) => (
                    <Grid item xs={12} sm={6} md={4} key={modelName}>
                      <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {modelName}
                          </Typography>
                          <IconButton size="small" onClick={() => handleDeleteModel(modelName)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          색상별 수량:
                        </Typography>
                        {modelData.colors.map((color, index) => (
                          <Typography key={index} variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                            • {color.name}: {color.quantity}개
                          </Typography>
                        ))}
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
                    {isLoadingPreview ? '계산중...' : '배정 미리보기 실행'}
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
                            사무실별 배정 현황
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
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>사무실</TableCell>
                                <TableCell align="center">영업사원 수</TableCell>
                                <TableCell align="center">총 배정량</TableCell>
                                <TableCell align="center">평균 배정량</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(previewData.offices).map(([officeName, officeData]) => (
                                <TableRow key={officeName}>
                                  <TableCell>{officeName}</TableCell>
                                  <TableCell align="center">{officeData.agentCount}명</TableCell>
                                  <TableCell align="center">
                                    <strong>{officeData.totalQuantity}개</strong>
                                  </TableCell>
                                  <TableCell align="center">
                                    {officeData.agentCount > 0 
                                      ? Math.round(officeData.totalQuantity / officeData.agentCount)
                                      : 0}개
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
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
                                <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }}>
                                  영업사원
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 120, backgroundColor: 'background.paper', zIndex: 1 }}>
                                  사무실
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }}>
                                  소속
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }}>
                                  총 배정량
                                </TableCell>
                                <TableCell sx={{ position: 'sticky', left: 360, backgroundColor: 'background.paper', zIndex: 1 }}>
                                  평균 점수
                                </TableCell>
                                {/* 모델별 색상별 헤더 */}
                                {Object.entries(previewData.models).map(([modelName, modelData]) => (
                                  <TableCell key={modelName} align="center" colSpan={modelData.colors.length}>
                                    {modelName}
                                  </TableCell>
                                ))}
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }}></TableCell>
                                <TableCell sx={{ position: 'sticky', left: 120, backgroundColor: 'background.paper', zIndex: 1 }}></TableCell>
                                <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }}></TableCell>
                                <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }}></TableCell>
                                <TableCell sx={{ position: 'sticky', left: 360, backgroundColor: 'background.paper', zIndex: 1 }}></TableCell>
                                {/* 색상별 헤더 */}
                                {Object.entries(previewData.models).map(([modelName, modelData]) => 
                                  modelData.colors.map((color, colorIndex) => (
                                    <TableCell key={`${modelName}-${color.name}`} align="center" sx={{ 
                                      backgroundColor: colorIndex % 2 === 0 ? 'grey.50' : 'grey.100',
                                      fontWeight: 'bold',
                                      fontSize: '0.75rem'
                                    }}>
                                      {color.name}
                                    </TableCell>
                                  ))
                                )}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(previewData.agents)
                                .sort(([,a], [,b]) => {
                                  const aTotal = Object.values(a).reduce((sum, val) => sum + (val.quantity || 0), 0);
                                  const bTotal = Object.values(b).reduce((sum, val) => sum + (val.quantity || 0), 0);
                                  return bTotal - aTotal;
                                })
                                .map(([agentId, agentData]) => {
                                  const agent = agents.find(a => a.contactId === agentId);
                                  const totalQuantity = Object.values(agentData).reduce((sum, val) => sum + (val.quantity || 0), 0);
                                  const avgScore = Object.values(agentData).reduce((sum, val) => sum + (val.score || 0), 0) / Object.keys(agentData).length;
                                  
                                  return (
                                    <TableRow key={agentId}>
                                      <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }}>
                                        {agent?.target || agentId}
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 120, backgroundColor: 'background.paper', zIndex: 1 }}>
                                        {agent?.office || '미지정'}
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 200, backgroundColor: 'background.paper', zIndex: 1 }}>
                                        {agent?.department || '미지정'}
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 280, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        <strong>{totalQuantity}개</strong>
                                      </TableCell>
                                      <TableCell sx={{ position: 'sticky', left: 360, backgroundColor: 'background.paper', zIndex: 1 }} align="center">
                                        {Math.round(avgScore)}점
                                      </TableCell>
                                      {/* 모델별 색상별 배정량 */}
                                      {Object.entries(previewData.models).map(([modelName, modelData]) => 
                                        modelData.colors.map((color, colorIndex) => {
                                          const modelAssignment = agentData[modelName];
                                          const assignedQuantity = modelAssignment ? modelAssignment.quantity : 0;
                                          
                                          return (
                                            <TableCell key={`${agentId}-${modelName}-${color.name}`} align="center" sx={{ 
                                              backgroundColor: colorIndex % 2 === 0 ? 'grey.50' : 'grey.100',
                                              fontWeight: assignedQuantity > 0 ? 'bold' : 'normal',
                                              color: assignedQuantity > 0 ? 'primary.main' : 'text.secondary'
                                            }}>
                                              {assignedQuantity > 0 ? `${assignedQuantity}개` : '-'}
                                            </TableCell>
                                          );
                                        })
                                      )}
                                    </TableRow>
                                  );
                                })}
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
                            소속별 배정 현황
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
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>소속</TableCell>
                                <TableCell align="center">영업사원 수</TableCell>
                                <TableCell align="center">총 배정량</TableCell>
                                <TableCell align="center">평균 배정량</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(previewData.departments).map(([departmentName, departmentData]) => (
                                <TableRow key={departmentName}>
                                  <TableCell>{departmentName}</TableCell>
                                  <TableCell align="center">{departmentData.agentCount}명</TableCell>
                                  <TableCell align="center">
                                    <strong>{departmentData.totalQuantity}개</strong>
                                  </TableCell>
                                  <TableCell align="center">
                                    {departmentData.agentCount > 0 
                                      ? Math.round(departmentData.totalQuantity / departmentData.agentCount)
                                      : 0}개
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
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
            <Typography variant="h6">모델 추가</Typography>
            <Button
              size="small"
              onClick={() => {
                setSelectedModel('');
                setSelectedColor('');
                setNewModel({ name: '', color: '', quantity: 0 });
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

            {/* 선택된 모델/색상의 입고수량 입력 */}
            {selectedModel && selectedColor && (
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ backgroundColor: '#e3f2fd' }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      📦 {selectedModel} - {selectedColor} 입고수량 설정
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      label="입고 수량"
                      value={newModel.quantity}
                      onChange={(e) => setNewModel(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                      placeholder="입고할 수량을 입력하세요"
                      inputProps={{ min: 1 }}
                      helperText="선택된 모델과 색상에 대한 입고 수량을 입력하세요"
                    />
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
            setNewModel({ name: '', color: '', quantity: 0 });
          }}>
            취소
          </Button>
          <Button 
            onClick={handleAddModel} 
            variant="contained"
            disabled={!((selectedModel && selectedColor && newModel.quantity > 0) || (newModel.name && newModel.color && newModel.quantity > 0))}
            startIcon={<AddIcon />}
          >
            모델 추가
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AssignmentSettingsScreen; 