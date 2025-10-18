import React from 'react';
import { Box, Typography, Button, IconButton, TextField, MenuItem, Autocomplete } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const CONTRACT_TYPES = ['지원금약정', '선택약정'];

export default function LineInputPanel({ inputs, onChange, planData, onCustomerNameChange, panelType }) {
  const handleLineChange = (index, field, value) => {
    const newLines = [...inputs.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    onChange({ ...inputs, lines: newLines });
    
    // 고객명 변경 시 양쪽 동기화
    if (field === 'customerName' && onCustomerNameChange) {
      onCustomerNameChange(index, value);
    }
  };

  const handleAddLine = () => {
    const prefix = inputs.lines[0]?.lineId?.charAt(0) || 'L';
    const newLine = { 
      lineId: `${prefix}${inputs.lines.length + 1}`, 
      customerName: '', 
      phone: '',
      planName: '', 
      planGroup: '', 
      contractType: '지원금약정', 
      deviceSupport: 0, 
      addons: [] 
    };
    
    // 기존결합일 경우 premierDiscount 추가
    if (panelType === 'existing') {
      newLine.premierDiscount = false;
    }
    
    onChange({
      ...inputs,
      lines: [...inputs.lines, newLine]
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
      {inputs.lines.map((line, idx) => {
        const selectedPlan = (planData || []).find(p => p.planName === line.planName);
        return (
          <Box key={line.lineId} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ minWidth: 40 }}>{idx + 1}번</Typography>
            <TextField
              size="small"
              label="고객명"
              value={line.customerName || ''}
              onChange={(e) => handleLineChange(idx, 'customerName', e.target.value)}
              sx={{ flex: 1, minWidth: 100 }}
            />
            <TextField
              size="small"
              label="연락처"
              value={line.phone || ''}
              onChange={(e) => handleLineChange(idx, 'phone', e.target.value)}
              sx={{ flex: 1, minWidth: 120 }}
              placeholder="010-1234-5678"
            />
            <Autocomplete
              size="small"
              options={planData || []}
              getOptionLabel={(option) => `${option.planName} (${option.planGroup}) - ${Number(option.baseFee || 0).toLocaleString()}원`}
              value={selectedPlan || null}
              onChange={(e, newValue) => handleLineChange(idx, 'planName', newValue?.planName || '')}
              renderInput={(params) => <TextField {...params} label="요금제" />}
              sx={{ flex: 3, minWidth: 250 }}
              isOptionEqualToValue={(option, value) => option.planName === value?.planName}
              filterOptions={(options, { inputValue }) => {
                const searchTerm = inputValue.toLowerCase().replace(/,/g, '').trim();
                if (!searchTerm) return options;
                
                return options.filter(option => {
                  const planName = option.planName.toLowerCase();
                  const planGroup = (option.planGroup || '').toLowerCase();
                  const baseFee = String(option.baseFee || 0);
                  
                  // 숫자만 입력한 경우 기본료로 검색
                  if (/^\d+$/.test(searchTerm)) {
                    return baseFee === searchTerm;
                  }
                  
                  // 일반 검색
                  return planName.includes(searchTerm) || planGroup.includes(searchTerm) || baseFee.includes(searchTerm);
                });
              }}
            />
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
            {panelType === 'existing' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <input
                  type="checkbox"
                  checked={line.premierDiscount || false}
                  onChange={(e) => handleLineChange(idx, 'premierDiscount', e.target.checked)}
                  id={`premier-${idx}`}
                />
                <label htmlFor={`premier-${idx}`} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>프리미어</label>
              </Box>
            )}
            <IconButton size="small" onClick={() => handleRemoveLine(idx)} disabled={inputs.lines.length <= 1}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
}


