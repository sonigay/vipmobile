import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControlLabel,
  Checkbox,
  Grid,
  Chip,
  Alert
} from '@mui/material';

const SettlementReflectModal = ({ 
  open, 
  onClose, 
  policy, 
  onReflectSubmit,
  userRole 
}) => {
  const [isReflected, setIsReflected] = useState(false);

  const handleSubmit = () => {
    onReflectSubmit({
      policyId: policy.id,
      isReflected
    });
  };

  const handleClose = () => {
    setIsReflected(false);
    onClose();
  };

  if (!policy) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        정산 반영 처리 - {policy.policyName}
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

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            현재 승인 상태
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Chip 
                label={`총괄: ${policy.approvalStatus?.total || '대기'}`}
                color={policy.approvalStatus?.total === '승인' ? 'success' : 'default'}
                size="small"
              />
            </Grid>
            <Grid item xs={4}>
              <Chip 
                label={`정산팀: ${policy.approvalStatus?.settlement || '대기'}`}
                color={policy.approvalStatus?.settlement === '승인' ? 'success' : 'default'}
                size="small"
              />
            </Grid>
            <Grid item xs={4}>
              <Chip 
                label={`소속팀: ${policy.approvalStatus?.team || '대기'}`}
                color={policy.approvalStatus?.team === '승인' ? 'success' : 'default'}
                size="small"
              />
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            현재 정산 반영 상태
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={6}>
              <Chip 
                label={`상태: ${policy.settlementStatus || '미반영'}`}
                color={policy.settlementStatus === '반영됨' ? 'success' : 'default'}
                variant="outlined"
              />
            </Grid>
            {policy.settlementUserName && (
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  반영자: {policy.settlementUserName}
                </Typography>
              </Grid>
            )}
            {policy.settlementDateTime && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  반영일시: {new Date(policy.settlementDateTime).toLocaleString()}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            정산 반영 처리
          </Typography>
          
          {policy.settlementStatus === '반영됨' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              이미 정산에 반영된 정책입니다. 중복 반영을 주의하세요.
            </Alert>
          )}
          
          <FormControlLabel
            control={
              <Checkbox
                checked={isReflected}
                onChange={(e) => setIsReflected(e.target.checked)}
                color="primary"
              />
            }
            label="정산에 반영 처리"
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            체크하면 정산에 반영된 것으로 처리됩니다.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
        >
          정산 반영 처리
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SettlementReflectModal; 