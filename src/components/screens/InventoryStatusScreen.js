import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { inventoryAPI, fetchAgentData } from '../../api';

// 재고장표 메인 화면
const InventoryStatusScreen = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inventoryData, setInventoryData] = useState([]);
  const [agents, setAgents] = useState([]);
  const [filters, setFilters] = useState({
    agent: '',
    office: '',
    department: ''
  });

  // 필터 옵션들
  const [filterOptions, setFilterOptions] = useState({
    agents: [],
    offices: [],
    departments: []
  });

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let data;
      if (activeTab === 0) {
        // 모델별 재고 현황
        data = await inventoryAPI.getInventoryStatus(filters);
      } else {
        // 색상별 재고 현황
        data = await inventoryAPI.getInventoryStatusByColor(filters);
      }
      
      if (data.success) {
        setInventoryData(data.data);
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('재고 데이터 로드 실패:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 담당자 데이터 로드
  const loadAgentData = async () => {
    try {
      const agentData = await fetchAgentData();
      setAgents(agentData);
      
      // 필터 옵션 생성
      const offices = [...new Set(agentData.map(agent => agent.office).filter(Boolean))].sort();
      const departments = [...new Set(agentData.map(agent => agent.department).filter(Boolean))].sort();
      
      setFilterOptions({
        agents: agentData,
        offices,
        departments
      });
    } catch (error) {
      console.error('담당자 데이터 로드 실패:', error);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadAgentData();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab, filters]);

  // 필터 변경 핸들러
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 필터 초기화
  const handleFilterReset = () => {
    setFilters({
      agent: '',
      office: '',
      department: ''
    });
  };

  // 탭 변경 핸들러
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // 데이터 새로고침
  const handleRefresh = () => {
    loadData();
  };

  // 일별 개통 현황 렌더링
  const renderDailyActivation = (dailyData) => {
    return dailyData.map((day, index) => (
      <TableCell key={index} align="center" sx={{ 
        minWidth: 40, 
        p: 1,
        backgroundColor: day.count > 0 ? 'success.light' : 'transparent',
        color: day.count > 0 ? 'white' : 'inherit'
      }}>
        {day.count}
      </TableCell>
    ));
  };

  return (
    <Box sx={{ p: 3, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          📊 재고장표
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="필터 초기화">
            <IconButton onClick={handleFilterReset} color="secondary">
              <FilterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="새로고침">
            <IconButton onClick={handleRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 필터 섹션 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>담당자</InputLabel>
              <Select
                value={filters.agent}
                onChange={(e) => handleFilterChange('agent', e.target.value)}
                label="담당자"
              >
                <MenuItem value="">전체</MenuItem>
                {filterOptions.agents.map((agent) => (
                  <MenuItem key={agent.contactId} value={agent.target}>
                    {agent.target}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>사무실</InputLabel>
              <Select
                value={filters.office}
                onChange={(e) => handleFilterChange('office', e.target.value)}
                label="사무실"
              >
                <MenuItem value="">전체</MenuItem>
                {filterOptions.offices.map((office) => (
                  <MenuItem key={office} value={office}>
                    {office}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>소속</InputLabel>
              <Select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                label="소속"
              >
                <MenuItem value="">전체</MenuItem>
                {filterOptions.departments.map((department) => (
                  <MenuItem key={department} value={department}>
                    {department}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip 
                label={`총 ${inventoryData.length}개 모델`} 
                color="primary" 
                variant="outlined"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 탭 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="모델별 재고 현황" />
          <Tab label="색상별 재고 현황" />
        </Tabs>
      </Box>

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 로딩 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 재고 테이블 */}
      {!loading && !error && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TableContainer component={Paper} sx={{ 
            borderRadius: 2, 
            boxShadow: 2,
            '& .MuiTable-root': {
              borderCollapse: 'separate',
              borderSpacing: 0
            }
          }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'primary.main' }}>
                  <TableCell sx={{ 
                    backgroundColor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 'bold',
                    minWidth: 120
                  }}>
                    구분
                  </TableCell>
                  <TableCell sx={{ 
                    backgroundColor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 'bold',
                    minWidth: 200
                  }}>
                    모델명
                  </TableCell>
                  {activeTab === 1 && (
                    <TableCell sx={{ 
                      backgroundColor: 'primary.main', 
                      color: 'white', 
                      fontWeight: 'bold',
                      minWidth: 100
                    }}>
                      색상
                    </TableCell>
                  )}
                  <TableCell sx={{ 
                    backgroundColor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 'bold',
                    minWidth: 80
                  }}>
                    잔여재고
                  </TableCell>
                  <TableCell sx={{ 
                    backgroundColor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 'bold',
                    minWidth: 80
                  }}>
                    당월개통
                  </TableCell>
                  <TableCell sx={{ 
                    backgroundColor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 'bold',
                    minWidth: 80
                  }}>
                    담당자
                  </TableCell>
                  <TableCell sx={{ 
                    backgroundColor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 'bold',
                    minWidth: 80
                  }}>
                    사무실
                  </TableCell>
                  <TableCell sx={{ 
                    backgroundColor: 'primary.main', 
                    color: 'white', 
                    fontWeight: 'bold',
                    minWidth: 80
                  }}>
                    소속
                  </TableCell>
                  {/* 일별 컬럼 헤더 */}
                  {Array.from({ length: 31 }, (_, i) => (
                    <TableCell key={i} align="center" sx={{ 
                      backgroundColor: 'primary.main', 
                      color: 'white', 
                      fontWeight: 'bold',
                      minWidth: 40,
                      p: 1
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {inventoryData.map((item, index) => (
                  <TableRow 
                    key={index}
                    sx={{ 
                      backgroundColor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                      '&:hover': { 
                        backgroundColor: 'primary.light',
                        color: 'white'
                      }
                    }}
                  >
                    <TableCell sx={{ minWidth: 120 }}>
                      <Chip 
                        label={item.category || '기타'} 
                        size="small"
                        color={item.category === '삼성' ? 'primary' : 
                               item.category === '2ND' ? 'secondary' : 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 200, fontWeight: 'medium' }}>
                      {item.modelName}
                    </TableCell>
                    {activeTab === 1 && (
                      <TableCell sx={{ minWidth: 100 }}>
                        {item.color}
                      </TableCell>
                    )}
                    <TableCell sx={{ minWidth: 80, fontWeight: 'bold' }}>
                      {item.inventoryCount}
                    </TableCell>
                    <TableCell sx={{ minWidth: 80 }}>
                      {item.monthlyActivation}
                    </TableCell>
                    <TableCell sx={{ minWidth: 80 }}>
                      {item.agent}
                    </TableCell>
                    <TableCell sx={{ minWidth: 80 }}>
                      {item.office}
                    </TableCell>
                    <TableCell sx={{ minWidth: 80 }}>
                      {item.department}
                    </TableCell>
                    {/* 일별 개통 현황 */}
                    {renderDailyActivation(item.dailyActivation)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
};

export default InventoryStatusScreen; 