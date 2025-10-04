import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  TextField, List, ListItem, ListItemText, ListItemButton, Chip, IconButton,
  Divider, Alert, InputAdornment
} from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon, Star as StarIcon, StarBorder as StarBorderIcon } from '@mui/icons-material';

function PriorityModelSelectionModal({ 
  open, 
  onClose, 
  recoveryData, 
  priorityModels, 
  onPriorityChange,
  selectedPriorityLevel 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredModels, setFilteredModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);

  // 회수 데이터에서 고유한 모델명 추출
  const uniqueModels = useMemo(() => {
    if (!recoveryData || !Array.isArray(recoveryData)) {
      return [];
    }
    
    const models = new Set();
    recoveryData.forEach(item => {
      if (item && item.modelName && typeof item.modelName === 'string' && item.modelName.trim()) {
        models.add(item.modelName.trim());
      }
    });
    
    return Array.from(models).sort();
  }, [recoveryData]);

  // 검색어에 따른 모델 필터링
  useEffect(() => {
    if (!uniqueModels || !Array.isArray(uniqueModels)) {
      setFilteredModels([]);
      return;
    }
    
    if (!searchTerm.trim()) {
      setFilteredModels(uniqueModels);
    } else {
      const filtered = uniqueModels.filter(model =>
        model && typeof model === 'string' && model.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredModels(filtered);
    }
  }, [searchTerm, uniqueModels]);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedModel(null);
    }
  }, [open]);

  // 모델 선택 핸들러
  const handleModelSelect = (model) => {
    setSelectedModel(model);
  };

  // 우선순위 저장 핸들러
  const handleSavePriority = () => {
    if (selectedModel && onPriorityChange) {
      onPriorityChange(selectedModel);
      onClose();
    }
  };

  // 우선순위 제거 핸들러
  const handleRemovePriority = (priority) => {
    if (onPriorityChange) {
      onPriorityChange(null, priority);
    }
  };

  // 이미 우선순위로 설정된 모델인지 확인
  const isAlreadyPriority = (model) => {
    if (!priorityModels || !model) return false;
    return Object.values(priorityModels).includes(model);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {selectedPriorityLevel} 모델 선정하기
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 현재 우선순위 모델들 */}
        {priorityModels && Object.keys(priorityModels).length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              현재 우선순위 모델
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(priorityModels).map(([priority, model]) => (
                <Chip
                  key={priority}
                  label={`${priority}: ${model || '미지정'}`}
                  color="primary"
                  variant="filled"
                  onDelete={() => handleRemovePriority(priority)}
                  icon={<StarIcon />}
                />
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
          </Box>
        )}

        {/* 모델 검색 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
            모델 검색 및 선택
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="모델명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
            총 {filteredModels?.length || 0}개 모델
          </Typography>
          
          {!filteredModels || filteredModels.length === 0 ? (
            <Alert severity="info">
              {searchTerm ? '검색 결과가 없습니다.' : '회수 대상 모델이 없습니다.'}
            </Alert>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #eee', borderRadius: 1 }}>
              {filteredModels.map((model, index) => {
                const isSelected = selectedModel === model;
                const isAlreadySet = isAlreadyPriority(model);
                
                return (
                  <ListItem key={index} disablePadding>
                    <ListItemButton
                      onClick={() => !isAlreadySet && handleModelSelect(model)}
                      selected={isSelected}
                      disabled={isAlreadySet}
                      sx={{
                        '&.Mui-selected': {
                          backgroundColor: '#e3f2fd',
                        },
                        '&.Mui-disabled': {
                          opacity: 0.6,
                        }
                      }}
                    >
                      <ListItemText 
                        primary={model}
                        secondary={isAlreadySet ? '이미 우선순위로 설정됨' : ''}
                      />
                      {isAlreadySet && <StarIcon color="warning" />}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="secondary">
          취소
        </Button>
        <Button
          onClick={handleSavePriority}
          color="primary"
          variant="contained"
          disabled={!selectedModel}
        >
          {selectedPriorityLevel} 모델로 선택
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PriorityModelSelectionModal;