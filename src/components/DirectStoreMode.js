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
  DialogActions
} from '@mui/material';
import {
  Lock as LockIcon,
  Update as UpdateIcon,
  Refresh as RefreshIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import PlaceholderModeScreen from './PlaceholderModeScreen';
import AppUpdatePopup from './AppUpdatePopup';
import { getModeColor, getModeTitle } from '../config/modeConfig';

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
  
  const API_URL = process.env.REACT_APP_API_URL;
  const modeColor = getModeColor('directStore');
  const modeTitle = getModeTitle('directStore', '직영점 모드');

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

  // 비밀번호가 필요하고 아직 인증되지 않은 경우
  if (requiresPassword && !isAuthenticated) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
        {/* 헤더 */}
        <AppBar position="static" sx={{ 
          bgcolor: 'transparent',
          background: `linear-gradient(135deg, ${modeColor} 0%, #37474f 100%)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <Toolbar>
            <LockIcon sx={{ mr: 2 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {modeTitle}
            </Typography>
            
            <Button
              color="inherit"
              startIcon={<UpdateIcon />}
              onClick={() => setShowUpdatePopup(true)}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
              }}
            >
              업데이트 확인
            </Button>
            
            {onModeChange && availableModes && availableModes.length > 1 && (
              <Button
                color="inherit"
                startIcon={<RefreshIcon />}
                onClick={onModeChange}
                sx={{
                  ml: 2,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                }}
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
            background: 'linear-gradient(135deg, #f5f7fa 0%, #e8edf1 100%)',
            border: '1px solid #b0bec5',
            boxShadow: '0 8px 32px rgba(69, 90, 100, 0.15)'
          }}>
            <LockIcon sx={{ fontSize: 60, color: modeColor, mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ color: modeColor, fontWeight: 'bold' }}>
              🔐 직영점 모드 접근
            </Typography>
            <Typography variant="body2" sx={{ color: modeColor, mb: 3 }}>
              이 모드에 접근하려면 비밀번호가 필요합니다.
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => setShowPasswordDialog(true)}
              sx={{ 
                mt: 2,
                background: `linear-gradient(135deg, ${modeColor} 0%, #37474f 100%)`,
                '&:hover': { 
                  background: `linear-gradient(135deg, #37474f 0%, #263238 100%)`,
                  transform: 'translateY(-2px)'
                },
                boxShadow: '0 6px 20px rgba(69, 90, 100, 0.4)',
                transition: 'all 0.3s ease',
                px: 4,
                py: 1.5
              }}
            >
              🔑 비밀번호 입력
            </Button>
          </Paper>
        </Box>

        {/* 비밀번호 입력 다이얼로그 */}
        <Dialog 
          open={showPasswordDialog} 
          onClose={() => setShowPasswordDialog(false)}
          PaperProps={{
            sx: {
              background: 'linear-gradient(135deg, #f5f7fa 0%, #e8edf1 100%)',
              border: '1px solid #b0bec5',
              boxShadow: '0 8px 32px rgba(69, 90, 100, 0.15)'
            }
          }}
        >
          <DialogTitle sx={{ color: modeColor, fontWeight: 'bold', textAlign: 'center' }}>
            🔐 비밀번호 입력
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1, minWidth: 300 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': { borderColor: modeColor },
                    '&.Mui-focused fieldset': { borderColor: modeColor }
                  },
                  '& .MuiInputLabel-root.Mui-focused': { color: modeColor }
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button 
              onClick={() => setShowPasswordDialog(false)}
              sx={{ color: modeColor }}
              disabled={loading}
            >
              취소
            </Button>
            <Button 
              onClick={handlePasswordSubmit}
              variant="contained"
              disabled={loading}
              sx={{ 
                background: `linear-gradient(135deg, ${modeColor} 0%, #37474f 100%)`,
                '&:hover': { 
                  background: `linear-gradient(135deg, #37474f 0%, #263238 100%)`
                },
                boxShadow: '0 4px 15px rgba(69, 90, 100, 0.3)',
                px: 3
              }}
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
    );
  }

  // 인증 완료 후 또는 비밀번호가 필요 없는 경우 준비중 화면 표시
  return <PlaceholderModeScreen modeKey="directStore" onLogout={onLogout} onModeChange={onModeChange} availableModes={availableModes} loggedInStore={loggedInStore} />;
};

export default DirectStoreMode;
