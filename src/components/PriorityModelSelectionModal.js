import React, { useState, useEffect, useMemo } from 'react';
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
  console.log('🔍 [PriorityModelSelectionModal] 컴포넌트 렌더링 시작');
  console.log('🔍 [PriorityModelSelectionModal] props:', { open, recoveryData, priorityModels, onPriorityChange });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredModels, setFilteredModels] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState(null);

  // 회수 데이터에서 고유한 모델명 추출
  const uniqueModels = useMemo(() => {
    try {
      console.log('🔍 [PriorityModelSelectionModal] uniqueModels 계산 시작');
      console.log('🔍 [PriorityModelSelectionModal] recoveryData:', recoveryData);
      
      if (!recoveryData || !Array.isArray(recoveryData)) {
        console.log('🔍 [PriorityModelSelectionModal] recoveryData가 유효하지 않음');
        return [];
      }
      
      const models = new Set();
      recoveryData.forEach((item, index) => {
        try {
          console.log(`🔍 [PriorityModelSelectionModal] item ${index}:`, item);
          if (item && item.modelName && typeof item.modelName === 'string' && item.modelName.trim()) {
            models.add(item.modelName.trim());
          }
        } catch (error) {
          console.error('❌ [PriorityModelSelectionModal] item 처리 중 에러:', error);
        }
      });
      
      const result = Array.from(models).sort();
      console.log('🔍 [PriorityModelSelectionModal] uniqueModels 결과:', result);
      return result;
    } catch (error) {
      console.error('❌ [PriorityModelSelectionModal] uniqueModels 계산 중 에러:', error);
      return [];
    }
  }, [recoveryData]);

  // 검색어에 따른 모델 필터링
  useEffect(() => {
    try {
      console.log('🔍 [PriorityModelSelectionModal] useEffect 실행:', { searchTerm, uniqueModels });
      
      if (!uniqueModels || !Array.isArray(uniqueModels)) {
        console.log('🔍 [PriorityModelSelectionModal] uniqueModels가 유효하지 않음');
        setFilteredModels([]);
        return;
      }
      
      if (!searchTerm.trim()) {
        setFilteredModels(uniqueModels);
      } else {
        const filtered = uniqueModels.filter(model => {
          try {
            return model && typeof model === 'string' && model.toLowerCase().includes(searchTerm.toLowerCase());
          } catch (error) {
            console.error('❌ [PriorityModelSelectionModal] model 필터링 중 에러:', error);
            return false;
          }
        });
        setFilteredModels(filtered);
      }
    } catch (error) {
      console.error('❌ [PriorityModelSelectionModal] useEffect 중 에러:', error);
      setFilteredModels([]);
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
    if (onPriorityChange) {
      onPriorityChange(null, priority);
    }
  };

  console.log('🔍 [PriorityModelSelectionModal] 렌더링 시작 - return 문 직전');
  console.log('🔍 [PriorityModelSelectionModal] 현재 상태:', { 
    open, 
    searchTerm, 
    filteredModels: filteredModels?.length || 0, 
    selectedPriority,
    uniqueModels: uniqueModels?.length || 0
  });

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
        {(() => {
          try {
            console.log('🔍 [PriorityModelSelectionModal] priorityModels 체크 시작');
            console.log('🔍 [PriorityModelSelectionModal] priorityModels 타입:', typeof priorityModels);
            console.log('🔍 [PriorityModelSelectionModal] priorityModels 값:', priorityModels);
            
            if (!priorityModels || typeof priorityModels !== 'object') {
              console.log('🔍 [PriorityModelSelectionModal] priorityModels가 유효하지 않음');
              return null;
            }
            
            const keys = Object.keys(priorityModels);
            console.log('🔍 [PriorityModelSelectionModal] Object.keys 결과:', keys);
            
            if (!keys || keys.length === 0) {
              console.log('🔍 [PriorityModelSelectionModal] priorityModels가 비어있음');
              return null;
            }
            
            const entries = Object.entries(priorityModels);
            console.log('🔍 [PriorityModelSelectionModal] Object.entries 결과:', entries);
            
            return (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                  현재 우선순위 모델
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {entries.map(([priority, model]) => {
                    console.log('🔍 [PriorityModelSelectionModal] priority, model:', priority, model);
                    return (
                      <Chip
                        key={priority}
                        label={`${priority}순위: ${model || '미지정'}`}
                        color="primary"
                        variant="filled"
                        onDelete={() => handleRemovePriority(priority)}
                        icon={<StarIcon />}
                      />
                    );
                  })}
                </Box>
                <Divider sx={{ my: 2 }} />
              </Box>
            );
          } catch (error) {
            console.error('❌ [PriorityModelSelectionModal] priorityModels 처리 중 에러:', error);
            return null;
          }
        })()}

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
            총 {filteredModels?.length || 0}개 모델
          </Typography>
          
          {!filteredModels || filteredModels.length === 0 ? (
            <Alert severity="info">
              {searchTerm ? '검색 결과가 없습니다.' : '회수 대상 모델이 없습니다.'}
            </Alert>
          ) : (
            <List>
              {filteredModels.map((model, index) => {
                const isSelected = selectedPriority === model;
                const isAlreadyPriority = priorityModels && Object.values(priorityModels).includes(model);
                
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
