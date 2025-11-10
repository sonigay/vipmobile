import React from 'react';
import PropTypes from 'prop-types';
import { Box, Paper, Stack, Typography } from '@mui/material';

const ObSettlementOverviewPlaceholder = ({ month }) => (
  <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
    <Paper
      elevation={0}
      sx={{
        p: 4,
        border: '2px dashed #c5cae9',
        background: '#f5f6ff'
      }}
    >
      <Stack spacing={2} alignItems="center">
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#3f51b5' }}>
          OB 정산 확인
        </Typography>
        <Typography variant="body1" align="center" color="text.secondary">
          {month
            ? `${month} 정산 데이터를 불러오도록 준비 중입니다.`
            : '정산 데이터를 불러오도록 준비 중입니다.'}
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary">
          월별 구글시트 링크와 시트 이름을 등록하면 정산 데이터가 여기에 표시됩니다.
        </Typography>
      </Stack>
    </Paper>
  </Box>
);

ObSettlementOverviewPlaceholder.propTypes = {
  month: PropTypes.string
};

ObSettlementOverviewPlaceholder.defaultProps = {
  month: undefined
};

export default ObSettlementOverviewPlaceholder;

