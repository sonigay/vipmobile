import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  CircularProgress
} from '@mui/material';

function Login({ onLogin }) {
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeId.trim()) {
      setError('매장 ID를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
      
      // 새로운 로그인 API를 사용하여 로그인
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeId }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || '로그인에 실패했습니다.');
        return;
      }
      
      if (data.success) {
        if (data.isAgent) {
          // 대리점 관리자인 경우
          onLogin({
            id: data.agentInfo.contactId,
            name: `${data.agentInfo.target} (${data.agentInfo.qualification})`,
            isAgent: true,
            target: data.agentInfo.target,
            qualification: data.agentInfo.qualification,
            contactId: data.agentInfo.contactId
          });
        } else {
          // 일반 매장인 경우
          onLogin({
            ...data.storeInfo,
            isAgent: false
          });
        }
      } else {
        setError('존재하지 않는 ID입니다.');
      }
    } catch (error) {
      setError('서버 연결에 실패했습니다.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <img 
              src="/login.png" 
              alt="VIP+" 
              style={{ maxWidth: '150px', margin: '0 auto' }}
            />
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="매장 ID(P코드) 또는 관리자 ID"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              margin="normal"
              error={!!error}
              helperText={error}
              disabled={loading}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : '로그인'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login; 