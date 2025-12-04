import React, { useState, useEffect } from 'react';
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
  Assessment as AssessmentIcon
} from '@mui/icons-material';

import { getModeColor, getModeTitle } from '../config/modeConfig';
import AppUpdatePopup from './AppUpdatePopup';
import directStoreTheme from '../theme/DirectStoreTheme';

// 탭 컴포넌트 임포트
import PolicySettingsTab from './direct/management/PolicySettingsTab';
import LinkSettingsTab from './direct/management/LinkSettingsTab';
import DirectSalesReportTab from './direct/DirectSalesReportTab';
import OpeningInfoPage from './direct/OpeningInfoPage';

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
  const availableTabs = React.useMemo(() => {
    const tabs = [];
    if (hasPolicyPermission) {
      tabs.push({ key: 'policy', label: '정책 설정', icon: <SettingsIcon />, component: <PolicySettingsTab /> });
    }
    if (hasLinkPermission) {
      tabs.push({ key: 'link', label: '링크 설정', icon: <LinkIcon />, component: <LinkSettingsTab /> });
    }
    if (hasSalesReportPermission) {
      tabs.push({ 
        key: 'sales', 
        label: '전체 판매일보', 
        icon: <AssessmentIcon />, 
        component: <DirectSalesReportTab 
          onRowClick={handleReportSelect} 
          loggedInStore={loggedInStore}
          isManagementMode={true}
        /> 
      });
    }
    return tabs;
  }, [hasPolicyPermission, hasLinkPermission, hasSalesReportPermission, handleReportSelect]);

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


  return (
    <ThemeProvider theme={directStoreTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        {selectedReport ? (
          <Box sx={{ flexGrow: 1, height: '100vh', overflow: 'auto' }}>
            <OpeningInfoPage
              initialData={selectedReport}
              onBack={handleBackToReports}
            />
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
              {availableTabs.map((tab, index) => (
                <Box 
                  key={tab.key}
                  role="tabpanel" 
                  hidden={activeTab !== index} 
                  sx={{ height: '100%', display: activeTab === index ? 'block' : 'none' }}
                >
                  {tab.component}
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default DirectStoreManagementMode;
