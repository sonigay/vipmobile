/**
 * 모던한 테이블 컴포넌트
 * 새로운 디자인 시스템에 맞춘 테이블 컴포넌트
 * 
 * 주의: useTheme() hook 사용을 제거하여 초기화 순서 문제를 방지합니다.
 * 대신 sx prop의 theme을 사용하거나 기본값을 사용합니다.
 */
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  alpha,
} from '@mui/material';

/**
 * 모던한 테이블 컨테이너
 */
export const ModernTable = ({ children, sx, ...props }) => {
  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 2,
        border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        overflow: 'hidden',
        ...sx,
      }}
      {...props}
    >
      {children}
    </TableContainer>
  );
};

/**
 * 모던한 테이블 헤더 셀
 */
export const ModernTableCell = ({ children, align = 'left', sx, ...props }) => {
  return (
    <TableCell
      align={align}
      sx={{
        fontWeight: 600,
        fontSize: '0.875rem',
        color: 'text.primary',
        ...sx,
      }}
      {...props}
    >
      {children}
    </TableCell>
  );
};

/**
 * 호버 효과가 있는 테이블 행
 */
export const HoverableTableRow = ({ children, onClick, sx, ...props }) => {
  return (
    <TableRow
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 0.2s ease',
        '&:hover': {
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </TableRow>
  );
};

/**
 * 빈 상태 테이블 행
 */
export const EmptyTableRow = ({ colSpan, message = '데이터가 없습니다' }) => {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} align="center" sx={{ py: 8 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            color: 'text.secondary',
          }}
        >
          <Typography variant="body1">{message}</Typography>
        </Box>
      </TableCell>
    </TableRow>
  );
};
