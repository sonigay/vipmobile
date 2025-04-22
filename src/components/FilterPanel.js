import React, { useCallback } from 'react';
import './FilterPanel.css';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Typography,
  Slider,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FilterListIcon from '@mui/icons-material/FilterList';
import ColorLensIcon from '@mui/icons-material/ColorLens';

const marks = [
  { value: 1000, label: '1km' },
  { value: 5000, label: '5km' },
  { value: 10000, label: '10km' },
  { value: 20000, label: '20km' },
  { value: 30000, label: '30km' },
  { value: 50000, label: '50km' }
];

function FilterPanel({ 
  models, 
  colorsByModel, 
  selectedModel, 
  selectedColor, 
  selectedRadius,
  onModelSelect, 
  onColorSelect, 
  onRadiusSelect 
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

  const handleRadiusChange = useCallback((event, newValue) => {
    if (event.type === 'mouseup' || event.type === 'touchend') {
      onRadiusSelect(newValue);
    }
  }, [onRadiusSelect]);

  return (
    <div className="filter-panel">
      <Typography className="filter-header">
        <TuneIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        필터 설정
      </Typography>

      <div className="filter-content">
        <div className="filter-left">
          <div className="search-group">
            <div className="model-search">
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
            </div>

            <div className="color-select">
              <FormControl fullWidth size="small">
                <InputLabel>색상 선택</InputLabel>
                <Select
                  value={selectedColor || ''}
                  onChange={handleColorChange}
                  label="색상 선택"
                  disabled={!selectedModel}
                >
                  <MenuItem value="">전체</MenuItem>
                  {selectedModel && colorsByModel[selectedModel]?.map((color) => (
                    <MenuItem key={color} value={color}>
                      {color}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>

          <div className="radius-group">
            <div className="radius-label">
              <LocationOnIcon sx={{ fontSize: 20 }} />
              <span>검색 반경</span>
            </div>
            <div className="radius-slider">
              <Slider
                value={selectedRadius}
                onChange={handleRadiusChange}
                onChangeCommitted={handleRadiusChange}
                min={1000}
                max={50000}
                step={1000}
                marks={marks}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${(value/1000).toFixed(1)}km`}
              />
            </div>
          </div>
        </div>

        <div className="selected-filters">
          <Typography className="selected-filters-title">
            <FilterListIcon />
            선택됨
          </Typography>
          <div className="selected-filter-items">
            <div className="selected-filter-item">
              <SearchIcon />
              {selectedModel || '전체'}
            </div>
            <div className="selected-filter-item">
              <ColorLensIcon />
              {selectedColor || (selectedModel ? '전체' : '-')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FilterPanel; 