import React, { useState, useEffect, useMemo } from 'react';
import { getAssignmentSettings, calculateFullAssignment } from '../../utils/assignmentUtils';
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
  Grid,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  AccountTree as AccountTreeIcon,
  Business as BusinessIcon,
  Person as PersonIcon
} from '@mui/icons-material';

function DepartmentAssignmentScreen({ data, onBack, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [assignmentSettings, setAssignmentSettings] = useState({});
  const [selectedDepartment, setSelectedDepartment] = useState('all');

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

  // 배정 설정 로드
  useEffect(() => {
    const settings = getAssignmentSettings();
    setAssignmentSettings(settings);
  }, []);

  // 소속별 통계 계산 (새로운 배정 로직 적용)
  const [departmentStats, setDepartmentStats] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // 배정 데이터 로드
  useEffect(() => {
    const loadAssignmentData = async () => {
      if (!agents.length || !assignmentSettings.models || Object.keys(assignmentSettings.models).length === 0) {
        setDepartmentStats({});
        return;
      }

      setIsLoading(true);
      try {
        const fullAssignment = await calculateFullAssignment(agents, assignmentSettings, data);
        
        // 소속별 통계 변환
        const stats = {};
        Object.entries(fullAssignment.departments || {}).forEach(([department, deptData]) => {
          stats[department] = {
            department: deptData.department,
            agentCount: deptData.agentCount,
            agents: deptData.agents,
            totalAssignment: deptData.totalQuantity,
            models: {}
          };
          
          // 모델별 배정량 계산
          Object.entries(assignmentSettings.models || {}).forEach(([modelName, modelData]) => {
            const modelAssignments = fullAssignment.models[modelName]?.assignments || {};
            const deptModelQuantity = Object.values(modelAssignments)
              .filter(assignment => assignment.department === department)
              .reduce((sum, assignment) => sum + assignment.quantity, 0);
            
            stats[department].models[modelName] = {
              name: modelName,
              colors: modelData.colors,
              totalQuantity: modelData.quantity,
              assignedQuantity: deptModelQuantity
            };
          });
        });

        setDepartmentStats(stats);
      } catch (error) {
        console.error('배정 데이터 로드 실패:', error);
        setDepartmentStats({});
      } finally {
        setIsLoading(false);
      }
    };

    loadAssignmentData();
  }, [agents, assignmentSettings, data]);

  // 선택된 소속의 데이터
  const selectedDepartmentData = useMemo(() => {
    if (selectedDepartment === 'all') {
      return Object.values(departmentStats);
    }
    return departmentStats[selectedDepartment] ? [departmentStats[selectedDepartment]] : [];
  }, [departmentStats, selectedDepartment]);

  // 소속 목록
  const departments = useMemo(() => {
    const deptSet = new Set();
    agents.forEach(agent => {
      deptSet.add(agent.department || '미지정');
    });
    return Array.from(deptSet).sort();
  }, [agents]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <AccountTreeIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            소속배정
          </Typography>
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 콘텐츠 */}
      <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
        
        {/* 필터 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>소속 선택</InputLabel>
                <Select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  label="소속 선택"
                >
                  <MenuItem value="all">전체 소속</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="body2" color="text.secondary">
                선택된 소속: {selectedDepartment === 'all' ? '전체' : selectedDepartment}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* 로딩 상태 */}
        {isLoading && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" align="center" color="primary">
                배정 데이터를 계산 중입니다...
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* 소속별 통계 카드 */}
        {!isLoading && (
          <>
            {/* 요약 정보 */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" color="primary">
                    총 소속: {Object.keys(departmentStats).length}개
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" color="primary">
                    총 담당자: {Object.values(departmentStats).reduce((sum, dept) => sum + dept.agentCount, 0)}명
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" color="primary">
                    총 배정량: {Object.values(departmentStats).reduce((sum, dept) => sum + dept.totalAssignment, 0)}개
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" color="primary">
                    모델 수: {assignmentSettings.models ? Object.keys(assignmentSettings.models).length : 0}개
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* 소속별 통계 카드 */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {selectedDepartmentData.map((deptData) => (
                <Grid item xs={12} md={4} key={deptData.department}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <AccountTreeIcon sx={{ mr: 2, color: 'primary.main' }} />
                        <Typography variant="h6">
                          {deptData.department}
                        </Typography>
                      </Box>
                      <Typography variant="h4" color="primary" gutterBottom>
                        {deptData.agentCount}명
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        담당자 수
                      </Typography>
                      <Typography variant="h5" color="secondary" gutterBottom>
                        {deptData.totalAssignment}개
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        총 배정 수량
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {/* 소속별 상세 테이블 */}
        {!isLoading && selectedDepartmentData.map((deptData) => (
          <Card key={deptData.department} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {deptData.department} - 모델별 배정 현황
              </Typography>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>모델명</TableCell>
                      <TableCell>색상</TableCell>
                      <TableCell align="center">전체 수량</TableCell>
                      <TableCell align="center">배정 수량</TableCell>
                      <TableCell align="center">배정률</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.values(deptData.models).map((model) => (
                      <TableRow key={model.name}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {model.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {model.colors.map((color, index) => (
                              <Chip
                                key={index}
                                label={color}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">
                            {model.totalQuantity}개
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={`${model.assignedQuantity}개`}
                            color={model.assignedQuantity > 0 ? 'primary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" color="text.secondary">
                            {model.totalQuantity > 0 
                              ? Math.round((model.assignedQuantity / model.totalQuantity) * 100)
                              : 0}%
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ))}

        {/* 담당자 목록 */}
        {!isLoading && selectedDepartmentData.map((deptData) => (
          <Card key={`${deptData.department}-agents`}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {deptData.department} - 담당자 목록
              </Typography>
              
              <Grid container spacing={2}>
                {deptData.agents.map((agent) => (
                  <Grid item xs={12} sm={6} md={4} key={agent.contactId}>
                    <Paper sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PersonIcon sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="subtitle2" fontWeight="medium">
                          {agent.target}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        사무실: {agent.office || '미지정'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        자격: {agent.qualification || '미지정'}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

export default DepartmentAssignmentScreen; 