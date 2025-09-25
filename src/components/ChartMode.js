import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  AlertTitle,
  CircularProgress,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Collapse,
  LinearProgress,
  Checkbox
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  SwapHoriz as SwapHorizIcon,
  AccountBalance as AccountBalanceIcon,
  Image as ImageIcon,
  TableChart as TableChartIcon,
  CloudUpload as CloudUploadIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  ShowChart as ShowChartIcon,
  PieChart as PieChartIcon,
  Update as UpdateIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { createWorker } from 'tesseract.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Line, Bar } from 'react-chartjs-2';

import AppUpdatePopup from './AppUpdatePopup';
import InventoryStatusScreen from './screens/InventoryStatusScreen';
import MatchingMismatchModal from './MatchingMismatchModal';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

// 합계 계산 유틸리티 함수
const calculateTotal = (dataArray, field) => {
  if (!dataArray || !Array.isArray(dataArray)) {
    return 0;
  }
  return dataArray.reduce((sum, item) => sum + (item[field] || 0), 0);
};

function ChartMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  const [activeTab, setActiveTab] = useState(0);
  
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 매칭 불일치 모달 상태
  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [matchingMismatches, setMatchingMismatches] = useState([]);
  
  // 장표모드 진입 시 업데이트 팝업 표시 (숨김 설정 확인 후)
  useEffect(() => {
    // 오늘 하루 보지 않기 설정 확인
    const hideUntil = localStorage.getItem('hideUpdate_chart');
    const shouldShowPopup = !(hideUntil && new Date() < new Date(hideUntil));
    
    if (shouldShowPopup) {
      // 숨김 설정이 없거나 만료된 경우에만 팝업 표시
      setShowUpdatePopup(true);
    }
  }, []);

  const handleBackToMain = () => {
    // 메인 화면으로 돌아가기 (모드 선택 팝업 표시)
    window.location.reload();
  };

  const handleTabChange = (event, newValue) => {
    // 채권장표 탭(1번)에 접근할 때 권한 체크 (마감장표가 0번이 되므로)
    if (newValue === 1 && !loggedInStore?.modePermissions?.bondChart) {
      alert('채권장표 메뉴에 대한 권한이 없습니다.');
      return;
    }
    setActiveTab(newValue);
  };

  // 탭 구성 (권한에 따라 조건부 렌더링)
  const tabs = [
    {
      label: '마감장표',
      icon: <ReceiptIcon />,
      component: <ClosingChartTab />,
      hasPermission: true // 마감장표 탭은 모든 사용자에게 표시
    },
    {
      label: '채권장표',
      icon: <AccountBalanceIcon />,
      component: <BondChartTab />,
      hasPermission: loggedInStore?.modePermissions?.bondChart
    },
    {
      label: '지표장표',
      icon: <BarChartIcon />,
      component: <IndicatorChartTab />,
      hasPermission: true // 지표장표 탭은 모든 사용자에게 표시
    },
    {
      label: '재고장표',
      icon: <InventoryIcon />,
      component: <InventoryStatusScreen />,
      hasPermission: true // 재고장표 탭은 모든 사용자에게 표시
    }
  ];

  // 권한이 있는 탭만 필터링
  const availableTabs = tabs.filter(tab => tab.hasPermission);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            장표 모드
          </Typography>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={() => {
                console.log('ChartMode 모드 전환 버튼 클릭됨');
                console.log('onModeChange 존재:', !!onModeChange);
                console.log('availableModes:', availableModes);
                onModeChange();
              }}
              startIcon={<SwapHorizIcon />}
              sx={{ 
                mr: 2,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.2)'
                }
              }}
            >
              모드 변경
            </Button>
          )}
          
          {/* 업데이트 확인 버튼 */}
          <Button
            color="inherit"
            startIcon={<UpdateIcon />}
            onClick={() => setShowUpdatePopup(true)}
            sx={{ 
              mr: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.2)'
              }
            }}
          >
            업데이트 확인
          </Button>
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'white' }}>
        <Container maxWidth="xl">
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '1rem',
                fontWeight: 'bold',
                color: '#666',
                '&.Mui-selected': {
                  color: '#f5576c',
                  fontWeight: 'bold'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#f5576c',
                height: 3
              }
            }}
          >
            {availableTabs.map((tab, index) => (
              <Tab
                key={index}
                label={tab.label}
                icon={tab.icon}
                iconPosition="start"
                sx={{ 
                  textTransform: 'none',
                  minHeight: 64,
                  py: 1
                }}
              />
            ))}
          </Tabs>
        </Container>
      </Box>
      
      {/* 탭 컨텐츠 */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 3, overflow: 'auto' }}>
        {/* 업데이트 팝업 */}
        <AppUpdatePopup
          open={showUpdatePopup}
          onClose={() => setShowUpdatePopup(false)}
          mode="chart"
          loggedInStore={loggedInStore}
          onUpdateAdded={() => {
            console.log('장표모드 새 업데이트가 추가되었습니다.');
          }}
        />
        
        {availableTabs[activeTab].component}
      </Container>
    </Box>
  );
}

// 채권장표 탭 컴포넌트
function BondChartTab() {
  const [activeSubTab, setActiveSubTab] = useState(0);

  const subTabs = [
    { label: '연체채권', icon: <WarningIcon /> },
    { label: '재초담초채권', icon: <AccountBalanceWalletIcon /> },
    { label: '가입자증감', icon: <PersonAddIcon /> }
  ];

  const handleSubTabChange = (event, newValue) => {
    setActiveSubTab(newValue);
  };

  return (
    <Box>
      {/* 서브 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeSubTab} 
          onChange={handleSubTabChange}
          variant="scrollable"
          scrollButtons="auto"
                sx={{
            '& .MuiTab-root': {
              minHeight: 56,
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: '#666',
              '&.Mui-selected': {
                color: '#f5576c',
                fontWeight: 'bold'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#f5576c',
              height: 3
            }
          }}
        >
          {subTabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
                  sx={{
                textTransform: 'none',
                minHeight: 56,
                py: 1
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* 서브 탭 컨텐츠 */}
      {activeSubTab === 0 && <OverdueBondTab />}
      {activeSubTab === 1 && <RechotanchoBondTab />}
      {activeSubTab === 2 && <SubscriberIncreaseTab />}
    </Box>
  );
}

// 지표장표 탭 컴포넌트
function IndicatorChartTab() {
  const [activeSubTab, setActiveSubTab] = useState(0);

  const subTabs = [
    { label: '월간시상', icon: <TrendingUpIcon /> },
    { label: '매출지표', icon: <AssessmentIcon /> },
    { label: '판매량', icon: <ShowChartIcon /> },
    { label: '구조정책', icon: <PieChartIcon /> }
  ];

  const handleSubTabChange = (event, newValue) => {
    setActiveSubTab(newValue);
  };

  return (
    <Box>
      {/* 서브 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeSubTab} 
          onChange={handleSubTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              minHeight: 56,
              fontSize: '0.9rem',
              fontWeight: 'bold',
              color: '#666',
              '&.Mui-selected': {
                color: '#f5576c',
                fontWeight: 'bold'
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#f5576c',
              height: 3
            }
          }}
        >
          {subTabs.map((tab, index) => (
            <Tab
              key={index}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              sx={{ 
                textTransform: 'none',
                minHeight: 56,
                py: 1
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* 서브 탭 컨텐츠 */}
      {activeSubTab === 0 && <MonthlyAwardTab />}
      {activeSubTab === 1 && <SalesIndicatorTab />}
      {activeSubTab === 2 && <SalesVolumeTab />}
      {activeSubTab === 3 && <StructurePolicyTab />}
    </Box>
  );
}

