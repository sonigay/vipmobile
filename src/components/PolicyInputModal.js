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
  loggedInUser,
  teams = [], // 소속정책팀 목록 추가
  policy // 수정할 정책 데이터 추가
}) {
  const [formData, setFormData] = useState({
    policyName: '',
    policyStartDate: new Date(),
    policyEndDate: new Date(),
    policyStore: '',
    policyContent: '',
    policyAmount: '',
    amountType: 'total', // 'total', 'per_case', 'in_content'
    team: '', // 소속정책팀 추가
    storeType: 'single', // 'single' 또는 'multiple'
    multipleStores: [], // 복수점 선택 시 매장 목록
    multipleStoreName: '', // 복수점명 (수기 입력)
    // 구두정책 전용 필드
    activationType: {
      new010: false,    // 010신규
      mnp: false,       // MNP
      change: false     // 기변
    },
    // 95군 이상/미만 금액 입력
    amount95Above: '',     // 95군 이상 금액
    amount95Below: '',     // 95군 미만 금액
    isDirectInput: false   // 직접입력 여부
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 카테고리 정보
  const categoryName = CATEGORY_NAMES[categoryId] || '정책';
  const isWireless = categoryId?.startsWith('wireless');

  useEffect(() => {
    if (open) {
      if (policy) {
        // 수정 모드: 기존 정책 데이터로 폼 초기화
        setFormData({
          policyName: policy.policyName || '',
          policyStartDate: policy.policyStartDate ? new Date(policy.policyStartDate) : new Date(),
          policyEndDate: policy.policyEndDate ? new Date(policy.policyEndDate) : new Date(),
          policyStore: policy.policyStore || '',
          policyContent: policy.policyContent || '',
          policyAmount: policy.policyAmount ? String(policy.policyAmount) : '',
          amountType: policy.amountType || 'total',
          team: policy.team || loggedInUser?.userRole || '',
          storeType: 'single',
          multipleStores: [],
          multipleStoreName: '',
          activationType: {
            new010: false,
            mnp: false,
            change: false
          },
          amount95Above: '',
          amount95Below: '',
          isDirectInput: false
        });
      } else {
        // 새 정책 생성 모드: 빈 폼으로 초기화
        setFormData({
          policyName: '',
          policyStartDate: new Date(),
          policyEndDate: new Date(),
          policyStore: '',
          policyContent: '',
          policyAmount: '',
          amountType: 'total',
          team: loggedInUser?.userRole || '', // 현재 사용자의 소속팀으로 기본 설정
          storeType: 'single',
          multipleStores: [],
          multipleStoreName: '',
          activationType: {
            new010: false,
            mnp: false,
            change: false
          },
          amount95Above: '',
          amount95Below: '',
          isDirectInput: false
        });
      }
      setErrors({});
    }
  }, [open, loggedInUser, policy]);

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
    
    if (formData.storeType === 'single' && !formData.policyStore) {
      newErrors.policyStore = '정책적용점을 선택해주세요.';
    }
    
    if (formData.storeType === 'multiple' && formData.multipleStores.length === 0) {
      newErrors.multipleStores = '적용점을 최소 1개 이상 선택해주세요.';
    }
    
    if (formData.storeType === 'multiple' && !formData.multipleStoreName.trim()) {
      newErrors.multipleStoreName = '복수점명을 입력해주세요.';
    }
    
    // 구두정책 개통유형 검사
    if (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe') {
      const hasAnyActivationType = formData.activationType.new010 || formData.activationType.mnp || formData.activationType.change;
      if (!hasAnyActivationType) {
        newErrors.activationType = '개통유형을 최소 1개 이상 선택해주세요.';
      }
      
      // 95군 이상/미만 금액 검사
      if (!formData.isDirectInput) {
        if (!formData.amount95Above.trim()) {
          newErrors.amount95Above = '95군 이상 금액을 입력해주세요.';
        }
        if (!formData.amount95Below.trim()) {
          newErrors.amount95Below = '95군 미만 금액을 입력해주세요.';
        }
      }
    }
    
    if (!formData.policyContent.trim()) {
      newErrors.policyContent = '정책내용을 입력해주세요.';
    }
    
    // 금액 입력 방식에 따른 검증
    if (formData.amountType !== 'in_content') {
      if (!formData.policyAmount.trim()) {
        newErrors.policyAmount = '금액을 입력해주세요.';
      } else if (isNaN(Number(formData.policyAmount))) {
        newErrors.policyAmount = '올바른 금액을 입력해주세요.';
      }
    }
    
    if (!formData.amountType) {
      newErrors.amountType = '금액 유형을 선택해주세요.';
    }
    
    if (!formData.team) {
      newErrors.team = '소속정책팀을 선택해주세요.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      // 구체적인 에러 메시지 표시
      const errorFields = Object.keys(errors);
      if (errorFields.length > 0) {
        const fieldNames = {
          policyName: '정책명',
          policyStartDate: '정책 시작일',
          policyEndDate: '정책 종료일',
          policyStore: '정책적용점',
          policyContent: '정책내용',
          policyAmount: '금액',
          amountType: '금액 유형',
          team: '소속정책팀'
        };
        const errorFieldNames = errorFields.map(field => fieldNames[field] || field).join(', ');
        setErrors({ submit: `다음 필수 입력란을 확인해주세요: [${errorFieldNames}]` });
      }
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (policy) {
        // 수정 모드
        const updateData = {
          policyName: formData.policyName.trim(),
          policyStartDate: formData.policyStartDate,
          policyEndDate: formData.policyEndDate,
          policyStore: formData.policyStore,
          policyContent: formData.policyContent.trim(),
          policyAmount: formData.amountType === 'in_content' ? '' : Number(formData.policyAmount),
          amountType: formData.amountType,
          policyType: isWireless ? '무선' : '유선',
          category: categoryId,
          yearMonth: yearMonth,
          team: formData.team,
          inputUserId: loggedInUser?.contactId || loggedInUser?.id,
          inputUserName: loggedInUser?.target || loggedInUser?.name,
          modifiedBy: loggedInUser?.contactId || loggedInUser?.id,
          modifiedByName: loggedInUser?.target || loggedInUser?.name,
          modifiedAt: new Date().toISOString()
        };

        await onSave(policy.id, updateData);
      } else {
        // 새 정책 생성 모드
        if (formData.storeType === 'single') {
          // 단일점 선택
          const policyData = {
            id: `POL_${Date.now()}`, // 임시 ID 생성
            policyName: formData.policyName.trim(),
            policyStartDate: formData.policyStartDate,
            policyEndDate: formData.policyEndDate,
            policyStore: formData.policyStore,
            policyContent: formData.policyContent.trim(),
            policyAmount: formData.amountType === 'in_content' ? '' : Number(formData.policyAmount),
            amountType: formData.amountType,
            policyType: isWireless ? '무선' : '유선',
            category: categoryId,
            yearMonth: yearMonth,
            inputUserId: loggedInUser?.contactId || loggedInUser?.id,
            inputUserName: loggedInUser?.target || loggedInUser?.name,
            inputDateTime: new Date().toISOString(),
            approvalStatus: {
              total: '대기',
              settlement: '대기',
              team: '대기'
            },
            team: formData.team, // 소속정책팀 추가
            activationType: formData.activationType // 개통유형
          };

          await onSave(policyData);
        } else {
          // 복수점 선택 - 각 매장별로 개별 정책 생성
          const policies = formData.multipleStores.map((store, index) => ({
            id: `POL_${Date.now()}_${index}`, // 임시 ID 생성
            policyName: formData.policyName.trim(),
            policyStartDate: formData.policyStartDate,
            policyEndDate: formData.policyEndDate,
            policyStore: store.id,
            policyContent: formData.policyContent.trim(),
            policyAmount: formData.amountType === 'in_content' ? '' : Number(formData.policyAmount),
            amountType: formData.amountType,
            policyType: isWireless ? '무선' : '유선',
            category: categoryId,
            yearMonth: yearMonth,
            inputUserId: loggedInUser?.contactId || loggedInUser?.id,
            inputUserName: loggedInUser?.target || loggedInUser?.name,
            inputDateTime: new Date().toISOString(),
            approvalStatus: {
              total: '대기',
              settlement: '대기',
              team: '대기'
            },
            team: formData.team,
            isMultiple: true, // 복수점 정책임을 표시
            multipleStoreName: formData.multipleStoreName, // 사용자가 입력한 복수점명
            activationType: formData.activationType // 개통유형
          }));

          // 각 정책을 순차적으로 저장
          for (const policyData of policies) {
            await onSave(policyData);
          }
        }
      }
      
      onClose();
    } catch (error) {
      console.error('정책 저장 실패:', error);
      
      // 서버에서 받은 에러 메시지가 있으면 사용, 없으면 기본 메시지
      let errorMessage = '정책 저장에 실패했습니다. 다시 시도해주세요.';
      
      if (error.message) {
        // HTTP 에러 응답에서 메시지 추출
        try {
          if (error.message.includes('HTTP error! status: 400')) {
            // 서버 응답에서 누락된 필드 정보 추출 시도
            if (error.response && error.response.data && error.response.data.received) {
              const received = error.response.data.received;
              const missingFields = [];
              
              // 필드명 매핑
              const fieldNames = {
                policyName: '정책명',
                policyStartDate: '정책 시작일',
                policyEndDate: '정책 종료일',
                policyStore: '정책적용점',
                policyContent: '정책내용',
                policyAmount: '금액',
                amountType: '금액 유형',
                team: '소속정책팀'
              };
              
              // 누락된 필드 확인
              Object.keys(fieldNames).forEach(field => {
                if (!received[field] || received[field] === '') {
                  missingFields.push(fieldNames[field]);
                }
              });
              
              if (missingFields.length > 0) {
                errorMessage = `다음 필수 입력란을 확인해주세요: [${missingFields.join(', ')}]`;
              } else {
                errorMessage = '입력 정보를 확인해주세요. 필수 항목이 누락되었거나 형식이 올바르지 않습니다.';
              }
            } else {
              errorMessage = '입력 정보를 확인해주세요. 필수 항목이 누락되었거나 형식이 올바르지 않습니다.';
            }
          } else if (error.message.includes('HTTP error! status: 404')) {
            errorMessage = '정책을 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.';
          } else if (error.message.includes('HTTP error! status: 500')) {
            errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
          } else {
            errorMessage = error.message;
          }
        } catch (parseError) {
          // 파싱 실패 시 기본 메시지 사용
          errorMessage = '정책 저장에 실패했습니다. 다시 시도해주세요.';
        }
      }
      
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    // 숫자 필드에 대한 유효성 검사
    if (field === 'policyAmount' && value !== '') {
      // 숫자가 아닌 문자 제거 (소수점과 음수 부호는 허용)
      const numericValue = value.toString().replace(/[^\d.-]/g, '');
      if (numericValue !== value) {
        value = numericValue;
      }
    }
    
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
            {policy ? `${categoryName} 수정` : `${categoryName} 추가`}
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
        
        {/* 수정 모드일 때 현재 승인 상태 표시 */}
        {policy && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>현재 승인 상태:</strong><br />
              총괄: {policy.approvalStatus?.total || '대기'} | 
              정산팀: {policy.approvalStatus?.settlement || '대기'} | 
              소속팀: {policy.approvalStatus?.team || '대기'}<br />
              <em>참고: 정책 수정 후 승인 상태는 변경되지 않습니다.</em>
            </Typography>
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
          
          {/* 적용점 타입 선택 */}
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <Typography variant="subtitle2" gutterBottom>
                적용점 선택 방식
              </Typography>
              <RadioGroup
                row
                value={formData.storeType}
                onChange={(e) => {
                  handleInputChange('storeType', e.target.value);
                  // 타입 변경 시 기존 선택 초기화
                  if (e.target.value === 'single') {
                    handleInputChange('multipleStores', []);
                  } else {
                    handleInputChange('policyStore', '');
                  }
                }}
              >
                <FormControlLabel value="single" control={<Radio />} label="단일점" />
                <FormControlLabel value="multiple" control={<Radio />} label="복수점" />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* 단일점 선택 */}
          {formData.storeType === 'single' && (
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
          )}

          {/* 복수점 선택 */}
          {formData.storeType === 'multiple' && (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="복수점명"
                  value={formData.multipleStoreName}
                  onChange={(e) => handleInputChange('multipleStoreName', e.target.value)}
                  error={!!errors.multipleStoreName}
                  helperText={errors.multipleStoreName || '복수점의 이름을 입력해주세요. (예: 서울지역, 강남구 등)'}
                  required
                  placeholder="예: 서울지역, 강남구, A그룹 등"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    적용점 선택 (복수 선택 가능)
                  </Typography>
                  <Autocomplete
                    multiple
                    options={stores}
                    getOptionLabel={(option) => option.name}
                    value={formData.multipleStores}
                    onChange={(event, newValue) => {
                      handleInputChange('multipleStores', newValue);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="정책적용점들"
                        error={!!errors.multipleStores}
                        helperText={errors.multipleStores || '여러 매장을 선택할 수 있습니다.'}
                        required
                      />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          variant="outlined"
                          label={option.name}
                          {...getTagProps({ index })}
                          key={option.id}
                        />
                      ))
                    }
                    filterOptions={(options, { inputValue }) => {
                      return options.filter((option) =>
                        option.name.toLowerCase().includes(inputValue.toLowerCase())
                      );
                    }}
                  />
                </Box>
              </Grid>
            </>
          )}
          
          {/* 구두정책 전용: 개통유형 선택 */}
          {categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' ? (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                개통유형 *
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.activationType.new010}
                      onChange={(e) => {
                        const newActivationType = {
                          ...formData.activationType,
                          new010: e.target.checked
                        };
                        handleInputChange('activationType', newActivationType);
                      }}
                    />
                  }
                  label="010신규"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.activationType.mnp}
                      onChange={(e) => {
                        const newActivationType = {
                          ...formData.activationType,
                          mnp: e.target.checked
                        };
                        handleInputChange('activationType', newActivationType);
                      }}
                    />
                  }
                  label="MNP"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.activationType.change}
                      onChange={(e) => {
                        const newActivationType = {
                          ...formData.activationType,
                          change: e.target.checked
                        };
                        handleInputChange('activationType', newActivationType);
                      }}
                    />
                  }
                  label="기변"
                />
              </Box>
              {errors.activationType && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {errors.activationType}
                </Typography>
              )}
            </Grid>
          ) : null}

          {/* 구두정책 전용: 95군 이상/미만 금액 입력 */}
          {categoryId === 'wireless_shoe' || categoryId === 'wired_shoe' ? (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                금액 설정 *
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 80 }}>95군이상</Typography>
                  <TextField
                    size="small"
                    value={formData.amount95Above}
                    onChange={(e) => handleInputChange('amount95Above', e.target.value)}
                    placeholder="금액 입력"
                    type="number"
                    sx={{ width: 120 }}
                    inputProps={{ min: 0 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ minWidth: 80 }}>95군미만</Typography>
                  <TextField
                    size="small"
                    value={formData.amount95Below}
                    onChange={(e) => handleInputChange('amount95Below', e.target.value)}
                    placeholder="금액 입력"
                    type="number"
                    sx={{ width: 120 }}
                    inputProps={{ min: 0 }}
                  />
                </Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isDirectInput}
                      onChange={(e) => handleInputChange('isDirectInput', e.target.checked)}
                    />
                  }
                  label="직접입력"
                />
              </Box>
              {errors.amount95Above && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {errors.amount95Above}
                </Typography>
              )}
              {errors.amount95Below && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {errors.amount95Below}
                </Typography>
              )}
            </Grid>
          ) : null}

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="정책내용"
              value={formData.policyContent}
              onChange={(e) => handleInputChange('policyContent', e.target.value)}
              error={!!errors.policyContent}
              helperText={
                (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe') 
                  ? (formData.isDirectInput ? '직접입력 모드: 정책 내용을 입력해주세요.' : '95군 이상/미만 금액을 입력하면 자동으로 내용이 생성됩니다.')
                  : errors.policyContent
              }
              multiline
              rows={4}
              required
              disabled={
                (categoryId === 'wireless_shoe' || categoryId === 'wired_shoe') 
                  ? !formData.isDirectInput 
                  : false
              }
            />
          </Grid>
          
          {/* 구두정책이 아닌 경우에만 금액 입력 필드 표시 */}
          {!(categoryId === 'wireless_shoe' || categoryId === 'wired_shoe') && (
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
                disabled={formData.amountType === 'in_content'}
                required={formData.amountType !== 'in_content'}
              />
            </Grid>
          )}
          
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
                <FormControlLabel
                  value="in_content"
                  control={<Radio />}
                  label="내용에 직접입력"
                />
              </RadioGroup>
              {errors.amountType && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.amountType}
                </Typography>
              )}
            </FormControl>
          </Grid>

          {/* 소속정책팀 선택 */}
          <Grid item xs={12} sm={6}>
            <Autocomplete
              options={teams}
              getOptionLabel={(option) => option.name}
              value={teams.find(team => team.code === formData.team) || null}
              onChange={(event, newValue) => {
                handleInputChange('team', newValue ? newValue.code : '');
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="소속정책팀 *"
                  error={!!errors.team}
                  helperText={errors.team}
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
          {isSubmitting ? (policy ? '수정 중...' : '저장 중...') : (policy ? '수정' : '저장')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PolicyInputModal; 