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
  Checkbox
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon
} from '@mui/icons-material';

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

  // 담당자 데이터 로드
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        if (response.ok) {
          const agentData = await response.json();
          setAgents(agentData);
        }
      } catch (error) {
        console.error('담당자 데이터 로드 실패:', error);
      }
    };
    
    loadAgents();
  }, []);

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
  };

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

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
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
                  
                  <Button
                    variant="contained"
                    onClick={saveSettings}
                    startIcon={<SaveIcon />}
                    fullWidth
                  >
                    설정 저장
                  </Button>
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
      </Box>

      {/* 모델 추가 다이얼로그 */}
      <Dialog open={showModelDialog} onClose={() => setShowModelDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>모델 추가</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="모델명"
                value={newModel.name}
                onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="색상"
                value={newModel.color}
                onChange={(e) => setNewModel(prev => ({ ...prev, color: e.target.value }))}
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
          <Button onClick={() => setShowModelDialog(false)}>취소</Button>
          <Button onClick={handleAddModel} variant="contained">추가</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AssignmentSettingsScreen; 