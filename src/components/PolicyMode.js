import React, { useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton
} from '@mui/material';
import {
  Policy as PolicyIcon,
  SwapHoriz as SwapHorizIcon,
  Update as UpdateIcon,
  Add as AddIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';

import AppUpdatePopup from './AppUpdatePopup';
import PolicyInputModal from './PolicyInputModal';
import PolicyService from '../utils/policyService';

// 정책 카테고리 데이터
const POLICY_CATEGORIES = {
  wireless: [
    { id: 'wireless_shoe', name: '구두정책', icon: '👞' },
    { id: 'wireless_union', name: '연합정책', icon: '🤝' },
    { id: 'wireless_rate', name: '요금제유형별정책', icon: '💰' },
    { id: 'wireless_add_support', name: '부가추가지원정책', icon: '➕' },
    { id: 'wireless_add_deduct', name: '부가차감지원정책', icon: '➖' },
    { id: 'wireless_grade', name: '그레이드정책', icon: '⭐' },
    { id: 'wireless_individual', name: '개별소급정책', icon: '📋' }
  ],
  wired: [
    { id: 'wired_shoe', name: '구두정책', icon: '👞' },
    { id: 'wired_union', name: '연합정책', icon: '🤝' },
    { id: 'wired_rate', name: '요금제유형별정책', icon: '💰' },
    { id: 'wired_add_support', name: '부가추가지원정책', icon: '➕' },
    { id: 'wired_add_deduct', name: '부가차감지원정책', icon: '➖' },
    { id: 'wired_grade', name: '그레이드정책', icon: '⭐' },
    { id: 'wired_individual', name: '개별소급정책', icon: '📋' }
  ]
};

// 대상년월 옵션 (최근 12개월)
const getYearMonthOptions = () => {
  const options = [];
  const currentDate = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const label = `${year}-${month}`;
    const value = `${year}-${month}`;
    options.push({ label, value });
  }
  
  return options;
};

function PolicyMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 정책 타입 (무선/유선)
  const [policyType, setPolicyType] = useState('wireless');
  
  // 대상년월
  const [selectedYearMonth, setSelectedYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // 정책 데이터
  const [policyData, setPolicyData] = useState({});
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // 정책 입력 모달 상태
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // 정책모드 진입 시 업데이트 팝업 표시
  useEffect(() => {
    // 모드 진입 시 자동으로 업데이트 팝업 표시
    setShowUpdatePopup(true);
    
    // 매장 데이터 로드
    loadStores();
    
    // 정책 데이터 로드
    loadPolicyData();
  }, [policyType, selectedYearMonth]);

  const loadStores = async () => {
    try {
      // 매장 데이터 로드 (기존 API 사용)
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stores`);
      if (response.ok) {
        const storesData = await response.json();
        setStores(storesData);
      }
    } catch (error) {
      console.error('매장 데이터 로드 실패:', error);
    }
  };

  const loadPolicyData = async () => {
    setLoading(true);
    try {
      const policyTypeLabel = policyType === 'wireless' ? '무선' : '유선';
      const policies = await PolicyService.getPolicies({
        yearMonth: selectedYearMonth,
        policyType: policyTypeLabel
      });
      
      // 카테고리별 개수 계산
      const counts = {};
      policies.forEach(policy => {
        const category = policy.category;
        counts[category] = (counts[category] || 0) + 1;
      });
      
      setPolicyData(counts);
    } catch (error) {
      console.error('정책 데이터 로드 실패:', error);
      setPolicyData({});
    } finally {
      setLoading(false);
    }
  };

  const handleBackToMain = () => {
    // 메인 화면으로 돌아가기 (모드 선택 팝업 표시)
    window.location.reload();
  };

  const handleAddPolicy = (categoryId) => {
    setSelectedCategory(categoryId);
    setShowPolicyModal(true);
  };

  const handleCategoryClick = (categoryId) => {
    // TODO: 해당 카테고리의 정책 목록 화면으로 이동
    console.log('카테고리 클릭:', categoryId);
  };

  const handleSavePolicy = async (policyData) => {
    try {
      await PolicyService.createPolicy(policyData);
      
      // 정책 데이터 다시 로드
      await loadPolicyData();
      
      // 성공 메시지 (나중에 스낵바로 변경 가능)
      alert('정책이 성공적으로 저장되었습니다.');
    } catch (error) {
      console.error('정책 저장 실패:', error);
      alert('정책 저장에 실패했습니다. 다시 시도해주세요.');
      throw error;
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <Button color="inherit" onClick={handleBackToMain} sx={{ mr: 2 }}>
            ← 뒤로가기
          </Button>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            정책 모드
          </Typography>
          
          {/* 알림 버튼 */}
          <IconButton color="inherit" sx={{ mr: 2 }}>
            <NotificationsIcon />
          </IconButton>
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              onClick={() => {
                console.log('PolicyMode 모드 전환 버튼 클릭됨');
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
      
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        {/* 정책 타입 선택 탭 */}
        <Paper sx={{ mb: 3 }}>
          <Tabs 
            value={policyType} 
            onChange={(e, newValue) => setPolicyType(newValue)}
            centered
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab 
              value="wireless" 
              label="무선정책" 
              icon={<PolicyIcon />}
              iconPosition="start"
            />
            <Tab 
              value="wired" 
              label="유선정책" 
              icon={<PolicyIcon />}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* 대상년월 선택 */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Typography variant="subtitle1" fontWeight="bold">
                대상년월:
              </Typography>
            </Grid>
            <Grid item>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>년월 선택</InputLabel>
                <Select
                  value={selectedYearMonth}
                  label="년월 선택"
                  onChange={(e) => setSelectedYearMonth(e.target.value)}
                >
                  {getYearMonthOptions().map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* 정책 카테고리 목록 */}
        <Grid container spacing={3}>
          {POLICY_CATEGORIES[policyType].map((category) => (
            <Grid item xs={12} sm={6} md={4} key={category.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s'
                  }
                }}
                onClick={() => handleCategoryClick(category.id)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h4" sx={{ mr: 1 }}>
                      {category.icon}
                    </Typography>
                    <Typography variant="h6" component="div">
                      {category.name}
                    </Typography>
                  </Box>
                  
                                     <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <Chip 
                       label={`${policyData[category.id] || 0}건`}
                       color="primary" 
                       variant="outlined"
                       size="small"
                     />
                     <Button
                       size="small"
                       startIcon={<AddIcon />}
                       onClick={(e) => {
                         e.stopPropagation();
                         handleAddPolicy(category.id);
                       }}
                       sx={{ minWidth: 'auto' }}
                     >
                       추가
                     </Button>
                   </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      
      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="policy"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('정책모드 새 업데이트가 추가되었습니다.');
        }}
      />

      {/* 정책 입력 모달 */}
      <PolicyInputModal
        open={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        categoryId={selectedCategory}
        yearMonth={selectedYearMonth}
        stores={stores}
        onSave={handleSavePolicy}
        loggedInUser={loggedInStore}
      />
    </Box>
  );
}

export default PolicyMode; 