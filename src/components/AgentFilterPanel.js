import React from 'react';
import './FilterPanel.css';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import StoreIcon from '@mui/icons-material/Store';

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
  onColorSelect,
  searchQuery,
  searchResults,
  onStoreSearch,
  onSearchResultSelect
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

      {/* 재고요청점 검색 */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
          <StoreIcon sx={{ mr: 1, fontSize: '1rem' }} />
          재고요청점 검색
        </Typography>
        <Autocomplete
          value={searchQuery}
          onChange={(event, newValue) => onStoreSearch(newValue || '')}
          options={[]}
          freeSolo
          renderInput={(params) => (
            <TextField
              {...params}
              label="매장명 또는 담당자명으로 검색"
              variant="outlined"
              size="small"
              InputProps={{
                ...params.InputProps,
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
              }}
            />
          )}
          onInputChange={(event, newInputValue) => {
            onStoreSearch(newInputValue);
          }}
        />
        
        {/* 검색 결과 목록 */}
        {searchResults.length > 0 && (
          <Paper elevation={3} sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
            <List dense>
              {searchResults.map((store, index) => (
                <React.Fragment key={store.id}>
                  <ListItem disablePadding>
                    <ListItemButton onClick={() => onSearchResultSelect(store)}>
                      <ListItemText
                        primary={store.name}
                        secondary={`담당자: ${store.manager || '미지정'} | 주소: ${store.address || '주소 없음'}`}
                        primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 'bold' }}
                        secondaryTypographyProps={{ fontSize: '0.8rem' }}
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < searchResults.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Paper>
        )}
      </Box>

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