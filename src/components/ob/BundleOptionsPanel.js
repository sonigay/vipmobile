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
    <Box sx={{ mt: 1 }}>
      <TextField
        select
        size="small"
        label="기존결합 상품"
        value={inputs.existingBundleType || ''}
        onChange={(e) => onChange({ ...inputs, existingBundleType: e.target.value })}
        fullWidth
        sx={{ 
          backgroundColor: '#fff',
          borderRadius: 1,
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255,255,255,0.3)'
            }
          },
          '& .MuiInputLabel-root': {
            color: 'rgba(255,255,255,0.9)'
          },
          '& .MuiSelect-icon': {
            color: '#fff'
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

