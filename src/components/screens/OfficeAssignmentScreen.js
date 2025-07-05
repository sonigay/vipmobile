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
  Business as BusinessIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { getAssignmentSettings, calculateFullAssignment } from '../../utils/assignmentUtils';

function OfficeAssignmentScreen({ data, onBack, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [assignmentSettings, setAssignmentSettings] = useState({});
  const [selectedOffice, setSelectedOffice] = useState('all');

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

  // 사무실별 통계 계산 (새로운 배정 로직 적용)
  const officeStats = useMemo(() => {
    if (!agents.length || !assignmentSettings.models) return {};

    // 전체 배정 계산
    const fullAssignment = calculateFullAssignment(agents, assignmentSettings);
    
    // 사무실별 통계 변환
    const stats = {};
    Object.entries(fullAssignment.offices).forEach(([office, officeData]) => {
      stats[office] = {
        office: officeData.office,
        agentCount: officeData.agentCount,
        agents: officeData.agents,
        totalAssignment: officeData.totalQuantity,
        models: {}
      };
      
      // 모델별 배정량 계산
      Object.entries(assignmentSettings.models || {}).forEach(([modelName, modelData]) => {
        const modelAssignments = fullAssignment.models[modelName]?.assignments || {};
        const officeModelQuantity = Object.values(modelAssignments)
          .filter(assignment => assignment.office === office)
          .reduce((sum, assignment) => sum + assignment.quantity, 0);
        
        stats[office].models[modelName] = {
          name: modelName,
          colors: modelData.colors,
          totalQuantity: modelData.quantity,
          assignedQuantity: officeModelQuantity
        };
      });
    });

    return stats;
  }, [agents, assignmentSettings]);

  // 선택된 사무실의 데이터
  const selectedOfficeData = useMemo(() => {
    if (selectedOffice === 'all') {
      return Object.values(officeStats);
    }
    return officeStats[selectedOffice] ? [officeStats[selectedOffice]] : [];
  }, [officeStats, selectedOffice]);

  // 사무실 목록
  const offices = useMemo(() => {
    const officeSet = new Set();
    agents.forEach(agent => {
      if (agent.office) officeSet.add(agent.office);
    });
    return Array.from(officeSet).sort();
  }, [agents]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <BusinessIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            사무실배정
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
                <InputLabel>사무실 선택</InputLabel>
                <Select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  label="사무실 선택"
                >
                  <MenuItem value="all">전체 사무실</MenuItem>
                  {offices.map(office => (
                    <MenuItem key={office} value={office}>{office}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="body2" color="text.secondary">
                선택된 사무실: {selectedOffice === 'all' ? '전체' : selectedOffice}
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        {/* 사무실별 통계 카드 */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {selectedOfficeData.map((officeData) => (
            <Grid item xs={12} md={4} key={officeData.office}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BusinessIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6">
                      {officeData.office}
                    </Typography>
                  </Box>
                  <Typography variant="h4" color="primary" gutterBottom>
                    {officeData.agentCount}명
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    영업사원 수
                  </Typography>
                  <Typography variant="h5" color="secondary" gutterBottom>
                    {officeData.totalAssignment}개
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    총 배정 수량
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* 사무실별 상세 테이블 */}
        {selectedOfficeData.map((officeData) => (
          <Card key={officeData.office} sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {officeData.office} - 모델별 배정 현황
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
                    {Object.values(officeData.models).map((model) => (
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

        {/* 영업사원 목록 */}
        {selectedOfficeData.map((officeData) => (
          <Card key={`${officeData.office}-agents`}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {officeData.office} - 영업사원 목록
              </Typography>
              
              <Grid container spacing={2}>
                {officeData.agents.map((agent) => (
                  <Grid item xs={12} sm={6} md={4} key={agent.contactId}>
                    <Paper sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PersonIcon sx={{ mr: 1, fontSize: 20 }} />
                        <Typography variant="subtitle2" fontWeight="medium">
                          {agent.target}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        소속: {agent.department || '미지정'}
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

export default OfficeAssignmentScreen; 