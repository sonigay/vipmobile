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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // 판매일보 상세 보기 핸들러
  const handleReportSelect = (report) => {
    setSelectedReport(report);
  };

  // 목록으로 돌아가기 핸들러
  const handleBackToReports = () => {
    setSelectedReport(null);
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

              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                textColor="primary"
                indicatorColor="primary"
                centered
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab icon={<SettingsIcon />} label="정책 설정" iconPosition="start" />
                <Tab icon={<LinkIcon />} label="링크 설정" iconPosition="start" />
                <Tab icon={<AssessmentIcon />} label="전체 판매일보" iconPosition="start" />
              </Tabs>
            </AppBar>

            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <Box role="tabpanel" hidden={activeTab !== 0} sx={{ height: '100%', display: activeTab === 0 ? 'block' : 'none' }}>
                <PolicySettingsTab />
              </Box>
              <Box role="tabpanel" hidden={activeTab !== 1} sx={{ height: '100%', display: activeTab === 1 ? 'block' : 'none' }}>
                <LinkSettingsTab />
              </Box>
              <Box role="tabpanel" hidden={activeTab !== 2} sx={{ height: '100%', display: activeTab === 2 ? 'block' : 'none' }}>
                <DirectSalesReportTab onRowClick={handleReportSelect} />
              </Box>
            </Box>
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default DirectStoreManagementMode;
