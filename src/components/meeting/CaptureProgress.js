import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

function CaptureProgress({ open, total, current, completed, failed, onCancel, slides = [] }) {
  const progress = total > 0 ? (completed / total) * 100 : 0;
  
  // 슬라이드 정보 가져오기 헬퍼 함수
  const getSlideInfo = (index) => {
    if (slides && slides[index]) {
      const slide = slides[index];
      if (slide.type === 'main') return '회의 메인 화면';
      if (slide.type === 'toc') return '회의 목차';
      if (slide.type === 'ending') return '회의 종료';
      if (slide.type === 'custom') return slide.title || '커스텀 화면';
      if (slide.type === 'mode-only') {
        const { getModeConfig } = require('../../config/modeConfig');
        const modeConfig = getModeConfig(slide.mode);
        return modeConfig?.title || slide.mode;
      }
      // mode-tab 타입
      const { getModeConfig } = require('../../config/modeConfig');
      const modeConfig = getModeConfig(slide.mode);
      const modeName = modeConfig?.title || slide.mode;
      const tabName = slide.tabLabel || slide.tab || '';
      const subTabName = slide.subTabLabel || slide.subTab || '';
      if (subTabName) {
        return `${modeName} > ${tabName} > ${subTabName}`;
      }
      return `${modeName} > ${tabName}`;
    }
    return '';
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth sx={{ zIndex: 10000 }}>
      <DialogTitle>
        화면 캡처 진행 중...
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {completed} / {total} 완료
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <List dense>
          {Array.from({ length: total }, (_, index) => {
            const slideIndex = index + 1;
            const isCompleted = slideIndex <= completed;
            const isFailed = failed.includes(slideIndex);
            const isCurrent = slideIndex === current;

            return (
              <ListItem key={slideIndex}>
                <ListItemIcon>
                  {isCompleted ? (
                    <CheckCircleIcon color="success" />
                  ) : isFailed ? (
                    <ErrorIcon color="error" />
                  ) : isCurrent ? (
                    <RadioButtonUncheckedIcon color="primary" />
                  ) : (
                    <RadioButtonUncheckedIcon />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={`슬라이드 ${slideIndex}${getSlideInfo(index) ? ` - ${getSlideInfo(index)}` : ''}`}
                  secondary={isFailed ? '캡처 실패' : isCompleted ? '완료' : isCurrent ? '캡처 중...' : '대기 중'}
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={completed === total}>
          취소
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CaptureProgress;

