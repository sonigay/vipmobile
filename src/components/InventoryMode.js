import React, { useState, useEffect, useCallback, Suspense, lazy, useRef, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  AlertTitle,
  Chip,
  Grid,
  Card,
  CardContent,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Skeleton,
  Container
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Store as StoreIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Help as HelpIcon,
  SimCard as SimCardIcon,
  PhoneAndroid as PhoneAndroidIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  PersonAdd as PersonAddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Compare as CompareIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
  Update as UpdateIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

// 지연 로딩 컴포넌트들
const AssignmentSettingsScreen = lazy(() => import('./screens/AssignmentSettingsScreen'));
const AppUpdatePopup = lazy(() => import('./AppUpdatePopup'));

// 폰클입고가상이값 컴포넌트
const PriceDiscrepancyTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchPriceDiscrepancies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/price-discrepancies`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('입고가 상이값 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPriceDiscrepancies();
    setLastUpdate(new Date());

    // 1시간마다 자동 새로고침
    const interval = setInterval(() => {
      fetchPriceDiscrepancies();
      setLastUpdate(new Date());
    }, 3600000);

    return () => clearInterval(interval);
  }, [fetchPriceDiscrepancies]);

  // 엑셀 다운로드 함수 - useCallback으로 메모이제이션
  const handleExcelDownload = useCallback(() => {
    if (!data || !data.discrepancies) return;

    const csvData = [
      ['시트명', '모델명', '입고가', '추천입고가', '신뢰도(%)', '출고처', '일련번호', '처리일', '작업자']
    ];

    data.discrepancies.forEach(discrepancy => {
      discrepancy.items.forEach(item => {
        csvData.push([
          item.sheetName,
          item.modelName,
          item.inPrice,
          discrepancy.recommendedPrice,
          discrepancy.confidence,
          item.outStore,
          item.serial,
          item.processDate,
          item.employee
        ]);
      });
    });

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `입고가상이값_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [data]);

  // 신뢰도에 따른 색상 결정 - useCallback으로 메모이제이션
  const getConfidenceColor = useCallback((confidence) => {
    if (confidence >= 90) return 'success';
    if (confidence >= 70) return 'warning';
    return 'error';
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#FF9800' }}>
          💰 폰클입고가상이값 검사
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              마지막 업데이트: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          <Button
            variant="outlined"
            onClick={fetchPriceDiscrepancies}
            disabled={loading}
            startIcon={<RefreshIcon />}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 로딩 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* 콘텐츠 */}
      {!loading && data && (
        <PriceDiscrepancyContent
          data={data}
          onExcelDownload={handleExcelDownload}
          getConfidenceColor={getConfidenceColor}
        />
      )}
    </Box>
  );
};

