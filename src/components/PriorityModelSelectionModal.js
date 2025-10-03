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
  Divider,
  Alert,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';

function PriorityModelSelectionModal({ 
  open, 
  onClose, 
  recoveryData, 
  priorityModels, 
  onPriorityChange 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredModels, setFilteredModels] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState(null);

  // 회수 데이터에서 고유한 모델명 추출
  const uniqueModels = React.useMemo(() => {
    const models = new Set();
    recoveryData.forEach(item => {
      if (item.modelName && item.modelName.trim()) {
        models.add(item.modelName.trim());
      }
    });
    return Array.from(models).sort();
  }, [recoveryData]);

  // 검색어에 따른 모델 필터링
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

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedPriority(null);
    }
  }, [open]);

  // 모델 선택 핸들러
  const handleModelSelect = (model) => {
    setSelectedPriority(model);
  };

  // 우선순위 저장 핸들러
  const handleSave = () => {
    if (selectedPriority) {
      onPriorityChange(selectedPriority);
      onClose();
    }
  };

  // 우선순위 제거 핸들러
  const handleRemovePriority = (priority) => {
    onPriorityChange(null, priority);
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
                  label={`${priority}순위: ${model}`}
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
            sx={{ mb: 2 }}
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
                const isSelected = selectedPriority === model;
                const isAlreadyPriority = Object.values(priorityModels).includes(model);
                
                return (
                  <ListItem key={index} disablePadding>
                    <ListItemButton
                      onClick={() => !isAlreadyPriority && handleModelSelect(model)}
                      disabled={isAlreadyPriority}
                      sx={{
                        backgroundColor: isSelected ? 'primary.light' : 'transparent',
                        '&:hover': {
                          backgroundColor: isSelected ? 'primary.light' : 'action.hover',
                        },
                        opacity: isAlreadyPriority ? 0.5 : 1
                      }}
                    >
                      <ListItemText
                        primary={model}
                        secondary={isAlreadyPriority ? '이미 우선순위에 설정됨' : '클릭하여 선택'}
                      />
                      {isSelected && <StarIcon color="primary" />}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>

        {/* 선택된 모델 표시 */}
        {selectedPriority && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: 'primary.light', borderRadius: 1 }}>
            <Typography variant="body2" color="primary.contrastText">
              선택된 모델: <strong>{selectedPriority}</strong>
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          취소
        </Button>
        <Button 
          onClick={handleSave}
          variant="contained"
          disabled={!selectedPriority}
        >
          우선순위에 추가
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PriorityModelSelectionModal;
