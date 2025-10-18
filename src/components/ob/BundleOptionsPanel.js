import React from 'react';
import { Box, Typography, TextField, MenuItem } from '@mui/material';

const EXISTING_BUNDLE_TYPES = [
  '가무사 무무선',
  '참쉬운 결합',
  '가무사 유무선',
  '한방에YO'
];

const INTERNET_SPEEDS = ['100M', '500M', '1G'];

export default function BundleOptionsPanel({ inputs, onChange }) {
  return (
    <Box>
      <TextField
        select
        size="small"
        placeholder="기존결합 상품 선택"
        value={inputs.existingBundleType || ''}
        onChange={(e) => onChange({ ...inputs, existingBundleType: e.target.value })}
        fullWidth
        sx={{ 
          backgroundColor: '#fff',
          borderRadius: 1
        }}
        SelectProps={{
          displayEmpty: true,
          renderValue: (selected) => {
            if (!selected) {
              return <span style={{ color: '#9e9e9e' }}>기존결합 상품 선택</span>;
            }
            return selected;
          }
        }}
      >
        <MenuItem value="">선택안함</MenuItem>
        {EXISTING_BUNDLE_TYPES.map(type => (
          <MenuItem key={type} value={type}>{type}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
}

