import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';

const PolicyCancelModal = ({ 
  open, 
  onClose, 
  policy, 
  onCancelSubmit,
  cancelType, // 'policy' 또는 'approval'
  userRole 
}) => {
  const [cancelData, setCancelData] = useState({
    cancelReason: '',
    approvalType: '' // 승인 취소 시에만 사용
  });

  const handleInputChange = (field, value) => {
    setCancelData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    if (!cancelData.cancelReason.trim()) {
      alert('취소 사유를 입력해주세요.');
      return;
    }

    if (cancelType === 'approval' && !cancelData.approvalType) {
      alert('승인 유형을 선택해주세요.');
      return;
    }

    onCancelSubmit({
      policyId: policy.id,
      cancelReason: cancelData.cancelReason,
      approvalType: cancelData.approvalType,
      cancelType
    });
  };

  const handleClose = () => {
    setCancelData({ cancelReason: '', approvalType: '' });
    onClose();
  };

  if (!policy) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {cancelType === 'policy' ? '정책 취소' : '승인 취소'} - {policy.policyName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            정책 정보
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                정책명: {policy.policyName}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                적용일: {policy.policyDate}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                적용점: {policy.policyStore}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                금액: {policy.policyAmount}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                내용: {policy.policyContent}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {cancelType === 'approval' && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              현재 승인 상태
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  총괄: {policy.approvalStatus?.total || '대기'}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  정산팀: {policy.approvalStatus?.settlement || '대기'}
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">
                  소속팀: {policy.approvalStatus?.team || '대기'}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {cancelType === 'policy' ? '정책 취소' : '승인 취소'} 처리
          </Typography>
          <Grid container spacing={2}>
            {cancelType === 'approval' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>취소할 승인 유형</InputLabel>
                  <Select
                    value={cancelData.approvalType}
                    label="취소할 승인 유형"
                    onChange={(e) => handleInputChange('approvalType', e.target.value)}
                  >
                    {(userRole === 'SS' || userRole === 'S') && (
                      <MenuItem value="total">총괄 승인</MenuItem>
                    )}
                    {(userRole === 'SS' || userRole === 'S') && (
                      <MenuItem value="settlement">정산팀 승인</MenuItem>
                    )}
                    {(userRole === 'AA' || userRole === 'BB' || userRole === 'CC' || 
                      userRole === 'DD' || userRole === 'EE' || userRole === 'FF') && (
                      <MenuItem value="team">소속팀 승인</MenuItem>
                    )}
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="취소 사유"
                value={cancelData.cancelReason}
                onChange={(e) => handleInputChange('cancelReason', e.target.value)}
                placeholder={`${cancelType === 'policy' ? '정책' : '승인'} 취소 사유를 입력하세요`}
                required
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="error"
        >
          {cancelType === 'policy' ? '정책 취소' : '승인 취소'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PolicyCancelModal; 