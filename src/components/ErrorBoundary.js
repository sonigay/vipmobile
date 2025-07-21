import React from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            p: 3,
            backgroundColor: '#f5f5f5'
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 600,
              textAlign: 'center',
              borderRadius: 2
            }}
          >
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              오류가 발생했습니다
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              애플리케이션에서 예상치 못한 오류가 발생했습니다. 
              페이지를 새로고침하여 다시 시도해주세요.
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                오류 정보: {this.state.error?.message || '알 수 없는 오류'}
              </Typography>
            </Alert>

            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={this.handleReload}
              size="large"
              sx={{ mr: 2 }}
            >
              페이지 새로고침
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => window.history.back()}
              size="large"
            >
              이전 페이지로
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 