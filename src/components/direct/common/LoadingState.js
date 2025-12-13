/**
 * 로딩 상태 공통 컴포넌트
 */
import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * 로딩 표시 컴포넌트
 * @param {Object} props
 * @param {string} props.message - 로딩 메시지
 * @param {boolean} props.fullScreen - 전체 화면 로딩 여부
 */
export const LoadingState = ({ message = '로딩 중...', fullScreen = false }) => {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 4
      }}
    >
      <CircularProgress />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999
        }}
      >
        {content}
      </Box>
    );
  }

  return content;
};

/**
 * 스켈레톤 로딩 컴포넌트
 */
export const SkeletonLoader = ({ count = 3, height = 100 }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box
          key={index}
          sx={{
            height,
            bgcolor: 'grey.200',
            borderRadius: 1,
            animation: 'pulse 1.5s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 }
            }
          }}
        />
      ))}
    </Box>
  );
};
