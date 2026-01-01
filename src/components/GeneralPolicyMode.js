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
  SwapHoriz as SwapHorizIcon
} from '@mui/icons-material';
import AppUpdatePopup from './AppUpdatePopup';
import PolicyTableListTab from './policy/PolicyTableListTab';

const GeneralPolicyMode = ({ 
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

  useEffect(() => {
    // 권한 확인
    const hasPermission = loggedInStore?.modePermissions?.generalPolicy;
    if (!hasPermission) {
      setError('일반정책모드 접근 권한이 없습니다.');
      return;
    }

    // 비밀번호 필요 여부 확인
    const requiresPassword = loggedInStore?.generalPolicySecurity?.requiresPassword;
    const alreadyAuthenticated = loggedInStore?.generalPolicySecurity?.authenticated;

    // 비밀번호가 필요 없으면 바로 인증 완료
    if (!requiresPassword) {
      setIsAuthenticated(true);
      return;
    }

    // 이미 인증된 경우 바로 인증 상태로 설정
    if (alreadyAuthenticated) {
      setIsAuthenticated(true);
      return;
    }

    // 비밀번호가 필요한 경우에만 다이얼로그 표시
    if (requiresPassword && !alreadyAuthenticated) {
      setShowPasswordDialog(true);
    }
  }, [loggedInStore]);

  const handlePasswordSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = loggedInStore?.id || loggedInStore?.contactId;
      if (!userId) {
        setError('사용자 ID를 찾을 수 없습니다.');
        return;
      }

      const response = await fetch(`${API_URL}/api/check-general-policy-permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          password: password
        }),
      });
      
      const data = await response.json();
      if (data.success && data.hasPermission) {
        setIsAuthenticated(true);
        setShowPasswordDialog(false);
      } else {
        setError(data.error || '비밀번호가 일치하지 않습니다.');
      }
    } catch (error) {
      console.error('비밀번호 확인 오류:', error);
      setError('비밀번호 확인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" sx={{ bgcolor: '#FF9800' }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              일반정책모드
            </Typography>
            <Button color="inherit" onClick={onLogout}>
              로그아웃
            </Button>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Dialog open={showPasswordDialog} onClose={() => {}} maxWidth="sm" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon />
                <Typography variant="h6">일반정책모드 접근</Typography>
              </Box>
            </DialogTitle>
            <DialogContent>
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
                sx={{ mt: 2 }}
                autoFocus
              />
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={onLogout}>취소</Button>
              <Button
                onClick={handlePasswordSubmit}
                variant="contained"
                disabled={loading || !password}
                startIcon={loading ? <CircularProgress size={20} /> : null}
              >
                확인
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ bgcolor: '#FF9800' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            일반정책모드
          </Typography>
          
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
          
          {/* 모드 전환 버튼 - 2개 이상 권한이 있는 사용자에게만 표시 */}
          {onModeChange && availableModes && availableModes.length > 1 && (
            <Button
              color="inherit"
              startIcon={<SwapHorizIcon />}
              onClick={onModeChange}
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
          
          <Button color="inherit" onClick={onLogout}>
            로그아웃
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <PolicyTableListTab loggedInStore={loggedInStore} mode="generalPolicy" />
      </Box>

      <AppUpdatePopup
        open={showUpdatePopup}
        onClose={() => setShowUpdatePopup(false)}
        mode="generalPolicy"
        loggedInStore={loggedInStore}
      />
    </Box>
  );
};

export default GeneralPolicyMode;

