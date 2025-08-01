import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Chip
} from '@mui/material';

const PolicyApprovalModal = ({ 
  open, 
  onClose, 
  policy, 
  onApprovalSubmit,
  userRole 
}) => {
  const [approvalData, setApprovalData] = useState({
    total: '대기',
    settlement: '대기',
    team: '대기',
    comment: ''
  });

  const handleApprovalChange = (field, value) => {
    setApprovalData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    onApprovalSubmit({
      policyId: policy.id,
      approvalData,
      userRole
    });
  };

  if (!policy) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        정책 승인 - {policy.policyName}
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
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip 
              label={`총괄: ${policy.approvalStatus?.total || '대기'}`}
              color={policy.approvalStatus?.total === '승인' ? 'success' : 'default'}
            />
            <Chip 
              label={`정산팀: ${policy.approvalStatus?.settlement || '대기'}`}
              color={policy.approvalStatus?.settlement === '승인' ? 'success' : 'default'}
            />
            <Chip 
              label={`소속팀: ${policy.approvalStatus?.team || '대기'}`}
              color={policy.approvalStatus?.team === '승인' ? 'default' : 'default'}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            승인 처리
          </Typography>
          <Grid container spacing={2}>
            {/* 권한에 따른 승인 필드 표시 */}
            {(userRole === 'SS' || userRole === 'S') && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>총괄 승인</InputLabel>
                  <Select
                    value={approvalData.total}
                    label="총괄 승인"
                    onChange={(e) => handleApprovalChange('total', e.target.value)}
                  >
                    <MenuItem value="대기">대기</MenuItem>
                    <MenuItem value="승인">승인</MenuItem>
                    <MenuItem value="반려">반려</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            {(userRole === 'SS' || userRole === 'S') && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>정산팀 승인</InputLabel>
                  <Select
                    value={approvalData.settlement}
                    label="정산팀 승인"
                    onChange={(e) => handleApprovalChange('settlement', e.target.value)}
                  >
                    <MenuItem value="대기">대기</MenuItem>
                    <MenuItem value="승인">승인</MenuItem>
                    <MenuItem value="반려">반려</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            {(userRole === 'SS' || userRole === 'AA' || userRole === 'BB' || userRole === 'CC' || 
              userRole === 'DD' || userRole === 'EE' || userRole === 'FF') && (
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>소속팀 승인</InputLabel>
                  <Select
                    value={approvalData.team}
                    label="소속팀 승인"
                    onChange={(e) => handleApprovalChange('team', e.target.value)}
                  >
                    <MenuItem value="대기">대기</MenuItem>
                    <MenuItem value="승인">승인</MenuItem>
                    <MenuItem value="반려">반려</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="승인 코멘트"
                value={approvalData.comment}
                onChange={(e) => handleApprovalChange('comment', e.target.value)}
                placeholder="승인 또는 반려 사유를 입력하세요"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          승인 처리
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PolicyApprovalModal; 