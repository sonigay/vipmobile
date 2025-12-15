import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  Button,
  Tabs,
  Tab,
  CssBaseline,
  ThemeProvider,
  IconButton,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Update as UpdateIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Link as LinkIcon,
  Assessment as AssessmentIcon,
  TextFields as TextFieldsIcon,
  Build as BuildIcon
} from '@mui/icons-material';

import { getModeColor, getModeTitle } from '../config/modeConfig';
import AppUpdatePopup from './AppUpdatePopup';
import directStoreTheme from '../theme/DirectStoreTheme';
import directStoreThemeV2 from '../theme/DirectStoreThemeV2';
import ErrorBoundary from './ErrorBoundary';
import { directStoreApiClient } from '../api/directStoreApiClient';

// 탭 컴포넌트를 lazy loading으로 변경하여 초기화 순서 문제 해결
const PolicySettingsTab = lazy(() => import('./direct/management/PolicySettingsTab'));
const LinkSettingsTab = lazy(() => import('./direct/management/LinkSettingsTab'));
const MainPageTextSettingsTab = lazy(() => import('./direct/management/MainPageTextSettingsTab'));
const DirectSalesReportTab = lazy(() => import('./direct/DirectSalesReportTab'));
const OpeningInfoPage = lazy(() => import('./direct/OpeningInfoPage'));

