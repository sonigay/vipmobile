import React from 'react';
import { Box, Typography, TextField, MenuItem } from '@mui/material';

const EXISTING_BUNDLE_TYPES = [
  '가무사 무무선',
  '참쉬운 결합',
  '가무사 유무선',
  '한방에YO'
];

export default function BundleOptionsPanel({ inputs, onChange }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <TextField
          select
          size="small"
          label="기존결합 상품"
          value={inputs.existingBundleType || ''}
          onChange={(e) => onChange({ ...inputs, existingBundleType: e.target.value })}
          sx={{ flex: 1 }}
        >
          <MenuItem value="">선택안함</MenuItem>
          {EXISTING_BUNDLE_TYPES.map(type => (
            <MenuItem key={type} value={type}>{type}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="인터넷 포함여부"
          value={inputs.internetIncluded || '미포함'}
          onChange={(e) => onChange({ ...inputs, internetIncluded: e.target.value })}
          sx={{ flex: 1 }}
        >
          <MenuItem value="포함">포함</MenuItem>
          <MenuItem value="미포함">미포함</MenuItem>
        </TextField>
    </Box>
  );
}

