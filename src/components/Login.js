import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container
} from '@mui/material';

function Login({ onLogin }) {
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeId.trim()) {
      setError('매장 ID를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/stores`);
      const stores = await response.json();
      
      const store = stores.find(s => s.id === storeId);
      if (store) {
        onLogin(store);
      } else {
        setError('존재하지 않는 매장 ID입니다.');
      }
    } catch (error) {
      setError('서버 연결에 실패했습니다.');
      console.error('Login error:', error);
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
              label="매장 ID(P코드)"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              margin="normal"
              error={!!error}
              helperText={error}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              sx={{ mt: 2 }}
            >
              로그인
            </Button>
          </form>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login; 