const DirectStoreManagementMode = ({
  loggedInStore,
  onLogout,
  onModeChange,
  availableModes
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState(null);

  // 인증 상태 (어플 접속 시 이미 검증됨)
  const [isAuthenticated] = useState(true);

  // 탭 상태 (0: 정책 설정, 1: 링크 설정, 2: 판매일보)
  const [activeTab, setActiveTab] = useState(0);

  // 판매일보 상세 보기 선택된 항목
  const [selectedReport, setSelectedReport] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL;
  const modeTitle = getModeTitle('directStoreManagement', '직영점 관리 모드');

  // 판매일보 상세 보기 핸들러
  const handleReportSelect = React.useCallback((report) => {
    setSelectedReport(report);
  }, []);

  // 목록으로 돌아가기 핸들러
  const handleBackToReports = React.useCallback(() => {
    setSelectedReport(null);
  }, []);

  // 권한 확인
  const directStoreManagementPermission = loggedInStore?.modePermissions?.directStoreManagement;
  const permissionValue = typeof directStoreManagementPermission === 'string'
    ? directStoreManagementPermission.trim().toUpperCase()
    : (directStoreManagementPermission === true ? 'O' : '');

  // 탭별 권한 체크
  const hasPolicyPermission = permissionValue === 'M' || permissionValue === 'S';
  const hasLinkPermission = permissionValue === 'M';
  const hasSalesReportPermission = permissionValue === 'M' || permissionValue === 'S' || permissionValue === 'O';

  // 사용 가능한 탭 목록 생성 (권한에 따라)
  // lazy loading을 위해 컴포넌트를 직접 렌더링하지 않고 탭 정보만 저장
  const availableTabs = React.useMemo(() => {
    const tabs = [];
    if (hasPolicyPermission) {
      tabs.push({ key: 'policy', label: '정책 설정', icon: <SettingsIcon />, componentName: 'PolicySettingsTab' });
    }
    if (hasLinkPermission) {
      tabs.push({ key: 'link', label: '링크 설정', icon: <LinkIcon />, componentName: 'LinkSettingsTab' });
    }
    if (hasLinkPermission) {
      tabs.push({ key: 'mainPageText', label: '메인페이지문구설정', icon: <TextFieldsIcon />, componentName: 'MainPageTextSettingsTab' });
    }
    if (hasSalesReportPermission) {
      tabs.push({
        key: 'sales',
        label: '전체 판매일보',
        icon: <AssessmentIcon />,
        componentName: 'DirectSalesReportTab',
        props: {
          onRowClick: handleReportSelect,
          loggedInStore: loggedInStore,
          isManagementMode: true
        }
      });
    }
    return tabs;
  }, [hasPolicyPermission, hasLinkPermission, hasSalesReportPermission, handleReportSelect, loggedInStore]);

  // 현재 활성 탭이 사용 가능한 탭인지 확인하고, 아니면 첫 번째 사용 가능한 탭으로 변경
  useEffect(() => {
    if (availableTabs.length > 0 && activeTab >= availableTabs.length) {
      setActiveTab(0);
    }
  }, [availableTabs.length, activeTab]);

  const handleTabChange = (event, newValue) => {
    if (newValue >= 0 && newValue < availableTabs.length) {
      setActiveTab(newValue);
    }
  };


  const handleRebuildMaster = async () => {
    if (!window.confirm('모든 통신사의 마스터 데이터를 재빌드하시겠습니까?\n이 작업은 수 초에서 수십 초가 소요될 수 있습니다.')) {
      return;
    }

    try {
      setRebuilding(true);
      const result = await directStoreApiClient.rebuildMaster(); // 전체 통신사
      if (result.success) {
        alert('마스터 데이터 재빌드가 완료되었습니다.\n' +
          `요금제: ${result.summary?.plans?.totalCount || 0}건\n` +
          `단말: ${result.summary?.devices?.totalCount || 0}건\n` +
          `정책: ${result.summary?.pricing?.totalCount || 0}건`);
      } else {
        alert('재빌드 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (err) {
      console.error('재빌드 오류:', err);
      alert('재빌드 중 오류가 발생했습니다.');
    } finally {
      setRebuilding(false);
    }
  };



  // 새로운 테마 사용 (V2)
  const theme = directStoreThemeV2;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        {selectedReport ? (
          <Box sx={{ flexGrow: 1, height: '100vh', overflow: 'auto' }}>
            <ErrorBoundary name="OpeningInfoPage (Management)">
              <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>}>
                <OpeningInfoPage
                  initialData={selectedReport}
                  onBack={handleBackToReports}
                />
              </Suspense>
            </ErrorBoundary>
          </Box>
        ) : (
          <>
            <AppBar position="static" enableColorOnDark>
              <Toolbar>
                <SettingsIcon sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ flexGrow: 1, color: 'primary.main', fontWeight: 'bold' }}>
                  {modeTitle}
                </Typography>

                {/* 업데이트 확인 버튼 */}
                <Button
                  color="inherit"
                  startIcon={<UpdateIcon />}
                  onClick={() => setShowUpdatePopup(true)}
                  sx={{ mr: 1, border: '1px solid rgba(255,255,255,0.3)' }}
                >
                  업데이트 확인
                </Button>

                {/* 데이터 재빌드 버튼 */}
                <Button
                  color="inherit"
                  startIcon={rebuilding ? <CircularProgress size={20} color="inherit" /> : <BuildIcon />}
                  onClick={handleRebuildMaster}
                  disabled={rebuilding}
                  sx={{ mr: 1, border: '1px solid rgba(255,255,255,0.3)' }}
                >
                  {rebuilding ? '빌드 중...' : '데이터 재빌드'}
                </Button>

                {onModeChange && availableModes && availableModes.length > 1 && (
                  <Button color="inherit" startIcon={<RefreshIcon />} onClick={onModeChange} sx={{ mr: 2 }}>
                    모드 변경
                  </Button>
                )}
                <Button color="inherit" onClick={onLogout}>로그아웃</Button>
              </Toolbar>

              {availableTabs.length > 0 && (
                <Tabs
                  value={Math.min(activeTab, availableTabs.length - 1)}
                  onChange={handleTabChange}
                  textColor="primary"
                  indicatorColor="primary"
                  centered
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  {availableTabs.map((tab, index) => (
                    <Tab
                      key={tab.key}
                      icon={tab.icon}
                      label={tab.label}
                      iconPosition="start"
                    />
                  ))}
                </Tabs>
              )}
            </AppBar>

            {/* 업데이트 팝업 */}
            <AppUpdatePopup
              open={showUpdatePopup}
              onClose={() => setShowUpdatePopup(false)}
              mode="directStoreManagement"
              loggedInStore={loggedInStore}
            />

            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              {availableTabs.map((tab, index) => {
                let Component = null;
                if (tab.componentName === 'PolicySettingsTab') {
                  Component = PolicySettingsTab;
                } else if (tab.componentName === 'LinkSettingsTab') {
                  Component = LinkSettingsTab;
                } else if (tab.componentName === 'MainPageTextSettingsTab') {
                  Component = MainPageTextSettingsTab;
                } else if (tab.componentName === 'DirectSalesReportTab') {
                  Component = DirectSalesReportTab;
                }

                return (
                  <Box
                    key={tab.key}
                    role="tabpanel"
                    hidden={activeTab !== index}
                    sx={{ height: '100%', display: activeTab === index ? 'block' : 'none' }}
                  >
                    <ErrorBoundary name={tab.componentName || tab.key}>
                      <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>}>
                        {Component && <Component {...(tab.props || {})} />}
                      </Suspense>
                    </ErrorBoundary>
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default DirectStoreManagementMode;
