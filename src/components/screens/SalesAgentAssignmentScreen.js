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
  MenuItem,
  TextField,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Business as BusinessIcon,
  AccountTree as AccountTreeIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon
} from '@mui/icons-material';
import { getAssignmentSettings, calculateFullAssignment } from '../../utils/assignmentUtils';
import { exportToExcel, exportToPDF, exportToCSV } from '../../utils/exportUtils';

function SalesAgentAssignmentScreen({ data, onBack, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [assignmentSettings, setAssignmentSettings] = useState({});
  const [selectedOffice, setSelectedOffice] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);

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

  // 영업사원별 배정 데이터 계산
  const [agentAssignments, setAgentAssignments] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // 배정 데이터 로드
  useEffect(() => {
    const loadAssignmentData = async () => {
      if (!agents.length || !assignmentSettings.models || Object.keys(assignmentSettings.models).length === 0) {
        setAgentAssignments({});
        return;
      }

      setIsLoading(true);
      try {
        const fullAssignment = await calculateFullAssignment(agents, assignmentSettings, data);
        setAgentAssignments(fullAssignment.agents || {});
      } catch (error) {
        console.error('배정 데이터 로드 실패:', error);
        setAgentAssignments({});
      } finally {
        setIsLoading(false);
      }
    };

    loadAssignmentData();
  }, [agents, assignmentSettings, data]);

  // 필터링된 영업사원 목록
  const filteredAgents = useMemo(() => {
    let filtered = agents;

    // 사무실 필터
    if (selectedOffice !== 'all') {
      filtered = filtered.filter(agent => agent.office === selectedOffice);
    }

    // 소속 필터
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(agent => agent.department === selectedDepartment);
    }

    // 검색어 필터
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(agent => 
        agent.target.toLowerCase().includes(term) ||
        (agent.office && agent.office.toLowerCase().includes(term)) ||
        (agent.department && agent.department.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [agents, selectedOffice, selectedDepartment, searchTerm]);

  // 사무실 목록
  const offices = useMemo(() => {
    const officeSet = new Set();
    agents.forEach(agent => {
      if (agent.office) officeSet.add(agent.office);
    });
    return Array.from(officeSet).sort();
  }, [agents]);

  // 소속 목록
  const departments = useMemo(() => {
    const deptSet = new Set();
    agents.forEach(agent => {
      if (agent.department) deptSet.add(agent.department);
    });
    return Array.from(deptSet).sort();
  }, [agents]);

  // 내보내기 함수들
  const handleExportExcel = () => {
    exportToExcel.salesAgentAssignment(filteredAgents, agentAssignments, assignmentSettings);
    setExportMenuAnchor(null);
  };

  const handleExportPDF = () => {
    exportToPDF.salesAgentAssignment(filteredAgents, agentAssignments, assignmentSettings);
    setExportMenuAnchor(null);
  };

  const handleExportCSV = () => {
    exportToCSV.salesAgentAssignment(filteredAgents, agentAssignments, assignmentSettings);
    setExportMenuAnchor(null);
  };

  // 영업사원별 총 배정량 계산
  const getAgentTotalAssignment = (agentId) => {
    const assignment = agentAssignments[agentId];
    if (!assignment) return 0;
    
    // 모든 모델의 배정량 합계
    return Object.values(assignment).reduce((sum, modelAssignment) => {
      return sum + (modelAssignment.quantity || 0);
    }, 0);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={onBack} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <PersonAddIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            영업사원배정
          </Typography>
          <Button
            color="inherit"
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            startIcon={<DownloadIcon />}
            sx={{ mr: 2 }}
          >
            내보내기
          </Button>
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
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>사무실</InputLabel>
                <Select
                  value={selectedOffice}
                  onChange={(e) => setSelectedOffice(e.target.value)}
                  label="사무실"
                >
                  <MenuItem value="all">전체 사무실</MenuItem>
                  {offices.map(office => (
                    <MenuItem key={office} value={office}>{office}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>소속</InputLabel>
                <Select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  label="소속"
                >
                  <MenuItem value="all">전체 소속</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="영업사원 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="이름, 사무실, 소속으로 검색"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Typography variant="body2" color="text.secondary">
                {filteredAgents.length}명 표시
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

        {/* 영업사원별 배정 현황 */}
        {!isLoading && (
          <>
            {/* 요약 정보 */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" color="primary">
                    총 영업사원: {filteredAgents.length}명
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" color="primary">
                    배정 대상: {Object.keys(agentAssignments).length}명
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" color="primary">
                    총 배정량: {Object.values(agentAssignments).reduce((sum, assignment) => {
                      return sum + (assignment.quantity || 0);
                    }, 0)}개
                  </Typography>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography variant="h6" color="primary">
                    모델 수: {assignmentSettings.models ? Object.keys(assignmentSettings.models).length : 0}개
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* 영업사원별 배정 카드 */}
            <Grid container spacing={3}>
              {filteredAgents.map((agent) => {
                const agentAssignment = agentAssignments[agent.contactId];
                const totalAssignment = agentAssignment ? agentAssignment.quantity || 0 : 0;
                
                return (
                  <Grid item xs={12} md={6} lg={4} key={agent.contactId}>
                    <Card>
                      <CardContent>
                        {/* 영업사원 정보 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <PersonAddIcon sx={{ mr: 2, color: 'primary.main' }} />
                          <Box>
                            <Typography variant="h6" fontWeight="bold">
                              {agent.target}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {agent.qualification || '미지정'}
                            </Typography>
                          </Box>
                        </Box>

                        {/* 사무실/소속 정보 */}
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <BusinessIcon sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2">
                              {agent.office || '미지정'}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AccountTreeIcon sx={{ mr: 1, fontSize: 16 }} />
                            <Typography variant="body2">
                              {agent.department || '미지정'}
                            </Typography>
                          </Box>
                        </Box>

                        {/* 총 배정량 */}
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="h5" color="primary" gutterBottom>
                            {totalAssignment}개
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            총 배정 수량
                          </Typography>
                        </Box>

                        {/* 배정 점수 정보 */}
                        {agentAssignment && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                              배정 점수: {agentAssignment.score ? Math.round(agentAssignment.score) : 0}점
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              배정 비율: {agentAssignment.ratio ? Math.round(agentAssignment.ratio * 100) : 0}%
                            </Typography>
                          </Box>
                        )}

                        {/* 모델별 배정 상세 */}
                        {agentAssignment && agentAssignment.colors && agentAssignment.colors.length > 0 ? (
                          <Box>
                            <Typography variant="subtitle2" gutterBottom>
                              배정 모델:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
                              {agentAssignment.colors.map((color, index) => (
                                <Chip
                                  key={index}
                                  label={color}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              ))}
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            배정된 모델이 없습니다.
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </>
        )}

        {/* 배정된 영업사원이 없는 경우 */}
        {filteredAgents.length === 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" align="center" color="text.secondary">
                조건에 맞는 영업사원이 없습니다.
              </Typography>
              <Typography variant="body2" align="center" color="text.secondary">
                필터 조건을 변경해보세요.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* 내보내기 메뉴 */}
        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={() => setExportMenuAnchor(null)}
        >
          <MenuItem onClick={handleExportExcel}>
            <ListItemIcon>
              <ExcelIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Excel로 내보내기</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleExportPDF}>
            <ListItemIcon>
              <PdfIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>PDF로 내보내기</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleExportCSV}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>CSV로 내보내기</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

export default SalesAgentAssignmentScreen; 