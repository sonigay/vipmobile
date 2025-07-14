import React, { useState, useEffect, useMemo } from 'react';
import { getAssignmentSettings, calculateFullAssignment } from '../../utils/assignmentUtils';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
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
  Menu,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton
} from '@mui/material';
import {
  AccountTree as AccountTreeIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon
} from '@mui/icons-material';

function DepartmentAssignmentScreen({ data, onBack, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [assignmentSettings, setAssignmentSettings] = useState({});
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [expandedColors, setExpandedColors] = useState({});
  const [expandedDepartments, setExpandedDepartments] = useState({});

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
        
        // 소속별 통계 변환 (새로운 집계 데이터 사용)
        const stats = {};
        const departmentsData = fullAssignment.departmentsWithScores || fullAssignment.departments || {};
        
        Object.entries(departmentsData).forEach(([department, deptData]) => {
          stats[department] = {
            department: deptData.department,
            agentCount: deptData.agentCount,
            agents: deptData.agents,
            totalAssignment: deptData.totalQuantity,
            models: {}
          };
          
          // 모델별 배정량 및 점수 계산
          Object.entries(assignmentSettings.models || {}).forEach(([modelName, modelData]) => {
            const modelAssignments = fullAssignment.models[modelName]?.assignments || {};
            const deptModelQuantity = Object.values(modelAssignments)
              .filter(assignment => assignment.department === department)
              .reduce((sum, assignment) => sum + assignment.quantity, 0);
            
            // 새로운 집계 데이터에서 점수 정보 가져오기
            const modelScores = deptData.modelScores?.[modelName] || {};
            
            stats[department].models[modelName] = {
              name: modelName,
              colors: modelData.colors,
              totalQuantity: modelData.quantity,
              assignedQuantity: deptModelQuantity,
              scores: modelScores // 점수 정보 추가
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

  // 내보내기 함수들
  const handleExportExcel = () => {
    exportToExcel.departmentAssignment(departmentStats, assignmentSettings);
    setExportMenuAnchor(null);
  };

  const handleExportPDF = () => {
    exportToPDF.departmentAssignment(departmentStats, assignmentSettings);
    setExportMenuAnchor(null);
  };

  // 소속 목록
  const departments = useMemo(() => {
    const deptSet = new Set();
    agents.forEach(agent => {
      deptSet.add(agent.department || '미지정');
    });
    return Array.from(deptSet).sort();
  }, [agents]);

  // 배정 로직별 이모지 및 색상 매핑
  const getLogicEmoji = (logicType) => {
    switch (logicType) {
      case 'turnoverRate': return { emoji: '🔄', color: '#4caf50', name: '회전율' };
      case 'storeCount': return { emoji: '🏪', color: '#2196f3', name: '거래처수' };
      case 'salesVolume': return { emoji: '📈', color: '#f44336', name: '판매량' };
      case 'inventoryScore': return { emoji: '📦', color: '#ff9800', name: '잔여재고' };
      case 'remainingInventory': return { emoji: '📦', color: '#ff9800', name: '잔여재고' };
      default: return { emoji: '❓', color: '#9e9e9e', name: '기타' };
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
          <AccountTreeIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            소속배정
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

        {/* 소속별 상세 테이블 */}
        {!isLoading && selectedDepartmentData.map((deptData) => (
          <Card key={deptData.department} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">
                  {deptData.department} - 배정 상세 현황
                </Typography>
                <IconButton
                  onClick={() => setExpandedDepartments(prev => ({ ...prev, [deptData.department]: !prev[deptData.department] }))}
                >
                  {expandedDepartments[deptData.department] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                </IconButton>
              </Box>
              
              <Collapse in={expandedDepartments[deptData.department]}>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }} align="center" rowSpan={2}>
                          모델/색상
                        </TableCell>
                        <TableCell align="center" rowSpan={2}>
                          색상
                        </TableCell>
                        <TableCell align="center" colSpan={deptData.agents.length} sx={{ 
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          backgroundColor: '#f5f5f5',
                          borderRight: '2px solid #ddd'
                        }}>
                          <div>{deptData.department}</div>
                          <div>영업사원</div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        {deptData.agents.map((agent) => (
                          <TableCell key={agent.contactId} align="center" sx={{ 
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            minWidth: '120px',
                            backgroundColor: '#fafafa'
                          }}>
                            <div style={{ fontWeight: 'bold', color: '#1976d2' }}>
                              {agent.target}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'text.secondary', marginTop: '2px' }}>
                              총 {Object.values(agent.assignments || {}).reduce((sum, assignment) => sum + assignment.quantity, 0)}개
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.values(deptData.models).map((model) =>
                        model.colors.map((color, colorIndex) => {
                          const colorKey = `${model.name}-${color.name}`;
                          const isExpanded = expandedColors[colorKey] !== false;
                          
                          return (
                            <TableRow key={colorKey}>
                              {colorIndex === 0 && (
                                <TableCell
                                  sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }}
                                  align="center"
                                  rowSpan={model.colors.length}
                                >
                                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#1976d2', marginBottom: '8px' }}>
                                    {model.name}
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                    {model.colors.length}개 색상
                                  </div>
                                </TableCell>
                              )}
                              <TableCell align="center" style={{ cursor: 'pointer' }} onClick={() => setExpandedColors(prev => ({ ...prev, [colorKey]: !isExpanded }))}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 10px',
                                  borderRadius: '12px',
                                  background: '#f0f4ff',
                                  color: '#1976d2',
                                  fontWeight: 600,
                                  fontSize: '0.95rem',
                                  marginRight: 4
                                }}>{color.name}</span>
                                <span style={{ marginLeft: 6, fontSize: '0.8em', color: '#888' }}>{isExpanded ? '▲' : '▼'}</span>
                              </TableCell>
                              
                              {deptData.agents.map((agent) => {
                                const agentAssignment = agent.assignments?.[`${model.name}-${color.name}`];
                                const quantity = agentAssignment?.quantity || 0;
                                
                                return (
                                  <TableCell key={agent.contactId} align="center">
                                    {isExpanded ? (
                                      <Box>
                                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1976d2' }}>
                                          {quantity}개
                                        </div>
                                        {agentAssignment?.scores && (
                                          <Box sx={{ mt: 1, fontSize: '0.7rem' }}>
                                            {Object.entries(agentAssignment.scores).map(([logicType, score]) => {
                                              const logic = getLogicEmoji(logicType);
                                              if (!logic || !score) return null;
                                              
                                              let displayValue = 0;
                                              if (typeof score === 'object' && score !== null && 'value' in score) {
                                                displayValue = score.value;
                                              } else {
                                                displayValue = score;
                                              }
                                              
                                              return (
                                                <Box key={logicType} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                                  <Box sx={{ 
                                                    width: 12, 
                                                    height: 12, 
                                                    borderRadius: '50%', 
                                                    backgroundColor: logic.color,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.6rem',
                                                    color: 'white',
                                                    fontWeight: 'bold'
                                                  }}>
                                                    {logic.emoji}
                                                  </Box>
                                                  <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>
                                                    {Math.round(Number(displayValue))}
                                                  </span>
                                                </Box>
                                              );
                                            })}
                                          </Box>
                                        )}
                                      </Box>
                                    ) : (
                                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#1976d2' }}>
                                        {quantity}개
                                      </div>
                                    )}
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
              </Collapse>
            </CardContent>
          </Card>
        ))}

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
        </Menu>
      </Box>
    </Box>
  );
}

export default DepartmentAssignmentScreen; 