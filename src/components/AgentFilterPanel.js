import React from 'react';
import './FilterPanel.css';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Typography,
  Box,
  Paper
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import ColorLensIcon from '@mui/icons-material/ColorLens';

/**
 * 관리자 모드용 필터 패널 컴포넌트
 * 검색 반경 설정이 없는 간소화된 버전
 */
function AgentFilterPanel({ 
  models, 
  colorsByModel, 
  selectedModel, 
  selectedColor, 
  onModelSelect, 
  onColorSelect
}) {
  const handleModelChange = (event, newValue) => {
    console.log('모델 선택:', newValue);
    onModelSelect(newValue || '');
  };

  const handleColorChange = (event) => {
    const newValue = event.target.value;
    console.log('색상 선택:', newValue);
    onColorSelect(newValue);
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h8" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
        <TuneIcon sx={{ mr: 1 }} />
        관리자 필터 설정
      </Typography>

      {/* 모델 및 색상 선택 */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        width: '100%'
      }}>
        {/* 모델 검색 */}
        <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', md: '60%' } }}>
          <Autocomplete
            value={selectedModel}
            onChange={handleModelChange}
            options={Array.isArray(models) ? models : []}
            renderInput={(params) => (
              <TextField
                {...params}
                label="모델 검색"
                variant="outlined"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
                }}
              />
            )}
          />
        </Box>

        {/* 색상 선택 */}
        <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', md: '40%' } }}>
          <FormControl fullWidth size="small">
            <InputLabel>색상 선택</InputLabel>
            <Select
              value={selectedColor || ''}
              onChange={handleColorChange}
              label="색상 선택"
              disabled={!selectedModel}
              startAdornment={<ColorLensIcon color="action" sx={{ mr: 1 }} />}
            >
              <MenuItem value="">전체</MenuItem>
              {selectedModel && colorsByModel[selectedModel]?.map((color) => (
                <MenuItem key={color} value={color}>
                  {color}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
    </Paper>
  );
}

export default AgentFilterPanel; 