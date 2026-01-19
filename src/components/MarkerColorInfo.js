import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

const OPTION_LABELS = {
  default: '기존 로직 (출고일 기준)',
  code: '코드별',
  office: '사무실별',
  department: '소속별',
  manager: '담당자별'
};

function MarkerColorInfo({ selectedOption, colorSettings }) {
  if (!selectedOption || selectedOption === 'default') {
    return (
      <Paper elevation={2} sx={{ p: 1.5, mb: 2, backgroundColor: '#f9f9f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
            마커 색상 설정:
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#333' }}>
            {OPTION_LABELS[selectedOption] || OPTION_LABELS.default}
          </Typography>
        </Box>
      </Paper>
    );
  }

  const settings = colorSettings[selectedOption] || {};
  const entries = Object.entries(settings);

  if (entries.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 1.5, mb: 2, backgroundColor: '#f9f9f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
            마커 색상 설정:
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#333' }}>
            {OPTION_LABELS[selectedOption]} (설정 없음)
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 1.5, mb: 2, backgroundColor: '#f9f9f9' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#666', fontWeight: 'bold' }}>
          마커 색상 설정:
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.75rem', color: '#333' }}>
          {OPTION_LABELS[selectedOption]}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {entries.map(([value, color]) => (
            <Box
              key={value}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#555' }}>
                {value}
              </Typography>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '1px solid #ccc',
                  flexShrink: 0
                }}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
}

export default MarkerColorInfo;