// 입고가 상이값 콘텐츠 컴포넌트 - React.memo로 메모이제이션
const PriceDiscrepancyContent = memo(({ data, onExcelDownload, getConfidenceColor }) => {
  // 평균 신뢰도 계산 - Hooks는 early return 이전에 호출
  const avgConfidence = data?.discrepancies?.length > 0
    ? (data.discrepancies.reduce((sum, d) => sum + d.confidence, 0) / data.discrepancies.length).toFixed(1)
    : 0;

  if (!data) {
    return (
      <Alert severity="info">
        데이터를 불러오는 중입니다...
      </Alert>
    );
  }

  if (data.discrepancies.length === 0) {
    return (
      <Alert severity="success" sx={{ fontSize: '1.1rem', py: 2 }}>
        🎉 입고가 상이값이 없습니다! 모든 데이터가 정상입니다.
      </Alert>
    );
  }

  return (
    <Box>
      {/* 통계 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#FFF3E0' }}>
            <Typography variant="h4" color="#FF9800" fontWeight="bold">
              {data.totalDiscrepancies}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              상이값이 있는 모델명 수
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#FFEBEE' }}>
            <Typography variant="h4" color="error" fontWeight="bold">
              {data.totalItems}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              총 상이값 항목 수
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#E8F5E9' }}>
            <Typography variant="h4" color="success.main" fontWeight="bold">
              {avgConfidence}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              평균 신뢰도
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* 엑셀 다운로드 버튼 */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<UpdateIcon />}
          onClick={onExcelDownload}
        >
          엑셀 다운로드
        </Button>
      </Box>

      {/* 상이값 그룹 목록 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔍 모델명별 입고가 상이값 상세
          </Typography>
          {data.discrepancies.map((discrepancy, index) => (
            <Accordion key={index} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', flexWrap: 'wrap' }}>
                  <Typography variant="body1" fontWeight="bold" sx={{ minWidth: 200 }}>
                    {discrepancy.modelName}
                  </Typography>
                  <Chip
                    label={`추천: ${Number(discrepancy.recommendedPrice).toLocaleString()}원`}
                    color="primary"
                    size="small"
                  />
                  <Chip
                    label={`신뢰도: ${discrepancy.confidence}%`}
                    color={getConfidenceColor(discrepancy.confidence)}
                    size="small"
                  />
                  <Chip
                    label={`${discrepancy.items.length}개 항목`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {/* 입고가 분포 */}
                <Box sx={{ mb: 2, p: 2, backgroundColor: '#F5F5F5', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    입고가 분포:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {discrepancy.priceBreakdown.map((breakdown, idx) => (
                      <Chip
                        key={idx}
                        label={`${Number(breakdown.price).toLocaleString()}원 (${breakdown.count}건)`}
                        color={breakdown.price === discrepancy.recommendedPrice ? 'success' : 'default'}
                        variant={breakdown.price === discrepancy.recommendedPrice ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </Box>

                {/* 상세 항목 테이블 */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>시트명</TableCell>
                        <TableCell>모델명</TableCell>
                        <TableCell>입고가</TableCell>
                        <TableCell>출고처</TableCell>
                        <TableCell>일련번호</TableCell>
                        <TableCell>처리일</TableCell>
                        <TableCell>작업자</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {discrepancy.items.map((item, itemIndex) => {
                        const normalizedPrice = item.inPrice.replace(/[,\s]/g, '');
                        const isWrongPrice = normalizedPrice !== discrepancy.recommendedPrice;

                        return (
                          <TableRow
                            key={itemIndex}
                            sx={{
                              backgroundColor: isWrongPrice ? '#FFEBEE' : 'transparent'
                            }}
                          >
                            <TableCell>
                              <Chip
                                label={item.sheetName}
                                size="small"
                                color={item.sheetName === '폰클재고데이터' ? 'secondary' : 'primary'}
                              />
                            </TableCell>
                            <TableCell>{item.modelName}</TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: isWrongPrice ? 'error.main' : 'inherit',
                                  fontWeight: isWrongPrice ? 'bold' : 'normal'
                                }}
                              >
                                {Number(item.inPrice.replace(/[,\s]/g, '')).toLocaleString()}원
                                {isWrongPrice && ' ⚠️'}
                              </Typography>
                            </TableCell>
                            <TableCell>{item.outStore || '-'}</TableCell>
                            <TableCell>{item.serial || '-'}</TableCell>
                            <TableCell>{item.processDate || '-'}</TableCell>
                            <TableCell>{item.employee || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
});

// 폰클중복값 컴포넌트
const PhoneDuplicateTab = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [phoneData, setPhoneData] = useState(null);
  const [simData, setSimData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchPhoneDuplicates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/phone-duplicates`);
      const result = await response.json();
      if (result.success) {
        setPhoneData(result.data);
      }
    } catch (error) {
      console.error('휴대폰 중복값 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSimDuplicates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/sim-duplicates`);
      const result = await response.json();
      if (result.success) {
        setSimData(result.data);
      }
    } catch (error) {
      console.error('유심 중복값 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (newValue === 0) {
      fetchPhoneDuplicates();
    } else {
      fetchSimDuplicates();
    }
  };

  useEffect(() => {
    fetchPhoneDuplicates();
    setLastUpdate(new Date());

    // 1시간마다 자동 새로고침
    const interval = setInterval(() => {
      if (activeTab === 0) {
        fetchPhoneDuplicates();
      } else {
        fetchSimDuplicates();
      }
      setLastUpdate(new Date());
    }, 3600000);

    return () => clearInterval(interval);
  }, [activeTab]);

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#1976D2' }}>
          📱 폰클중복값 검사
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              마지막 업데이트: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          <Button
            variant="outlined"
            onClick={activeTab === 0 ? fetchPhoneDuplicates : fetchSimDuplicates}
            disabled={loading}
            startIcon={<RefreshIcon />}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 탭 네비게이션 */}
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab
          label={`휴대폰 중복값 ${phoneData ? `(${phoneData.duplicates.length}개 그룹)` : ''}`}
          icon={<PhoneAndroidIcon />}
          iconPosition="start"
        />
        <Tab
          label={`유심 중복값 ${simData ? `(${simData.duplicates.length}개 그룹)` : ''}`}
          icon={<SimCardIcon />}
          iconPosition="start"
        />
      </Tabs>

      {/* 콘텐츠 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && activeTab === 0 && (
        <PhoneDuplicateContent data={phoneData} type="휴대폰" />
      )}

      {!loading && activeTab === 1 && (
        <PhoneDuplicateContent data={simData} type="유심" />
      )}
    </Box>
  );
};

// 중복값 콘텐츠 컴포넌트
const PhoneDuplicateContent = ({ data, type }) => {
  if (!data) {
    return (
      <Alert severity="info">
        데이터를 불러오는 중입니다...
      </Alert>
    );
  }

  if (data.duplicates.length === 0) {
    return (
      <Alert severity="success" sx={{ fontSize: '1.1rem', py: 2 }}>
        🎉 {type} 중복값이 없습니다! 모든 데이터가 정상입니다.
      </Alert>
    );
  }

  // 등록직원 빈도순 정렬
  const sortedEmployees = data.employeeFrequency
    ? Object.entries(data.employeeFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // 상위 5명
    : [];

  return (
    <Box>
      {/* 통계 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#ffebee' }}>
            <Typography variant="h4" color="error" fontWeight="bold">
              {data.duplicates.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              중복 그룹 수
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#ffebee' }}>
            <Typography variant="h4" color="error" fontWeight="bold">
              {data.totalDuplicates}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              총 중복 항목 수
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff3e0' }}>
            <Typography variant="h4" color="warning.main" fontWeight="bold">
              {sortedEmployees.length > 0 ? sortedEmployees[0][1] : 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              최다 중복 등록자
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* 주의 직원 목록 */}
      {sortedEmployees.length > 0 && (
        <Card sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom color="warning.main">
            ⚠️ 중복 등록 빈도가 높은 직원 (상위 5명)
          </Typography>
          <Grid container spacing={1}>
            {sortedEmployees.map(([employee, count]) => (
              <Grid item key={employee}>
                <Chip
                  label={`${employee}: ${count}회`}
                  color={count > 10 ? 'error' : count > 5 ? 'warning' : 'default'}
                  variant="outlined"
                />
              </Grid>
            ))}
          </Grid>
        </Card>
      )}

      {/* 중복 그룹 목록 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🔍 {type} 중복 그룹 상세
          </Typography>
          {data.duplicates.map((duplicate, index) => (
            <Accordion key={index} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Chip
                    label={`${duplicate.count}개 중복`}
                    color="error"
                    size="small"
                  />
                  <Typography variant="body1" fontWeight="bold">
                    {duplicate.key}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>타입</TableCell>
                        <TableCell>업체명</TableCell>
                        <TableCell>등록직원</TableCell>
                        {type === '휴대폰' && <TableCell>모델명</TableCell>}
                        {type === '휴대폰' && <TableCell>색상</TableCell>}
                        <TableCell>일련번호</TableCell>
                        <TableCell>입고처</TableCell>
                        <TableCell>출고일</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {duplicate.items.map((item, itemIndex) => (
                        <TableRow key={itemIndex}>
                          <TableCell>
                            <Chip
                              label={item.type}
                              size="small"
                              color={item.type === '개통' ? 'primary' : 'secondary'}
                            />
                          </TableCell>
                          <TableCell>{item.store}</TableCell>
                          <TableCell>
                            <Chip
                              label={item.employee || '미등록'}
                              size="small"
                              color={(data.employeeFrequency && data.employeeFrequency[item.employee] > 5) ? 'error' : 'default'}
                            />
                          </TableCell>
                          {type === '휴대폰' && <TableCell>{item.model}</TableCell>}
                          {type === '휴대폰' && <TableCell>{item.color}</TableCell>}
                          <TableCell>{item.serial}</TableCell>
                          <TableCell>{item.inputStore}</TableCell>
                          <TableCell>{item.outputDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
};

// 마스터재고검수 탭 컴포넌트
const MasterInventoryTab = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [wirelessData, setWirelessData] = useState(null);
  const [simData, setSimData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // 새로고침 트리거

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1); // 트리거 값 증가로 자식 컴포넌트 새로고침
    setLastUpdate(new Date());
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  useEffect(() => {
    setLastUpdate(new Date());
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#7B1FA2' }}>
          📦 마스터재고검수
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              마지막 업데이트: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          <Button
            variant="outlined"
            onClick={handleRefresh}
            disabled={loading}
            startIcon={<RefreshIcon />}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 서브 탭 네비게이션 */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            fontSize: '1rem',
            fontWeight: 'medium',
            color: '#666',
            '&.Mui-selected': {
              color: '#7B1FA2',
              fontWeight: 'bold'
            }
          },
          '& .MuiTabs-indicator': {
            backgroundColor: '#7B1FA2'
          }
        }}
      >
        <Tab
          label="무선단말검수"
          icon={<PhoneAndroidIcon />}
          iconPosition="start"
          sx={{ textTransform: 'none' }}
        />
        <Tab
          label="유심검수"
          icon={<SimCardIcon />}
          iconPosition="start"
          sx={{ textTransform: 'none' }}
        />
      </Tabs>

      {/* 콘텐츠 */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {activeTab === 0 && (
        <WirelessInventoryContent data={wirelessData} refreshTrigger={refreshTrigger} />
      )}

      {activeTab === 1 && (
        <SimInventoryContent data={simData} refreshTrigger={refreshTrigger} />
      )}
    </Box>
  );
};

// 무선단말검수 콘텐츠 컴포넌트
const WirelessInventoryContent = ({ data, refreshTrigger }) => {
  const [inspectionData, setInspectionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('inspection'); // 'inspection' or 'normalization'
  const [selectedItems, setSelectedItems] = useState([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmNote, setConfirmNote] = useState('');
  const [normalizationMap, setNormalizationMap] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmedData, setConfirmedData] = useState([]);
  const [confirmedLoading, setConfirmedLoading] = useState(false);

  // debounce를 위한 ref
  const debounceRef = useRef(null);

  // 재고 검수 데이터 로드 (캐시 무시 옵션 추가)
  const loadInspectionData = useCallback(async (noCache = false) => {
    try {
      setLoading(true);
      // 캐시 무시를 위해 타임스탬프 쿼리 파라미터 추가
      const url = `${process.env.REACT_APP_API_URL}/api/inventory-inspection${noCache ? `?t=${Date.now()}` : ''}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const result = await response.json();

      if (result.success) {
        setInspectionData(result.data);
        setNormalizationMap(result.data.normalizationMap || {});
      } else {
        setSnackbar({ open: true, message: '데이터 로드 실패', severity: 'error' });
      }
    } catch (error) {
      console.error('검수 데이터 로드 오류:', error);
      setSnackbar({ open: true, message: '데이터 로드 중 오류 발생', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  // 확인된 재고 데이터 로드
  const loadConfirmedData = useCallback(async () => {
    try {
      setConfirmedLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/confirmed-unconfirmed-inventory?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const result = await response.json();

      if (result.success) {
        setConfirmedData(result.data);
      } else {
        setSnackbar({ open: true, message: '확인된 재고 데이터 로드 실패', severity: 'error' });
      }
    } catch (error) {
      console.error('확인된 재고 데이터 로드 오류:', error);
      setSnackbar({ open: true, message: '확인된 재고 데이터 로드 중 오류 발생', severity: 'error' });
    } finally {
      setConfirmedLoading(false);
    }
  }, []);

  // 초기 로드 및 새로고침 트리거 감지
  useEffect(() => {
    loadInspectionData(refreshTrigger > 0); // 새로고침 시 캐시 무시
  }, [refreshTrigger, loadInspectionData]);

  // 확인된 재고 탭이 활성화될 때 데이터 로드
  useEffect(() => {
    if (activeView === 'confirmed') {
      loadConfirmedData();
    }
  }, [activeView, loadConfirmedData]);

  // 선택 항목 토글
  const handleToggleItem = (item) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.serialNumber === item.serialNumber);
      if (exists) {
        return prev.filter(i => i.serialNumber !== item.serialNumber);
      } else {
        return [...prev, item];
      }
    });
  };

  // 전체 선택/해제
  const handleToggleAll = () => {
    if (selectedItems.length === inspectionData?.unmatched?.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...(inspectionData?.unmatched || [])]);
    }
  };

  // 확인된미확인재고로 이동
  const handleMoveToConfirmed = async () => {
    if (selectedItems.length === 0) {
      setSnackbar({ open: true, message: '선택된 항목이 없습니다', severity: 'warning' });
      return;
    }

    try {
      const items = selectedItems.map(item => ({
        outletCode: item.outletCode,
        inPrice: '', // 폰클재고에 없으므로 비어있음
        modelCode: item.modelCode,
        color: item.color,
        serialNumber: item.serialNumber,
        inDate: item.firstInDate || item.dealerInDate,
        confirmNote: confirmNote,
        status: '완료'
      }));

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/confirmed-unconfirmed-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      const result = await response.json();

      if (result.success) {
        setSnackbar({ open: true, message: `${selectedItems.length}개 항목이 확인처리되었습니다`, severity: 'success' });
        setSelectedItems([]);
        setConfirmNote('');
        setConfirmDialogOpen(false);
        await loadInspectionData(true); // 캐시 무시하고 데이터 새로고침
      } else {
        setSnackbar({ open: true, message: '저장 실패', severity: 'error' });
      }
    } catch (error) {
      console.error('확인처리 오류:', error);
      setSnackbar({ open: true, message: '처리 중 오류 발생', severity: 'error' });
    }
  };

  // debounce된 정규화 맵 업데이트
  const updateNormalizationMap = useCallback((modelCode, value) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setNormalizationMap(prev => ({
        ...prev,
        [modelCode]: value
      }));
    }, 100); // 100ms 지연
  }, []);

  // 모델명 정규화 저장
  const handleSaveNormalization = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/model-normalization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ normalizationMap })
      });

      const result = await response.json();

      if (result.success) {
        setSnackbar({ open: true, message: '모델명 정규화가 저장되었습니다', severity: 'success' });
        await loadInspectionData(true); // 캐시 무시하고 데이터 새로고침
      } else {
        setSnackbar({ open: true, message: '저장 실패', severity: 'error' });
      }
    } catch (error) {
      console.error('정규화 저장 오류:', error);
      setSnackbar({ open: true, message: '저장 중 오류 발생', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!inspectionData) {
    return (
      <Alert severity="info">
        데이터를 불러오는 중입니다...
      </Alert>
    );
  }

  return (
    <Box>
      {/* 뷰 전환 탭 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeView} onChange={(e, v) => setActiveView(v)}>
          <Tab label="재고 검수" value="inspection" />
          <Tab
            label={`모델명 정규화 ${inspectionData.needsNormalization.length > 0 ? `(${inspectionData.needsNormalization.length})` : ''}`}
            value="normalization"
          />
          <Tab
            label={`확인된 재고 ${confirmedData.length > 0 ? `(${confirmedData.length})` : ''}`}
            value="confirmed"
          />
        </Tabs>
      </Box>

      {/* 재고 검수 뷰 */}
      {activeView === 'inspection' && (
        <Box>
          {/* 통계 카드 */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                <Typography variant="h4" color="primary" fontWeight="bold">
                  {inspectionData.statistics.totalCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  전체 재고
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#e8f5e9' }}>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {inspectionData.statistics.matchedCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  일치 (정상)
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#ffebee' }}>
                <Typography variant="h4" color="error" fontWeight="bold">
                  {inspectionData.statistics.unmatchedCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  미확인 재고
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff3e0' }}>
                <Typography variant="h4" color="warning.main" fontWeight="bold">
                  {inspectionData.statistics.confirmedCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  확인된 재고
                </Typography>
              </Card>
            </Grid>
          </Grid>

          {/* 미확인 재고 테이블 */}
          {inspectionData.unmatched.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" color="error">
                    ⚠️ 미확인 재고 ({inspectionData.unmatched.length}개)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<UpdateIcon />}
                      onClick={() => {
                        // 미확인 재고 엑셀 다운로드
                        const csvData = [
                          ['모델코드', '색상', '일련번호', '출고점코드', '최초입고일', '대리점입고일'],
                          ...inspectionData.unmatched.map(item => [
                            item.modelCode,
                            item.color,
                            item.serialNumber,
                            item.outletCode,
                            item.firstInDate,
                            item.dealerInDate
                          ])
                        ];

                        const csvContent = csvData.map(row => row.join(',')).join('\n');
                        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = `미확인재고_${new Date().toISOString().split('T')[0]}.csv`;
                        link.click();
                      }}
                    >
                      엑셀 다운로드
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleToggleAll}
                    >
                      {selectedItems.length === inspectionData.unmatched.length ? '전체 해제' : '전체 선택'}
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      disabled={selectedItems.length === 0}
                      onClick={() => setConfirmDialogOpen(true)}
                    >
                      확인처리 ({selectedItems.length})
                    </Button>
                  </Box>
                </Box>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedItems.length === inspectionData.unmatched.length && inspectionData.unmatched.length > 0}
                            indeterminate={selectedItems.length > 0 && selectedItems.length < inspectionData.unmatched.length}
                            onChange={handleToggleAll}
                          />
                        </TableCell>
                        <TableCell>모델코드</TableCell>
                        <TableCell>색상</TableCell>
                        <TableCell>일련번호</TableCell>
                        <TableCell>출고점코드</TableCell>
                        <TableCell>최초입고일</TableCell>
                        <TableCell>대리점입고일</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inspectionData.unmatched.map((item, index) => (
                        <TableRow key={index} hover>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedItems.some(i => i.serialNumber === item.serialNumber)}
                              onChange={() => handleToggleItem(item)}
                            />
                          </TableCell>
                          <TableCell>{item.modelCode}</TableCell>
                          <TableCell>{item.color}</TableCell>
                          <TableCell>{item.serialNumber}</TableCell>
                          <TableCell>{item.outletCode}</TableCell>
                          <TableCell>{item.firstInDate}</TableCell>
                          <TableCell>{item.dealerInDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* 일치하는 재고 (접을 수 있게) */}
          {inspectionData.matched.length > 0 && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" color="success.main">
                  ✓ 정상 재고 ({inspectionData.matched.length}개)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    정상적으로 일치하는 재고 목록
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UpdateIcon />}
                    onClick={() => {
                      // 엑셀 다운로드 기능
                      const csvData = [
                        ['모델코드', '색상', '일련번호', '출고점코드', '폰클 모델명', '입고가', '입고처', '출고처'],
                        ...inspectionData.matched.map(item => [
                          item.modelCode,
                          item.color,
                          item.serialNumber,
                          item.outletCode,
                          item.phoneklData?.modelName || '',
                          item.phoneklData?.inPrice || '',
                          item.phoneklData?.inStore || '',
                          item.phoneklData?.outStore || ''
                        ])
                      ];

                      const csvContent = csvData.map(row => row.join(',')).join('\n');
                      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `정상재고_${new Date().toISOString().split('T')[0]}.csv`;
                      link.click();
                    }}
                  >
                    엑셀 다운로드
                  </Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>모델코드</TableCell>
                        <TableCell>색상</TableCell>
                        <TableCell>일련번호</TableCell>
                        <TableCell>출고점코드</TableCell>
                        <TableCell>폰클 모델명</TableCell>
                        <TableCell>입고가</TableCell>
                        <TableCell>입고처</TableCell>
                        <TableCell>출고처</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inspectionData.matched.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.modelCode}</TableCell>
                          <TableCell>{item.color}</TableCell>
                          <TableCell>{item.serialNumber}</TableCell>
                          <TableCell>{item.outletCode}</TableCell>
                          <TableCell>{item.phoneklData?.modelName}</TableCell>
                          <TableCell>
                            {item.phoneklData?.inPrice ?
                              Number(item.phoneklData.inPrice).toLocaleString() + '원' :
                              '-'
                            }
                          </TableCell>
                          <TableCell>{item.phoneklData?.inStore || '-'}</TableCell>
                          <TableCell>{item.phoneklData?.outStore || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      )}

      {/* 모델명 정규화 뷰 */}
      {activeView === 'normalization' && (
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  모델명 정규화 관리
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveNormalization}
                  startIcon={<CheckCircleIcon />}
                >
                  저장
                </Button>
              </Box>

              <Alert severity="info" sx={{ mb: 2 }}>
                마스터재고의 모델코드를 표준 모델명으로 정규화하세요. 정규화된 모델명은 검수에 활용됩니다.
              </Alert>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="40%">원본 모델코드</TableCell>
                      <TableCell width="60%">정규화 모델명</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inspectionData.needsNormalization.map((modelCode, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {modelCode}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="정규화된 모델명 입력"
                            defaultValue={normalizationMap[modelCode] || ''}
                            onChange={(e) => updateNormalizationMap(modelCode, e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 확인된 재고 뷰 */}
      {activeView === 'confirmed' && (
        <Box>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" color="warning.main">
                  ✅ 확인된 재고 ({confirmedData.length}개)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UpdateIcon />}
                    onClick={() => {
                      // 확인된 재고 엑셀 다운로드
                      const csvData = [
                        ['모델코드', '색상', '일련번호', '출고점코드', '입고일자', '확인내용', '진행상황'],
                        ...confirmedData.map(item => [
                          item.modelCode,
                          item.color,
                          item.serialNumber,
                          item.outletCode,
                          item.inDate,
                          item.confirmNote || '',
                          item.status || '완료'
                        ])
                      ];

                      const csvContent = csvData.map(row => row.join(',')).join('\n');
                      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `확인된재고_${new Date().toISOString().split('T')[0]}.csv`;
                      link.click();
                    }}
                  >
                    엑셀 다운로드
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      loadConfirmedData();
                      loadInspectionData(true); // 캐시 무시하고 전체 데이터 새로고침
                    }}
                  >
                    새로고침
                  </Button>
                </Box>
              </Box>

              <Alert severity="info" sx={{ mb: 2 }}>
                이미 확인처리된 재고 목록입니다. 이 항목들은 미확인 재고 목록에서 제외됩니다.
              </Alert>

              {confirmedLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : confirmedData.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>모델코드</TableCell>
                        <TableCell>색상</TableCell>
                        <TableCell>일련번호</TableCell>
                        <TableCell>출고점코드</TableCell>
                        <TableCell>입고일자</TableCell>
                        <TableCell>확인내용</TableCell>
                        <TableCell>진행상황</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {confirmedData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.modelCode}</TableCell>
                          <TableCell>{item.color}</TableCell>
                          <TableCell>{item.serialNumber}</TableCell>
                          <TableCell>{item.outletCode}</TableCell>
                          <TableCell>{item.inDate}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.confirmNote || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={item.status || '완료'}
                              color={item.status === '완료' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="success">
                  확인된 재고가 없습니다.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 확인처리 다이얼로그 */}
      {confirmDialogOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setConfirmDialogOpen(false)}
        >
          <Card
            sx={{ width: 500, maxWidth: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                미확인 재고 확인처리
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                선택된 {selectedItems.length}개 항목을 확인처리합니다.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="확인 내용"
                placeholder="확인 사유를 입력하세요"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                sx={{ mt: 2, mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button onClick={() => setConfirmDialogOpen(false)}>
                  취소
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleMoveToConfirmed}
                >
                  확인
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 스낵바 */}
      {snackbar.open && (
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 10000
          }}
        >
          {snackbar.message}
        </Alert>
      )}
    </Box>
  );
};

// 유심검수 콘텐츠 컴포넌트
const SimInventoryContent = ({ data, refreshTrigger }) => {
  // refreshTrigger가 변경되면 로그만 출력 (현재는 개발 중)
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 유심검수 새로고침 요청 (개발 중)');
    }
  }, [refreshTrigger]);

  if (!data) {
    return (
      <Alert severity="info">
        데이터를 불러오는 중입니다...
      </Alert>
    );
  }

  return (
    <Box>
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <SimCardIcon sx={{ fontSize: 80, color: '#7B1FA2', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight="bold">
              유심검수
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              유심 재고를 검수하고 관리합니다.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              현재 개발 중입니다. 곧 새로운 기능으로 찾아뵙겠습니다.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

// 로딩 스켈레톤 컴포넌트
const LoadingSkeleton = () => (
  <Box sx={{ p: 3 }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Skeleton variant="rectangular" height={60} />
      <Skeleton variant="rectangular" height={200} />
      <Skeleton variant="rectangular" height={100} />
    </Box>
  </Box>
);

const InventoryMode = ({
  loggedInStore,
  onLogout,
  onModeChange,
  availableModes
}) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('price-discrepancy');
  const [preloadedScreens, setPreloadedScreens] = useState(new Set());

  // 검색 관련 상태
  const [searchType, setSearchType] = useState('store');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStores, setSelectedStores] = useState([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // 데이터 로딩 로직 (실제 구현 필요)
        setData({});
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 메뉴 핸들러들
  const handleMenuClick = (event, menu) => {
    setAnchorEl(event.currentTarget);
    setSelectedMenu(menu);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMenu(null);
  };

  const handleSubMenuClick = (subMenu) => {
    setCurrentScreen(subMenu);
    handleMenuClose();
  };

  const handleMenuHover = (menu, subMenu) => {
    // 호버 로직
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#2E7D32' }}>
          <Toolbar>
            <InventoryIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              재고 관리 시스템
            </Typography>
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#2E7D32' }}>
          <Toolbar>
            <InventoryIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              재고 관리 시스템
            </Typography>
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Alert severity="error" sx={{ width: '50%' }}>
            <AlertTitle>오류</AlertTitle>
            {error}
          </Alert>
        </Box>
      </Box>
    );
  }

  // 메인 화면 (탭 화면들)
  if (currentScreen === 'price-discrepancy' || currentScreen === 'duplicate' || currentScreen === 'master' || currentScreen === 'assignment') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <AppBar position="static" sx={{ backgroundColor: '#2E7D32' }}>
          <Toolbar>
            <InventoryIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              재고 관리 시스템
            </Typography>

            {/* 업데이트 확인 버튼 */}
            <Button
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={() => setShowUpdatePopup(true)}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              업데이트 확인
            </Button>

            {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
            {onModeChange && availableModes && availableModes.length > 1 && (
              <Button
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={onModeChange}
                sx={{
                  ml: 2,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                모드 변경
              </Button>
            )}

            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>

        {/* 탭 네비게이션 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'white' }}>
          <Container maxWidth={false} sx={{ px: 2 }}>
            <Tabs
              value={currentScreen}
              onChange={(event, newValue) => setCurrentScreen(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                '& .MuiTab-root': {
                  minHeight: 64,
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: '#666',
                  '&.Mui-selected': {
                    color: '#2E7D32',
                    fontWeight: 'bold'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#2E7D32',
                  height: 3
                }
              }}
            >
              <Tab
                label="폰클입고가상이값"
                value="price-discrepancy"
                icon={<CompareIcon />}
                iconPosition="start"
                sx={{
                  textTransform: 'none',
                  minHeight: 64,
                  py: 1
                }}
              />
              <Tab
                label="폰클중복값"
                value="duplicate"
                icon={<WarningIcon />}
                iconPosition="start"
                sx={{
                  textTransform: 'none',
                  minHeight: 64,
                  py: 1
                }}
              />
              <Tab
                label="마스터재고검수"
                value="master"
                icon={<InventoryIcon />}
                iconPosition="start"
                sx={{
                  textTransform: 'none',
                  minHeight: 64,
                  py: 1
                }}
              />
              <Tab
                label="재고배정"
                value="assignment"
                icon={<AssignmentIcon />}
                iconPosition="start"
                sx={{
                  textTransform: 'none',
                  minHeight: 64,
                  py: 1
                }}
              />
            </Tabs>
          </Container>
        </Box>

        {/* 탭 콘텐츠 */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {currentScreen === 'price-discrepancy' && (
            <PriceDiscrepancyTab />
          )}

          {currentScreen === 'duplicate' && (
            <PhoneDuplicateTab />
          )}

          {currentScreen === 'master' && (
            <MasterInventoryTab />
          )}

          {currentScreen === 'assignment' && (
            <Suspense fallback={<LoadingSkeleton />}>
              <AssignmentSettingsScreen
                data={data}
                onBack={() => setCurrentScreen('price-discrepancy')}
                onLogout={onLogout}
              />
            </Suspense>
          )}
        </Box>

        {/* 업데이트 팝업 */}
        <AppUpdatePopup
          open={showUpdatePopup}
          onClose={() => setShowUpdatePopup(false)}
          mode="inventory"
          loggedInStore={loggedInStore}
          onUpdateAdded={() => {
            console.log('재고모드 새 업데이트가 추가되었습니다.');
          }}
        />
      </Box>
    );
  }

  // 다른 화면들 (지연 로딩 적용)
  if (currentScreen === 'loading') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ backgroundColor: '#2E7D32' }}>
          <Toolbar>
            <InventoryIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              재고 관리 시스템
            </Typography>
            <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={60} />
        </Box>
      </Box>
    );
  }

  // 기본 화면 (에러 처리)
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ backgroundColor: '#2E7D32' }}>
        <Toolbar>
          <InventoryIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            재고 관리 시스템
          </Typography>
          <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="error" sx={{ width: '50%' }}>
          <AlertTitle>오류</AlertTitle>
          알 수 없는 화면입니다.
        </Alert>
      </Box>
    </Box>
  );
}

export default InventoryMode;
