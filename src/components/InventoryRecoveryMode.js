import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  Button
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Refresh as RefreshIcon,
  Build as BuildIcon
} from '@mui/icons-material';

import Header from './Header';
import AppUpdatePopup from './AppUpdatePopup';
import InventoryRecoveryTable from './InventoryRecoveryTable';
import InventoryRecoveryMap from './InventoryRecoveryMap';
// import PriorityModelSelectionModal from './PriorityModelSelectionModal';
import { inventoryRecoveryAPI } from '../api';

function InventoryRecoveryMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  
  // 탭 상태
  const [currentTab, setCurrentTab] = useState(0);
  const [currentView, setCurrentView] = useState('table'); // 'table' 또는 'map'
  
  // 데이터 상태
  const [recoveryData, setRecoveryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 알림 상태
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // 우선순위 모델 상태
  const [priorityModels, setPriorityModels] = useState({
    '1순위': null,
    '2순위': null,
    '3순위': null,
    '4순위': null,
    '5순위': null
  });
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [selectedPriorityLevel, setSelectedPriorityLevel] = useState(null);

  // 업데이트 확인 핸들러
  const handleUpdateCheck = () => {
    setShowUpdatePopup(true);
  };

  // 컴포넌트 마운트 시 자동으로 업데이트 팝업 표시
  useEffect(() => {
    // 약간의 지연 후 업데이트 팝업 표시 (사용자 경험 개선)
    const timer = setTimeout(() => {
      setShowUpdatePopup(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // 데이터 로드
  const loadRecoveryData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 [재고회수] 데이터 로드 시작');
      const response = await inventoryRecoveryAPI.getData();
      
      console.log('🔍 [재고회수] API 응답:', response);
      
      if (response.success) {
        setRecoveryData(response.data);
        console.log('✅ 재고회수 데이터 로드 완료:', response.data.length, '개 항목');
        
        // 데이터 상세 로그
        if (response.data.length > 0) {
          console.log('🔍 [재고회수] 첫 번째 항목:', response.data[0]);
        } else {
          console.log('⚠️ [재고회수] 데이터가 없습니다. 구글시트를 확인해주세요.');
        }
      } else {
        throw new Error(response.error || '데이터 로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ 재고회수 데이터 로드 오류:', error);
      setError(error.message);
      setSnackbar({
        open: true,
        message: '데이터 로드에 실패했습니다: ' + error.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    loadRecoveryData();
  }, []);

  // 상태 업데이트 핸들러
  const handleStatusUpdate = async (rowIndex, column, value, shouldRefresh = true) => {
    try {
      const response = await inventoryRecoveryAPI.updateStatus(rowIndex, column, value);
      if (response.success) {
        // 새로고침이 필요한 경우에만 데이터 새로고침
        if (shouldRefresh) {
          await loadRecoveryData();
          setSnackbar({
            open: true,
            message: '상태가 성공적으로 업데이트되었습니다.',
            severity: 'success'
          });
        }
      } else {
        throw new Error(response.error || '상태 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ 상태 업데이트 오류:', error);
      setSnackbar({
        open: true,
        message: '상태 업데이트에 실패했습니다: ' + error.message,
        severity: 'error'
      });
    }
  };

  // 탭 변경 핸들러
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    
    // 위경도좌표없는곳 탭으로 이동하면 자동으로 테이블 보기로 변경
    if (newValue === 3) {
      setCurrentView('table');
    }
  };

  // 뷰 변경 핸들러 (테이블/지도)
  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  // 탭별 데이터 필터링
  const getFilteredData = () => {
    switch (currentTab) {
      case 0: // 총 회수대상
        return recoveryData;
      case 1: // 금일 회수대상
        return recoveryData.filter(item => item.recoveryTargetSelected);
      case 2: // 금일 회수완료
        return recoveryData.filter(item => item.recoveryCompleted);
      case 3: // 위경도좌표없는곳
        return recoveryData.filter(item => !item.hasCoordinates);
      default:
        return recoveryData;
    }
  };

  // 스낵바 닫기
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // 우선순위 모델 선정 핸들러 - 임시 alert로 대체
  const handlePriorityModelSelect = (priorityLevel) => {
    alert(`${priorityLevel} 모델 선택 기능 (준비 중)`);
    // setSelectedPriorityLevel(priorityLevel);
    // setShowPriorityModal(true);
  };

  // 우선순위 모델 변경 핸들러
  const handlePriorityChange = (model, removePriority = null) => {
    if (removePriority) {
      // 우선순위 제거
      setPriorityModels(prev => ({
        ...prev,
        [removePriority]: null
      }));
      setSnackbar({
        open: true,
        message: `${removePriority} 모델이 제거되었습니다.`,
        severity: 'info'
      });
    } else if (model && selectedPriorityLevel) {
      // 우선순위 설정
      setPriorityModels(prev => ({
        ...prev,
        [selectedPriorityLevel]: model
      }));
      setSnackbar({
        open: true,
        message: `${selectedPriorityLevel} 모델이 설정되었습니다: ${model}`,
        severity: 'success'
      });
    }
  };

  // 우선순위 모달 닫기
  const handlePriorityModalClose = () => {
    setShowPriorityModal(false);
    setSelectedPriorityLevel(null);
  };

  if (loading) {
    return (
      <Box>
        <Header 
          onLogout={onLogout}
          loggedInStore={loggedInStore}
          onModeChange={onModeChange}
          availableModes={availableModes}
          currentMode="재고회수"
          onCheckUpdate={handleUpdateCheck}
        />
        
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            데이터를 불러오는 중...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Header 
          onLogout={onLogout}
          loggedInStore={loggedInStore}
          onModeChange={onModeChange}
          availableModes={availableModes}
          currentMode="재고회수"
          onCheckUpdate={handleUpdateCheck}
        />
        
        <Box sx={{ p: 4 }}>
          <Alert severity="error">
            {error}
          </Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Header 
        onLogout={onLogout}
        loggedInStore={loggedInStore}
        onModeChange={onModeChange}
        availableModes={availableModes}
        currentMode="재고회수"
        onCheckUpdate={handleUpdateCheck}
      />
      
      {/* 메인 콘텐츠 */}
      <Box sx={{ p: 2 }}>
        {/* 탭 메뉴 */}
        <Card sx={{ mb: 2 }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 'bold'
              }
            }}
          >
            <Tab label="📦 총 회수대상" />
            <Tab label="🎯 금일 회수대상" />
            <Tab label="✅ 금일 회수완료" />
            <Tab label="⚠️ 위경도좌표없는곳" />
          </Tabs>
        </Card>

        {/* 뷰 선택 버튼 */}
        <Card sx={{ mb: 2, p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant={currentView === 'table' ? 'contained' : 'outlined'}
              onClick={() => handleViewChange('table')}
              startIcon={<InventoryIcon />}
            >
              테이블 보기
            </Button>
            {/* 위경도좌표없는곳 탭에서는 지도 보기 버튼 숨김 */}
            {currentTab !== 3 && (
              <Button
                variant={currentView === 'map' ? 'contained' : 'outlined'}
                onClick={() => handleViewChange('map')}
                startIcon={<RefreshIcon />}
              >
                지도 보기
              </Button>
            )}
          </Box>
        </Card>

        {/* 우선순위 모델 선정 메뉴 */}
        <Card sx={{ mb: 2, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            ⭐ 우선순위 모델 선정하기
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {Object.entries(priorityModels).map(([priority, model]) => (
              <Button
                key={priority}
                variant={model ? 'contained' : 'outlined'}
                color={model ? 'primary' : 'default'}
                onClick={() => handlePriorityModelSelect(priority)}
                sx={{ 
                  minWidth: 120,
                  textTransform: 'none',
                  fontWeight: 'bold'
                }}
              >
                {priority} 모델
                {model && (
                  <Typography variant="caption" sx={{ ml: 1, opacity: 0.8 }}>
                    ({model})
                  </Typography>
                )}
              </Button>
            ))}
          </Box>
        </Card>

        {/* 콘텐츠 영역 */}
        <Card>
          <CardContent>
            {currentView === 'table' ? (
              <InventoryRecoveryTable
                data={getFilteredData()}
                tabIndex={currentTab}
                onStatusUpdate={handleStatusUpdate}
                onRefresh={loadRecoveryData}
                priorityModels={priorityModels}
              />
            ) : (
              <InventoryRecoveryMap
                data={getFilteredData()}
                tabIndex={currentTab}
                onStatusUpdate={handleStatusUpdate}
                onRefresh={loadRecoveryData}
                priorityModels={priorityModels}
              />
            )}
          </CardContent>
        </Card>
      </Box>

      {/* 알림 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 업데이트 팝업 */}
      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="inventoryRecovery"
        loggedInStore={loggedInStore}
        onUpdateAdded={() => {
          console.log('재고회수모드 새 업데이트가 추가되었습니다.');
        }}
      />

      {/* 우선순위 모델 선정 모달 - 임시 비활성화 */}
      {/* <PriorityModelSelectionModal
        open={showPriorityModal}
        onClose={handlePriorityModalClose}
        recoveryData={recoveryData}
        priorityModels={priorityModels}
        onPriorityChange={handlePriorityChange}
      /> */}
    </Box>
  );
}

export default InventoryRecoveryMode;
