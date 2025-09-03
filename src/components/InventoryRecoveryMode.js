import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Refresh as RefreshIcon,
  Build as BuildIcon
} from '@mui/icons-material';

import Header from './Header';
import AppUpdatePopup from './AppUpdatePopup';

function InventoryRecoveryMode({ onLogout, loggedInStore, onModeChange, availableModes }) {
  // 업데이트 팝업 상태
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);

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

  return (
    <Box>
      <Header 
        onLogout={onLogout}
        loggedInStore={loggedInStore}
        onModeChange={onModeChange}
        availableModes={availableModes}
        currentMode="재고회수"
        onUpdateCheck={handleUpdateCheck}
      />
      
      {/* 메인 콘텐츠 */}
      <Box sx={{ p: 4 }}>
        {/* 준비중 안내 */}
        <Card sx={{ mb: 4, border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ mb: 3 }}>
              <InventoryIcon sx={{ fontSize: 80, color: '#795548', mb: 2 }} />
              <RefreshIcon sx={{ fontSize: 60, color: '#ff9800', ml: -2, mb: 1 }} />
            </Box>
            
            <Typography variant="h4" sx={{ color: '#795548', mb: 2, fontWeight: 'bold' }}>
              🏪 재고회수모드
            </Typography>
            
            <Typography variant="h6" sx={{ color: '#ff9800', mb: 3 }}>
              🚧 준비 중입니다
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#666', mb: 4, maxWidth: 600, mx: 'auto' }}>
              재고 회수 및 관리 기능을 위한 모드입니다.<br />
              현재 개발 진행 중이며, 곧 서비스가 시작될 예정입니다.
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Card sx={{ backgroundColor: '#e3f2fd', border: '1px solid #2196f3', minWidth: 200 }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <BuildIcon sx={{ fontSize: 40, color: '#2196f3', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                    개발 진행률
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
                    <CircularProgress 
                      variant="determinate" 
                      value={35} 
                      size={40}
                      sx={{ color: '#2196f3' }}
                    />
                    <Typography variant="h6" sx={{ ml: 1, color: '#1976d2', fontWeight: 'bold' }}>
                      35%
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
              
              <Card sx={{ backgroundColor: '#fff3e0', border: '1px solid #ff9800', minWidth: 200 }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <RefreshIcon sx={{ fontSize: 40, color: '#ff9800', mb: 1 }} />
                  <Typography variant="subtitle1" sx={{ color: '#f57c00', fontWeight: 'bold' }}>
                    예상 완료일
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#f57c00', fontWeight: 'bold', mt: 1 }}>
                    2025년 2월
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </CardContent>
        </Card>
        
        {/* 기능 미리보기 */}
        <Card sx={{ border: '1px solid #e0e0e0' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3, color: '#795548', fontWeight: 'bold' }}>
              🔮 향후 제공 예정 기능
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
              <Card sx={{ backgroundColor: '#e8f5e8', border: '1px solid #4caf50' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ color: '#2e7d32', fontWeight: 'bold', mb: 1 }}>
                    📦 재고 회수 관리
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    매장별 재고 회수 현황 추적 및 관리
                  </Typography>
                </CardContent>
              </Card>
              
              <Card sx={{ backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ color: '#1976d2', fontWeight: 'bold', mb: 1 }}>
                    📊 회수 통계 분석
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    회수율, 회수 패턴 등 데이터 분석
                  </Typography>
                </CardContent>
              </Card>
              
              <Card sx={{ backgroundColor: '#fff3e0', border: '1px solid #ff9800' }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ color: '#f57c00', fontWeight: 'bold', mb: 1 }}>
                    🔄 자동화 프로세스
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    재고 회수 알림 및 자동화된 워크플로우
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </CardContent>
        </Card>
      </Box>

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
    </Box>
  );
}

export default InventoryRecoveryMode;
