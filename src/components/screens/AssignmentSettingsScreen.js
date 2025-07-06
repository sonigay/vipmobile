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
  Tab
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
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { calculateFullAssignment, clearAssignmentCache, getSelectedTargets } from '../../utils/assignmentUtils';
import AssignmentVisualization from '../AssignmentVisualization';
import { extractAvailableModels, getColorsForModel, getModelInventorySummary } from '../../utils/modelUtils';
import { addAssignmentCompletedNotification, addSettingsChangedNotification } from '../../utils/notificationUtils';

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
            newSettings.targets.offices[office] = true; // 기본값: 선택됨
          }
        });

        // 소속별 배정 대상 초기화
        const departments = new Set();
        validAgents.forEach(agent => {
          if (agent.department) departments.add(agent.department);
        });
        
        departments.forEach(department => {
          if (!newSettings.targets.departments.hasOwnProperty(department)) {
            newSettings.targets.departments[department] = true; // 기본값: 선택됨
          }
        });

        // 영업사원별 배정 대상 초기화 (유효한 담당자만)
        validAgents.forEach(agent => {
          if (!newSettings.targets.agents.hasOwnProperty(agent.contactId)) {
            newSettings.targets.agents[agent.contactId] = true; // 기본값: 선택됨
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

  // 배정 대상 변경
  const handleTargetChange = (type, target, checked) => {
    setAssignmentSettings(prev => ({
      ...prev,
      targets: {
        ...prev.targets,
        [type]: {
          ...prev.targets[type],
          [target]: checked
        }
      }
    }));
  };

  // 전체 선택/해제
  const handleSelectAll = (type, checked) => {
    setAssignmentSettings(prev => {
      const newTargets = { ...prev.targets };
      Object.keys(newTargets[type]).forEach(key => {
        newTargets[type][key] = checked;
      });
      return {
        ...prev,
        targets: newTargets
      };
    });
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
                <Typography variant="h6" gutterBottom>
                  배정 대상 선택
                </Typography>
                
                <Grid container spacing={3}>
                  {/* 사무실별 배정 대상 */}
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          사무실별 배정
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => handleSelectAll('offices', true)}
                        >
                          전체선택
                        </Button>
                      </Box>
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {Object.entries(assignmentSettings.targets.offices).map(([office, checked]) => (
                          <Box key={office} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Checkbox
                              checked={checked}
                              onChange={(e) => handleTargetChange('offices', office, e.target.checked)}
                              icon={<CheckBoxOutlineBlankIcon />}
                              checkedIcon={<CheckBoxIcon />}
                              size="small"
                            />
                            <Typography variant="body2">
                              {office}
                            </Typography>
                          </Box>
                        ))}
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
                        <Button
                          size="small"
                          onClick={() => handleSelectAll('departments', true)}
                        >
                          전체선택
                        </Button>
                      </Box>
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {Object.entries(assignmentSettings.targets.departments).map(([department, checked]) => (
                          <Box key={department} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Checkbox
                              checked={checked}
                              onChange={(e) => handleTargetChange('departments', department, e.target.checked)}
                              icon={<CheckBoxOutlineBlankIcon />}
                              checkedIcon={<CheckBoxIcon />}
                              size="small"
                            />
                            <Typography variant="body2">
                              {department}
                            </Typography>
                          </Box>
                        ))}
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
                        <Button
                          size="small"
                          onClick={() => handleSelectAll('agents', true)}
                        >
                          전체선택
                        </Button>
                      </Box>
                      <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                        {Object.entries(assignmentSettings.targets.agents).map(([agentId, checked]) => {
                          const agent = agents.find(a => a.contactId === agentId);
                          return (
                            <Box key={agentId} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Checkbox
                                checked={checked}
                                onChange={(e) => handleTargetChange('agents', agentId, e.target.checked)}
                                icon={<CheckBoxOutlineBlankIcon />}
                                checkedIcon={<CheckBoxIcon />}
                                size="small"
                              />
                              <Typography variant="body2">
                                {agent ? agent.target : agentId}
                              </Typography>
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
                {/* 모델별 배정 현황 */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      모델별 배정 현황
                    </Typography>
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
                        <Typography variant="subtitle1" gutterBottom>
                          사무실별 배정 현황
                        </Typography>
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
                        <Typography variant="subtitle1" gutterBottom>
                          영업사원별 모델/색상 배정 현황 (전체 {Object.keys(previewData.agents).length}명)
                        </Typography>
                        
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
                        <Typography variant="subtitle1" gutterBottom>
                          소속별 배정 현황
                        </Typography>
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