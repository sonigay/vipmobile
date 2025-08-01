import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Box,
  Chip,
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';

// 정책 카테고리 매핑
const CATEGORY_NAMES = {
  'wireless_shoe': '구두정책',
  'wireless_union': '연합정책',
  'wireless_rate': '요금제유형별정책',
  'wireless_add_support': '부가추가지원정책',
  'wireless_add_deduct': '부가차감지원정책',
  'wireless_grade': '그레이드정책',
  'wireless_individual': '개별소급정책',
  'wired_shoe': '구두정책',
  'wired_union': '연합정책',
  'wired_rate': '요금제유형별정책',
  'wired_add_support': '부가추가지원정책',
  'wired_add_deduct': '부가차감지원정책',
  'wired_grade': '그레이드정책',
  'wired_individual': '개별소급정책'
};

function PolicyInputModal({ 
  open, 
  onClose, 
  categoryId, 
  yearMonth, 
  stores = [], 
  onSave,
  loggedInUser 
}) {
  const [formData, setFormData] = useState({
    policyName: '',
    policyDate: new Date(),
    policyStore: '',
    policyContent: '',
    policyAmount: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 카테고리 정보
  const categoryName = CATEGORY_NAMES[categoryId] || '정책';
  const isWireless = categoryId?.startsWith('wireless');

  useEffect(() => {
    if (open) {
      // 모달이 열릴 때 폼 초기화
      setFormData({
        policyName: '',
        policyDate: new Date(),
        policyStore: '',
        policyContent: '',
        policyAmount: ''
      });
      setErrors({});
    }
  }, [open]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.policyName.trim()) {
      newErrors.policyName = '정책명을 입력해주세요.';
    }
    
    if (!formData.policyDate) {
      newErrors.policyDate = '정책적용일을 선택해주세요.';
    }
    
    if (!formData.policyStore) {
      newErrors.policyStore = '정책적용점을 선택해주세요.';
    }
    
    if (!formData.policyContent.trim()) {
      newErrors.policyContent = '정책내용을 입력해주세요.';
    }
    
    if (!formData.policyAmount.trim()) {
      newErrors.policyAmount = '금액을 입력해주세요.';
    } else if (isNaN(Number(formData.policyAmount))) {
      newErrors.policyAmount = '올바른 금액을 입력해주세요.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const policyData = {
        id: `POL_${Date.now()}`, // 임시 ID 생성
        policyName: formData.policyName.trim(),
        policyDate: formData.policyDate,
        policyStore: formData.policyStore,
        policyContent: formData.policyContent.trim(),
        policyAmount: Number(formData.policyAmount),
        policyType: isWireless ? '무선' : '유선',
        category: categoryId,
        yearMonth: yearMonth,
        inputUserId: loggedInUser?.id || '',
        inputUserName: loggedInUser?.name || '',
        inputDateTime: new Date().toISOString(),
        approvalStatus: {
          total: '대기',
          settlement: '대기',
          team: '대기'
        }
      };

      await onSave(policyData);
      onClose();
    } catch (error) {
      console.error('정책 저장 실패:', error);
      setErrors({ submit: '정책 저장에 실패했습니다. 다시 시도해주세요.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 에러 메시지 제거
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">
            {categoryName} 추가
          </Typography>
          <Chip 
            label={isWireless ? '무선' : '유선'} 
            color={isWireless ? 'primary' : 'secondary'}
            size="small"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {errors.submit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.submit}
          </Alert>
        )}
        
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="정책명"
              value={formData.policyName}
              onChange={(e) => handleInputChange('policyName', e.target.value)}
              error={!!errors.policyName}
              helperText={errors.policyName}
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <DatePicker
                label="정책적용일"
                value={formData.policyDate}
                onChange={(date) => handleInputChange('policyDate', date)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    error={!!errors.policyDate}
                    helperText={errors.policyDate}
                    required
                  />
                )}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.policyStore} required>
              <InputLabel>정책적용점</InputLabel>
              <Select
                value={formData.policyStore}
                label="정책적용점"
                onChange={(e) => handleInputChange('policyStore', e.target.value)}
              >
                {stores.map((store) => (
                  <MenuItem key={store.id} value={store.id}>
                    {store.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.policyStore && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                  {errors.policyStore}
                </Typography>
              )}
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="정책내용"
              value={formData.policyContent}
              onChange={(e) => handleInputChange('policyContent', e.target.value)}
              error={!!errors.policyContent}
              helperText={errors.policyContent}
              multiline
              rows={4}
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="금액 (원)"
              value={formData.policyAmount}
              onChange={(e) => handleInputChange('policyAmount', e.target.value)}
              error={!!errors.policyAmount}
              helperText={errors.policyAmount}
              type="number"
              inputProps={{ min: 0 }}
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="대상년월"
              value={yearMonth}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={isSubmitting}>
          취소
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PolicyInputModal; 