/**
 * 에러 상태 공통 컴포넌트
 */
import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { normalizeErrorMessage } from '../../../utils/directStoreUtils';

/**
 * 에러 표시 컴포넌트
 * @param {Object} props
 * @param {Error|string} props.error - 에러 객체 또는 메시지
 * @param {Function} props.onRetry - 재시도 함수
 * @param {string} props.title - 에러 제목
 */
export const ErrorState = ({ error, onRetry, title = '오류가 발생했습니다' }) => {
  const errorMessage = normalizeErrorMessage(error);

  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2">
          {errorMessage}
        </Typography>
      </Alert>
      {onRetry && (
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
          sx={{ mt: 2 }}
        >
          다시 시도
        </Button>
      )}
    </Box>
  );
};

/**
 * 빈 상태 표시 컴포넌트
 * @param {Object} props
 * @param {string} props.message - 메시지
 * @param {React.ReactNode} props.icon - 아이콘
 */
export const EmptyState = ({ message = '데이터가 없습니다', icon }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
        gap: 2
      }}
    >
      {icon && <Box sx={{ fontSize: 48, color: 'text.secondary' }}>{icon}</Box>}
      <Typography variant="body1" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};
