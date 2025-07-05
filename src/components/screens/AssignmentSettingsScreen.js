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
  CircularProgress
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
import { calculateFullAssignment, clearAssignmentCache } from '../../utils/assignmentUtils';
import AssignmentVisualization from '../AssignmentVisualization';
import { extractAvailableModels, getColorsForModel, getModelInventorySummary } from '../../utils/modelUtils';
import { addAssignmentCompletedNotification, addSettingsChangedNotification } from '../../utils/notificationUtils';

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

  // 담당자 데이터 및 사용 가능한 모델 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        // 담당자 데이터 로드
        const agentResponse = await fetch('/api/agents');
        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          setAgents(agentData);
        }

        // 매장 데이터에서 사용 가능한 모델 추출
        if (data && Array.isArray(data)) {
          console.log('매장 데이터:', data.length, '개');
          const models = extractAvailableModels(data);
          console.log('추출된 모델:', models);
          setAvailableModels(models);
        } else {
          console.log('매장 데이터가 없거나 배열이 아님:', data);
          // 데이터가 없으면 API에서 직접 가져오기
          try {
            const storeResponse = await fetch('/api/data');
            if (storeResponse.ok) {
              const storeData = await storeResponse.json();
              console.log('API에서 가져온 매장 데이터:', storeData.stores?.length || 0, '개');
              if (storeData.stores && Array.isArray(storeData.stores)) {
                const models = extractAvailableModels(storeData.stores);
                console.log('API에서 추출된 모델:', models);
                setAvailableModels(models);
              }
            }
          } catch (apiError) {
            console.error('API에서 데이터 가져오기 실패:', apiError);
          }
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error);
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

  // 담당자 데이터가 로드되면 배정 대상 초기화
  useEffect(() => {
    if (agents.length > 0) {
      setAssignmentSettings(prev => {
        const newSettings = { ...prev };
        
        // 사무실별 배정 대상 초기화
        const offices = new Set();
        agents.forEach(agent => {
          if (agent.office) offices.add(agent.office);
        });
        
        offices.forEach(office => {
          if (!newSettings.targets.offices.hasOwnProperty(office)) {
            newSettings.targets.offices[office] = true; // 기본값: 선택됨
          }
        });

        // 소속별 배정 대상 초기화
        const departments = new Set();
        agents.forEach(agent => {
          if (agent.department) departments.add(agent.department);
        });
        
        departments.forEach(department => {
          if (!newSettings.targets.departments.hasOwnProperty(department)) {
            newSettings.targets.departments[department] = true; // 기본값: 선택됨
          }
        });

        // 영업사원별 배정 대상 초기화
        agents.forEach(agent => {
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
    setIsLoadingPreview(true);
    setProgress(0);
    setProgressMessage('배정 계산을 시작합니다...');
    
    try {
      // 진행률 업데이트
      setProgress(10);
      setProgressMessage('매장 데이터를 로드하는 중...');
      
      // 매장 데이터 가져오기 (재고 정보용)
      const storeResponse = await fetch('/api/data');
      const storeData = await storeResponse.json();
      
      setProgress(30);
      setProgressMessage('개통실적 데이터를 로드하는 중...');
      
      // 새로운 배정 로직으로 계산
      const preview = await calculateFullAssignment(agents, assignmentSettings, storeData);
      
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
      setProgressMessage('배정 계산 중 오류가 발생했습니다.');
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
      
      // 숫자 키로 탭 전환
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
    if (newModel.name && newModel.color && newModel.quantity > 0) {
      setAssignmentSettings(prev => ({
        ...prev,
        models: {
          ...prev.models,
          [newModel.name]: {
            colors: [newModel.color],
            quantity: newModel.quantity
          }
        }
      }));
      setNewModel({ name: '', color: '', quantity: 0 });
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
                <Typography variant="h6" gutterBottom>
                  담당자 관리
                </Typography>
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
                      {agents.map((agent) => (
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
                      ))}
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
                        <Typography variant="body2" color="text.secondary">
                          색상: {modelData.colors.join(', ')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          수량: {modelData.quantity}개
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
              <Grid container spacing={3}>
                {/* 기존 미리보기 결과 내용 */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        배정 미리보기 결과
                      </Typography>
                      
                      {/* 모델별 배정 현황 */}
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
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
                      </Box>

                      {/* 영업사원별 배정 현황 */}
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          영업사원별 배정 현황 (상위 10명)
                        </Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>영업사원</TableCell>
                                <TableCell>사무실</TableCell>
                                <TableCell>소속</TableCell>
                                <TableCell align="center">총 배정량</TableCell>
                                <TableCell align="center">배정 점수</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(previewData.agents)
                                .sort(([,a], [,b]) => {
                                  const aTotal = Object.values(a).reduce((sum, val) => sum + (val.quantity || 0), 0);
                                  const bTotal = Object.values(b).reduce((sum, val) => sum + (val.quantity || 0), 0);
                                  return bTotal - aTotal;
                                })
                                .slice(0, 10)
                                .map(([agentId, agentData]) => {
                                  const agent = agents.find(a => a.contactId === agentId);
                                  const totalQuantity = Object.values(agentData).reduce((sum, val) => sum + (val.quantity || 0), 0);
                                  const avgScore = Object.values(agentData).reduce((sum, val) => sum + (val.score || 0), 0) / Object.keys(agentData).length;
                                  
                                  return (
                                    <TableRow key={agentId}>
                                      <TableCell>{agent?.target || agentId}</TableCell>
                                      <TableCell>{agent?.office || '미지정'}</TableCell>
                                      <TableCell>{agent?.department || '미지정'}</TableCell>
                                      <TableCell align="center">{totalQuantity}개</TableCell>
                                      <TableCell align="center">{Math.round(avgScore)}점</TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {/* 새로운 배정 비율 설명 */}
                      <Alert severity="info" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>새로운 배정 비율 계산 방식:</strong><br/>
                          • 모델별회전율 = (당월실적+전월실적)/(보유재고+당월실적+전월실적)<br/>
                          • 거래처수 = 담당자별로 보유중인 매장수<br/>
                          • 잔여재고 = 보유재고<br/>
                          • 판매량 = 당월실적+전월실적
                        </Typography>
                      </Alert>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
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
      <Dialog open={showModelDialog} onClose={() => setShowModelDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>모델 추가</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* 기존 보유 모델 선택 */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                기존 보유 모델 선택
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
                  {availableModels.models.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* 선택된 모델의 색상 선택 */}
            {selectedModel && (
              <Grid item xs={12}>
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
                    {getColorsForModel(availableModels.modelColors, selectedModel).map((color) => (
                      <MenuItem key={color} value={color}>
                        {color}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* 선택된 모델/색상의 재고 현황 */}
            {selectedModel && selectedColor && (
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      {selectedModel} - {selectedColor} 재고 현황
                    </Typography>
                    {(() => {
                      const summary = getModelInventorySummary(data, selectedModel, selectedColor);
                      return (
                        <Box>
                          <Typography variant="body2">
                            총 수량: {summary.totalQuantity}개
                          </Typography>
                          <Typography variant="body2">
                            보유 매장: {summary.storeCount}개
                          </Typography>
                          {summary.stores.length > 0 && (
                            <Typography variant="body2" color="text.secondary">
                              주요 보유 매장: {summary.stores.slice(0, 3).map(s => s.name).join(', ')}
                              {summary.stores.length > 3 && ` 외 ${summary.stores.length - 3}개`}
                            </Typography>
                          )}
                        </Box>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* 수동 입력 (기존 방식) */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                또는 수동 입력
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="모델명 (수동)"
                value={newModel.name}
                onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                placeholder="직접 모델명을 입력하세요"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="색상 (수동)"
                value={newModel.color}
                onChange={(e) => setNewModel(prev => ({ ...prev, color: e.target.value }))}
                placeholder="직접 색상을 입력하세요"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="입고 수량"
                value={newModel.quantity}
                onChange={(e) => setNewModel(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
              />
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
            disabled={!newModel.name || !newModel.color || newModel.quantity <= 0}
          >
            추가
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AssignmentSettingsScreen; 