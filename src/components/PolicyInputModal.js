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
  Alert,
  FormControlLabel,
  Radio,
  RadioGroup
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { Autocomplete } from '@mui/material';

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
    policyStartDate: new Date(),
    policyEndDate: new Date(),
    policyStore: '',
    policyContent: '',
    policyAmount: '',
    amountType: 'total' // 'total' 또는 'per_case'
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
        policyStartDate: new Date(),
        policyEndDate: new Date(),
        policyStore: '',
        policyContent: '',
        policyAmount: '',
        amountType: 'total'
      });
      setErrors({});
    }
  }, [open]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.policyName.trim()) {
      newErrors.policyName = '정책명을 입력해주세요.';
    }
    
    if (!formData.policyStartDate) {
      newErrors.policyStartDate = '정책 시작일을 선택해주세요.';
    }
    
    if (!formData.policyEndDate) {
      newErrors.policyEndDate = '정책 종료일을 선택해주세요.';
    }
    
    if (formData.policyStartDate && formData.policyEndDate && 
        formData.policyStartDate > formData.policyEndDate) {
      newErrors.policyEndDate = '종료일은 시작일보다 늦어야 합니다.';
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
    
    if (!formData.amountType) {
      newErrors.amountType = '금액 유형을 선택해주세요.';
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
        policyStartDate: formData.policyStartDate,
        policyEndDate: formData.policyEndDate,
        policyStore: formData.policyStore,
        policyContent: formData.policyContent.trim(),
        policyAmount: Number(formData.policyAmount),
        amountType: formData.amountType,
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
                label="정책 시작일"
                value={formData.policyStartDate}
                onChange={(date) => handleInputChange('policyStartDate', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.policyStartDate,
                    helperText: errors.policyStartDate,
                    required: true
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
              <DatePicker
                label="정책 종료일"
                value={formData.policyEndDate}
                onChange={(date) => handleInputChange('policyEndDate', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    error: !!errors.policyEndDate,
                    helperText: errors.policyEndDate,
                    required: true
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12}>
            <Autocomplete
              options={stores}
              getOptionLabel={(option) => option.name}
              value={stores.find(store => store.id === formData.policyStore) || null}
              onChange={(event, newValue) => {
                handleInputChange('policyStore', newValue ? newValue.id : '');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="정책적용점"
                  error={!!errors.policyStore}
                  helperText={errors.policyStore}
                  required
                />
              )}
              filterOptions={(options, { inputValue }) => {
                return options.filter((option) =>
                  option.name.toLowerCase().includes(inputValue.toLowerCase())
                );
              }}
            />
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
            <FormControl component="fieldset" error={!!errors.amountType}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                금액 유형 *
              </Typography>
              <RadioGroup
                row
                value={formData.amountType}
                onChange={(e) => handleInputChange('amountType', e.target.value)}
              >
                <FormControlLabel
                  value="total"
                  control={<Radio />}
                  label="총금액"
                />
                <FormControlLabel
                  value="per_case"
                  control={<Radio />}
                  label="건당금액"
                />
              </RadioGroup>
              {errors.amountType && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.amountType}
                </Typography>
              )}
            </FormControl>
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