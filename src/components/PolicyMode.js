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
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress
} from '@mui/material';
import {
  Policy as PolicyIcon,
  SwapHoriz as SwapHorizIcon,
  Update as UpdateIcon,
  Add as AddIcon,
  Notifications as NotificationsIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';

import AppUpdatePopup from './AppUpdatePopup';
import PolicyInputModal from './PolicyInputModal';
import PolicyApprovalModal from './PolicyApprovalModal';
import PolicyCancelModal from './PolicyCancelModal';
import SettlementReflectModal from './SettlementReflectModal';
import PolicyService from '../utils/policyService';

// 기본 정책 카테고리 데이터 (폴백용)
const DEFAULT_POLICY_CATEGORIES = {
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
  
  // 카테고리 데이터
  const [categories, setCategories] = useState(DEFAULT_POLICY_CATEGORIES);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  
  // 정책 입력 모달 상태
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // 화면 상태 관리
  const [currentView, setCurrentView] = useState('categories'); // 'categories' 또는 'policies'
  const [selectedCategoryForList, setSelectedCategoryForList] = useState(null);
  const [policies, setPolicies] = useState([]); // 전체 정책 목록
  
  // 승인 모달 상태
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedPolicyForApproval, setSelectedPolicyForApproval] = useState(null);
  const [approvalProcessing, setApprovalProcessing] = useState(false);
  
  // 취소 모달 상태
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedPolicyForCancel, setSelectedPolicyForCancel] = useState(null);
  const [cancelType, setCancelType] = useState('policy'); // 'policy' 또는 'approval'
  
  // 정산 반영 모달 상태
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedPolicyForSettlement, setSelectedPolicyForSettlement] = useState(null);
  
  // 정책모드 진입 시 업데이트 팝업 표시
  useEffect(() => {
    // 모드 진입 시 자동으로 업데이트 팝업 표시
    setShowUpdatePopup(true);
    
    // 매장 데이터 로드
    loadStores();
    
    // 카테고리 데이터 로드
    loadCategories();
    
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

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const categoriesData = await PolicyService.getCategories();
      
      // 정책 타입별로 카테고리 그룹화
      const groupedCategories = {
        wireless: categoriesData.filter(cat => cat.policyType === 'wireless' && cat.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
        wired: categoriesData.filter(cat => cat.policyType === 'wired' && cat.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
      };
      
      setCategories(groupedCategories);
    } catch (error) {
      console.error('카테고리 데이터 로드 실패:', error);
      // 실패 시 기본 카테고리 사용
      setCategories(DEFAULT_POLICY_CATEGORIES);
    } finally {
      setCategoriesLoading(false);
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
      
      // 전체 정책 목록 저장
      setPolicies(policies);
      
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
      setPolicies([]);
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
    // 해당 카테고리의 정책 목록 화면으로 이동
    setSelectedCategoryForList(categoryId);
    setCurrentView('policies');
  };

  const handleBackToCategories = () => {
    setCurrentView('categories');
    setSelectedCategoryForList(null);
  };

  const handleApprovalClick = (policy) => {
    setSelectedPolicyForApproval(policy);
    setShowApprovalModal(true);
  };

  const handleApprovalSubmit = async (approvalData) => {
    // 중복 처리 방지
    if (approvalProcessing) {
      return;
    }
    
    setApprovalProcessing(true);
    
    try {
      const { policyId, approvalData: approval, userRole } = approvalData;
      
             // 사용자 권한에 따른 승인 유형 결정
       let approvalType = '';
       if (userRole === 'SS' || userRole === '이사') {
         // 총괄/이사: 총괄, 정산팀, 소속팀 승인 모두 가능
         if (approval.total === '승인') approvalType = 'total';
         else if (approval.settlement === '승인') approvalType = 'settlement';
         else if (approval.team === '승인') approvalType = 'team';
       } else if (userRole === 'S') {
         // 정산팀: 총괄, 정산팀 승인 가능
         if (approval.total === '승인') approvalType = 'total';
         else if (approval.settlement === '승인') approvalType = 'settlement';
       } else if (['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole)) {
         // 소속정책팀: 소속팀 승인만 가능
         if (approval.team === '승인') approvalType = 'team';
       }
      
      if (!approvalType) {
        alert('승인 상태를 선택해주세요.');
        return;
      }
      
             // 승인 API 호출
       await PolicyService.approvePolicy(policyId, {
         approvalType,
         comment: approval.comment,
         userId: loggedInStore?.contactId || loggedInStore?.id,
         userName: loggedInStore?.target || loggedInStore?.name
       });
      
      alert('승인이 완료되었습니다.');
      setShowApprovalModal(false);
      setSelectedPolicyForApproval(null);
      // 정책 데이터 다시 로드
      await loadPolicyData();
    } catch (error) {
      console.error('승인 실패:', error);
      alert('승인에 실패했습니다: ' + error.message);
    } finally {
      setApprovalProcessing(false);
    }
  };

  const handleCancelClick = (policy, type) => {
    setSelectedPolicyForCancel(policy);
    setCancelType(type);
    setShowCancelModal(true);
  };

  const handleCancelSubmit = async (cancelData) => {
    try {
      if (cancelData.cancelType === 'policy') {
        // 정책 취소
        await PolicyService.cancelPolicy(cancelData.policyId, {
          cancelReason: cancelData.cancelReason,
          userId: loggedInStore?.contactId || loggedInStore?.id,
          userName: loggedInStore?.target || loggedInStore?.name
        });
        alert('정책이 성공적으로 취소되었습니다.');
      } else {
        // 승인 취소
        await PolicyService.cancelApproval(cancelData.policyId, {
          cancelReason: cancelData.cancelReason,
          approvalType: cancelData.approvalType,
          userId: loggedInStore?.contactId || loggedInStore?.id,
          userName: loggedInStore?.target || loggedInStore?.name
        });
        alert('승인이 성공적으로 취소되었습니다.');
      }
      
      setShowCancelModal(false);
      setSelectedPolicyForCancel(null);
      // 정책 데이터 다시 로드
      await loadPolicyData();
    } catch (error) {
      console.error('취소 실패:', error);
      alert('취소에 실패했습니다.');
    }
  };

  const handleSettlementClick = (policy) => {
    setSelectedPolicyForSettlement(policy);
    setShowSettlementModal(true);
  };

  const handleSettlementSubmit = async (settlementData) => {
    try {
      await PolicyService.reflectSettlement(settlementData.policyId, {
        isReflected: settlementData.isReflected,
        userId: loggedInStore?.contactId || loggedInStore?.id,
        userName: loggedInStore?.target || loggedInStore?.name
      });
      
      alert(`정책이 정산에 ${settlementData.isReflected ? '반영' : '미반영'} 처리되었습니다.`);
      setShowSettlementModal(false);
      setSelectedPolicyForSettlement(null);
      // 정책 데이터 다시 로드
      await loadPolicyData();
    } catch (error) {
      console.error('정산 반영 실패:', error);
      alert('정산 반영에 실패했습니다.');
    }
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

                {/* 정책 카테고리 목록 또는 정책 목록 */}
                 {currentView === 'categories' ? (
           <Grid container spacing={3}>
             {categoriesLoading ? (
               <Grid item xs={12}>
                 <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                   <CircularProgress />
                 </Box>
               </Grid>
             ) : (
               categories[policyType]?.map((category) => (
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
             )))}
           </Grid>
        ) : (
          /* 정책 목록 화면 */
          <Box>
            {/* 뒤로가기 버튼 */}
            <Button 
              onClick={handleBackToCategories}
              startIcon={<ArrowBackIcon />}
              sx={{ mb: 2 }}
            >
              카테고리로 돌아가기
            </Button>
            
                         {/* 카테고리 제목 */}
             <Typography variant="h5" sx={{ mb: 3 }}>
               {categories[policyType]?.find(cat => cat.id === selectedCategoryForList)?.name} 정책 목록
             </Typography>
            
            {/* 정책 목록 테이블 */}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                                     <TableHead>
                     <TableRow>
                       <TableCell>정책명</TableCell>
                       <TableCell>적용일</TableCell>
                       <TableCell>적용점</TableCell>
                       <TableCell>내용</TableCell>
                       <TableCell>금액</TableCell>
                       <TableCell>입력자</TableCell>
                       <TableCell>승인상태</TableCell>
                       <TableCell>정산반영</TableCell>
                       <TableCell>작업</TableCell>
                     </TableRow>
                   </TableHead>
                  <TableBody>
                    {policies
                      .filter(policy => policy.category === selectedCategoryForList)
                      .map((policy) => (
                                             <TableRow key={policy.id}>
                       <TableCell>
                         <Box>
                           <Typography variant="body2">{policy.policyName}</Typography>
                           {policy.policyStatus === '취소됨' && (
                             <Chip 
                               label="취소됨" 
                               size="small" 
                               color="error" 
                               variant="outlined"
                             />
                           )}
                         </Box>
                       </TableCell>
                       <TableCell>{policy.policyDate}</TableCell>
                       <TableCell>{policy.policyStore}</TableCell>
                       <TableCell>
                         <Box>
                           <Typography variant="body2">{policy.policyContent}</Typography>
                           {policy.cancelReason && (
                             <Typography variant="caption" color="error" display="block">
                               취소사유: {policy.cancelReason}
                             </Typography>
                           )}
                         </Box>
                       </TableCell>
                       <TableCell>{policy.policyAmount}</TableCell>
                       <TableCell>{policy.inputUserName}</TableCell>
                                               <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Chip 
                              label={`총괄: ${policy.approvalStatus?.total || '대기'}`}
                              size="small"
                              color={policy.approvalStatus?.total === '승인' ? 'success' : 'default'}
                            />
                            <Chip 
                              label={`정산팀: ${policy.approvalStatus?.settlement || '대기'}`}
                              size="small"
                              color={policy.approvalStatus?.settlement === '승인' ? 'success' : 'default'}
                            />
                            <Chip 
                              label={`소속팀: ${policy.approvalStatus?.team || '대기'}`}
                              size="small"
                              color={policy.approvalStatus?.team === '승인' ? 'success' : 'default'}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Chip 
                              label={policy.settlementStatus || '미반영'}
                              size="small"
                              color={policy.settlementStatus === '반영됨' ? 'success' : 'default'}
                              variant="outlined"
                            />
                            {policy.settlementUserName && (
                              <Typography variant="caption" color="text.secondary">
                                {policy.settlementUserName}
                              </Typography>
                            )}
                            {policy.settlementDateTime && (
                              <Typography variant="caption" color="text.secondary">
                                {new Date(policy.settlementDateTime).toLocaleDateString()}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                         {/* 정책 취소 버튼 (입력자만 보임) */}
                             {policy.inputUserId === (loggedInStore?.contactId || loggedInStore?.id) && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleCancelClick(policy, 'policy')}
                                disabled={policy.policyStatus === '취소됨'}
                              >
                                정책취소
                              </Button>
                            )}
                            
                            {/* 승인 버튼 - 권한별 표시 */}
                            {(() => {
                              const userRole = loggedInStore?.agentInfo?.userRole;
                              console.log('🔍 [승인버튼] 사용자 권한 정보:', {
                                userRole,
                                loggedInStore: loggedInStore,
                                agentInfo: loggedInStore?.agentInfo
                              });
                              
                                                             const canApprove = 
                                 // 총괄(SS): 모든 승인 가능
                                 userRole === 'SS' ||
                                 // 정산팀(S): 총괄, 정산팀 승인 가능
                                 userRole === 'S' ||
                                 // 소속정책팀(AA, BB, CC, DD, EE, FF): 소속팀 승인만 가능
                                 ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole);
                              
                              console.log('🔍 [승인버튼] 승인 가능 여부:', canApprove);
                              
                              return canApprove ? (
                                <Button
                                  size="small"
                                  onClick={() => handleApprovalClick(policy)}
                                  disabled={policy.policyStatus === '취소됨' || approvalProcessing}
                                >
                                  {approvalProcessing ? '처리중...' : '승인'}
                                </Button>
                              ) : null;
                            })()}
                            
                            {/* 승인 취소 버튼 - 권한별 표시 */}
                            {(() => {
                              const userRole = loggedInStore?.agentInfo?.userRole;
                                                             const canCancelApproval = 
                                 // 총괄(SS): 모든 승인 취소 가능
                                 userRole === 'SS' ||
                                 // 정산팀(S): 총괄, 정산팀 승인 취소 가능
                                 userRole === 'S' ||
                                 // 소속정책팀(AA, BB, CC, DD, EE, FF): 소속팀 승인 취소만 가능
                                 ['AA', 'BB', 'CC', 'DD', 'EE', 'FF'].includes(userRole);
                              
                              return canCancelApproval ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  onClick={() => handleCancelClick(policy, 'approval')}
                                  disabled={policy.policyStatus === '취소됨'}
                                >
                                  승인취소
                                </Button>
                              ) : null;
                            })()}
                            
                                                         {/* 정산 반영 버튼 (정산팀 권한만 보임) */}
                             {(loggedInStore?.agentInfo?.userRole === 'S' || loggedInStore?.agentInfo?.userRole === 'SS') && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="info"
                                onClick={() => handleSettlementClick(policy)}
                                disabled={policy.policyStatus === '취소됨'}
                              >
                                정산반영
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                     </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
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

                                                       {/* 정책 승인 모달 */}
         <PolicyApprovalModal
           open={showApprovalModal}
           onClose={() => {
             setShowApprovalModal(false);
             setSelectedPolicyForApproval(null);
           }}
           policy={selectedPolicyForApproval}
           onApprovalSubmit={handleApprovalSubmit}
                       userRole={loggedInStore?.agentInfo?.userRole}
           processing={approvalProcessing}
         />

               {/* 정책 취소 모달 */}
                 <PolicyCancelModal
           open={showCancelModal}
           onClose={() => {
             setShowCancelModal(false);
             setSelectedPolicyForCancel(null);
           }}
           policy={selectedPolicyForCancel}
           onCancelSubmit={handleCancelSubmit}
           cancelType={cancelType}
           userRole={loggedInStore?.agentInfo?.userRole}
         />

        {/* 정산 반영 모달 */}
                 <SettlementReflectModal
           open={showSettlementModal}
           onClose={() => {
             setShowSettlementModal(false);
             setSelectedPolicyForSettlement(null);
           }}
           policy={selectedPolicyForSettlement}
           onReflectSubmit={handleSettlementSubmit}
           userRole={loggedInStore?.agentInfo?.userRole}
         />
                    </Box>
  );
}

export default PolicyMode; 