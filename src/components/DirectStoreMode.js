import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  IconButton,
  Fade,
  Container,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  Lock as LockIcon,
  Update as UpdateIcon,
  Refresh as RefreshIcon,
  Logout as LogoutIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';
import { getModeColor, getModeTitle } from '../config/modeConfig';
import directStoreTheme from '../theme/DirectStoreTheme';
import directStoreThemeV2 from '../theme/DirectStoreThemeV2';
import ErrorBoundary from './ErrorBoundary';

// 탭 컴포넌트를 lazy loading으로 변경하여 초기화 순서 문제 해결
// TDZ 문제 디버깅을 위해 임시로 일반 import로 변경
import TodaysMobileTab from './direct/TodaysMobileTab';
import MobileListTab from './direct/MobileListTab';
import DirectSalesReportTab from './direct/DirectSalesReportTab';
import OpeningInfoPage from './direct/OpeningInfoPage';
import CustomerPurchaseQueueTab from './customer/CustomerPurchaseQueueTab';
import DirectStorePreferredStoreTab from './direct/DirectStorePreferredStoreTab';
import DirectStoreBoardTab from './direct/DirectStoreBoardTab';

const DirectStoreMode = ({
  loggedInStore,
  onLogout,
  onModeChange,
  availableModes
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

  // 인증 상태
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // 탭 상태 (0: 휴대폰 목록, 1: 오늘의 휴대폰, 2: 판매일보, 3: 구매대기, 4: 선호구입매장)
  const [activeTab, setActiveTab] = useState(0);

  // 전체화면 모드 상태 (오늘의 휴대폰 탭에서만 유효)
  const [isFullScreen, setIsFullScreen] = useState(false);

  // 개통정보 입력 페이지 선택된 상품
  const [selectedProduct, setSelectedProduct] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL;
  // 기존 모드 설정은 유지하되, 테마는 directStoreTheme로 덮어씌움
  const modeColor = getModeColor('directStore');
  const modeTitle = getModeTitle('directStore', '직영점 모드');
  const theme = directStoreThemeV2;
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 비밀번호가 필요한지 확인
  const requiresPassword = loggedInStore?.directStoreSecurity?.requiresPassword;
  const alreadyAuthenticated = loggedInStore?.directStoreSecurity?.authenticated;

  // 이미 인증된 경우 바로 인증 상태로 설정
  useEffect(() => {
    if (alreadyAuthenticated) {
      setIsAuthenticated(true);
    }
  }, [alreadyAuthenticated]);

  // 업데이트 팝업 자동 표시 (인증 성공 시)
  useEffect(() => {
    if (isAuthenticated) {
      const hideUntil = localStorage.getItem(`hideUpdate_directStore`);
      if (!hideUntil || new Date() >= new Date(hideUntil)) {
        setShowUpdatePopup(true);
      }
    }
  }, [isAuthenticated]);

  const handlePasswordSubmit = async () => {
    try {
      if (!password) {
        setError('비밀번호를 입력해주세요.');
        return;
      }

      setLoading(true);
      setError(null);

      console.log('🔐 직영점 모드 비밀번호 확인 요청:', {
        userId: loggedInStore.id
      });

      const response = await fetch(`${API_URL}/api/verify-direct-store-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: loggedInStore.id,
          password: password
        }),
      });

      const data = await response.json();
      console.log('🔐 직영점 모드 비밀번호 확인 응답:', data);

      if (data.success && data.verified) {
        setIsAuthenticated(true);
        setShowPasswordDialog(false);
        setPassword('');
        console.log('✅ 직영점 모드 인증 성공');
      } else {
        const errorMessage = data.error || '비밀번호가 일치하지 않습니다.';
        console.error('❌ 직영점 모드 인증 실패:', errorMessage);
        setError(errorMessage);
      }
    } catch (error) {
      console.error('비밀번호 확인 실패:', error);
      setError('비밀번호 확인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // 탭 변경 시 전체화면 모드 해제
    if (isFullScreen) setIsFullScreen(false);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // 상품 선택 핸들러 (개통정보 페이지로 이동)
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setIsFullScreen(false); // 전체화면 해제
  };

  // 목록으로 돌아가기 핸들러
  const handleBackToStore = () => {
    setSelectedProduct(null);
  };

  // 비밀번호가 필요하고 아직 인증되지 않은 경우
  if (requiresPassword && !isAuthenticated) {
    return (
      <ThemeProvider theme={directStoreTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          {/* 헤더 */}
          <AppBar position="static">
            <Toolbar>
              <LockIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ flexGrow: 1, color: 'primary.main' }}>
                {modeTitle}
              </Typography>

              <Button
                color="inherit"
                startIcon={<UpdateIcon />}
                onClick={() => setShowUpdatePopup(true)}
              >
                업데이트 확인
              </Button>

              {onModeChange && availableModes && availableModes.length > 1 && (
                <Button
                  color="inherit"
                  startIcon={<RefreshIcon />}
                  onClick={onModeChange}
                  sx={{ ml: 2 }}
                >
                  모드 변경
                </Button>
              )}

              <Button color="inherit" onClick={onLogout} sx={{ ml: 2 }}>
                로그아웃
              </Button>
            </Toolbar>
          </AppBar>

          {/* 인증 요청 화면 */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 'calc(100vh - 64px)',
              p: 3
            }}
          >
            <Paper sx={{
              p: 4,
              maxWidth: 500,
              width: '100%',
              textAlign: 'center',
              bgcolor: 'background.paper',
              border: '1px solid rgba(212, 175, 55, 0.3)'
            }}>
              <LockIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                🔐 직영점 모드 접근
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                이 모드에 접근하려면 비밀번호가 필요합니다.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => setShowPasswordDialog(true)}
                sx={{ mt: 2, px: 4, py: 1.5 }}
              >
                🔑 비밀번호 입력
              </Button>
            </Paper>
          </Box>

          {/* 비밀번호 입력 다이얼로그 */}
          <Dialog
            open={showPasswordDialog}
            onClose={() => setShowPasswordDialog(false)}
            fullWidth
            maxWidth="sm"
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 3 },
                width: { xs: 'calc(100% - 32px)', sm: 'auto' }
              }
            }}
          >
            <DialogTitle sx={{ color: 'primary.main', fontWeight: 'bold', textAlign: 'center', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              🔐 비밀번호 입력
            </DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 1, minWidth: { xs: 'auto', sm: 300 } }}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                <TextField
                  fullWidth
                  type="password"
                  label="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handlePasswordSubmit();
                    }
                  }}
                  autoFocus
                  disabled={loading}
                  variant="outlined"
                  color="primary"
                />
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3, gap: 1 }}>
              <Button
                onClick={() => setShowPasswordDialog(false)}
                color="secondary"
                disabled={loading}
              >
                취소
              </Button>
              <Button
                onClick={handlePasswordSubmit}
                variant="contained"
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : '확인'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* 업데이트 팝업 */}
          <AppUpdatePopup
            open={showUpdatePopup}
            onClose={() => setShowUpdatePopup(false)}
            mode="directStore"
            loggedInStore={loggedInStore}
          />
        </Box>
      </ThemeProvider>
    );
  }

  // 인증 완료 후 메인 화면
  // 새로운 테마 사용 (V2) - 이미 위에서 선언됨

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* 개통정보 입력 페이지가 활성화된 경우 */}
        {selectedProduct ? (
          <Fade in={true}>
            <Box className="opening-wrapper" sx={{ flexGrow: 1, height: '100vh', overflow: 'auto' }}>
              <ErrorBoundary name="OpeningInfoPage">
                <OpeningInfoPage
                  initialData={selectedProduct}
                  onBack={handleBackToStore}
                  loggedInStore={loggedInStore}
                />
              </ErrorBoundary>
            </Box>
          </Fade>
        ) : (
          <>
            {/* 헤더 (전체화면 모드일 때는 숨김) */}
            {!isFullScreen && (
              <AppBar position="static" enableColorOnDark sx={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
                <Toolbar sx={{ flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 }, py: { xs: 1, sm: 0 } }}>
                  <Typography variant="h4" sx={{ flexGrow: 1, color: 'primary.main', fontWeight: 700, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                    {modeTitle}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'flex-end', sm: 'flex-start' } }}>
                  <Button
                    color="inherit"
                      size={isMobile ? 'small' : 'medium'}
                    startIcon={<UpdateIcon />}
                    onClick={() => setShowUpdatePopup(true)}
                      sx={{ flex: { xs: '1 1 auto', sm: '0 0 auto' }, minWidth: { xs: 'auto', sm: '120px' } }}
                  >
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>업데이트 확인</Box>
                      <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>업데이트</Box>
                  </Button>

                  {onModeChange && availableModes && availableModes.length > 1 && (
                    <Button
                      color="inherit"
                        size={isMobile ? 'small' : 'medium'}
                      startIcon={<RefreshIcon />}
                      onClick={onModeChange}
                        sx={{ flex: { xs: '1 1 auto', sm: '0 0 auto' }, minWidth: { xs: 'auto', sm: '100px' } }}
                    >
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>모드 변경</Box>
                        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>모드</Box>
                    </Button>
                  )}

                    <Button 
                      color="inherit" 
                      onClick={onLogout}
                      size={isMobile ? 'small' : 'medium'}
                      sx={{ flex: { xs: '1 1 auto', sm: '0 0 auto' }, minWidth: { xs: 'auto', sm: '80px' } }}
                    >
                    로그아웃
                  </Button>
                  </Box>
                </Toolbar>
              </AppBar>
            )}

            {/* 메인 컨텐츠 영역 */}
            <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2, md: 3 }, flexGrow: 1, position: 'relative', overflow: 'auto', maxHeight: { xs: 'calc(100vh - 200px)', sm: 'none' } }}>
                {/* 탭 네비게이션 */}
              {!isFullScreen && (
                <Paper sx={{ width: '100%', mb: 2, overflow: 'hidden' }}>
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                    indicatorColor="primary"
                  textColor="primary"
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                      '& .MuiTab-root': {
                        fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' },
                        minWidth: { xs: 'auto', sm: 'auto' },
                        px: { xs: 1, sm: 2 }
                      }
                    }}
                >
                  <Tab label="휴대폰시세표" />
                  <Tab label="오늘의 휴대폰" />
                  <Tab label="판매일보" />
                  <Tab label="구매대기" />
                  <Tab label="선호구입매장설정" />
                  <Tab label="게시판" />
                </Tabs>
                </Paper>
            )}
              {/* 휴대폰 목록 탭 */}
              <Paper sx={{ 
                p: { xs: activeTab === 0 ? 0 : 2, sm: activeTab === 0 ? 0 : 3 }, 
                bgcolor: '#fff', 
                borderRadius: 2, 
                boxShadow: 1, 
                minHeight: { xs: '300px', sm: '400px' }, 
                overflow: 'auto',
                maxHeight: { xs: 'calc(100vh - 300px)', sm: 'none' },
                height: '100%',
                display: activeTab === 0 ? 'block' : 'none'
              }} role="tabpanel" hidden={activeTab !== 0}>
                <ErrorBoundary name="MobileListTab">
                  <MobileListTab onProductSelect={handleProductSelect} />
                </ErrorBoundary>
              </Paper>

              {/* 오늘의 휴대폰 탭 */}
              <Paper sx={{ 
                p: { xs: activeTab === 1 ? 0 : 2, sm: activeTab === 1 ? 0 : 3 }, 
                bgcolor: '#fff', 
                borderRadius: 2, 
                boxShadow: 1, 
                minHeight: { xs: '300px', sm: '400px' }, 
                overflow: 'auto',
                maxHeight: { xs: 'calc(100vh - 300px)', sm: 'none' },
                height: '100%',
                display: activeTab === 1 ? 'block' : 'none',
                position: 'relative'
              }} role="tabpanel" hidden={activeTab !== 1}>
                {/* 전체화면 토글 버튼 (오늘의 휴대폰 탭에서만 표시) */}
                <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1000 }}>
                  <IconButton
                    onClick={toggleFullScreen}
                    sx={{
                      bgcolor: 'rgba(0,0,0,0.5)',
                      color: 'primary.main',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                    }}
                  >
                    {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                  </IconButton>
                </Box>

                <ErrorBoundary name="TodaysMobileTab">
                  <TodaysMobileTab
                    isFullScreen={isFullScreen}
                    onProductSelect={handleProductSelect}
                  />
                </ErrorBoundary>
              </Paper>

              {/* 판매일보 탭 */}
              <Paper sx={{ 
                p: { xs: activeTab === 2 ? 0 : 2, sm: activeTab === 2 ? 0 : 3 }, 
                bgcolor: '#fff', 
                borderRadius: 2, 
                boxShadow: 1, 
                minHeight: { xs: '300px', sm: '400px' }, 
                overflow: 'auto',
                maxHeight: { xs: 'calc(100vh - 300px)', sm: 'none' },
                height: '100%',
                display: activeTab === 2 ? 'block' : 'none'
              }} role="tabpanel" hidden={activeTab !== 2}>
                <ErrorBoundary name="DirectSalesReportTab">
                  <DirectSalesReportTab 
                    onRowClick={handleProductSelect} 
                    loggedInStore={loggedInStore}
                    isManagementMode={false}
                  />
                </ErrorBoundary>
              </Paper>

              {/* 구매대기 탭 */}
              <Paper sx={{ 
                p: { xs: activeTab === 3 ? 0 : 2, sm: activeTab === 3 ? 0 : 3 }, 
                bgcolor: '#fff', 
                borderRadius: 2, 
                boxShadow: 1, 
                minHeight: { xs: '300px', sm: '400px' }, 
                overflow: 'auto',
                maxHeight: { xs: 'calc(100vh - 300px)', sm: 'none' },
                height: '100%',
                display: activeTab === 3 ? 'block' : 'none'
              }} role="tabpanel" hidden={activeTab !== 3}>
                <ErrorBoundary name="CustomerPurchaseQueueTab">
                  <CustomerPurchaseQueueTab 
                    loggedInStore={loggedInStore}
                    isManagementMode={false}
                  />
                </ErrorBoundary>
              </Paper>

              {/* 선호구입매장 탭 */}
              <Paper sx={{ 
                p: { xs: activeTab === 4 ? 0 : 2, sm: activeTab === 4 ? 0 : 3 }, 
                bgcolor: '#fff', 
                borderRadius: 2, 
                boxShadow: 1, 
                minHeight: { xs: '300px', sm: '400px' }, 
                overflow: 'auto',
                maxHeight: { xs: 'calc(100vh - 300px)', sm: 'none' },
                height: '100%',
                display: activeTab === 4 ? 'block' : 'none'
              }} role="tabpanel" hidden={activeTab !== 4}>
                <ErrorBoundary name="DirectStorePreferredStoreTab">
                  {activeTab === 4 && (
                    <DirectStorePreferredStoreTab 
                      loggedInStore={loggedInStore}
                      isManagementMode={false}
                      activeTab={activeTab}
                    />
                  )}
                </ErrorBoundary>
              </Paper>

              {/* 게시판 탭 */}
              <Paper sx={{ 
                p: { xs: activeTab === 5 ? 0 : 2, sm: activeTab === 5 ? 0 : 3 }, 
                bgcolor: '#fff', 
                borderRadius: 2, 
                boxShadow: 1, 
                minHeight: { xs: '300px', sm: '400px' }, 
                overflow: 'auto',
                maxHeight: { xs: 'calc(100vh - 300px)', sm: 'none' },
                height: '100%',
                display: activeTab === 5 ? 'block' : 'none'
              }} role="tabpanel" hidden={activeTab !== 5}>
                <ErrorBoundary name="DirectStoreBoardTab">
                  <DirectStoreBoardTab 
                    loggedInStore={loggedInStore}
                    isManagementMode={false}
                  />
                </ErrorBoundary>
              </Paper>
            </Container>
          </>
        )}

        {/* 업데이트 팝업 */}
        <AppUpdatePopup
          open={showUpdatePopup}
          onClose={() => setShowUpdatePopup(false)}
          mode="directStore"
          loggedInStore={loggedInStore}
        />
      </Box>
    </ThemeProvider>
  );
};

export default DirectStoreMode;
