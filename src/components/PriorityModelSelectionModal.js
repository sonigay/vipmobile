import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
  IconButton,
  Alert,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Star as StarIcon
} from '@mui/icons-material';

function PriorityModelSelectionModal({ 
  open, 
  onClose, 
  recoveryData = [], 
  priorityModels = {}, 
  onPriorityChange 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredModels, setFilteredModels] = useState([]);

  // 고유한 모델명 추출
  const uniqueModels = React.useMemo(() => {
    if (!Array.isArray(recoveryData)) return [];
    
    const models = new Set();
    recoveryData.forEach(item => {
      if (item && item.modelName && typeof item.modelName === 'string') {
        models.add(item.modelName.trim());
      }
    });
    
    return Array.from(models).sort();
  }, [recoveryData]);

  // 검색 필터링
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredModels(uniqueModels);
    } else {
      const filtered = uniqueModels.filter(model => 
        model.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredModels(filtered);
    }
  }, [searchTerm, uniqueModels]);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setFilteredModels(uniqueModels);
    }
  }, [open, uniqueModels]);

  const handleModelSelect = (model) => {
    if (onPriorityChange) {
      onPriorityChange(model);
    }
    onClose();
  };

  const handleRemovePriority = (priority) => {
    if (onPriorityChange) {
      onPriorityChange(null, priority);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            우선순위 모델 선정하기
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 현재 우선순위 모델들 */}
        {Object.keys(priorityModels).length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              현재 우선순위 모델
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(priorityModels).map(([priority, model]) => (
                <Chip
                  key={priority}
                  label={`${priority}순위: ${model || '미지정'}`}
                  color="primary"
                  variant="filled"
                  onDelete={() => handleRemovePriority(priority)}
                  icon={<StarIcon />}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* 모델 검색 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
            모델 검색 및 선택
          </Typography>
          <TextField
            fullWidth
            placeholder="모델명을 입력하세요..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* 모델 목록 */}
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
            총 {filteredModels.length}개 모델
          </Typography>
          {filteredModels.length === 0 ? (
            <Alert severity="info">
              {searchTerm ? '검색 결과가 없습니다.' : '회수 대상 모델이 없습니다.'}
            </Alert>
          ) : (
            <List>
              {filteredModels.map((model, index) => {
                const isAlreadyPriority = Object.values(priorityModels).includes(model);
                return (
                  <ListItem key={index} disablePadding>
                    <ListItemButton
                      onClick={() => !isAlreadyPriority && handleModelSelect(model)}
                      disabled={isAlreadyPriority}
                    >
                      <ListItemText primary={model} />
                      {isAlreadyPriority && <StarIcon color="warning" />}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PriorityModelSelectionModal;