import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert
} from '@mui/material';

function PolicyCopyModal({ 
  open, 
  onClose, 
  policy, 
  onCopySubmit,
  selectedPolicies = [] // 일괄 복사를 위한 선택된 정책들
}) {
  const [targetYearMonth, setTargetYearMonth] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 대상년월 옵션 생성 (과거 12개월부터 미래 12개월까지 총 25개월)
  const getYearMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    
    // 과거 12개월부터 미래 12개월까지 (총 25개월)
    for (let i = -12; i <= 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const label = `${year}-${month}`;
      const value = `${year}-${month}`;
      options.push({ label, value });
    }
    
    return options;
  };

  const handleSubmit = async () => {
    if (!targetYearMonth) {
      alert('대상년월을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onCopySubmit(targetYearMonth);
    } catch (error) {
      console.error('정책 복사 실패:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTargetYearMonth('');
      onClose();
    }
  };

  // 일괄 복사인지 개별 복사인지 확인
  const isBulkCopy = selectedPolicies.length > 0;

  if (!policy && !isBulkCopy) return null;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Typography variant="h6">
          {isBulkCopy ? '정책 일괄 복사' : '정책 복사'}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          {isBulkCopy ? (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>복사할 정책:</strong> {selectedPolicies.length}건
              </Typography>
              <Typography variant="body2" color="text.secondary">
                선택된 정책들이 대상년월로 복사됩니다.
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>복사할 정책:</strong> {policy.policyName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                정책 내용: {policy.policyContent}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                현재 년월: {policy.yearMonth}
              </Typography>
            </>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            복사할 대상년월을 선택해주세요. 정책 내용은 동일하게 복사되며, 승인 상태는 초기화됩니다.
          </Typography>
        </Alert>

        <FormControl fullWidth>
          <InputLabel>대상년월 *</InputLabel>
          <Select
            value={targetYearMonth}
            onChange={(e) => setTargetYearMonth(e.target.value)}
            label="대상년월 *"
          >
            {getYearMonthOptions().map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          취소
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={isSubmitting || !targetYearMonth}
        >
          {isSubmitting ? '복사 중...' : '복사'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PolicyCopyModal; 