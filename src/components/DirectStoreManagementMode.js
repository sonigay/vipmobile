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
  TextFields as TextFieldsIcon
} from '@mui/icons-material';

import { getModeColor, getModeTitle } from '../config/modeConfig';
import AppUpdatePopup from './AppUpdatePopup';
import directStoreTheme from '../theme/DirectStoreTheme';
import directStoreThemeV2 from '../theme/DirectStoreThemeV2';
import ErrorBoundary from './ErrorBoundary';

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
