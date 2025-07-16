import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Store as StoreIcon,
  People as PeopleIcon,
  ColorLens as ColorLensIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

function AgentDetailScreen({ agentName, onBack, loggedInStore }) {
  const [agentData, setAgentData] = useState(null);
  const [customerList, setCustomerList] = useState([]);
  const [modelColorData, setModelColorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // 담당자별 상세 데이터 로드
  const loadAgentDetailData = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. 판매처별정리 데이터에서 해당 담당자 정보 추출
      const salesResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/sales-by-store/data`);
      if (!salesResponse.ok) {
        throw new Error('판매처별정리 데이터를 불러올 수 없습니다.');
      }
      
      const salesResult = await salesResponse.json();
      if (!salesResult.success) {
        throw new Error(salesResult.message || '판매처별정리 데이터 로드에 실패했습니다.');
      }

      const agentData = salesResult.data.byAgent[agentName] || {};
      setAgentData(agentData);

      // 2. 담당자별 고객 리스트 로드
      const customerResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-sales/customer-list/by-agent/${encodeURIComponent(agentName)}`);
      if (customerResponse.ok) {
        const customerResult = await customerResponse.json();
        if (customerResult.success) {
          setCustomerList(customerResult.data);
        }
      }

      // 3. 담당자별 모델/색상 데이터 로드
      const modelColorResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/reservation-sales/model-color/by-agent/${encodeURIComponent(agentName)}`);
      if (modelColorResponse.ok) {
        const modelColorResult = await modelColorResponse.json();
        if (modelColorResult.success) {
          setModelColorData(modelColorResult.data);
        }
      }

    } catch (error) {
      console.error('담당자 상세 데이터 로드 오류:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (agentName) {
      loadAgentDetailData();
    }
  }, [agentName]);

  // 모델/색상별 피벗테이블 데이터 준비
  const prepareModelColorPivotData = () => {
    const pivotData = {};
    
    modelColorData.forEach(item => {
      const model = item.model || '미지정';
      const color = item.color || '미지정';
      const key = `${model}|${color}`;
      
      if (!pivotData[key]) {
        pivotData[key] = {
          model,
          color,
          count: 0,
          items: []
        };
      }
      
      pivotData[key].count++;
      pivotData[key].items.push(item);
    });
    
    return Object.values(pivotData).sort((a, b) => b.count - a.count);
  };

  // 차트 데이터 준비
  const prepareChartData = () => {
    const pivotData = prepareModelColorPivotData();
    return pivotData.slice(0, 10); // 상위 10개만 차트에 표시
  };

  // 엑셀 다운로드
  const downloadAgentDetailExcel = async () => {
    setDownloadingExcel(true);

    try {
      const XLSX = await import('xlsx');
      
      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      
      // 1. 담당자별 매장 현황 시트
      if (agentData) {
        const storeData = Object.entries(agentData).map(([posName, posData]) => ({
          'POS명': posName,
          '서류접수': posData.received,
          '서류미접수': posData.notReceived,
          '총건수': posData.total
        }));
        
        const storeWorksheet = XLSX.utils.json_to_sheet(storeData);
        XLSX.utils.book_append_sheet(workbook, storeWorksheet, '매장현황');
      }
      
      // 2. 고객 리스트 시트
      if (customerList.length > 0) {
        const customerData = customerList.map((customer, index) => ({
          '순번': index + 1,
          '예약번호': customer.reservationNumber || '',
          '고객명': customer.customerName || '',
          '예약일시': customer.reservationDateTime || '',
          '접수일시': customer.receivedDateTime || '',
          '모델': customer.model || '',
          '색상': customer.color || '',
          'POS명': customer.posName || '',
          '예약메모': customer.reservationMemo || '',
          '접수메모': customer.receivedMemo || ''
        }));
        
        const customerWorksheet = XLSX.utils.json_to_sheet(customerData);
        XLSX.utils.book_append_sheet(workbook, customerWorksheet, '고객리스트');
      }
      
      // 3. 모델/색상별 피벗테이블 시트
      if (modelColorData.length > 0) {
        const pivotData = prepareModelColorPivotData();
        const pivotExcelData = pivotData.map((item, index) => ({
          '순번': index + 1,
          '모델': item.model,
          '색상': item.color,
          '건수': item.count
        }));
        
        const pivotWorksheet = XLSX.utils.json_to_sheet(pivotExcelData);
        XLSX.utils.book_append_sheet(workbook, pivotWorksheet, '모델색상별정리');
      }
      
      // 파일 다운로드
      const fileName = `${agentName}_담당자상세_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
    } finally {
      setDownloadingExcel(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={onBack}>
          뒤로가기
        </Button>
      </Container>
    );
  }

  const totalItems = Object.values(agentData || {}).reduce((sum, posData) => sum + posData.total, 0);
  const totalReceived = Object.values(agentData || {}).reduce((sum, posData) => sum + posData.received, 0);
  const completionRate = totalItems > 0 ? Math.round((totalReceived / totalItems) * 100) : 0;
  const totalStores = Object.keys(agentData || {}).length;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ mr: 2 }}
        >
          뒤로가기
        </Button>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#ff9a9e' }}>
          {agentName} 담당자 상세
        </Typography>
      </Box>

      {/* 통계 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {totalItems}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    총 건수
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {totalReceived}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    서류접수 완료
                  </Typography>
                </Box>
                <StoreIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {totalStores}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    담당 매장 수
                  </Typography>
                </Box>
                <StoreIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
            color: 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {completionRate}%
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    완료율
                  </Typography>
                </Box>
                <ColorLensIcon sx={{ fontSize: 40, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 액션 버튼 */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={downloadAgentDetailExcel}
          disabled={downloadingExcel}
          sx={{ 
            backgroundColor: '#ff9a9e',
            '&:hover': { backgroundColor: '#ff8a8e' }
          }}
        >
          {downloadingExcel ? <CircularProgress size={20} /> : '전체 데이터 다운로드'}
        </Button>
      </Box>

      {/* 탭 네비게이션 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Tabs 
            value={currentTab} 
            onChange={(event, newValue) => setCurrentTab(newValue)}
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '1rem',
                fontWeight: 500
              }
            }}
          >
            <Tab 
              label="매장별 현황" 
              icon={<StoreIcon />} 
              iconPosition="start"
              sx={{ 
                minHeight: 64,
                '&.Mui-selected': {
                  color: '#ff9a9e'
                }
              }}
            />
            <Tab 
              label="고객 리스트" 
              icon={<PeopleIcon />} 
              iconPosition="start"
              sx={{ 
                minHeight: 64,
                '&.Mui-selected': {
                  color: '#ff9a9e'
                }
              }}
            />
            <Tab 
              label="모델/색상별 정리" 
              icon={<ColorLensIcon />} 
              iconPosition="start"
              sx={{ 
                minHeight: 64,
                '&.Mui-selected': {
                  color: '#ff9a9e'
                }
              }}
            />
          </Tabs>
        </CardContent>
      </Card>

      {/* 탭 내용 */}
      {currentTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              매장별 현황
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="60px" align="center">랭크</TableCell>
                    <TableCell width="200px">POS명</TableCell>
                    <TableCell width="120px" align="center">서류접수</TableCell>
                    <TableCell width="120px" align="center">서류미접수</TableCell>
                    <TableCell width="100px" align="center">합계</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(agentData || {})
                    .map(([posName, posData]) => ({
                      posName,
                      posData,
                      total: posData.total
                    }))
                    .sort((a, b) => b.total - a.total)
                    .map(({ posName, posData }, index) => (
                    <TableRow key={posName} hover>
                      <TableCell align="center">
                        <Chip
                          label={index + 1}
                          size="small"
                          color={index < 3 ? 'primary' : 'default'}
                          sx={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 'bold',
                            backgroundColor: index < 3 ? '#ff9a9e' : undefined,
                            color: index < 3 ? 'white' : undefined
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={posName || '-'}
                          color="primary"
                          size="small"
                          icon={<StoreIcon />}
                          sx={{ fontSize: '0.8rem' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.received}
                          color="success"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.notReceived}
                          color="warning"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={posData.total}
                          color="primary"
                          size="small"
                          sx={{ fontSize: '0.8rem', minWidth: 40, fontWeight: 'bold' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {currentTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              고객 리스트 ({customerList.length}명)
            </Typography>
            
            {customerList.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="80px">순번</TableCell>
                      <TableCell width="120px">예약번호</TableCell>
                      <TableCell width="100px">고객명</TableCell>
                      <TableCell width="120px">예약일시</TableCell>
                      <TableCell width="120px">접수일시</TableCell>
                      <TableCell width="150px">모델&색상</TableCell>
                      <TableCell width="100px">POS명</TableCell>
                      <TableCell width="200px">예약메모</TableCell>
                      <TableCell width="200px">접수메모</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customerList.map((customer, index) => (
                      <TableRow key={customer.reservationNumber} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.customerName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationDateTime}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.receivedDateTime || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${customer.model || '-'} / ${customer.color || '-'}`}
                            color="primary"
                            size="small"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.posName || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.reservationMemo || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {customer.receivedMemo || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">
                고객 리스트 데이터가 없습니다.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {currentTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e', fontWeight: 'bold' }}>
              모델/색상별 정리 (피벗테이블)
            </Typography>
            
            {modelColorData.length > 0 ? (
              <>
                {/* 피벗테이블 */}
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width="60px" align="center">랭크</TableCell>
                        <TableCell width="200px">모델</TableCell>
                        <TableCell width="150px">색상</TableCell>
                        <TableCell width="100px" align="center">건수</TableCell>
                        <TableCell width="100px" align="center">비율</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {prepareModelColorPivotData().map((item, index) => {
                        const percentage = modelColorData.length > 0 
                          ? Math.round((item.count / modelColorData.length) * 100) 
                          : 0;
                        
                        return (
                          <TableRow key={`${item.model}-${item.color}`} hover>
                            <TableCell align="center">
                              <Chip
                                label={index + 1}
                                size="small"
                                color={index < 3 ? 'primary' : 'default'}
                                sx={{ 
                                  fontSize: '0.7rem', 
                                  fontWeight: 'bold',
                                  backgroundColor: index < 3 ? '#ff9a9e' : undefined,
                                  color: index < 3 ? 'white' : undefined
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {item.model}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={item.color}
                                color="secondary"
                                size="small"
                                sx={{ fontSize: '0.8rem' }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={item.count}
                                color="primary"
                                size="small"
                                sx={{ fontSize: '0.8rem', minWidth: 40, fontWeight: 'bold' }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={`${percentage}%`}
                                color="info"
                                size="small"
                                sx={{ fontSize: '0.8rem', minWidth: 40 }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* 차트 */}
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e' }}>
                          모델/색상별 분포 (상위 10개)
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={prepareChartData()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="model" angle={-45} textAnchor="end" height={80} />
                            <YAxis />
                            <RechartsTooltip />
                            <Bar dataKey="count" fill="#ff9a9e" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 2, color: '#ff9a9e' }}>
                          색상별 분포
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={prepareChartData().map(item => ({
                                name: item.color,
                                value: item.count,
                                fill: `hsl(${Math.random() * 360}, 70%, 60%)`
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {prepareChartData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 36}, 70%, 60%)`} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </>
            ) : (
              <Alert severity="info">
                모델/색상별 데이터가 없습니다.
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

export default AgentDetailScreen; 