// 월간시상 탭 컴포넌트
function MonthlyAwardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAgentTableExpanded, setIsAgentTableExpanded] = useState(true);
  const [isOfficeTableExpanded, setIsOfficeTableExpanded] = useState(true);
  const [isDepartmentTableExpanded, setIsDepartmentTableExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState(0); // 셋팅 다이얼로그에서 현재 탭 상태 관리
  
  // Matrix 기준값 상태
  const [matrixValues, setMatrixValues] = useState({});
  
  // 추가 전략상품 상태
  const [newStrategicProduct, setNewStrategicProduct] = useState({
    subCategory: '',
    serviceName: '',
    points: 0
  });

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await api.getMonthlyAwardData();
        setData(result);
        
        // Matrix 기준값 초기화
        if (result.matrixCriteria) {
          const initialMatrixValues = {};
          result.matrixCriteria.forEach(criterion => {
            const key = `${criterion.indicator}-${criterion.score}`;
            const descKey = `${criterion.indicator}-desc-${criterion.score}`;
            initialMatrixValues[key] = criterion.percentage;
            initialMatrixValues[descKey] = criterion.description || '';
          });
          setMatrixValues(initialMatrixValues);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Matrix 셀 색상 계산
  const getMatrixCellColor = (score, percentage) => {
    if (!data?.matrixCriteria) return '#ffffff';
    
    const criteria = data.matrixCriteria.find(c => c.score === score);
    if (!criteria) return '#ffffff';
    
    const targetPercentage = criteria.percentage;
    if (percentage >= targetPercentage) return '#4caf50'; // 녹색
    if (percentage >= targetPercentage * 0.8) return '#ff9800'; // 주황색
    return '#f44336'; // 빨간색
  };

  // 성과 아이콘 계산 (시트에서 로드된 기준값 사용)
  const getPerformanceIcon = (percentage, indicator) => {
    if (!data?.matrixCriteria) return '⚠️';
    
    // 해당 지표의 최고 점수 기준값 찾기
    const maxCriteria = data.matrixCriteria
      .filter(c => c.indicator === indicator)
      .sort((a, b) => b.score - a.score)[0];
    
    if (!maxCriteria) return '⚠️';
    
    if (percentage >= maxCriteria.percentage) return '🏆';
    if (percentage >= maxCriteria.percentage * 0.8) return '👍';
    return '⚠️';
  };

  // 달성 상태 텍스트 생성
  const getAchievementText = (percentage, indicator) => {
    if (!data?.matrixCriteria) return '미달';
    
    // 해당 지표의 최고 점수 기준값 찾기
    const maxCriteria = data.matrixCriteria
      .filter(c => c.indicator === indicator)
      .sort((a, b) => b.score - a.score)[0];
    
    if (!maxCriteria) return '미달';
    
    if (percentage >= maxCriteria.percentage) {
      return '달성';
    } else {
      const gap = (maxCriteria.percentage - percentage).toFixed(1);
      return `${gap}% 부족`;
    }
  };

  // 점수 계산 함수 (백엔드와 동일한 로직)
  const calculateScore = (percentage, criteria) => {
    if (!criteria || criteria.length === 0) return 0;
    
    // 기준값을 점수별로 정렬
    const sortedCriteria = [...criteria].sort((a, b) => b.score - a.score);
    
    for (const criterion of sortedCriteria) {
      if (criterion.description === '미만') {
        // 미만 조건: 해당 퍼센트 미만이면 해당 점수
        if (percentage < criterion.percentage) {
          return criterion.score;
        }
      } else if (criterion.description === '만점') {
        // 만점 조건: 해당 퍼센트 이상이면 해당 점수
        if (percentage >= criterion.percentage) {
          return criterion.score;
        }
      } else {
        // 이상 조건: 해당 퍼센트 이상이면 해당 점수
        if (percentage >= criterion.percentage) {
          return criterion.score;
        }
      }
    }
    
    // 모든 조건을 만족하지 않으면 최소 점수 반환
    const minScore = Math.min(...criteria.map(c => c.score));
    return minScore;
  };

  // 추가 전략상품 핸들러
  const handleAddStrategicProduct = async () => {
    if (!newStrategicProduct.subCategory || !newStrategicProduct.serviceName || newStrategicProduct.points <= 0) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const updatedProducts = [
        ...(data.strategicProductsList || []),
        {
          subCategory: newStrategicProduct.subCategory,
          serviceCode: '', // 빈 값으로 설정
          serviceName: newStrategicProduct.serviceName,
          points: newStrategicProduct.points
        }
      ];

      await api.saveMonthlyAwardSettings('strategic_products', updatedProducts);
      
      // 데이터 새로고침
      const result = await api.getMonthlyAwardData();
      setData(result);
      
      // 입력 필드 초기화
      setNewStrategicProduct({
        subCategory: '',
        serviceName: '',
        points: 0
      });
      
      alert('전략상품이 추가되었습니다.');
    } catch (error) {
      alert('전략상품 추가 중 오류가 발생했습니다: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        데이터가 없습니다.
      </Alert>
    );
  }

  return (
    <Box>
      {/* 헤더 정보 */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
            {data.date} 월간시상 현황
          </Typography>
          <Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsExpanded(!isExpanded)}
              startIcon={isExpanded ? <CloseIcon /> : <ShowChartIcon />}
              sx={{ mr: 1 }}
            >
              {isExpanded ? '축소' : '확대'}
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowSettings(true)}
              startIcon={<EditIcon />}
            >
              셋팅
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                {data.indicators.upsellChange.percentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">업셀기변</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                {data.indicators.change105Above.percentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">기변105이상</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                {data.indicators.strategicProducts.percentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">전략상품</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h4" sx={{ color: '#f5576c', fontWeight: 'bold' }}>
                {data.indicators.internetRatio.percentage}%
              </Typography>
              <Typography variant="body2" color="text.secondary">인터넷 비중</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 월간시상 Matrix */}
      <Collapse in={isExpanded}>
        <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#333' }}>
            월간시상 Matrix
          </Typography>
          
          {/* 만점기준 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
              만점기준
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e3f2fd', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{data.totalMaxScore || 21}점</Typography>
                  <Typography variant="body2" color="text.secondary">총점</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e8f5e8', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>{data.maxScores?.upsell || 6}점</Typography>
                  <Typography variant="body2" color="text.secondary">업셀기변</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>{data.maxScores?.change105 || 6}점</Typography>
                  <Typography variant="body2" color="text.secondary">기변105이상</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>{data.maxScores?.strategic || 6}점</Typography>
                  <Typography variant="body2" color="text.secondary">전략상품</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fce4ec', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>{data.maxScores?.internet || 3}점</Typography>
                  <Typography variant="body2" color="text.secondary">인터넷 비중</Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* 달성상황 */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
              달성상황
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e3f2fd', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>{data.totalScore}점</Typography>
                  <Typography variant="body2" color="text.secondary">총점</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={2.4}>
                <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#e8f5e8', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                    {getPerformanceIcon(data.indicators.upsellChange.percentage, 'upsell')}
                    {calculateScore(parseFloat(data.indicators.upsellChange.percentage), data.matrixCriteria?.filter(c => c.indicator === 'upsell') || [])}점
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    업셀기변
                  </Typography>

                </Box>
              </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fff3e0', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.change105Above.percentage, 'change105')}
                  {calculateScore(parseFloat(data.indicators.change105Above.percentage), data.matrixCriteria?.filter(c => c.indicator === 'change105') || [])}점
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  기변105이상
                </Typography>

              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#f3e5f5', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#7b1fa2', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.strategicProducts.percentage, 'strategic')}
                  {calculateScore(parseFloat(data.indicators.strategicProducts.percentage), data.matrixCriteria?.filter(c => c.indicator === 'strategic') || [])}점
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  전략상품
                </Typography>

              </Box>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fce4ec', borderRadius: 1, height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ color: '#c2185b', fontWeight: 'bold' }}>
                  {getPerformanceIcon(data.indicators.internetRatio.percentage, 'internet')}
                  {calculateScore(parseFloat(data.indicators.internetRatio.percentage), data.matrixCriteria?.filter(c => c.indicator === 'internet') || [])}점
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  인터넷 비중
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Matrix 테이블 */}
        <Collapse in={isExpanded}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>점수</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>업셀기변</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>기변105이상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>전략상품</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>인터넷 비중</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[6, 5, 4, 3, 2, 1].map((score) => {
                  const upsellCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'upsell');
                  const change105Criteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'change105');
                  const strategicCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'strategic');
                  const internetCriteria = data.matrixCriteria?.find(c => c.score === score && c.indicator === 'internet');
                  
                  const isUpsellAchieved = upsellCriteria && parseFloat(data.indicators.upsellChange.percentage) >= upsellCriteria.percentage;
                  const isChange105Achieved = change105Criteria && parseFloat(data.indicators.change105Above.percentage) >= change105Criteria.percentage;
                  const isStrategicAchieved = strategicCriteria && parseFloat(data.indicators.strategicProducts.percentage) >= strategicCriteria.percentage;
                  const isInternetAchieved = internetCriteria && parseFloat(data.indicators.internetRatio.percentage) >= internetCriteria.percentage;
                  
                  return (
                    <TableRow key={score}>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{score}점</TableCell>
                      <TableCell sx={{ textAlign: 'center', bgcolor: isUpsellAchieved ? '#e8f5e8' : 'transparent' }}>
                        {upsellCriteria?.percentage || 0}%
                        {isUpsellAchieved && <span style={{ marginLeft: '8px', color: '#2e7d32' }}>✓</span>}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', bgcolor: isChange105Achieved ? '#fff3e0' : 'transparent' }}>
                        {change105Criteria?.percentage || 0}%
                        {isChange105Achieved && <span style={{ marginLeft: '8px', color: '#f57c00' }}>✓</span>}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', bgcolor: isStrategicAchieved ? '#f3e5f5' : 'transparent' }}>
                        {strategicCriteria?.percentage || 0}%
                        {isStrategicAchieved && <span style={{ marginLeft: '8px', color: '#7b1fa2' }}>✓</span>}
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', bgcolor: isInternetAchieved ? '#fce4ec' : 'transparent' }}>
                        {internetCriteria?.percentage || 0}%
                        {isInternetAchieved && <span style={{ marginLeft: '8px', color: '#c2185b' }}>✓</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
        </Collapse>

      {/* 상세 데이터 테이블 */}
      <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
            채널별 성과 현황
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setIsAgentTableExpanded(!isAgentTableExpanded)}
            startIcon={isAgentTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
          >
            {isAgentTableExpanded ? '축소' : '확대'}
          </Button>
        </Box>
        <Collapse in={isAgentTableExpanded}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>채널</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>업셀기변</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>기변105이상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>전략상품</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>인터넷 비중</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.agentDetails && data.agentDetails.length > 0 ? (
                  data.agentDetails.map((agent, index) => (
                    <TableRow key={index}>
                      <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{agent.name}</TableCell>
                      <TableCell sx={{ 
                        textAlign: 'center', 
                        bgcolor: parseFloat(agent.upsellChange.percentage) >= 92.0 ? 'transparent' : '#ffebee' 
                      }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {agent.upsellChange.percentage}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ 
                        textAlign: 'center', 
                        bgcolor: parseFloat(agent.change105Above.percentage) >= 88.0 ? 'transparent' : '#ffebee' 
                      }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {agent.change105Above.percentage}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ 
                        textAlign: 'center', 
                        bgcolor: parseFloat(agent.strategicProducts.percentage) >= 90.0 ? 'transparent' : '#ffebee' 
                      }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {agent.strategicProducts.percentage}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ 
                        textAlign: 'center', 
                        bgcolor: parseFloat(agent.internetRatio.percentage) >= 7.0 ? 'transparent' : '#ffebee' 
                      }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {agent.internetRatio.percentage}%
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        담당자 데이터가 없습니다. 업체 매핑을 확인해주세요.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>

      {/* 사무실별 성과 테이블 */}
      {data.officeGroups && data.officeGroups.length > 0 && (
        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
              사무실별 성과 현황
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsOfficeTableExpanded(!isOfficeTableExpanded)}
              startIcon={isOfficeTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
            >
              {isOfficeTableExpanded ? '축소' : '확대'}
            </Button>
          </Box>
          <Collapse in={isOfficeTableExpanded}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>사무실</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>업셀기변</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>기변105이상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>전략상품</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>인터넷 비중</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.officeGroups.map((group, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{group.office}</TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      bgcolor: parseFloat(group.totalUpsellChange.percentage) >= 92.0 ? 'transparent' : '#ffebee' 
                    }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalUpsellChange.percentage}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      bgcolor: parseFloat(group.totalChange105Above.percentage) >= 88.0 ? 'transparent' : '#ffebee' 
                    }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalChange105Above.percentage}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      bgcolor: parseFloat(group.totalStrategicProducts.percentage) >= 90.0 ? 'transparent' : '#ffebee' 
                    }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalStrategicProducts.percentage}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      bgcolor: parseFloat(group.totalInternetRatio.percentage) >= 7.0 ? 'transparent' : '#ffebee' 
                    }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalInternetRatio.percentage}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
      )}

      {/* 소속별 성과 테이블 */}
      {data.departmentGroups && data.departmentGroups.length > 0 && (
        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#333' }}>
              소속별 성과 현황
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsDepartmentTableExpanded(!isDepartmentTableExpanded)}
              startIcon={isDepartmentTableExpanded ? <CloseIcon /> : <ShowChartIcon />}
            >
              {isDepartmentTableExpanded ? '축소' : '확대'}
            </Button>
          </Box>
          <Collapse in={isDepartmentTableExpanded}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>소속</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>업셀기변</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>기변105이상</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>전략상품</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', textAlign: 'center', width: '20%' }}>인터넷 비중</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.departmentGroups.map((group, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>{group.department}</TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      bgcolor: parseFloat(group.totalUpsellChange.percentage) >= 92.0 ? 'transparent' : '#ffebee' 
                    }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalUpsellChange.percentage}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      bgcolor: parseFloat(group.totalChange105Above.percentage) >= 88.0 ? 'transparent' : '#ffebee' 
                    }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalChange105Above.percentage}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      bgcolor: parseFloat(group.totalStrategicProducts.percentage) >= 90.0 ? 'transparent' : '#ffebee' 
                    }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalStrategicProducts.percentage}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      textAlign: 'center', 
                      bgcolor: parseFloat(group.totalInternetRatio.percentage) >= 7.0 ? 'transparent' : '#ffebee' 
                    }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {group.totalInternetRatio.percentage}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Paper>
      )}

      {/* 셋팅 다이얼로그 */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="lg" fullWidth>
        <DialogTitle>월간시상 셋팅</DialogTitle>
        <DialogContent>
          <Tabs value={settingsTab} onChange={(e, newValue) => setSettingsTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Matrix 기준값" />
            <Tab label="전략상품 관리" />
            <Tab label="업체 매핑" />
            <Tab label="요금제 매핑" />
            <Tab label="담당자 관리" />
          </Tabs>

          {/* Matrix 기준값 탭 */}
          {settingsTab === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Matrix 기준값 설정</Typography>
              
              {/* 업셀기변 기준값 */}
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#2e7d32' }}>업셀기변 기준값</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[6, 5, 4, 3, 2, 1].map((score) => (
                  <Grid item xs={12} md={6} key={`upsell-${score}`}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        label={`${score}점 기준 (%)`}
                        type="number"
                        name={`upsell-${score}`}
                        value={matrixValues[`upsell-${score}`] ?? (data.matrixCriteria?.find(c => c.score === score && c.indicator === 'upsell')?.percentage || 0)}
                        onChange={(e) => setMatrixValues(prev => ({
                          ...prev,
                          [`upsell-${score}`]: parseFloat(e.target.value) || 0
                        }))}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                      />
                      <TextField
                        fullWidth
                        label="설명"
                        name={`upsell-desc-${score}`}
                        value={matrixValues[`upsell-desc-${score}`] ?? (data.matrixCriteria?.find(c => c.score === score && c.indicator === 'upsell')?.description || '')}
                        onChange={(e) => setMatrixValues(prev => ({
                          ...prev,
                          [`upsell-desc-${score}`]: e.target.value
                        }))}
                        placeholder="만점/이상/미만"
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {/* 기변105이상 기준값 */}
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#f57c00' }}>기변105이상 기준값</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[6, 5, 4, 3, 2, 1].map((score) => (
                  <Grid item xs={12} md={6} key={`change105-${score}`}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        label={`${score}점 기준 (%)`}
                        type="number"
                        name={`change105-${score}`}
                        value={matrixValues[`change105-${score}`] ?? (data.matrixCriteria?.find(c => c.score === score && c.indicator === 'change105')?.percentage || 0)}
                        onChange={(e) => setMatrixValues(prev => ({
                          ...prev,
                          [`change105-${score}`]: parseFloat(e.target.value) || 0
                        }))}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                      />
                      <TextField
                        fullWidth
                        label="설명"
                        name={`change105-desc-${score}`}
                        value={matrixValues[`change105-desc-${score}`] ?? (data.matrixCriteria?.find(c => c.score === score && c.indicator === 'change105')?.description || '')}
                        onChange={(e) => setMatrixValues(prev => ({
                          ...prev,
                          [`change105-desc-${score}`]: e.target.value
                        }))}
                        placeholder="만점/이상/미만"
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {/* 전략상품 기준값 */}
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#7b1fa2' }}>전략상품 기준값</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[6, 5, 4, 3, 2, 1].map((score) => (
                  <Grid item xs={12} md={6} key={`strategic-${score}`}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        label={`${score}점 기준 (%)`}
                        type="number"
                        name={`strategic-${score}`}
                        value={matrixValues[`strategic-${score}`] ?? (data.matrixCriteria?.find(c => c.score === score && c.indicator === 'strategic')?.percentage || 0)}
                        onChange={(e) => setMatrixValues(prev => ({
                          ...prev,
                          [`strategic-${score}`]: parseFloat(e.target.value) || 0
                        }))}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                      />
                      <TextField
                        fullWidth
                        label="설명"
                        name={`strategic-desc-${score}`}
                        value={matrixValues[`strategic-desc-${score}`] ?? (data.matrixCriteria?.find(c => c.score === score && c.indicator === 'strategic')?.description || '')}
                        onChange={(e) => setMatrixValues(prev => ({
                          ...prev,
                          [`strategic-desc-${score}`]: e.target.value
                        }))}
                        placeholder="만점/이상/미만"
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {/* 인터넷 비중 기준값 */}
              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold', color: '#c2185b' }}>인터넷 비중 기준값</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[3, 2, 1].map((score) => (
                  <Grid item xs={12} md={6} key={`internet-${score}`}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        label={`${score}점 기준 (%)`}
                        type="number"
                        name={`internet-${score}`}
                        value={matrixValues[`internet-${score}`] ?? (data.matrixCriteria?.find(c => c.score === score && c.indicator === 'internet')?.percentage || 0)}
                        onChange={(e) => setMatrixValues(prev => ({
                          ...prev,
                          [`internet-${score}`]: parseFloat(e.target.value) || 0
                        }))}
                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                      />
                      <TextField
                        fullWidth
                        label="설명"
                        name={`internet-desc-${score}`}
                        value={matrixValues[`internet-desc-${score}`] ?? (data.matrixCriteria?.find(c => c.score === score && c.indicator === 'internet')?.description || '')}
                        onChange={(e) => setMatrixValues(prev => ({
                          ...prev,
                          [`internet-desc-${score}`]: e.target.value
                        }))}
                        placeholder="만점/이상/미만"
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* 전략상품 관리 탭 */}
          {settingsTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>전략상품 포인트 설정</Typography>
              
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>매칭 규칙</Typography>
                <Typography variant="body2" color="text.secondary">
                  • 1순위: 부가서비스명과 정확히 일치하는 경우<br/>
                  • 2순위: 소분류와 일치하는 경우<br/>
                  • 소분류와 부가서비스명을 모두 설정할 수 있습니다
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>기본 전략상품</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="보험(폰교체) 포인트"
                    type="number"
                    defaultValue={data.strategicProductsList?.find(p => p.serviceName === '보험(폰교체)')?.points || 0}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="유플릭스 포인트"
                    type="number"
                    defaultValue={data.strategicProductsList?.find(p => p.serviceName === '유플릭스')?.points || 0}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="통화연결음 포인트"
                    type="number"
                    defaultValue={data.strategicProductsList?.find(p => p.serviceName === '통화연결음')?.points || 0}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="뮤직류 포인트"
                    type="number"
                    defaultValue={data.strategicProductsList?.find(p => p.serviceName === '뮤직류')?.points || 0}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>추가 전략상품</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="소분류"
                    placeholder="예: 보험(폰교체)"
                    value={newStrategicProduct.subCategory}
                    onChange={(e) => setNewStrategicProduct(prev => ({
                      ...prev,
                      subCategory: e.target.value
                    }))}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="부가서비스명"
                    placeholder="예: 폰교체슬림"
                    value={newStrategicProduct.serviceName}
                    onChange={(e) => setNewStrategicProduct(prev => ({
                      ...prev,
                      serviceName: e.target.value
                    }))}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="포인트"
                    type="number"
                    placeholder="0"
                    value={newStrategicProduct.points}
                    onChange={(e) => setNewStrategicProduct(prev => ({
                      ...prev,
                      points: parseFloat(e.target.value) || 0
                    }))}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={1}>
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    sx={{ height: 56 }}
                    onClick={handleAddStrategicProduct}
                    disabled={!newStrategicProduct.subCategory || !newStrategicProduct.serviceName || newStrategicProduct.points <= 0}
                  >
                    추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>현재 설정된 전략상품 목록</Typography>
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  {data.strategicProductsList && data.strategicProductsList.length > 0 ? (
                    data.strategicProductsList.map((product, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                        <Typography variant="body2">
                          <strong>소분류:</strong> {product.subCategory} | 
                          <strong>부가서비스명:</strong> {product.serviceName} | 
                          <strong>포인트:</strong> {product.points}
                        </Typography>
                      </Box>
                    ))
                  ) : (
                    "설정된 전략상품이 없습니다."
                  )}
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>매칭되지 않은 전략상품</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                {data.unmatchedItems?.strategicProducts && data.unmatchedItems.strategicProducts.length > 0 ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      다음 전략상품들이 설정된 목록과 매칭되지 않았습니다. 위의 전략상품 목록에 추가해주세요.
                    </Typography>
                    {data.unmatchedItems.strategicProducts.map((product, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>매칭되지 않은 전략상품:</strong> {product}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    매칭되지 않은 전략상품이 없습니다.
                  </Typography>
                )}
              </Paper>
            </Box>
          )}

          {/* 업체 매핑 탭 */}
          {settingsTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>인터넷 비중 업체명 매핑</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                개통데이터/홈데이터의 업체명과 폰클출고처데이터의 업체명이 일치하지 않는 경우를 관리합니다.
              </Typography>
              
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>매핑 규칙</Typography>
                <Typography variant="body2" color="text.secondary">
                  • 개통데이터/홈데이터 G열(업체명) ↔ 폰클출고처데이터 C열(출고처 업체명)<br/>
                  • 정확한 업체명 매칭이 필요한 경우에만 사용합니다<br/>
                  • 매칭되지 않은 업체는 인터넷 비중 계산에서 제외됩니다
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>매핑되지 않은 업체 목록</Typography>
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                {data.unmatchedItems?.companies && data.unmatchedItems.companies.length > 0 ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      다음 업체명들이 폰클출고처데이터와 매칭되지 않았습니다. 각 업체명에 대해 정확한 매핑을 설정해주세요.
                    </Typography>
                    {data.unmatchedItems.companies.map((company, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>매칭되지 않은 업체명:</strong> {company}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    매칭되지 않은 업체가 없습니다.
                  </Typography>
                )}
              </Paper>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="개통데이터/홈데이터 업체명"
                    placeholder="예: (주)본앤코리아(원주단계)"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="폰클출고처데이터 업체명"
                    placeholder="예: (주)본앤코리아"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button variant="outlined" fullWidth sx={{ height: 56 }}>
                    매핑 추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>현재 매핑 목록</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  설정된 매핑이 없습니다. 위에서 매핑을 추가하면 여기에 표시됩니다.
                </Typography>
              </Paper>
            </Box>
          )}

          {/* 업체 매핑 탭 */}
          {settingsTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>인터넷 비중 업체명 매핑</Typography>
              
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>매핑 규칙</Typography>
                <Typography variant="body2" color="text.secondary">
                  • 개통데이터/홈데이터 G열(업체명) ↔ 폰클출고처데이터 C열(출고처 업체명)<br/>
                  • 정확한 업체명 매칭이 필요한 경우에만 사용합니다<br/>
                  • 매칭되지 않은 업체는 인터넷 비중 계산에서 제외됩니다
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>매핑되지 않은 업체 목록</Typography>
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                {data.unmatchedItems?.companies && data.unmatchedItems.companies.length > 0 ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      다음 업체명들이 폰클출고처데이터와 매칭되지 않았습니다. 각 업체명에 대해 정확한 매핑을 설정해주세요.
                    </Typography>
                    {data.unmatchedItems.companies.map((company, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>매칭되지 않은 업체명:</strong> {company}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    매칭되지 않은 업체가 없습니다.
                  </Typography>
                )}
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>업체명 매핑 추가</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="개통데이터/홈데이터 업체명"
                    placeholder="예: (주)본앤코리아(원주단계)"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="폰클출고처데이터 업체명"
                    placeholder="예: (주)본앤코리아"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button variant="outlined" fullWidth sx={{ height: 56 }}>
                    매핑 추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>현재 매핑 목록</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  설정된 매핑이 없습니다. 위에서 매핑을 추가하면 여기에 표시됩니다.
                </Typography>
              </Paper>
            </Box>
          )}

          {/* 요금제 매핑 탭 */}
          {settingsTab === 3 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>요금제 매핑 설정</Typography>
              
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>매핑 규칙</Typography>
                <Typography variant="body2" color="text.secondary">
                  • 수기초에 있는 요금제명이 무선요금제군에 없을 때 매핑 설정<br/>
                  • 요금제군과 기본료를 설정하여 업셀기변, 기변105이상 계산에 사용<br/>
                  • 매핑되지 않은 요금제는 계산에서 제외됩니다
                </Typography>
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>매핑되지 않은 요금제 목록</Typography>
              <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                {data.unmatchedItems?.plans && data.unmatchedItems.plans.length > 0 ? (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      다음 요금제명들이 무선요금제군과 매칭되지 않았습니다. 각 요금제에 대해 요금제군과 기본료를 설정해주세요.
                    </Typography>
                    {data.unmatchedItems.plans.map((plan, index) => (
                      <Box key={index} sx={{ mb: 1, p: 1, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" color="warning.dark">
                          <strong>매칭되지 않은 요금제명:</strong> {plan}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    매칭되지 않은 요금제가 없습니다.
                  </Typography>
                )}
              </Paper>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>요금제 매핑 추가</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="요금제명"
                    placeholder="예: 5G 프리미어 레귤러"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="요금제군"
                    placeholder="예: 115군"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="기본료"
                    type="number"
                    placeholder="118"
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button variant="outlined" fullWidth sx={{ height: 56 }}>
                    매핑 추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>현재 매핑 목록</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  설정된 매핑이 없습니다. 위에서 매핑을 추가하면 여기에 표시됩니다.
                </Typography>
              </Paper>
            </Box>
          )}

          {/* 담당자 관리 탭 */}
          {settingsTab === 4 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>담당자별 설정</Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="담당자명"
                    placeholder="담당자 이름"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>활성화 상태</InputLabel>
                    <Select defaultValue="active">
                      <MenuItem value="active">활성</MenuItem>
                      <MenuItem value="inactive">비활성</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="목표 달성률 (%)"
                    type="number"
                    placeholder="100"
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Button variant="outlined" fullWidth sx={{ height: 56 }}>
                    담당자 추가
                  </Button>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>담당자 목록</Typography>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  담당자 매핑 테이블에서 관리됩니다. Google Sheets에서 직접 수정하거나<br/>
                  위의 매핑 기능을 통해 자동으로 관리할 수 있습니다.
                </Typography>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>취소</Button>
          <Button onClick={async () => {
            try {
              // 현재 탭에 따른 저장 로직
              if (settingsTab === 0) {
                // Matrix 기준값 저장
                const matrixCriteria = [];
                ['upsell', 'change105', 'strategic'].forEach(indicator => {
                  [6, 5, 4, 3, 2, 1].forEach(score => {
                    const value = matrixValues[`${indicator}-${score}`];
                    const description = matrixValues[`${indicator}-desc-${score}`] || '';
                    if (value !== undefined) {
                      matrixCriteria.push({
                        score,
                        indicator,
                        percentage: value,
                        description: description
                      });
                    }
                  });
                });
                // 인터넷 비중은 3점까지만
                [3, 2, 1].forEach(score => {
                  const value = matrixValues[`internet-${score}`];
                  const description = matrixValues[`internet-desc-${score}`] || '';
                  if (value !== undefined) {
                    matrixCriteria.push({
                      score,
                      indicator: 'internet',
                      percentage: value,
                      description: description
                    });
                  }
                });
                console.log('저장할 Matrix 기준값:', matrixCriteria);
                await api.saveMonthlyAwardSettings('matrix_criteria', matrixCriteria);
              } else if (settingsTab === 1) {
                // 전략상품 포인트 저장
                const strategicProducts = [
                  { serviceName: '보험(폰교체)', points: parseFloat(document.querySelector('input[label*="보험"]')?.value || 0) },
                  { serviceName: '유플릭스', points: parseFloat(document.querySelector('input[label*="유플릭스"]')?.value || 0) },
                  { serviceName: '통화연결음', points: parseFloat(document.querySelector('input[label*="통화연결음"]')?.value || 0) },
                  { serviceName: '뮤직류', points: parseFloat(document.querySelector('input[label*="뮤직류"]')?.value || 0) }
                ];
                await api.saveMonthlyAwardSettings('strategic_products', strategicProducts);
              } else if (settingsTab === 2) {
                // 업체 매핑 저장
                const companyMappings = [];
                // 업체 매핑 데이터 수집 (실제 구현 시 입력 필드에서 데이터 가져오기)
                await api.saveMonthlyAwardSettings('company_mapping', companyMappings);
              } else if (settingsTab === 3) {
                // 요금제 매핑 저장
                const planMappings = [];
                // 요금제 매핑 데이터 수집 (실제 구현 시 입력 필드에서 데이터 가져오기)
                await api.saveMonthlyAwardSettings('plan_mapping', planMappings);
              } else if (settingsTab === 4) {
                // 담당자 관리 저장
                const managerSettings = [];
                // 담당자 관리 데이터 수집 (실제 구현 시 입력 필드에서 데이터 가져오기)
                await api.saveMonthlyAwardSettings('manager_settings', managerSettings);
              }
              
              alert('설정이 저장되었습니다.');
              setShowSettings(false);
              // 데이터 다시 로드
              window.location.reload();
            } catch (error) {
              alert('설정 저장 중 오류가 발생했습니다.');
            }
          }} variant="contained">저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 매출지표 탭 컴포넌트
function SalesIndicatorTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <AssessmentIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        매출지표
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        매출 관련 지표 및 분석 기능이 개발 중입니다.<br />
        빠른 시일 내에 서비스를 제공하겠습니다.
      </Typography>
    </Paper>
  );
}

// 판매량 탭 컴포넌트
function SalesVolumeTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <ShowChartIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        판매량
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        판매량 관련 차트 및 분석 기능이 개발 중입니다.<br />
        빠른 시일 내에 서비스를 제공하겠습니다.
      </Typography>
    </Paper>
  );
}

// 구조정책 탭 컴포넌트
function StructurePolicyTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <PieChartIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        구조정책
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        구조정책 관련 분석 및 차트 기능이 개발 중입니다.<br />
        빠른 시일 내에 서비스를 제공하겠습니다.
      </Typography>
    </Paper>
  );
}

// 마감장표 탭 컴포넌트
function ClosingChartTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rankingType, setRankingType] = useState('performance'); // 'fee' or 'performance'
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingFailures, setMappingFailures] = useState([]);
  
  // 매칭 불일치 모달 상태
  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [matchingMismatches, setMatchingMismatches] = useState([]);
  
  // 테이블 접기/펼치기 상태
  const [codeTableOpen, setCodeTableOpen] = useState(false);
  const [officeTableOpen, setOfficeTableOpen] = useState(false);
  const [departmentTableOpen, setDepartmentTableOpen] = useState(false);
  const [agentTableOpen, setAgentTableOpen] = useState(false);
  const [csSummaryOpen, setCsSummaryOpen] = useState(false); // 기본값: 접기 상태
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // 데이터 로드
  const loadData = useCallback(async (date = selectedDate) => {
    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      // 프로그레스바 시뮬레이션
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/closing-chart?date=${date}`);
      if (!response.ok) {
        throw new Error('데이터 로드에 실패했습니다.');
      }

      const result = await response.json();
      setData(result);
      
      // 매칭 불일치 데이터 처리
      console.log('🔍 [프론트엔드] API 응답 확인:', {
        hasMatchingMismatches: !!result.matchingMismatches,
        matchingMismatchesLength: result.matchingMismatches ? result.matchingMismatches.length : 0,
        matchingMismatchesSample: result.matchingMismatches ? result.matchingMismatches.slice(0, 2) : 'none'
      });
      
      if (result.matchingMismatches && result.matchingMismatches.length > 0) {
        console.log('🔍 [프론트엔드] 매칭 불일치 모달 표시:', result.matchingMismatches.length, '건');
        setMatchingMismatches(result.matchingMismatches);
        setShowMismatchModal(true);
      } else {
        console.log('🔍 [프론트엔드] 매칭 불일치 데이터 없음');
      }
      
      setLastUpdate(new Date());
      setProgress(100);

      setTimeout(() => {
        setProgress(0);
        setLoading(false);
      }, 500);

    } catch (err) {
      setError(err.message);
      setProgress(0);
      setLoading(false);
    }
  }, [selectedDate]);

  // 매핑 실패 데이터 로드
  const loadMappingFailures = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/closing-chart/mapping-failures?date=${selectedDate}`);
      if (response.ok) {
        const result = await response.json();
        setMappingFailures(result.failures || []);
      }
    } catch (err) {
      console.error('매핑 실패 데이터 로드 오류:', err);
    }
  }, [selectedDate]);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 자동 업데이트 (10분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [loadData]);

  // 날짜 변경 시 데이터 재로드
  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    loadData(newDate);
  };

  // 수동 새로고침
  const handleRefresh = () => {
    loadData();
    loadMappingFailures();
  };

  // 목표 설정 저장
  const handleTargetSave = async (targets) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/closing-chart/targets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targets }),
      });

      if (response.ok) {
        // 데이터 재로드
        loadData();
        setShowTargetModal(false);
      } else {
        throw new Error('목표 저장에 실패했습니다.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // 합계 일치 여부 확인
  const checkTotalConsistency = () => {
    if (!data) return true;
    
    const codeTotal = calculateTotal(data?.codeData, 'performance');
    const officeTotal = calculateTotal(data?.officeData, 'performance');
    const departmentTotal = calculateTotal(data?.departmentData, 'performance');
    const agentTotal = calculateTotal(data?.agentData, 'performance');
    
    return codeTotal === officeTotal && officeTotal === departmentTotal && departmentTotal === agentTotal;
  };

  if (loading && progress > 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          마감장표 데이터 로딩 중...
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ height: 8, borderRadius: 4, mb: 2 }}
        />
        <Typography variant="body2" color="text.secondary">
          {progress}% 완료
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <AlertTitle>오류</AlertTitle>
        {error}
        <Button onClick={handleRefresh} sx={{ ml: 2 }}>
          다시 시도
        </Button>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          데이터를 불러오는 중...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* 상단 컨트롤 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6">
              {new Date(selectedDate).getDate()}일 마감 실적장표
            </Typography>
            <TextField
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              size="small"
            />
            <Button
              variant="outlined"
              onClick={handleRefresh}
              startIcon={<RefreshIcon />}
            >
              새로고침
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setShowTargetModal(true)}
              startIcon={<SettingsIcon />}
            >
              목표 설정
            </Button>
            <Button
              variant="outlined"
              onClick={() => setShowMismatchModal(true)}
              startIcon={<WarningIcon />}
              color="warning"
            >
              매칭 불일치 ({matchingMismatches.length})
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                loadMappingFailures();
                setShowMappingModal(true);
              }}
              startIcon={<WarningIcon />}
            >
              매핑 실패 ({mappingFailures.length})
            </Button>
            {lastUpdate && (
              <Typography variant="caption" color="text.secondary">
                마지막 업데이트: {lastUpdate.toLocaleTimeString()}
              </Typography>
            )}
          </Box>
        </Box>

        {/* CS 개통 요약 */}
        <Paper sx={{ mb: 2, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              📞 CS 개통 실적
            </Typography>
            <Button
              onClick={() => setCsSummaryOpen(!csSummaryOpen)}
              sx={{ color: 'white', minWidth: 'auto' }}
              startIcon={csSummaryOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {csSummaryOpen ? '접기' : '펼치기'}
            </Button>
          </Box>
          
          {!csSummaryOpen && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#FFD700' }}>
                {data.csSummary?.total || 0}
              </Typography>
              <Typography variant="body2">총 개통</Typography>
            </Box>
          )}
          
          <Collapse in={csSummaryOpen}>
            <Box sx={{ p: 2 }}>
              {/* 총계 카드 */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#FFD700' }}>
                      {data.csSummary?.total || 0}
                    </Typography>
                    <Typography variant="body2">총 개통</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#87CEEB' }}>
                      {data.csSummary?.totalWireless || 0}
                    </Typography>
                    <Typography variant="body2">무선 개통</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper sx={{ p: 2, textAlign: 'center', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#98FB98' }}>
                      {data.csSummary?.totalWired || 0}
                    </Typography>
                    <Typography variant="body2">유선 개통</Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* CS 직원별 랭킹 */}
              {data.csSummary?.agents && data.csSummary.agents.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ mb: 2, textAlign: 'center', fontWeight: 'bold' }}>
                    🏆 CS 직원별 랭킹
                  </Typography>
                  <Grid container spacing={1}>
                    {data.csSummary.agents.map((agent, index) => (
                      <Grid item xs={12} sm={6} md={4} key={index}>
                        <Paper sx={{ 
                          p: 1.5, 
                          background: index < 3 ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.1)',
                          border: index < 3 ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.3)',
                          borderRadius: 2
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {index + 1}. {agent.agent}
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                무선: {agent.wireless} | 유선: {agent.wired}
                              </Typography>
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#FFD700' }}>
                              {agent.total}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          </Collapse>
        </Paper>

        {/* 합계 일치 경고 */}
        {!checkTotalConsistency() && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <AlertTitle>주의</AlertTitle>
            코드별, 사무실별, 소속별, 담당자별 실적 합계가 일치하지 않습니다.
          </Alert>
        )}
      </Paper>

      {/* 랭킹 기준 탭 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs 
          value={rankingType} 
          onChange={(e, newValue) => setRankingType(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="실적 기준" value="performance" />
          <Tab label="수수료 기준" value="fee" />
        </Tabs>
      </Paper>

      {/* 코드별 랭킹 테이블 */}
      {/* 코드별 실적 테이블 */}
      <Paper sx={{ 
        mb: 2, 
        borderRadius: 2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          p: 2, 
          background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
          color: 'white'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            📊 코드별 실적
          </Typography>
          <Button
            size="small"
            onClick={() => setCodeTableOpen(!codeTableOpen)}
            startIcon={codeTableOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ 
              color: 'white', 
              borderColor: 'white',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
            }}
            variant="outlined"
          >
            {codeTableOpen ? '접기' : '펼치기'}
          </Button>
        </Box>
        {!codeTableOpen && (
          <Box sx={{ 
            p: 3, 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
          }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4CAF50', mb: 1 }}>
              {calculateTotal(data?.codeData, 'performance')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              총 실적 건수
            </Typography>
          </Box>
        )}
        {codeTableOpen && (
          <ClosingChartTable
            data={data.codeData}
            type="code"
            rankingType={rankingType}
            total={calculateTotal(data?.codeData, 'performance')}
            headerColor="#4CAF50"
          />
        )}
      </Paper>

      {/* 사무실별 실적 테이블 */}
      <Paper sx={{ 
        mb: 2, 
        borderRadius: 2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          p: 2, 
          background: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)',
          color: 'white'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            🏢 사무실별 실적
          </Typography>
          <Button
            size="small"
            onClick={() => setOfficeTableOpen(!officeTableOpen)}
            startIcon={officeTableOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ 
              color: 'white', 
              borderColor: 'white',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
            }}
            variant="outlined"
          >
            {officeTableOpen ? '접기' : '펼치기'}
          </Button>
        </Box>
        {!officeTableOpen && (
          <Box sx={{ 
            p: 3, 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
          }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#E91E63', mb: 1 }}>
              {calculateTotal(data?.officeData, 'performance')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              총 실적 건수
            </Typography>
          </Box>
        )}
        {officeTableOpen && (
          <ClosingChartTable
            data={data.officeData}
            type="office"
            rankingType={rankingType}
            total={calculateTotal(data?.officeData, 'performance')}
            headerColor="#E91E63"
          />
        )}
      </Paper>

      {/* 소속별 실적 테이블 */}
      <Paper sx={{ 
        mb: 2, 
        borderRadius: 2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          p: 2, 
          background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
          color: 'white'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            👥 소속별 실적
          </Typography>
          <Button
            size="small"
            onClick={() => setDepartmentTableOpen(!departmentTableOpen)}
            startIcon={departmentTableOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ 
              color: 'white', 
              borderColor: 'white',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
            }}
            variant="outlined"
          >
            {departmentTableOpen ? '접기' : '펼치기'}
          </Button>
        </Box>
        {!departmentTableOpen && (
          <Box sx={{ 
            p: 3, 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
          }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2196F3', mb: 1 }}>
              {calculateTotal(data?.departmentData, 'performance')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              총 실적 건수
            </Typography>
          </Box>
        )}
        {departmentTableOpen && (
          <ClosingChartTable
            data={data.departmentData}
            type="department"
            rankingType={rankingType}
            total={calculateTotal(data?.departmentData, 'performance')}
            headerColor="#2196F3"
          />
        )}
      </Paper>

      {/* 담당자별 실적 테이블 */}
      <Paper sx={{ 
        mb: 2, 
        borderRadius: 2,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          p: 2, 
          background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
          color: 'white'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            👤 담당자별 실적
          </Typography>
          <Button
            size="small"
            onClick={() => setAgentTableOpen(!agentTableOpen)}
            startIcon={agentTableOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ 
              color: 'white', 
              borderColor: 'white',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
            }}
            variant="outlined"
          >
            {agentTableOpen ? '접기' : '펼치기'}
          </Button>
        </Box>
        {!agentTableOpen && (
          <Box sx={{ 
            p: 3, 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
          }}>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#FF9800', mb: 1 }}>
              {calculateTotal(data?.agentData, 'performance')}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              총 실적 건수
            </Typography>
          </Box>
        )}
        {agentTableOpen && (
          <ClosingChartTable
            data={data.agentData}
            type="agent"
            rankingType={rankingType}
            total={calculateTotal(data?.agentData, 'performance')}
            headerColor="#FF9800"
          />
        )}
      </Paper>

      {/* 목표 설정 모달 */}
      <TargetSettingModal
        open={showTargetModal}
        onClose={() => setShowTargetModal(false)}
        onSave={handleTargetSave}
        agents={data?.agentData || []}
        excludedAgents={data?.excludedAgents || []}
      />

      {/* 매핑 실패 모달 */}
      <MappingFailureModal
        open={showMappingModal}
        onClose={() => setShowMappingModal(false)}
        failures={mappingFailures}
      />

      {/* 매칭 불일치 모달 */}
      <MatchingMismatchModal
        visible={showMismatchModal}
        onClose={() => setShowMismatchModal(false)}
        matchingMismatches={matchingMismatches}
      />

    </Box>
  );
}

// 마감장표 테이블 컴포넌트 (이미지와 동일한 구조)
function ClosingChartTable({ data, type, rankingType, total, headerColor = 'lightgreen' }) {
  // 랭킹 기준에 따른 정렬
  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      if (rankingType === 'fee') {
        return b.fee - a.fee;
      } else {
        return b.performance - a.performance;
      }
    });
  }, [data, rankingType]);



  const totalFee = calculateTotal(data, 'fee');
  const totalExpectedClosing = calculateTotal(data, 'expectedClosing');

  return (
    <TableContainer sx={{ 
      borderRadius: 1, 
      overflow: 'auto',
      maxWidth: '100%',
      '& .MuiTable-root': {
        tableLayout: 'fixed',
        minWidth: { xs: '1200px', sm: '100%' }
      }
    }}>
      <Table size="small">
        <TableBody>
          {/* 상단 합계 행 (헤더 위쪽) */}
          <TableRow sx={{ 
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            fontWeight: 'bold',
            '& .MuiTableCell-root': {
              borderBottom: '2px solid #dee2e6',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              color: '#495057',
              padding: '8px 4px',
              textAlign: 'center'
            }
          }}>
            <TableCell sx={{ width: { xs: '20px', sm: '40px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}></TableCell>
            <TableCell sx={{ width: { xs: '25px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}></TableCell>
            <TableCell sx={{ width: { xs: '40px', sm: '80px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}></TableCell>
            <TableCell align="right" sx={{ width: { xs: '30px', sm: '70px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{((totalFee + calculateTotal(data, 'support')) * 1000).toLocaleString()}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '30px', sm: '70px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{(totalFee * 1000).toLocaleString()}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{(calculateTotal(data, 'support') * 1000).toLocaleString()}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{calculateTotal(data, 'registeredStores')}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{calculateTotal(data, 'activeStores')}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '20px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{Math.round(calculateTotal(data, 'activeStores') / calculateTotal(data, 'registeredStores') * 100)}%</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{calculateTotal(data, 'registeredStores') - calculateTotal(data, 'activeStores')}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{calculateTotal(data, 'devices')}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{calculateTotal(data, 'sims')}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '20px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{Math.round(calculateTotal(data, 'expectedClosing') / (calculateTotal(data, 'expectedClosing') + calculateTotal(data, 'devices')) * 100)}%</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{total}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '30px', sm: '70px' }, backgroundColor: '#ffcdd2', fontWeight: 'bold', color: '#d32f2f', fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{totalExpectedClosing}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{calculateTotal(data, 'target')}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '20px', sm: '50px' }, color: '#d32f2f', fontWeight: 'bold', fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>
              {Math.round(totalExpectedClosing / calculateTotal(data, 'target') * 100)}%
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      
      <Table size="small">
        <TableHead>
          <TableRow sx={{ 
            backgroundColor: headerColor,
            '& .MuiTableCell-root': {
              color: 'white',
              fontWeight: 'bold',
              fontSize: { xs: '0.6rem', sm: '0.7rem' },
              borderBottom: '2px solid rgba(255,255,255,0.3)',
              padding: { xs: '2px 1px', sm: '8px 4px' },
              textAlign: 'center'
            }
          }}>
            <TableCell sx={{ width: { xs: '20px', sm: '40px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>RANK</TableCell>
            <TableCell sx={{ width: { xs: '25px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>구분</TableCell>
            <TableCell sx={{ width: { xs: '40px', sm: '80px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{type === 'code' ? '코드' : type === 'office' ? '사무실' : type === 'department' ? '소속' : '담당자'}</TableCell>
            <TableCell align="right" sx={{ width: { xs: '30px', sm: '70px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>합계</TableCell>
            <TableCell align="right" sx={{ width: { xs: '30px', sm: '70px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>수수료</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>지원금</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>등록점</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>가동점</TableCell>
            <TableCell align="right" sx={{ width: { xs: '20px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>가동율</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>무실적점</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>보유단말</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>보유유심</TableCell>
            <TableCell align="right" sx={{ width: { xs: '20px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>회전율</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>당월실적</TableCell>
            <TableCell align="right" sx={{ width: { xs: '30px', sm: '70px' }, backgroundColor: 'rgba(255,255,255,0.2)', fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>예상마감</TableCell>
            <TableCell align="right" sx={{ width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>목표</TableCell>
            <TableCell align="right" sx={{ width: { xs: '20px', sm: '50px' }, color: '#FFD700', fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>달성율</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          
          {/* 데이터 행들 */}
          {sortedData.map((item, index) => (
            <TableRow 
              key={index}
              sx={{ 
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.04)',
                  transition: 'background-color 0.2s'
                },
                '& .MuiTableCell-root': {
                  borderBottom: '1px solid rgba(224, 224, 224, 0.5)',
                  fontSize: { xs: '0.5rem', sm: '0.7rem' },
                  padding: { xs: '1px 0px', sm: '6px 4px' },
                  textAlign: 'center'
                }
              }}
            >
              <TableCell sx={{ fontWeight: 'bold', color: '#495057', width: { xs: '20px', sm: '40px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{index + 1}</TableCell>
              <TableCell sx={{ color: '#6c757d', width: { xs: '25px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>
                {type === 'code' ? 'VIP' : type === 'office' ? '사무실' : type === 'department' ? '소속' : '영업'}
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: '#212529', width: { xs: '40px', sm: '80px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>
                {type === 'code' ? item.code : type === 'office' ? item.office : type === 'department' ? item.department : item.agent}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: '#495057', width: { xs: '30px', sm: '70px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{((item.fee + item.support) * 1000).toLocaleString()}</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '30px', sm: '70px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{(item.fee * 1000).toLocaleString()}</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{(item.support * 1000).toLocaleString()}</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{item.registeredStores || 0}</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{item.activeStores || 0}</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '20px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{item.utilization || 0}%</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{(item.registeredStores || 0) - (item.activeStores || 0)}</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{item.devices || 0}</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{item.sims || 0}</TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '20px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{item.rotation || 0}%</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: '#495057', width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{item.performance}</TableCell>
              <TableCell align="right" sx={{ backgroundColor: '#ffcdd2', fontWeight: 'bold', color: '#d32f2f', width: { xs: '30px', sm: '70px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>
                {item.expectedClosing}
              </TableCell>
              <TableCell align="right" sx={{ color: '#6c757d', width: { xs: '25px', sm: '60px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>{item.target || 0}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold', color: item.achievement >= 100 ? '#4caf50' : '#d32f2f', width: { xs: '20px', sm: '50px' }, fontSize: { xs: '0.4rem', sm: '0.7rem' } }}>
                {item.achievement || 0}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// 목표 설정 모달
function TargetSettingModal({ open, onClose, onSave, agents, excludedAgents }) {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [combinations, setCombinations] = useState([]);

  // 담당자-코드 조합 데이터 가져오기
  useEffect(() => {
    if (open) {
      fetchAgentCodeCombinations();
    }
  }, [open]);

  const fetchAgentCodeCombinations = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/closing-chart/agent-code-combinations`);
      const data = await response.json();
      
      if (data.combinations) {
        setCombinations(data.combinations);
        setTargets(data.combinations);
        
        console.log('🔍 [목표설정] 담당자-코드 조합 로드:', {
          총조합수: data.combinations.length,
          샘플: data.combinations.slice(0, 5)
        });
      }
    } catch (error) {
      console.error('담당자-코드 조합 로드 오류:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(targets);
    } finally {
      setLoading(false);
    }
  };

  const handleTargetChange = (index, value) => {
    const newTargets = [...targets];
    newTargets[index].target = parseInt(value) || 0;
    setTargets(newTargets);
  };

  const handleExcludedChange = (index, excluded) => {
    const newTargets = [...targets];
    newTargets[index].excluded = excluded;
    setTargets(newTargets);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>목표 설정</DialogTitle>
      <DialogContent>
        {targets.length === 0 ? (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              담당자-코드 조합 데이터가 없습니다.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              데이터를 먼저 로드해주세요.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>담당자명</TableCell>
                  <TableCell>코드명</TableCell>
                  <TableCell align="right">목표값</TableCell>
                  <TableCell align="center">제외</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {targets.map((target, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {target.agent}
                        {target.excluded && (
                          <Chip 
                            label="제외" 
                            size="small" 
                            color="default" 
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{target.code}</TableCell>
                    <TableCell align="right">
                      <TextField
                        type="number"
                        value={target.target}
                        onChange={(e) => handleTargetChange(index, e.target.value)}
                        size="small"
                        disabled={target.excluded}
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={target.excluded}
                        onChange={(e) => handleExcludedChange(index, e.target.checked)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// 매핑 실패 모달
function MappingFailureModal({ open, onClose, failures }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>매핑 실패 데이터</DialogTitle>
      <DialogContent>
        {failures.length === 0 ? (
          <Typography>매핑 실패 데이터가 없습니다.</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>출고처명</TableCell>
                  <TableCell>담당자명</TableCell>
                  <TableCell>실패 원인</TableCell>
                  <TableCell align="right">발생 건수</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {failures.map((failure, index) => (
                  <TableRow key={index}>
                    <TableCell>{failure.storeCode}</TableCell>
                    <TableCell>{failure.agent}</TableCell>
                    <TableCell>{failure.reason}</TableCell>
                    <TableCell align="right">{failure.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

// 채권장표 준비 중 탭 컴포넌트
function BondChartComingSoonTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <AccountBalanceIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        채권장표
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        기존 OCR 기능 등을 새로운 형태로 재개발 중입니다.<br />
        더 나은 사용자 경험을 제공하기 위해 준비하고 있습니다.
      </Typography>
    </Paper>
  );
}

// 연체채권 탭 컴포넌트
function OverdueBondTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%)',
        color: '#333',
        borderRadius: 3
      }}
    >
      <WarningIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8, color: '#ff6b6b' }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        연체채권
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        연체채권 관련 데이터를 관리할 수 있는 기능을 개발 중입니다.<br />
        더 나은 사용자 경험을 제공하기 위해 준비하고 있습니다.
      </Typography>
    </Paper>
  );
}

// 재초담초채권 탭 컴포넌트
function RechotanchoBondTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        color: '#333',
        borderRadius: 3
      }}
    >
      <AccountBalanceWalletIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8, color: '#4ecdc4' }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        재초담초채권
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        준비 중입니다
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        재초담초채권 관련 데이터를 관리할 수 있는 기능을 개발 중입니다.<br />
        더 나은 사용자 경험을 제공하기 위해 준비하고 있습니다.
      </Typography>
    </Paper>
  );
}

// 가입자증감 탭 컴포넌트
function SubscriberIncreaseTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYearMonth, setSelectedYearMonth] = useState('');
  const [inputData, setInputData] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' 또는 'chart'
  const [hasPermission, setHasPermission] = useState(false);
  const [timeUnit, setTimeUnit] = useState('month'); // 'month' 또는 'year'

  // 숫자 포맷팅 함수
  const formatNumber = (value) => {
    if (value === '' || value === null || value === undefined) {
      return '-';
    }
    const num = Number(value);
    if (isNaN(num)) {
      return '-';
    }
    return num.toLocaleString();
  };

  // API 호출 함수들
  const checkPermission = async () => {
    try {
      console.log('🔍 [가입자증감] 권한 확인 API 호출 시작');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/subscriber-increase/access`, {
        credentials: 'include'
      });
      
      console.log('🔍 [가입자증감] 권한 확인 응답 상태:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 [가입자증감] 권한 확인 실패:', response.status, errorText);
        throw new Error(`권한 확인 실패: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('🔍 [가입자증감] 권한 확인 결과:', result);
      setHasPermission(result.hasAccess);
      return result.hasAccess;
    } catch (error) {
      console.error('🔍 [가입자증감] 권한 확인 오류:', error);
      return false;
    }
  };

  const initializeSheet = async () => {
    try {
      console.log('🔍 [가입자증감] 시트 초기화 API 호출 시작');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/subscriber-increase/init-sheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      console.log('🔍 [가입자증감] 시트 초기화 응답 상태:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 [가입자증감] 시트 초기화 실패:', response.status, errorText);
        throw new Error(`시트 초기화 실패: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('🔍 [가입자증감] 시트 초기화 결과:', result);
      console.log('🔍 [가입자증감] 시트 초기화 성공 여부:', result.success);
      console.log('🔍 [가입자증감] 시트 초기화 데이터:', result.data);
      console.log('🔍 [가입자증감] 시트 초기화 데이터 길이:', result.data ? result.data.length : 'null');
      
      if (result.success) {
        setData(result.data);
        return result.data;
      }
      console.error('🔍 [가입자증감] 시트 초기화 실패 - success가 false');
      return null;
    } catch (error) {
      console.error('🔍 [가입자증감] 시트 초기화 오류:', error);
      return null;
    }
  };

  const fetchData = async () => {
    try {
      console.log('🔍 [가입자증감] 데이터 조회 API 호출 시작');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/subscriber-increase/data`, {
        credentials: 'include'
      });
      
      console.log('🔍 [가입자증감] 데이터 조회 응답 상태:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 [가입자증감] 데이터 조회 실패:', response.status, errorText);
        
        // Google Sheets API 할당량 초과 오류 감지
        if (response.status === 500 && errorText.includes('Quota exceeded')) {
          setError('Google Sheets API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
          return null;
        }
        
        throw new Error(`데이터 조회 실패: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('🔍 [가입자증감] 데이터 조회 결과:', result);
      console.log('🔍 [가입자증감] 데이터 조회 성공 여부:', result.success);
      console.log('🔍 [가입자증감] 데이터 조회 데이터:', result.data);
      console.log('🔍 [가입자증감] 데이터 조회 데이터 길이:', result.data ? result.data.length : 'null');
      
      if (result.success) {
        setData(result.data);
        setError(null); // 성공 시 오류 메시지 초기화
        return result.data;
      }
      
      // 서버에서 오류 메시지가 있는 경우
      if (result.error && result.message && result.message.includes('Quota exceeded')) {
        setError('Google Sheets API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
        return null;
      }
      
      console.log('🔍 [가입자증감] 데이터 조회 실패 - success가 false 또는 데이터 없음');
      return null;
    } catch (error) {
      console.error('🔍 [가입자증감] 데이터 조회 오류:', error);
      
      // 네트워크 오류나 CORS 오류 감지
      if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
        setError('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.');
      } else {
        setError('데이터를 불러올 수 없습니다.');
      }
      
      return null;
    }
  };

  const saveData = async (yearMonth, agentCode, type, value) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/subscriber-increase/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ yearMonth, agentCode, type, value })
      });
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('데이터 저장 오류:', error);
      return false;
    }
  };

  const deleteData = async (yearMonth, agentCode, type) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/subscriber-increase/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ yearMonth, agentCode, type })
      });
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('데이터 삭제 오류:', error);
      return false;
    }
  };

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 [가입자증감] 컴포넌트 초기화 시작');
        
        const hasAccess = await checkPermission();
        console.log('🔍 [가입자증감] 권한 확인 결과:', hasAccess);
        
        if (!hasAccess) {
          setError('가입자증감 기능에 접근할 권한이 없습니다.');
          setLoading(false);
          return;
        }

        // 먼저 데이터 조회 시도
        console.log('🔍 [가입자증감] 기존 데이터 조회 시도');
        let sheetData = await fetchData();
        
        // 데이터가 없으면 시트 초기화
        if (!sheetData || sheetData.length === 0) {
          console.log('🔍 [가입자증감] 기존 데이터 없음, 시트 초기화 시도');
          sheetData = await initializeSheet();
        }

        if (sheetData && sheetData.length > 0) {
          console.log('🔍 [가입자증감] 데이터 로드 성공:', sheetData.length, '행');
          setData(sheetData);
          // 기본 년월 설정 (첫 번째 데이터 컬럼)
          if (sheetData[0] && sheetData[0].length > 3) {
            setSelectedYearMonth(sheetData[0][3]);
            console.log('🔍 [가입자증감] 기본 년월 설정:', sheetData[0][3]);
          }
        } else {
          console.error('🔍 [가입자증감] 데이터 로드 실패');
          setError('데이터를 불러올 수 없습니다. 시트 초기화에 실패했을 수 있습니다.');
        }
      } catch (error) {
        console.error('🔍 [가입자증감] 초기화 중 오류:', error);
        setError('초기화 중 오류가 발생했습니다: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  // 입력 데이터 변경 핸들러
  const handleInputChange = (agentCode, type, value) => {
    setInputData(prev => ({
      ...prev,
      [`${agentCode}_${type}`]: value
    }));
  };

  // 천단위 구분 서식 함수
  const formatNumberWithCommas = (value) => {
    if (!value || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString();
  };

  // 천단위 구분 제거 함수
  const removeCommas = (value) => {
    if (!value) return '';
    return value.toString().replace(/,/g, '');
  };

  // 월별 합계 계산 함수
  const calculateMonthlyTotals = (type) => {
    const totals = Array.from({length: 12}, (_, i) => {
      const month = i + 1;
      const yearMonthKey = `${selectedYearMonth}년 ${month}월`;
      const colIndex = data[0].findIndex(header => header === yearMonthKey);
      
      let total = 0;
      agentData.forEach(agent => {
        if (colIndex !== -1) {
          const value = type === 'subscriber' ? agent.subscriberData[colIndex] : agent.feeData[colIndex];
          const numValue = parseFloat(value) || 0;
          total += numValue;
        }
      });
      return total;
    });
    return totals;
  };

  // 년간 데이터 일괄 저장 핸들러
  const handleYearlySave = async () => {
    setSaving(true);
    try {
      // 년단위 모든 월 데이터를 일괄 저장용 데이터로 변환
      const bulkData = [];
      agentData.forEach(agent => {
        Array.from({length: 12}, (_, i) => i + 1).forEach(month => {
          const yearMonthKey = `${selectedYearMonth}년 ${month}월`;
          const subscriberKey = `${agent.code}_${yearMonthKey}_가입자수`;
          const feeKey = `${agent.code}_${yearMonthKey}_관리수수료`;
          
          if (inputData[subscriberKey] !== undefined && inputData[subscriberKey] !== '') {
            bulkData.push({
              yearMonth: yearMonthKey,
              agentCode: agent.code,
              type: '가입자수',
              value: inputData[subscriberKey]
            });
          }
          if (inputData[feeKey] !== undefined && inputData[feeKey] !== '') {
            bulkData.push({
              yearMonth: yearMonthKey,
              agentCode: agent.code,
              type: '관리수수료',
              value: inputData[feeKey]
            });
          }
        });
      });
      
      if (bulkData.length === 0) {
        alert('저장할 데이터가 없습니다.');
        return;
      }
      
      // 일괄 저장 API 호출
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/subscriber-increase/bulk-save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bulkData })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        
        // Google Sheets API 할당량 초과 오류 감지
        if (response.status === 500 && errorText.includes('Quota exceeded')) {
          alert('Google Sheets API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
          return;
        }
        
        throw new Error(`저장 실패: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        alert(`년간 데이터가 성공적으로 저장되었습니다!\n저장된 항목: ${result.results.successCount}개`);
        // 데이터 새로고침
        await fetchData();
      } else {
        // 서버에서 오류 메시지가 있는 경우
        if (result.error && result.message && result.message.includes('Quota exceeded')) {
          alert('Google Sheets API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
        } else {
          alert(`저장 중 오류가 발생했습니다: ${result.error}`);
        }
      }
      
    } catch (error) {
      console.error('년간 데이터 저장 오류:', error);
      alert('년간 데이터 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 데이터 저장 핸들러
  const handleSave = async (agentCode, type, customYearMonth = null) => {
    const yearMonth = customYearMonth || selectedYearMonth;
    
    if (!yearMonth) {
      alert(timeUnit === 'month' ? '년월을 선택해주세요.' : '년도를 선택해주세요.');
      return;
    }

    const inputKey = customYearMonth ? 
      `${agentCode}_${yearMonth}_${type}` : 
      `${agentCode}_${type}`;
    const value = inputData[inputKey];
    
    if (value === undefined || value === '') {
      alert('값을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const success = await saveData(yearMonth, agentCode, type, value);
      if (success) {
        // 데이터 새로고침
        await fetchData();
        // 입력 필드 초기화
        setInputData(prev => {
          const newData = { ...prev };
          delete newData[inputKey];
          return newData;
        });
        if (!customYearMonth) {
          alert('데이터가 성공적으로 저장되었습니다.');
        }
      } else {
        if (!customYearMonth) {
          alert('데이터 저장에 실패했습니다.');
        }
      }
    } catch (error) {
      alert('데이터 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 데이터 삭제 핸들러
  const handleDelete = async (agentCode, type) => {
    if (!selectedYearMonth) {
      alert('년월을 선택해주세요.');
      return;
    }

    if (!window.confirm(`정말로 ${agentCode}의 ${type} 데이터를 삭제하시겠습니까?`)) {
      return;
    }

    setSaving(true);
    try {
      const success = await deleteData(selectedYearMonth, agentCode, type);
      if (success) {
        // 데이터 새로고침
        await fetchData();
        alert('데이터가 성공적으로 삭제되었습니다.');
      } else {
        alert('데이터 삭제에 실패했습니다.');
      }
    } catch (error) {
      alert('데이터 삭제 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 년월 옵션 생성
  const getYearMonthOptions = () => {
    if (!data || data.length === 0) return [];
    
    const headers = data[0];
    return headers.slice(3).map(header => ({
      value: header,
      label: header
    }));
  };

  // 년도 옵션 생성
  const getYearOptions = () => {
    if (!data || data.length === 0) return [];
    
    const headers = data[0];
    const years = new Set();
    
    headers.slice(3).forEach(header => {
      if (header && header.includes('년')) {
        const yearMatch = header.match(/(\d{4})년/);
        if (yearMatch) {
          years.add(yearMatch[1]);
        }
      }
    });
    
    return Array.from(years).sort();
  };

  // 대리점 데이터 추출
  const getAgentData = () => {
    if (!data || data.length < 4) return [];
    
    const agents = [];
    const agentCodes = ['306891', '315835', '316558', '314942', '316254', '315835(제외)'];
    
    agentCodes.forEach(code => {
      const subscriberRow = data.find(row => row[0] === code && row[2] === '가입자수');
      const feeRow = data.find(row => row[0] === code && row[2] === '관리수수료');
      
      if (subscriberRow && feeRow) {
        // 315835(제외) 코드의 경우 "경인(제외)"로 표시
        const displayName = code === '315835(제외)' ? '경인(제외)' : subscriberRow[1];
        const displayCode = code;
        
        agents.push({
          code: code,
          displayCode: displayCode,
          name: displayName,
          subscriberData: subscriberRow,
          feeData: feeRow
        });
      }
    });
    
    return agents;
  };

  // 합계 데이터 추출
  const getTotalData = () => {
    if (!data || data.length < 3) return null;
    
    const totalSubscriberRow = data[1]; // 합계 - 가입자수
    const totalFeeRow = data[2]; // 합계 - 관리수수료
    
    return {
      subscriberData: totalSubscriberRow,
      feeData: totalFeeRow
    };
  };

  // 로딩 상태
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>데이터를 불러오는 중...</Typography>
      </Box>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <AlertTitle>오류</AlertTitle>
        {error}
      </Alert>
    );
  }

  // 권한 없음
  if (!hasPermission) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        <AlertTitle>권한 없음</AlertTitle>
        가입자증감 기능에 접근할 권한이 없습니다. 관리자에게 문의하세요.
      </Alert>
    );
  }

  const agentData = getAgentData();
  const totalData = getTotalData();
  const yearMonthOptions = getYearMonthOptions();
  const yearOptions = getYearOptions();

  // 년간 데이터 계산 함수
  const getYearlyData = (selectedYear) => {
    if (!data || !selectedYear) return { agentData: [], totalData: null };

    // 해당 년도의 월 컬럼 인덱스 찾기
    const yearColumns = [];
    data[0].forEach((header, index) => {
      if (header && header.includes(`${selectedYear}년`)) {
        yearColumns.push(index);
      }
    });

    if (yearColumns.length === 0) return { agentData: [], totalData: null };

    // 대리점별 년간 데이터 계산
    const yearlyAgentData = agentData.map(agent => {
      let yearlySubscriberTotal = 0;
      let yearlyFeeTotal = 0;

      yearColumns.forEach(colIndex => {
        const subscriberValue = agent.subscriberData[colIndex];
        const feeValue = agent.feeData[colIndex];
        
        if (subscriberValue !== '' && subscriberValue !== null && subscriberValue !== undefined) {
          yearlySubscriberTotal += parseFloat(subscriberValue) || 0;
        }
        if (feeValue !== '' && feeValue !== null && feeValue !== undefined) {
          yearlyFeeTotal += parseFloat(feeValue) || 0;
        }
      });

      return {
        ...agent,
        yearlySubscriberTotal,
        yearlyFeeTotal
      };
    });

    // 전체 합계 계산
    const yearlyTotalSubscriber = yearlyAgentData.reduce((sum, agent) => sum + agent.yearlySubscriberTotal, 0);
    const yearlyTotalFee = yearlyAgentData.reduce((sum, agent) => sum + agent.yearlyFeeTotal, 0);

    return {
      agentData: yearlyAgentData,
      totalData: {
        subscriberData: [yearlyTotalSubscriber],
        feeData: [yearlyTotalFee]
      }
    };
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none' }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold', color: '#f5576c' }}>
          가입자증감 관리
        </Typography>
        
        {/* 통합 선택 영역 */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 3, 
          mb: 3,
          p: 2,
          backgroundColor: '#f8f9fa',
          borderRadius: 2,
          border: '1px solid #e0e0e0'
        }}>
          {/* 시간 단위 선택 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', minWidth: 'fit-content' }}>
              시간 단위:
          </Typography>
          <ToggleButtonGroup
            value={timeUnit}
            exclusive
            onChange={(e, newUnit) => {
              setTimeUnit(newUnit);
              setSelectedYearMonth('');
            }}
            size="small"
          >
              <ToggleButton value="month">월단위</ToggleButton>
              <ToggleButton value="year">년단위</ToggleButton>
          </ToggleButtonGroup>
        </Box>

          {/* 년월/년도 선택 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', minWidth: 'fit-content' }}>
              {timeUnit === 'month' ? '대상 년월:' : '대상 년도:'}
          </Typography>
          <FormControl sx={{ minWidth: 200 }}>
            <Select
              value={selectedYearMonth}
                label={timeUnit === 'month' ? '년월 선택' : '년도 선택'}
              onChange={(e) => setSelectedYearMonth(e.target.value)}
            >
              {timeUnit === 'month' ? 
                yearMonthOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                )) :
                yearOptions.map((year) => (
                  <MenuItem key={year} value={year}>
                      {year}년
                    </MenuItem>
                ))
              }
            </Select>
          </FormControl>
        </Box>

          {/* 뷰 모드 선택 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', minWidth: 'fit-content' }}>
              표시 모드:
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => setViewMode(newMode)}
            size="small"
          >
              <ToggleButton value="table">숫자형식</ToggleButton>
              <ToggleButton value="chart">그래프형식</ToggleButton>
          </ToggleButtonGroup>
          </Box>
        </Box>
      </Box>

      {viewMode === 'table' ? (
        <Box>
          {/* 합계 테이블 */}
          {(timeUnit === 'month' ? totalData : getYearlyData(selectedYearMonth).totalData) && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                  📊 전체 합계 {timeUnit === 'year' ? '(년간)' : ''}
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>구분</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>
                          {selectedYearMonth || (timeUnit === 'month' ? '년월 선택' : '년도 선택')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>가입자수 합계</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {timeUnit === 'month' ? (
                            selectedYearMonth && totalData.subscriberData ? 
                              formatNumber(totalData.subscriberData[totalData.subscriberData.findIndex((_, i) => data[0][i] === selectedYearMonth)]) + '명'
                              : '-'
                          ) : (
                            selectedYearMonth && getYearlyData(selectedYearMonth).totalData ? 
                              formatNumber(getYearlyData(selectedYearMonth).totalData.subscriberData[0]) + '명'
                              : '-'
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ backgroundColor: '#f3e5f5' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>관리수수료 합계</TableCell>
                        <TableCell sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {timeUnit === 'month' ? (
                            selectedYearMonth && totalData.feeData ? 
                              formatNumber(totalData.feeData[totalData.feeData.findIndex((_, i) => data[0][i] === selectedYearMonth)]) + '원'
                              : '-'
                          ) : (
                            selectedYearMonth && getYearlyData(selectedYearMonth).totalData ? 
                              formatNumber(getYearlyData(selectedYearMonth).totalData.feeData[0]) + '원'
                              : '-'
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}


          {/* 월별 데이터 입력 테이블 - 개선된 디자인 */}
          {timeUnit === 'year' && selectedYearMonth && (
            <Card sx={{ mb: 3, boxShadow: 3 }}>
              <CardContent>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  mb: 3,
                  p: 2,
                  background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
                  borderRadius: 2,
                  color: 'white'
                }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    📅 {selectedYearMonth}년 월별 데이터 입력
                </Typography>
                  <Button
                    variant="contained"
                    onClick={handleYearlySave}
                    disabled={saving}
                    sx={{ 
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(255,255,255,0.3)'
                      }
                    }}
                  >
                    {saving ? '저장 중...' : '년간 데이터 일괄 저장'}
                  </Button>
                </Box>
                
                <TableContainer 
                  component={Paper} 
                  variant="outlined" 
                  sx={{ 
                    width: '100%',
                    maxWidth: 'none',
                    overflowX: 'auto',
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <Table size="small" sx={{ minWidth: 1800, width: '100%' }}>
                    <TableHead>
                      {/* 월별 헤더 */}
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell sx={{ 
                          fontWeight: 'bold', 
                          width: '12%', 
                          minWidth: 120,
                          backgroundColor: '#e3f2fd',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          대리점코드
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold', 
                          width: '15%', 
                          minWidth: 100,
                          backgroundColor: '#e3f2fd',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          대리점명
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold', 
                          width: '12%', 
                          minWidth: 100,
                          backgroundColor: '#e3f2fd',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          구분
                        </TableCell>
                        {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                          <TableCell key={month} sx={{ 
                            fontWeight: 'bold', 
                            textAlign: 'center', 
                            width: '5%', 
                            minWidth: 70, 
                            maxWidth: 80,
                            padding: '8px 6px',
                            backgroundColor: month % 2 === 0 ? '#f8f9fa' : '#ffffff',
                            borderRight: '1px solid #e0e0e0'
                          }}>
                            {month}월
                          </TableCell>
                        ))}
                      </TableRow>
                      
                      {/* 가입자수 합계 행 */}
                      <TableRow sx={{ backgroundColor: '#e8f5e8' }}>
                        <TableCell sx={{ 
                          fontWeight: 'bold',
                          textAlign: 'center',
                          backgroundColor: '#c8e6c9',
                          borderRight: '1px solid #e0e0e0',
                          color: '#1976d2'
                        }}>
                          합계
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold',
                          textAlign: 'center',
                          backgroundColor: '#c8e6c9',
                          borderRight: '1px solid #e0e0e0',
                          color: '#1976d2'
                        }}>
                          가입자수
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold',
                          textAlign: 'center',
                          backgroundColor: '#c8e6c9',
                          borderRight: '1px solid #e0e0e0',
                          color: '#1976d2'
                        }}>
                          월별합계
                        </TableCell>
                        {calculateMonthlyTotals('subscriber').map((total, index) => (
                          <TableCell key={index} sx={{ 
                            fontWeight: 'bold',
                            textAlign: 'center',
                            backgroundColor: '#c8e6c9',
                            borderRight: '1px solid #e0e0e0',
                            color: '#1976d2',
                            fontSize: '0.8rem'
                          }}>
                            {formatNumberWithCommas(total)}
                          </TableCell>
                        ))}
                      </TableRow>
                      
                      {/* 관리수수료 합계 행 */}
                      <TableRow sx={{ backgroundColor: '#f3e5f5' }}>
                        <TableCell sx={{ 
                          fontWeight: 'bold',
                          textAlign: 'center',
                          backgroundColor: '#e1bee7',
                          borderRight: '1px solid #e0e0e0',
                          color: '#7b1fa2'
                        }}>
                          합계
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold',
                          textAlign: 'center',
                          backgroundColor: '#e1bee7',
                          borderRight: '1px solid #e0e0e0',
                          color: '#7b1fa2'
                        }}>
                          관리수수료
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold',
                          textAlign: 'center',
                          backgroundColor: '#e1bee7',
                          borderRight: '1px solid #e0e0e0',
                          color: '#7b1fa2'
                        }}>
                          월별합계
                        </TableCell>
                        {calculateMonthlyTotals('fee').map((total, index) => (
                          <TableCell key={index} sx={{ 
                            fontWeight: 'bold',
                            textAlign: 'center',
                            backgroundColor: '#e1bee7',
                            borderRight: '1px solid #e0e0e0',
                            color: '#7b1fa2',
                            fontSize: '0.8rem'
                          }}>
                            {formatNumberWithCommas(total)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {agentData.map((agent, agentIndex) => (
                        <React.Fragment key={agent.code}>
                          {/* 가입자수 행 */}
                          <TableRow sx={{ 
                            backgroundColor: agentIndex % 2 === 0 ? '#fafafa' : '#ffffff',
                            '&:hover': { backgroundColor: '#f0f8ff' }
                          }}>
                            <TableCell sx={{ 
                              fontWeight: 'bold',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#e8f5e8',
                              width: '12%',
                              minWidth: 120,
                              textAlign: 'center'
                            }}>
                              {agent.displayCode || agent.code}
                            </TableCell>
                            <TableCell sx={{ 
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#e8f5e8',
                              width: '15%',
                              minWidth: 100,
                              textAlign: 'center'
                            }}>
                              {agent.name}
                            </TableCell>
                            <TableCell sx={{ 
                              fontWeight: 'bold', 
                              color: '#1976d2',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#e8f5e8',
                              width: '12%',
                              minWidth: 100,
                              textAlign: 'center'
                            }}>
                              가입자수
                            </TableCell>
                            {Array.from({length: 12}, (_, i) => i + 1).map(month => {
                              const yearMonthKey = `${selectedYearMonth}년 ${month}월`;
                              const colIndex = data[0].findIndex(header => header === yearMonthKey);
                              const currentValue = colIndex !== -1 ? agent.subscriberData[colIndex] : '';
                              
                              return (
                                <TableCell key={month} sx={{ 
                                  textAlign: 'center', 
                                  padding: '6px 4px',
                                  width: '5%',
                                  minWidth: 70,
                                  maxWidth: 80,
                                  borderRight: '1px solid #e0e0e0',
                                  backgroundColor: month % 2 === 0 ? '#f8f9fa' : '#ffffff'
                                }}>
                              <TextField
                                    type="text"
                                size="small"
                                    placeholder="0"
                                    value={formatNumberWithCommas(inputData[`${agent.code}_${yearMonthKey}_가입자수`] || currentValue || '')}
                                    onChange={(e) => {
                                      const rawValue = removeCommas(e.target.value);
                                      const newInputData = { ...inputData };
                                      newInputData[`${agent.code}_${yearMonthKey}_가입자수`] = rawValue;
                                      setInputData(newInputData);
                                    }}
                                sx={{ 
                                      width: '100%',
                                      '& .MuiInputBase-input': {
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        padding: '6px 4px',
                                        textAlign: 'center',
                                        color: '#1976d2'
                                      },
                                      '& .MuiOutlinedInput-root': {
                                        '& fieldset': {
                                          borderWidth: '2px',
                                          borderColor: '#1976d2'
                                        },
                                        '&:hover fieldset': {
                                          borderColor: '#1565c0'
                                        },
                                        '&.Mui-focused fieldset': {
                                          borderColor: '#1565c0',
                                          borderWidth: '3px'
                                        }
                                  }
                                }}
                                inputProps={{
                                  style: { 
                                    textAlign: 'center', 
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    color: '#1976d2'
                                  },
                                  inputMode: 'numeric',
                                  pattern: '-?[0-9,]*'
                                }}
                              />
                            </TableCell>
                              );
                            })}
                          </TableRow>
                          
                          {/* 관리수수료 행 */}
                          <TableRow sx={{ 
                            backgroundColor: agentIndex % 2 === 0 ? '#fafafa' : '#ffffff',
                            '&:hover': { backgroundColor: '#f0f8ff' }
                          }}>
                            <TableCell sx={{ 
                              fontWeight: 'bold',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#f3e5f5',
                              width: '12%',
                              minWidth: 120,
                              textAlign: 'center'
                            }}>
                              {agent.displayCode || agent.code}
                            </TableCell>
                            <TableCell sx={{ 
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#f3e5f5',
                              width: '15%',
                              minWidth: 100,
                              textAlign: 'center'
                            }}>
                              {agent.name}
                            </TableCell>
                            <TableCell sx={{ 
                              fontWeight: 'bold', 
                              color: '#7b1fa2',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#f3e5f5',
                              width: '12%',
                              minWidth: 100,
                              textAlign: 'center'
                            }}>
                              관리수수료
                            </TableCell>
                            {Array.from({length: 12}, (_, i) => i + 1).map(month => {
                              const yearMonthKey = `${selectedYearMonth}년 ${month}월`;
                              const colIndex = data[0].findIndex(header => header === yearMonthKey);
                              const currentValue = colIndex !== -1 ? agent.feeData[colIndex] : '';
                              
                              return (
                                <TableCell key={month} sx={{ 
                                  textAlign: 'center', 
                                  padding: '6px 4px',
                                  width: '5%',
                                  minWidth: 70,
                                  maxWidth: 80,
                                  borderRight: '1px solid #e0e0e0',
                                  backgroundColor: month % 2 === 0 ? '#f8f9fa' : '#ffffff'
                                }}>
                              <TextField
                                    type="text"
                                size="small"
                                    placeholder="0"
                                    value={formatNumberWithCommas(inputData[`${agent.code}_${yearMonthKey}_관리수수료`] || currentValue || '')}
                                    onChange={(e) => {
                                      const rawValue = removeCommas(e.target.value);
                                      const newInputData = { ...inputData };
                                      newInputData[`${agent.code}_${yearMonthKey}_관리수수료`] = rawValue;
                                      setInputData(newInputData);
                                    }}
                                sx={{ 
                                      width: '100%',
                                      '& .MuiInputBase-input': {
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        padding: '6px 4px',
                                        textAlign: 'center',
                                        color: '#7b1fa2'
                                      },
                                      '& .MuiOutlinedInput-root': {
                                        '& fieldset': {
                                          borderWidth: '2px',
                                          borderColor: '#7b1fa2'
                                        },
                                        '&:hover fieldset': {
                                          borderColor: '#6a1b9a'
                                        },
                                        '&.Mui-focused fieldset': {
                                          borderColor: '#6a1b9a',
                                          borderWidth: '3px'
                                        }
                                  }
                                }}
                                inputProps={{
                                  style: { 
                                    textAlign: 'center', 
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    color: '#7b1fa2'
                                  },
                                  inputMode: 'numeric',
                                  pattern: '-?[0-9,]*'
                                }}
                              />
                            </TableCell>
                              );
                            })}
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {/* 월단위 입력 테이블 */}
          {timeUnit === 'month' && selectedYearMonth && (
            <Card sx={{ mb: 3, boxShadow: 3 }}>
              <CardContent>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  mb: 3,
                  p: 2,
                  background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
                  borderRadius: 2,
                  color: 'white'
                }}>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                    📝 {selectedYearMonth} 월별 데이터 입력
                </Typography>
                </Box>
                
                <TableContainer 
                  component={Paper} 
                  variant="outlined" 
                  sx={{ 
                    width: '100%',
                    maxWidth: 'none',
                    overflowX: 'auto',
                    borderRadius: 2,
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <Table size="small" sx={{ minWidth: 1200, width: '100%' }}>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                        <TableCell sx={{ 
                          fontWeight: 'bold', 
                          width: '15%',
                          backgroundColor: '#e3f2fd',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          대리점코드
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold', 
                          width: '20%',
                          backgroundColor: '#e3f2fd',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          대리점명
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold', 
                          width: '15%',
                          backgroundColor: '#e3f2fd',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          구분
                        </TableCell>
                        <TableCell sx={{ 
                            fontWeight: 'bold', 
                            textAlign: 'center', 
                          width: '20%',
                          backgroundColor: '#e3f2fd',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          {selectedYearMonth}
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold', 
                          textAlign: 'center',
                          width: '15%',
                          backgroundColor: '#e3f2fd',
                          borderRight: '1px solid #e0e0e0'
                        }}>
                          입력
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 'bold', 
                          textAlign: 'center',
                          width: '15%',
                          backgroundColor: '#e3f2fd'
                        }}>
                          저장/삭제
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {agentData.map((agent, agentIndex) => (
                        <React.Fragment key={agent.code}>
                          {/* 가입자수 행 */}
                          <TableRow sx={{ 
                            backgroundColor: agentIndex % 2 === 0 ? '#fafafa' : '#ffffff',
                            '&:hover': { backgroundColor: '#f0f8ff' }
                          }}>
                            <TableCell sx={{ 
                              fontWeight: 'bold',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#e8f5e8'
                            }}>
                              {agent.displayCode || agent.code}
                            </TableCell>
                            <TableCell sx={{ 
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#e8f5e8'
                            }}>
                              {agent.name}
                            </TableCell>
                            <TableCell sx={{ 
                              fontWeight: 'bold', 
                              color: '#1976d2',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#e8f5e8'
                            }}>
                              가입자수
                            </TableCell>
                            <TableCell sx={{ 
                              textAlign: 'right',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#e8f5e8'
                            }}>
                              {selectedYearMonth ? 
                                formatNumber(agent.subscriberData[agent.subscriberData.findIndex((_, i) => data[0][i] === selectedYearMonth)]) + '명'
                                : '-'
                              }
                            </TableCell>
                            <TableCell sx={{ 
                                  textAlign: 'center', 
                              borderRight: '1px solid #e0e0e0'
                                }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                placeholder="입력"
                                value={inputData[`${agent.code}_가입자수`] || ''}
                                onChange={(e) => handleInputChange(agent.code, '가입자수', e.target.value)}
                                    sx={{ 
                                      width: '100%',
                                      '& input[type=number]': {
                                        MozAppearance: 'textfield',
                                      },
                                      '& input[type=number]::-webkit-outer-spin-button': {
                                        WebkitAppearance: 'none',
                                        margin: 0,
                                      },
                                      '& input[type=number]::-webkit-inner-spin-button': {
                                        WebkitAppearance: 'none',
                                        margin: 0,
                                      }
                                    }}
                                    inputProps={{
                                  style: { textAlign: 'center' },
                                      inputMode: 'numeric',
                                      pattern: '-?[0-9]*'
                                    }}
                                    InputProps={{
                                      inputProps: {
                                        min: 0,
                                        step: 1
                                      }
                                    }}
                                  />
                                </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  onClick={() => handleSave(agent.code, '가입자수')}
                                  disabled={saving || !selectedYearMonth}
                                >
                                  저장
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleDelete(agent.code, '가입자수')}
                                  disabled={saving || !selectedYearMonth}
                                >
                                  삭제
                                </Button>
                              </Box>
                            </TableCell>
                          </TableRow>
                          
                          {/* 관리수수료 행 */}
                          <TableRow sx={{ 
                            backgroundColor: agentIndex % 2 === 0 ? '#fafafa' : '#ffffff',
                            '&:hover': { backgroundColor: '#f0f8ff' }
                          }}>
                            <TableCell sx={{ 
                              fontWeight: 'bold',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#f3e5f5'
                            }}>
                              {agent.displayCode || agent.code}
                            </TableCell>
                            <TableCell sx={{ 
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#f3e5f5'
                            }}>
                              {agent.name}
                            </TableCell>
                            <TableCell sx={{ 
                              fontWeight: 'bold', 
                              color: '#7b1fa2',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#f3e5f5'
                            }}>
                              관리수수료
                            </TableCell>
                            <TableCell sx={{ 
                              textAlign: 'right',
                              borderRight: '1px solid #e0e0e0',
                              backgroundColor: '#f3e5f5'
                            }}>
                              {selectedYearMonth ? 
                                formatNumber(agent.feeData[agent.feeData.findIndex((_, i) => data[0][i] === selectedYearMonth)]) + '원'
                                : '-'
                              }
                            </TableCell>
                            <TableCell sx={{ 
                                  textAlign: 'center', 
                              borderRight: '1px solid #e0e0e0'
                                }}>
                                  <TextField
                                    type="number"
                                    size="small"
                                placeholder="입력"
                                value={inputData[`${agent.code}_관리수수료`] || ''}
                                onChange={(e) => handleInputChange(agent.code, '관리수수료', e.target.value)}
                                    sx={{ 
                                      width: '100%',
                                      '& input[type=number]': {
                                        MozAppearance: 'textfield',
                                      },
                                      '& input[type=number]::-webkit-outer-spin-button': {
                                        WebkitAppearance: 'none',
                                        margin: 0,
                                      },
                                      '& input[type=number]::-webkit-inner-spin-button': {
                                        WebkitAppearance: 'none',
                                        margin: 0,
                                      }
                                    }}
                                    inputProps={{
                                  style: { textAlign: 'center' },
                                      inputMode: 'numeric',
                                      pattern: '-?[0-9]*'
                                    }}
                                    InputProps={{
                                      inputProps: {
                                        min: 0,
                                        step: 1
                                      }
                                    }}
                                  />
                                </TableCell>
                            <TableCell sx={{ textAlign: 'center' }}>
                              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                  <Button
                                  size="small"
                    variant="contained"
                                  color="secondary"
                                  onClick={() => handleSave(agent.code, '관리수수료')}
                                  disabled={saving || !selectedYearMonth}
                                >
                                  저장
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  onClick={() => handleDelete(agent.code, '관리수수료')}
                                  disabled={saving || !selectedYearMonth}
                                >
                                  삭제
                  </Button>
                </Box>
                                </TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
            </CardContent>
          </Card>
          )}
        </Box>
      ) : (
        <Box>
          {/* 그래프 표시 */}
          <Card sx={{ mb: 3, width: '100%' }}>
            <CardContent sx={{ width: '100%' }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#388e3c' }}>
                📈 가입자수 추이 {timeUnit === 'year' ? '(월별 흐름)' : '(막대 그래프)'}
              </Typography>
              <Box sx={{ height: 650, width: '100%' }}>
                {timeUnit === 'year' && selectedYearMonth ? (
                  <Line 
                    data={{
                      labels: Array.from({length: 12}, (_, i) => `${i + 1}월`),
                      datasets: agentData.map((agent, index) => {
                        const colors = [
                          'rgba(54, 162, 235, 1)',   // 파란색
                          'rgba(255, 99, 132, 1)',   // 빨간색
                          'rgba(75, 192, 192, 1)',   // 청록색
                          'rgba(255, 205, 86, 1)',   // 노란색
                          'rgba(153, 102, 255, 1)'   // 보라색
                        ];
                        const monthData = Array.from({length: 12}, (_, i) => {
                          const yearMonthKey = `${selectedYearMonth}년 ${i + 1}월`;
                          const colIndex = data[0].findIndex(header => header === yearMonthKey);
                          if (colIndex !== -1) {
                            const value = agent.subscriberData[colIndex];
                            return value !== '' && value !== null && value !== undefined ? (parseFloat(value) || 0) : 0;
                          }
                          return 0;
                        });
                        
                        return {
                          label: `${agent.name} (${agent.code})`,
                          data: monthData,
                          borderColor: colors[index % colors.length],
                          backgroundColor: colors[index % colors.length] + '20',
                          borderWidth: 2,
                          borderDash: [5, 5], // 점선
                          fill: false,
                          tension: 0.1
                        };
                      })
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: `가입자수 월별 흐름 - ${selectedYearMonth}년`
                        },
                        datalabels: {
                          display: true,
                          color: '#333',
                          font: {
                            size: 10,
                            weight: 'bold'
                          },
                          formatter: function(value, context) {
                            return value > 0 ? value.toLocaleString() : '';
                          },
                          anchor: 'end',
                          align: 'top',
                          offset: 4
                        }
                      },
                      scales: {
                        x: {
                          title: {
                            display: true,
                            text: '월'
                          }
                        },
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: '가입자수 (명)'
                          },
                          ticks: {
                            callback: function(value) {
                              return value.toLocaleString() + '명';
                            }
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <Bar 
                    data={{
                      labels: agentData.map(agent => `${agent.name}\n(${agent.code})`),
                      datasets: [{
                        label: '가입자수',
                        data: agentData.map(agent => {
                          if (!selectedYearMonth) return 0;
                          const index = agent.subscriberData.findIndex((_, i) => data[0][i] === selectedYearMonth);
                          const value = agent.subscriberData[index];
                          return index !== -1 && value !== '' ? (parseFloat(value) || 0) : 0;
                        }),
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: `가입자수 현황 - ${selectedYearMonth || '년월 선택'}`
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function(value) {
                              return value.toLocaleString() + '명';
                            }
                          }
                        }
                      }
                    }}
                  />
                )}
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#388e3c' }}>
                📊 관리수수료 추이 {timeUnit === 'year' ? '(월별 흐름)' : '(선 그래프)'}
              </Typography>
              <Box sx={{ height: 650, width: '100%' }}>
                {timeUnit === 'year' && selectedYearMonth ? (
                  <Line 
                    data={{
                      labels: Array.from({length: 12}, (_, i) => `${i + 1}월`),
                      datasets: agentData.map((agent, index) => {
                        const colors = [
                          'rgba(54, 162, 235, 1)',   // 파란색
                          'rgba(255, 99, 132, 1)',   // 빨간색
                          'rgba(75, 192, 192, 1)',   // 청록색
                          'rgba(255, 205, 86, 1)',   // 노란색
                          'rgba(153, 102, 255, 1)'   // 보라색
                        ];
                        const monthData = Array.from({length: 12}, (_, i) => {
                          const yearMonthKey = `${selectedYearMonth}년 ${i + 1}월`;
                          const colIndex = data[0].findIndex(header => header === yearMonthKey);
                          if (colIndex !== -1) {
                            const value = agent.feeData[colIndex];
                            return value !== '' && value !== null && value !== undefined ? (parseFloat(value) || 0) : 0;
                          }
                          return 0;
                        });
                        
                        return {
                          label: `${agent.name} (${agent.code})`,
                          data: monthData,
                          borderColor: colors[index % colors.length],
                          backgroundColor: colors[index % colors.length] + '20',
                          borderWidth: 2,
                          borderDash: [5, 5], // 점선
                          fill: false,
                          tension: 0.1
                        };
                      })
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: `관리수수료 월별 흐름 - ${selectedYearMonth}년`
                        },
                        datalabels: {
                          display: true,
                          color: '#333',
                          font: {
                            size: 10,
                            weight: 'bold'
                          },
                          formatter: function(value, context) {
                            return value > 0 ? value.toLocaleString() : '';
                          },
                          anchor: 'end',
                          align: 'top',
                          offset: 4
                        }
                      },
                      scales: {
                        x: {
                          title: {
                            display: true,
                            text: '월'
                          }
                        },
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: '관리수수료 (원)'
                          },
                          ticks: {
                            callback: function(value) {
                              return value.toLocaleString() + '원';
                            }
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <Line 
                    data={{
                      labels: agentData.map(agent => `${agent.name}\n(${agent.code})`),
                      datasets: [{
                        label: '관리수수료',
                        data: agentData.map(agent => {
                          if (!selectedYearMonth) return 0;
                          const index = agent.feeData.findIndex((_, i) => data[0][i] === selectedYearMonth);
                          const value = agent.feeData[index];
                          return index !== -1 && value !== '' ? (parseFloat(value) || 0) : 0;
                        }),
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: `관리수수료 현황 - ${selectedYearMonth || '년월 선택'}`
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function(value) {
                              return value.toLocaleString() + '원';
                            }
                          }
                        }
                      }
                    }}
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}

// 준비 중 탭 컴포넌트
function ComingSoonTab() {
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        borderRadius: 3
      }}
    >
      <BarChartIcon sx={{ fontSize: 80, mb: 3, opacity: 0.8 }} />
      <Typography variant="h4" component="h1" sx={{ mb: 2, fontWeight: 'bold' }}>
        준비 중입니다
      </Typography>
      <Typography variant="h6" sx={{ mb: 3, opacity: 0.9 }}>
        새로운 형태로 개발 예정
      </Typography>
      <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600, mx: 'auto' }}>
        기존 OCR 기능 등을 새로운 형태로 재개발 중입니다.<br />
        더 나은 사용자 경험을 제공하기 위해 준비하고 있습니다.
      </Typography>
    </Paper>
  );
}

export default ChartMode; 