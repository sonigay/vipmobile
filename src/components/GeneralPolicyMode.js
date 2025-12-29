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
  Lock as LockIcon
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
    // 권한이 있으면 비밀번호 다이얼로그 표시
    const hasPermission = loggedInStore?.modePermissions?.generalPolicy;
    if (hasPermission) {
      setShowPasswordDialog(true);
    } else {
      setError('일반정책모드 접근 권한이 없습니다.');
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
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            일반정책모드
          </Typography>
          <Button
            color="inherit"
            onClick={() => setShowUpdatePopup(true)}
            sx={{ mr: 2 }}
          >
            업데이트
          </Button>
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

