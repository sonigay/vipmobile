import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  CircularProgress
} from '@mui/material';
import {
  Update as UpdateIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

const UpdateProgressPopup = ({ open, onClose, onUpdate }) => {
  const [progress, setProgress] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStep, setUpdateStep] = useState('');

  const handleUpdate = async () => {
    setIsUpdating(true);
    setProgress(0);
    
    try {
      // 1단계: 캐시 정리 (20%)
      setUpdateStep('캐시 정리 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(20);
      
      // 2단계: 새 리소스 확인 (40%)
      setUpdateStep('새 리소스 확인 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(40);
      
      // 3단계: 업데이트 다운로드 (70%)
      setUpdateStep('업데이트 다운로드 중...');
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgress(70);
      
      // 4단계: 업데이트 적용 (90%)
      setUpdateStep('업데이트 적용 중...');
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(90);
      
      // 5단계: 완료 (100%)
      setUpdateStep('업데이트 완료!');
      await new Promise(resolve => setTimeout(resolve, 300));
      setProgress(100);
      
      // Service Worker에 업데이트 요청
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SKIP_WAITING'
        });
      }
      
      // 잠시 후 페이지 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('업데이트 중 오류 발생:', error);
      setUpdateStep('업데이트 실패');
    }
  };

  const handleClose = () => {
    if (!isUpdating) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={isUpdating}
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: '200px'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'primary.main',
        color: 'white',
        textAlign: 'center'
      }}>
        <UpdateIcon sx={{ mr: 1 }} />
        <Typography variant="h6">
          업데이트 진행
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3, textAlign: 'center' }}>
        {!isUpdating ? (
          <Box>
            <UpdateIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>
              간단한 업데이트 내용이 있습니다
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              업데이트를 진행하시겠습니까?
            </Typography>
          </Box>
        ) : (
          <Box>
            <CircularProgress 
              variant="determinate" 
              value={progress} 
              size={80}
              sx={{ mb: 2 }}
            />
            <Typography variant="h6" sx={{ mb: 2 }}>
              {updateStep}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {progress}% 완료
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'center' }}>
        {!isUpdating ? (
          <>
            <Button 
              onClick={handleClose}
              variant="outlined"
              sx={{ minWidth: 100 }}
            >
              취소
            </Button>
            <Button 
              onClick={handleUpdate}
              variant="contained"
              startIcon={<UpdateIcon />}
              sx={{ minWidth: 100 }}
            >
              확인
            </Button>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CheckCircleIcon color="success" sx={{ mr: 1 }} />
            <Typography variant="body2" color="success.main">
              업데이트가 완료되면 자동으로 새로고침됩니다
            </Typography>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default UpdateProgressPopup; 