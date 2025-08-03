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
  
  // 운영모델 순서 상태
  const [operationModelOrder, setOperationModelOrder] = useState({});

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
            let processedData = data.data;
            
            // 다중 정렬: 구분별 → 모델명(운영모델 순서) → 색상별
            const sortedData = processedData.sort((a, b) => {
              // 1순위: 구분 (삼성 → 애플 → 기타 → 2ND)
              const categoryOrder = { '삼성': 1, '애플': 2, '기타': 3, '2ND': 4 };
              const aOrder = categoryOrder[a.category] || 5;
              const bOrder = categoryOrder[b.category] || 5;
              if (aOrder !== bOrder) {
                return aOrder - bOrder;
              }
              
              // 2순위: 모델명 (운영모델 시트 C열 순서)
              if (a.modelName !== b.modelName) {
                const aModelOrder = operationModelOrder[a.modelName] ?? 999;
                const bModelOrder = operationModelOrder[b.modelName] ?? 999;
                if (aModelOrder !== bModelOrder) {
                  return aModelOrder - bModelOrder;
                }
                // 운영모델에 없는 모델은 알파벳 순으로 정렬
                return a.modelName.localeCompare(b.modelName);
              }
              
              // 3순위: 색상 (색상별 탭에서만)
              if (activeTab === 1 && a.color !== b.color) {
                return a.color.localeCompare(b.color);
              }
              
              return 0;
            });
            
            // 색상별 탭에서 동일 모델명 그룹화 처리 (정렬 후)
            if (activeTab === 1) {
              const modelGroups = new Map();
              sortedData.forEach(item => {
                if (!modelGroups.has(item.modelName)) {
                  modelGroups.set(item.modelName, []);
                }
                modelGroups.get(item.modelName).push(item);
              });
              
              // 그룹화된 데이터 생성
              const groupedData = [];
              modelGroups.forEach((items, modelName) => {
                items.forEach((item, index) => {
                  groupedData.push({
                    ...item,
                    isFirstInGroup: index === 0, // 그룹의 첫 번째 항목인지 표시
                    groupSize: items.length, // 그룹 크기
                    groupIndex: index // 그룹 내 인덱스
                  });
                });
              });
              
              setInventoryData(groupedData);
            } else {
              setInventoryData(sortedData);
            }
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
  
  // 운영모델 순서 로드
  const loadOperationModelOrder = async () => {
    try {
      const response = await inventoryAPI.getOperationModels();
      if (response.success) {
        setOperationModelOrder(response.data);
      }
    } catch (error) {
      console.error('운영모델 순서 로드 실패:', error);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadAgentData();
    loadOperationModelOrder();
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

           // 수량별 색상 결정 함수
    const getQuantityColor = (count, type = 'daily') => {
      if (count === 0) return { color: 'text.secondary', backgroundColor: '#ffffff' }; // 0값은 하얀색 배경
      
      if (type === 'inventory') {
        // 잔여재고: 1~/5~/10~/20~/40~ (낮은 숫자 = 빨강, 높은 숫자 = 파랑)
        if (count >= 40) return { color: '#1976d2', backgroundColor: '#e3f2fd' }; // 파랑 (안정)
        if (count >= 20) return { color: '#388e3c', backgroundColor: '#e8f5e8' };  // 초록 (양호)
        if (count >= 10) return { color: '#f57f17', backgroundColor: '#fff8e1' }; // 노랑 (보통)
        if (count >= 5) return { color: '#f57c00', backgroundColor: '#fff3e0' }; // 주황 (경계)
        return { color: '#d32f2f', backgroundColor: '#ffebee' }; // 빨강 (주의)
      } else if (type === 'monthly') {
        // 당월개통: 1~/5~/10~/20~/40~ (낮은 숫자 = 빨강, 높은 숫자 = 파랑)
        if (count >= 40) return { color: '#1976d2', backgroundColor: '#e3f2fd' }; // 파랑 (안정)
        if (count >= 20) return { color: '#388e3c', backgroundColor: '#e8f5e8' };  // 초록 (양호)
        if (count >= 10) return { color: '#f57f17', backgroundColor: '#fff8e1' }; // 노랑 (보통)
        if (count >= 5) return { color: '#f57c00', backgroundColor: '#fff3e0' }; // 주황 (경계)
        return { color: '#d32f2f', backgroundColor: '#ffebee' }; // 빨강 (주의)
      } else {
        // 일별 개통: 1~/2~/3~/5~/10~ (낮은 숫자 = 빨강, 높은 숫자 = 파랑)
        if (count >= 10) return { color: '#1976d2', backgroundColor: '#e3f2fd' }; // 파랑 (안정)
        if (count >= 5) return { color: '#388e3c', backgroundColor: '#e8f5e8' };  // 초록 (양호)
        if (count >= 3) return { color: '#f57f17', backgroundColor: '#fff8e1' };  // 노랑 (보통)
        if (count >= 2) return { color: '#f57c00', backgroundColor: '#fff3e0' };  // 주황 (경계)
        return { color: '#d32f2f', backgroundColor: '#ffebee' }; // 빨강 (주의)
      }
    };

           // 일별 개통 현황 렌더링
    const renderDailyActivation = (dailyData) => {
      return dailyData.map((day, index) => {
        const colorStyle = getQuantityColor(day.count, 'daily');
        return (
          <TableCell key={index} align="center" sx={{ 
            minWidth: 25, 
            p: 0.25,
            fontSize: '0.7rem',
            color: colorStyle.color,
            backgroundColor: colorStyle.backgroundColor,
            fontWeight: day.count > 0 ? 'bold' : 'normal',
            borderRight: index < 30 ? '1px solid #f0f0f0' : 'none',
            borderRadius: day.count > 0 ? '2px' : '0',
            borderLeft: index === 0 ? '2px solid #ffffff' : 'none' // 첫 번째 일별 컬럼에 하얀 구분선 추가
          }}>
            {day.count}
          </TableCell>
        );
      });
    };

    return (
    <Box sx={{ 
      p: 3, 
      height: '100vh', 
      overflow: 'hidden', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#ffffff'
    }}>
             {/* 헤더 */}
       <Box sx={{ 
         mb: 3, 
         background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
         borderRadius: 3,
         p: 3,
         boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
         position: 'relative',
         overflow: 'hidden'
       }}>
         {/* 배경 패턴 */}
         <Box sx={{
           position: 'absolute',
           top: 0,
           right: 0,
           width: '200px',
           height: '100%',
           background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)',
           transform: 'rotate(15deg)'
         }} />
         
         <Box sx={{ 
           display: 'flex', 
           justifyContent: 'space-between', 
           alignItems: 'center',
           position: 'relative',
           zIndex: 1
         }}>
           <Box>
             <Typography variant="h3" component="h1" sx={{ 
               fontWeight: 800,
               color: '#ffffff',
               textShadow: '0 2px 4px rgba(0,0,0,0.3)',
               mb: 0.5
             }}>
               📊 재고장표
             </Typography>
             <Typography variant="body2" sx={{ 
               color: 'rgba(255,255,255,0.9)',
               fontWeight: 500
             }}>
               실시간 재고 현황 및 개통 데이터 관리
             </Typography>
           </Box>
           
           <Box sx={{ display: 'flex', gap: 2 }}>
             <Tooltip title="필터 초기화">
               <IconButton 
                 onClick={handleFilterReset} 
                 sx={{ 
                   backgroundColor: 'rgba(255,255,255,0.2)',
                   color: '#ffffff',
                   backdropFilter: 'blur(10px)',
                   border: '1px solid rgba(255,255,255,0.3)',
                   '&:hover': { 
                     backgroundColor: 'rgba(255,255,255,0.3)',
                     transform: 'translateY(-2px)',
                     boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                   },
                   transition: 'all 0.3s ease'
                 }}
               >
                 <FilterIcon />
               </IconButton>
             </Tooltip>
             <Tooltip title="새로고침">
               <IconButton 
                 onClick={handleRefresh} 
                 sx={{ 
                   backgroundColor: 'rgba(255,255,255,0.2)',
                   color: '#ffffff',
                   backdropFilter: 'blur(10px)',
                   border: '1px solid rgba(255,255,255,0.3)',
                   '&:hover': { 
                     backgroundColor: 'rgba(255,255,255,0.3)',
                     transform: 'translateY(-2px)',
                     boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                   },
                   transition: 'all 0.3s ease'
                 }}
               >
                 <RefreshIcon />
               </IconButton>
             </Tooltip>
           </Box>
         </Box>
       </Box>

             {/* 필터 섹션 */}
       <Paper sx={{ 
         p: 3, 
         mb: 3, 
         backgroundColor: '#ffffff',
         borderRadius: 3,
         boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
         border: '1px solid #f0f0f0'
       }}>
         <Grid container spacing={3} alignItems="center">
           <Grid item xs={12} sm={2}>
             <FormControl fullWidth size="small">
               <InputLabel sx={{ color: '#666666' }}>담당자</InputLabel>
               <Select
                 value={filters.agent}
                 onChange={(e) => handleFilterChange('agent', e.target.value)}
                 label="담당자"
                 sx={{
                   backgroundColor: '#fafafa',
                   '& .MuiOutlinedInput-notchedOutline': {
                     borderColor: '#e0e0e0'
                   },
                   '&:hover .MuiOutlinedInput-notchedOutline': {
                     borderColor: '#1976d2'
                   }
                 }}
               >
                 <MenuItem value="">전체 담당자</MenuItem>
                 {filterOptions.agents.map((agent) => (
                   <MenuItem key={agent.contactId} value={agent.target}>
                     {agent.target}
                   </MenuItem>
                 ))}
               </Select>
             </FormControl>
           </Grid>
           
           <Grid item xs={12} sm={2}>
             <FormControl fullWidth size="small">
               <InputLabel sx={{ color: '#666666' }}>사무실</InputLabel>
               <Select
                 value={filters.office}
                 onChange={(e) => handleFilterChange('office', e.target.value)}
                 label="사무실"
                 sx={{
                   backgroundColor: '#fafafa',
                   '& .MuiOutlinedInput-notchedOutline': {
                     borderColor: '#e0e0e0'
                   },
                   '&:hover .MuiOutlinedInput-notchedOutline': {
                     borderColor: '#1976d2'
                   }
                 }}
               >
                 <MenuItem value="">전체 사무실</MenuItem>
                 {filterOptions.offices.map((office) => (
                   <MenuItem key={office} value={office}>
                     {office}
                   </MenuItem>
                 ))}
               </Select>
             </FormControl>
           </Grid>
           
           <Grid item xs={12} sm={2}>
             <FormControl fullWidth size="small">
               <InputLabel sx={{ color: '#666666' }}>소속</InputLabel>
               <Select
                 value={filters.department}
                 onChange={(e) => handleFilterChange('department', e.target.value)}
                 label="소속"
                 sx={{
                   backgroundColor: '#fafafa',
                   '& .MuiOutlinedInput-notchedOutline': {
                     borderColor: '#e0e0e0'
                   },
                   '&:hover .MuiOutlinedInput-notchedOutline': {
                     borderColor: '#1976d2'
                   }
                 }}
               >
                 <MenuItem value="">전체 소속</MenuItem>
                 {filterOptions.departments.map((department) => (
                   <MenuItem key={department} value={department}>
                     {department}
                   </MenuItem>
                 ))}
               </Select>
             </FormControl>
           </Grid>
           
           <Grid item xs={12} sm={3}>
             <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
               <Chip 
                 label={`총 ${inventoryData.length}개 모델`} 
                 sx={{ 
                   backgroundColor: '#e3f2fd',
                   color: '#1976d2',
                   fontWeight: 'bold'
                 }}
               />
               <Chip 
                 label={`잔여재고: ${inventoryData.reduce((sum, item) => sum + item.inventoryCount, 0)}개`} 
                 sx={{ 
                   backgroundColor: '#fff3e0',
                   color: '#f57c00',
                   fontWeight: 'bold'
                 }}
               />
             </Box>
           </Grid>
           
           <Grid item xs={12} sm={3}>
             <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
               <Chip 
                 label={`당월개통: ${inventoryData.reduce((sum, item) => sum + item.monthlyActivation, 0)}개`} 
                 sx={{ 
                   backgroundColor: '#e8f5e8',
                   color: '#388e3c',
                   fontWeight: 'bold'
                 }}
               />
             </Box>
           </Grid>
         </Grid>
       </Paper>

      {/* 탭 */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: '#e0e0e0', 
        mb: 3,
        backgroundColor: '#ffffff',
        borderRadius: 2,
        p: 1
      }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              color: '#666666',
              fontWeight: 'bold',
              '&.Mui-selected': {
                color: '#1976d2'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#1976d2'
            }
          }}
        >
          <Tab label="모델별 재고 현황" />
          <Tab label="색상별 재고 현황" />
        </Tabs>
      </Box>

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ 
          mb: 3,
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: 2
        }}>
          {error}
        </Alert>
      )}

      {/* 로딩 */}
      {loading && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          p: 4,
          backgroundColor: '#ffffff',
          borderRadius: 2
        }}>
          <CircularProgress sx={{ color: '#1976d2' }} />
        </Box>
      )}

             {/* 재고 테이블 */}
       {!loading && !error && (
         <Box sx={{ flex: 1, overflow: 'auto' }}>
           <TableContainer component={Paper} sx={{ 
             borderRadius: 3, 
             boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
             border: '1px solid #f0f0f0',
             backgroundColor: '#ffffff',
             '& .MuiTable-root': {
               borderCollapse: 'separate',
               borderSpacing: 0
             }
           }}>
             <Table stickyHeader>
                               <TableHead>
                                     {/* 총 수량 요약 행 (맨 위) */}
                   <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                                                                  <TableCell sx={{ 
                         backgroundColor: '#f8f9fa', 
                         fontWeight: 'bold',
                         minWidth: 35,
                         borderBottom: '2px solid #1976d2',
                         fontSize: '0.7rem',
                         p: 0.25,
                         textAlign: 'center'
                       }}>
                         총계
                       </TableCell>
                                                                  <TableCell sx={{ 
                         backgroundColor: '#f8f9fa', 
                         fontWeight: 'bold',
                         minWidth: 80,
                         borderBottom: '2px solid #1976d2',
                         fontSize: '0.7rem',
                         p: 0.25,
                         textAlign: 'center'
                       }}>
                         전체 모델
                       </TableCell>
                                           {activeTab === 1 && (
                        <TableCell sx={{ 
                          backgroundColor: '#f8f9fa', 
                          fontWeight: 'bold',
                          minWidth: 80,
                          borderBottom: '2px solid #1976d2',
                          fontSize: '0.8rem',
                          p: 0.5,
                          textAlign: 'center'
                        }}>
                          전체 색상
                        </TableCell>
                      )}
                                             <TableCell sx={{ 
                         backgroundColor: '#f8f9fa', 
                         fontWeight: 'bold',
                         minWidth: 50,
                         borderBottom: '2px solid #1976d2',
                         textAlign: 'center',
                         fontSize: '0.7rem',
                         p: 0.5,
                         borderLeft: '2px solid #ffffff'
                       }}>
                         {inventoryData.reduce((sum, item) => sum + item.inventoryCount, 0)}
                       </TableCell>
                      <TableCell sx={{ 
                        backgroundColor: '#f8f9fa', 
                        fontWeight: 'bold',
                        minWidth: 50,
                        borderBottom: '2px solid #1976d2',
                        textAlign: 'center',
                        fontSize: '0.8rem',
                        p: 0.5
                      }}>
                        {inventoryData.reduce((sum, item) => sum + item.monthlyActivation, 0)}
                      </TableCell>
                    
                                           {/* 일별 총 개통 수량 */}
                      {Array.from({ length: 31 }, (_, i) => {
                        const dayTotal = inventoryData.reduce((sum, item) => sum + (item.dailyActivation[i]?.count || 0), 0);
                        return (
                          <TableCell key={i} align="center" sx={{ 
                            backgroundColor: '#f8f9fa', 
                            fontWeight: 'bold',
                            minWidth: 25,
                            p: 0.25,
                            fontSize: '0.7rem',
                            borderBottom: '2px solid #1976d2',
                            color: dayTotal > 0 ? '#1976d2' : '#666666',
                            borderLeft: i === 0 ? '2px solid #ffffff' : 'none' // 첫 번째 일별 컬럼에 하얀 구분선 추가
                          }}>
                            {dayTotal}
                          </TableCell>
                        );
                      })}
                   </TableRow>
                  
                                     {/* 요일 행 (중간) */}
                   <TableRow sx={{ backgroundColor: '#ffffff' }}>
                                                                  <TableCell sx={{ 
                         backgroundColor: '#ffffff', 
                         fontWeight: 'bold',
                         minWidth: 35,
                         borderBottom: '1px solid #e0e0e0',
                         fontSize: '0.7rem',
                         p: 0.25
                       }}>
                         
                       </TableCell>
                                                                  <TableCell sx={{ 
                         backgroundColor: '#ffffff', 
                         fontWeight: 'bold',
                         minWidth: 80,
                         borderBottom: '1px solid #e0e0e0',
                         fontSize: '0.7rem',
                         p: 0.25
                       }}>
                         
                       </TableCell>
                    {activeTab === 1 && (
                      <TableCell sx={{ 
                        backgroundColor: '#ffffff', 
                        fontWeight: 'bold',
                        minWidth: 80,
                        borderBottom: '1px solid #e0e0e0',
                        fontSize: '0.8rem',
                        p: 0.5
                      }}>
                         
                      </TableCell>
                    )}
                     <TableCell sx={{ 
                       backgroundColor: '#ffffff', 
                       fontWeight: 'bold',
                       minWidth: 50,
                       borderBottom: '1px solid #e0e0e0',
                       fontSize: '0.7rem',
                       p: 0.5,
                       borderLeft: '2px solid #ffffff'
                     }}>
                       
                     </TableCell>
                     <TableCell sx={{ 
                       backgroundColor: '#ffffff', 
                       fontWeight: 'bold',
                       minWidth: 50,
                       borderBottom: '1px solid #e0e0e0',
                       fontSize: '0.7rem',
                       p: 0.5
                     }}>
                       
                     </TableCell>
                    
                                                               {/* 일별 요일 표시 */}
                      {Array.from({ length: 31 }, (_, i) => {
                        // 당월 1일의 요일을 기준으로 계산
                        const currentDate = new Date();
                        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                        const firstDayOfWeek = firstDayOfMonth.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
                        
                        const dayOfWeek = (firstDayOfWeek + i) % 7; // 1일부터 시작하는 요일 계산
                        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                        const dayName = dayNames[dayOfWeek];
                        
                        let dayColor = '#666666'; // 기본 회색
                        if (dayName === '토') dayColor = '#1976d2'; // 토요일 파랑
                        if (dayName === '일') dayColor = '#d32f2f'; // 일요일 빨강
                        
                        return (
                          <TableCell key={i} align="center" sx={{ 
                            backgroundColor: '#ffffff', 
                            fontWeight: 'bold',
                            minWidth: 25,
                            p: 0.25,
                            fontSize: '0.7rem',
                            borderBottom: '1px solid #e0e0e0',
                            color: dayColor,
                            borderLeft: i === 0 ? '2px solid #ffffff' : 'none' // 첫 번째 일별 컬럼에 하얀 구분선 추가
                          }}>
                            {dayName}
                          </TableCell>
                        );
                      })}
                   </TableRow>
                  
                                     {/* 컬럼 헤더 행 (맨 아래) */}
                   <TableRow sx={{ backgroundColor: '#1976d2' }}>
                                                                  <TableCell sx={{ 
                         backgroundColor: '#1976d2', 
                         color: 'white', 
                         fontWeight: 'bold',
                         minWidth: 35,
                         borderRight: '1px solid #1565c0',
                         fontSize: '0.7rem',
                         p: 0.25,
                         textAlign: 'center'
                       }}>
                         구분
                       </TableCell>
                                                                                           <TableCell sx={{ 
                           backgroundColor: '#1976d2', 
                           color: 'white', 
                           fontWeight: 'bold',
                           minWidth: 80,
                           borderRight: '2px solid #ffffff',
                           fontSize: '0.7rem',
                           p: 0.25,
                           textAlign: 'center'
                         }}>
                           모델명
                         </TableCell>
                                           {activeTab === 1 && (
                        <TableCell sx={{ 
                          backgroundColor: '#1976d2', 
                          color: 'white', 
                          fontWeight: 'bold',
                          minWidth: 80,
                          borderRight: '1px solid #1565c0',
                          fontSize: '0.8rem',
                          p: 0.5,
                          textAlign: 'center'
                        }}>
                          색상
                        </TableCell>
                      )}
                                           <TableCell sx={{ 
                        backgroundColor: '#1976d2', 
                        color: 'white', 
                        fontWeight: 'bold',
                        minWidth: 50,
                        borderRight: '1px solid #1565c0',
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        p: 0.5,
                        borderLeft: '2px solid #ffffff'
                      }}>
                        잔여<br/>재고
                      </TableCell>
                                           <TableCell sx={{ 
                        backgroundColor: '#1976d2', 
                        color: 'white', 
                        fontWeight: 'bold',
                        minWidth: 50,
                        borderRight: '2px solid #ffffff',
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        p: 0.5
                      }}>
                        당월<br/>개통
                      </TableCell>
                     
                                           {/* 일별 컬럼 헤더 */}
                      {Array.from({ length: 31 }, (_, i) => (
                        <TableCell key={i} align="center" sx={{ 
                          backgroundColor: '#1976d2', 
                          color: 'white', 
                          fontWeight: 'bold',
                          minWidth: 25,
                          p: 0.25,
                          fontSize: '0.7rem',
                          borderRight: i < 30 ? '1px solid #1565c0' : 'none',
                          borderLeft: i === 0 ? '2px solid #ffffff' : 'none' // 첫 번째 일별 컬럼에 하얀 구분선 추가
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </TableCell>
                      ))}
                   </TableRow>
                </TableHead>
                              <TableBody>
                                  {inventoryData.map((item, index) => {
                                         // 구분별 배경색 결정
                     const getRowBackgroundColor = (category) => {
                       if (category === '삼성') return '#e3f2fd'; // 연한 파랑
                       if (category === '애플') return '#e8f5e8'; // 연한 연두
                       if (category === '2ND') return '#fff8e1'; // 연한 노랑
                       if (category === '기타') return '#f3e5f5'; // 연한 보라
                       return '#ffffff'; // 흰색 (기본)
                     };
                    
                    return (
                                             <TableRow 
                         key={index}
                         sx={{ 
                           backgroundColor: getRowBackgroundColor(item.category),
                           borderBottom: '1px solid #f0f0f0',
                           '&:hover': { 
                             backgroundColor: '#f5f9ff',
                             boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)'
                           }
                         }}
                       >
                                                                                             <TableCell sx={{ 
                           minWidth: 35,
                           borderRight: '1px solid #f0f0f0',
                           p: 0.25,
                           fontSize: '0.7rem'
                         }}>
                           <Chip 
                             label={item.category || '기타'} 
                             size="small"
                             sx={{
                               backgroundColor: item.category === '삼성' ? '#bbdefb' : 
                                               item.category === '애플' ? '#c8e6c9' :
                                               item.category === '2ND' ? '#fff59d' :
                                               item.category === '기타' ? '#e1bee7' : '#f5f5f5',
                               color: item.category === '삼성' ? '#1565c0' : 
                                      item.category === '애플' ? '#2e7d32' :
                                      item.category === '2ND' ? '#f57f17' :
                                      item.category === '기타' ? '#7b1fa2' : '#666666',
                               fontWeight: 'bold',
                               fontSize: '0.6rem'
                             }}
                           />
                         </TableCell>
                                                                                                                                                                                                                                                                                                                                                                                                           <TableCell sx={{ 
                              minWidth: 80, 
                              fontWeight: 'medium',
                              borderRight: '2px solid #ffffff',
                              color: '#333333',
                              p: 0.25,
                              fontSize: '0.7rem',
                              verticalAlign: 'top',
                              ...(activeTab === 1 && !item.isFirstInGroup && {
                                borderTop: 'none',
                                paddingTop: 0,
                                paddingBottom: 0
                              })
                            }}>
                              {activeTab === 1 && !item.isFirstInGroup ? '' : item.modelName}
                            </TableCell>
                      {activeTab === 1 && (
                        <TableCell sx={{ 
                          minWidth: 80,
                          borderRight: '1px solid #f0f0f0',
                          color: '#666666',
                          p: 0.5,
                          fontSize: '0.8rem'
                        }}>
                          {item.color}
                        </TableCell>
                      )}
                                                                                                               <TableCell sx={{ 
                           minWidth: 50, 
                           fontWeight: 'bold',
                           textAlign: 'center',
                           borderRight: '1px solid #f0f0f0',
                           p: 0.5,
                           fontSize: '0.7rem',
                           borderLeft: '2px solid #ffffff',
                           ...getQuantityColor(item.inventoryCount, 'inventory')
                         }}>
                           {item.inventoryCount}
                         </TableCell>
                                                 <TableCell sx={{ 
                           minWidth: 50,
                           fontWeight: item.monthlyActivation > 0 ? 'bold' : 'normal',
                           borderRight: '2px solid #ffffff',
                           textAlign: 'center',
                           p: 0.5,
                           fontSize: '0.8rem',
                           ...getQuantityColor(item.monthlyActivation, 'monthly')
                         }}>
                           {item.monthlyActivation}
                         </TableCell>
                     
                                          {/* 일별 개통 현황 */}
                      {renderDailyActivation(item.dailyActivation)}
                    </TableRow>
                  );
                })}
               </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
};

export default InventoryStatusScreen; 