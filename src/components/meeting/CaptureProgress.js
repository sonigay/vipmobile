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

function CaptureProgress({ open, total, current, completed, failed, onCancel }) {
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
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
                  primary={`슬라이드 ${slideIndex}`}
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

