import React from 'react';
import { Box, Typography, Button, IconButton, TextField, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const CONTRACT_TYPES = ['지원금약정', '선택약정'];

export default function LineInputPanel({ inputs, onChange, planData }) {
  const handleLineChange = (index, field, value) => {
    const newLines = [...inputs.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    onChange({ ...inputs, lines: newLines });
  };

  const handleAddLine = () => {
    const prefix = inputs.lines[0]?.lineId?.charAt(0) || 'L';
    onChange({
      ...inputs,
      lines: [...inputs.lines, { lineId: `${prefix}${inputs.lines.length + 1}`, planName: '', planGroup: '', contractType: '지원금약정', deviceSupport: 0, addons: [] }]
    });
  };

  const handleRemoveLine = (index) => {
    onChange({
      ...inputs,
      lines: inputs.lines.filter((_, i) => i !== index)
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" fontWeight="bold">회선 입력</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={handleAddLine} variant="outlined">
          추가
        </Button>
      </Box>
      {inputs.lines.map((line, idx) => (
        <Box key={line.lineId} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <Typography variant="body2" sx={{ minWidth: 40 }}>{idx + 1}번</Typography>
          <TextField
            select
            size="small"
            label="요금제"
            value={line.planName}
            onChange={(e) => handleLineChange(idx, 'planName', e.target.value)}
            sx={{ flex: 2, minWidth: 200 }}
          >
            <MenuItem value="">선택안함</MenuItem>
            {(planData || []).map(p => (
              <MenuItem key={p.planName} value={p.planName}>
                {p.planName} ({p.planGroup}) - {Number(p.baseFee || 0).toLocaleString()}원
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="약정구분"
            value={line.contractType || '지원금약정'}
            onChange={(e) => handleLineChange(idx, 'contractType', e.target.value)}
            sx={{ flex: 1, minWidth: 120 }}
          >
            {CONTRACT_TYPES.map(type => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </TextField>
          <IconButton size="small" onClick={() => handleRemoveLine(idx)} disabled={inputs.lines.length <= 1}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}


