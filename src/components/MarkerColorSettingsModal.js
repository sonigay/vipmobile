import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Divider
} from '@mui/material';
import { getUniqueValues, getMarkerColorSettings, saveMarkerColorSettings } from '../utils/markerColorUtils';

const DEFAULT_COLOR_PALETTE = [
  '#f44336', '#2196f3', '#4caf50', '#ff9800', '#9c27b0',
  '#00bcd4', '#ffeb3b', '#e91e63', '#795548', '#607d8b',
  '#3f51b5', '#009688', '#ff5722', '#673ab7', '#cddc39',
  '#ffc107', '#00acc1', '#8bc34a', '#ff6f00', '#5c6bc0'
];

const OPTION_LABELS = {
  default: '기존 로직 (출고일 기준)',
  code: '코드별',
  office: '사무실별',
  department: '소속별',
  manager: '담당자별'
};

const MarkerColorSettingsModal = ({ open, onClose, userId, onSave }) => {
  const [selectedOption, setSelectedOption] = useState('default');
  const [colorSettings, setColorSettings] = useState({
    code: {},
    office: {},
    department: {},
    manager: {}
  });
  const [uniqueValues, setUniqueValues] = useState({
    code: [],
    office: [],
    department: [],
    manager: []
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // 데이터 로드
  useEffect(() => {
    if (open && userId) {
      loadData();
    }
  }, [open, userId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 색상 설정 로드
      const settings = await getMarkerColorSettings(userId);
      setSelectedOption(settings.selectedOption || 'default');
      setColorSettings(settings.colorSettings || { code: {}, office: {}, department: {}, manager: {} });
      
      // 선택된 옵션의 유니크 값 로드
      if (settings.selectedOption && settings.selectedOption !== 'default') {
        const values = await getUniqueValues(settings.selectedOption);
        setUniqueValues(prev => ({
          ...prev,
          [settings.selectedOption]: values
        }));
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = async (option) => {
    setSelectedOption(option);
    
    // 선택된 옵션의 유니크 값 로드 (아직 로드되지 않은 경우)
    if (option !== 'default' && !uniqueValues[option]?.length) {
      try {
        const values = await getUniqueValues(option);
        setUniqueValues(prev => ({
          ...prev,
          [option]: values
        }));
      } catch (error) {
        console.error('유니크 값 로드 오류:', error);
      }
    }
  };

  const handleColorChange = (optionType, value, color) => {
    setColorSettings(prev => ({
      ...prev,
      [optionType]: {
        ...prev[optionType],
        [value]: color
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // 저장할 색상 설정 준비 (기본 색상 포함)
      const settingsToSave = { ...colorSettings };
      
      // 선택된 옵션이 'default'가 아닌 경우, 모든 값에 대해 색상이 없으면 기본 색상 할당
      if (selectedOption !== 'default') {
        const values = uniqueValues[selectedOption] || [];
        const currentSettings = settingsToSave[selectedOption] || {};
        const completeSettings = {};
        
        values.forEach((value, index) => {
          // 사용자가 설정한 색상이 있으면 사용하고, 없으면 기본 색상 사용
          completeSettings[value] = currentSettings[value] || DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length];
        });
        
        settingsToSave[selectedOption] = completeSettings;
      }
      
      const result = await saveMarkerColorSettings(userId, selectedOption, settingsToSave);
      
      if (result.success) {
        if (onSave) {
          onSave({ selectedOption, colorSettings: settingsToSave });
        }
        onClose();
      } else {
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedOption !== 'default') {
      const values = uniqueValues[selectedOption] || [];
      const resetSettings = {};
      values.forEach((value, index) => {
        resetSettings[value] = DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length];
      });
      setColorSettings(prev => ({
        ...prev,
        [selectedOption]: resetSettings
      }));
    }
  };

  const renderColorList = (optionType) => {
    const values = uniqueValues[optionType] || [];
    const settings = colorSettings[optionType] || {};
    
    if (values.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
          데이터가 없습니다.
        </Typography>
      );
    }
    
    return (
      <List>
        {values.map((value, index) => {
          const defaultColor = DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length];
          const currentColor = settings[value] || defaultColor;
          
          return (
            <ListItem key={value}>
              <ListItemText 
                primary={value}
                secondary={!settings[value] ? '기본 색상' : '사용자 설정'}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  type="color"
                  value={currentColor}
                  onChange={(e) => handleColorChange(optionType, value, e.target.value)}
                  sx={{ width: 60, height: 40 }}
                />
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    backgroundColor: currentColor,
                    border: '1px solid #ccc',
                    borderRadius: 1
                  }}
                />
              </Box>
            </ListItem>
          );
        })}
      </List>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>마커 색상 설정</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          색상 구분 옵션을 선택하고 각 값별로 색상을 설정할 수 있습니다.
        </Typography>
        
        {/* 라디오 버튼으로 옵션 선택 */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend">색상 구분 옵션 선택</FormLabel>
          <RadioGroup
            value={selectedOption}
            onChange={(e) => handleOptionChange(e.target.value)}
          >
            <FormControlLabel value="default" control={<Radio />} label={OPTION_LABELS.default} />
            <FormControlLabel value="code" control={<Radio />} label={OPTION_LABELS.code} />
            <FormControlLabel value="office" control={<Radio />} label={OPTION_LABELS.office} />
            <FormControlLabel value="department" control={<Radio />} label={OPTION_LABELS.department} />
            <FormControlLabel value="manager" control={<Radio />} label={OPTION_LABELS.manager} />
          </RadioGroup>
        </FormControl>
        
        <Divider sx={{ my: 2 }} />
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : selectedOption !== 'default' ? (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">
                {OPTION_LABELS[selectedOption]} 색상 설정
              </Typography>
              <Button size="small" onClick={handleReset}>
                기본값으로 초기화
              </Button>
            </Box>
            {renderColorList(selectedOption)}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            기존 로직을 선택하셨습니다. 출고일 기준 색상이 적용됩니다.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>취소</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading || saving}>
          {saving ? <CircularProgress size={24} /> : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MarkerColorSettingsModal;
