import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';

function BulkActionModal({ 
  open, 
  onClose, 
  action, 
  selectedCount,
  onConfirm 
}) {
  const getActionInfo = () => {
    switch (action) {
      case 'approve':
        return {
          title: '일괄 승인',
          message: `선택된 ${selectedCount}건의 정책을 일괄승인하시겠습니까?`,
          confirmText: '승인'
        };
      case 'settlement':
        return {
          title: '일괄 정산반영',
          message: `선택된 ${selectedCount}건의 정책을 일괄정산반영하시겠습니까?`,
          confirmText: '정산반영'
        };
      case 'cancel':
        return {
          title: '일괄 취소',
          message: `선택된 ${selectedCount}건의 정책을 일괄취소하시겠습니까?`,
          confirmText: '취소'
        };
      case 'copy':
        return {
          title: '일괄 복사',
          message: `선택된 ${selectedCount}건의 정책을 복사하시겠습니까?`,
          confirmText: '복사'
        };
      default:
        return {
          title: '일괄 처리',
          message: `선택된 ${selectedCount}건의 정책을 처리하시겠습니까?`,
          confirmText: '처리'
        };
    }
  };

  const actionInfo = getActionInfo();

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Typography variant="h6">{actionInfo.title}</Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Alert severity="warning">
            <Typography variant="body2">
              {actionInfo.message}
            </Typography>
          </Alert>
        </Box>
        
        <Typography variant="body2" color="text.secondary">
          이 작업은 되돌릴 수 없습니다. 신중하게 진행해주세요.
        </Typography>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>
          취소
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="primary"
        >
          {actionInfo.confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BulkActionModal; 