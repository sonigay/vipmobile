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
    // 상세한 에러 정보 로깅
    const errorDetails = {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      errorBoundary: this.props.name || 'Unknown',
      timestamp: new Date().toISOString()
    };
    
    console.error('🔴 ErrorBoundary caught an error:', errorDetails);
    console.error('📍 Component Stack:', errorInfo?.componentStack);
    console.error('📋 Error Stack:', error?.stack);
    
    // 서버로 에러 전송 (개발 환경에서만)
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                          process.env.REACT_APP_ENV === 'development' ||
                          !process.env.NODE_ENV;
    
    if (isDevelopment) {
      try {
        fetch('http://127.0.0.1:7242/ingest/ce34fffa-1b21-49f2-9d28-ef36f8382244', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'ErrorBoundary.componentDidCatch',
          message: `ErrorBoundary [${this.props.name || 'Unknown'}] caught error`,
          data: errorDetails,
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'error-catch',
          hypothesisId: 'ERROR-BOUNDARY'
        })
      }).catch(() => {
        // 네트워크 에러는 조용히 무시 (개발 환경에서만)
      });
      } catch (e) {
        // 로깅 실패 무시
      }
    }
    
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
            
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace' }}>
                <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'error.main' }}>
                    🔴 에러 발생 위치 및 원인
                  </Typography>
                  
                  <Box sx={{ mb: 1.5 }}>
                    <strong>📍 발생 컴포넌트:</strong> {this.props.name || '알 수 없음'}
                  </Box>
                  
                  <Box sx={{ mb: 1.5 }}>
                    <strong>❌ 에러 메시지:</strong> {this.state.error?.message || '알 수 없는 오류'}
                  </Box>
                  
                  <Box sx={{ mb: 1.5 }}>
                    <strong>🏷️ 에러 타입:</strong> {this.state.error?.name || 'Unknown'}
                  </Box>
                  
                  {this.state.errorInfo?.componentStack && (
                    <Box sx={{ mb: 1.5 }}>
                      <strong>📋 컴포넌트 호출 스택:</strong>
                      <Box 
                        component="pre" 
                        sx={{ 
                          fontSize: '0.7rem', 
                          overflow: 'auto', 
                          maxHeight: '150px', 
                          marginTop: '8px',
                          padding: '8px',
                          bgcolor: 'rgba(0,0,0,0.03)',
                          borderRadius: 1,
                          border: '1px solid rgba(0,0,0,0.1)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {this.state.errorInfo.componentStack}
                      </Box>
                    </Box>
                  )}
                  
                  {this.state.error?.stack && (
                    <Box sx={{ mb: 1.5 }}>
                      <strong>🔍 상세 에러 스택 (파일명 및 라인 번호):</strong>
                      <Box 
                        component="pre" 
                        sx={{ 
                          fontSize: '0.7rem', 
                          overflow: 'auto', 
                          maxHeight: '200px', 
                          marginTop: '8px',
                          padding: '8px',
                          bgcolor: 'rgba(255,0,0,0.05)',
                          borderRadius: 1,
                          border: '1px solid rgba(255,0,0,0.2)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {this.state.error.stack}
                      </Box>
                    </Box>
                  )}
                </Box>
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