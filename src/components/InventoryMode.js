import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
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
  const sortedEmployees = Object.entries(data.employeeFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5); // 상위 5명

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
                              color={data.employeeFrequency[item.employee] > 5 ? 'error' : 'default'}
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
  const [currentScreen, setCurrentScreen] = useState('duplicate');
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
  if (currentScreen === 'duplicate' || currentScreen === 'master' || currentScreen === 'assignment') {
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
          {currentScreen === 'duplicate' && (
            <PhoneDuplicateTab />
          )}

          {currentScreen === 'master' && (
            <Box sx={{ p: 3 }}>
              <Card sx={{ p: 4, textAlign: 'center' }}>
                <CardContent>
                  <InventoryIcon sx={{ fontSize: 80, color: '#7B1FA2', mb: 2 }} />
                  <Typography variant="h4" component="h1" gutterBottom>
                    마스터재고검수
                  </Typography>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    현재 개발 중입니다
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    곧 새로운 기능으로 찾아뵙겠습니다.
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}

          {currentScreen === 'assignment' && (
            <Suspense fallback={<LoadingSkeleton />}>
              <AssignmentSettingsScreen 
                data={data}
                onBack={() => setCurrentScreen('duplicate')}
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
